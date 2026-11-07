import { useMemo, useRef, useState } from 'react';
import { Image as ImageIcon } from 'lucide-react';
import { showToast } from '../utils/toast';
import { ANIO_INFORME, MESES_INFORME, ordenarCategorias } from '../utils/informeDeuda';
import { obtenerPorcentajeBeca } from '../utils/beca';

// Tesorería → Informes → "Cierre de mes": resumen de un mes para la
// directiva (recaudado por las cuotas de ese mes, por validar, deuda
// acumulada, estado por categoría y becas), descargable como imagen.

const NOMBRES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const pesos = (n) => `$${Math.round(Number(n) || 0).toLocaleString('es-CL')}`;
const sinTildes = (t = '') => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const mesDelPago = (p) => {
  const texto = sinTildes(p.meses_correspondientes);
  const idx = NOMBRES.findIndex((n) => texto.startsWith(n.slice(0, 3)));
  const anio = Number((texto.match(/(20\d{2})/) || [])[1]) || ANIO_INFORME;
  return anio === ANIO_INFORME && idx >= 0 ? idx + 1 : null;
};

export default function CierreMesPanel({ pagos = [], filasDeportistas = [], filasSocios = [], jugadores = [] }) {
  const mesPorDefecto = Math.max(1, new Date().getFullYear() === ANIO_INFORME ? new Date().getMonth() : 12);
  const [mes, setMes] = useState(mesPorDefecto);
  const [exportando, setExportando] = useState(false);
  const ref = useRef(null);
  const idx = mes - 1;

  const datos = useMemo(() => {
    const delMes = pagos.filter((p) => mesDelPago(p) === mes);
    const aprobados = delMes.filter((p) => ['aprobado', 'validado'].includes(String(p.estado_pago || '').toLowerCase()));
    const esSocio = (p) => sinTildes(p.concepto_pago).startsWith('mensualidad socio');
    const recSocios = aprobados.filter(esSocio).reduce((s, p) => s + (Number(p.monto_total_pagado) || 0), 0);
    const recDep = aprobados.filter((p) => !esSocio(p)).reduce((s, p) => s + (Number(p.monto_total_pagado) || 0), 0);
    const porValidar = delMes.filter((p) => String(p.estado_pago || '').toLowerCase() === 'pendiente');
    const debeEnMes = (f) => ['debe', 'parcial'].includes(f.estados[idx]);
    const correspondeEnMes = (f) => !['no-aplica', 'futuro'].includes(f.estados[idx]);
    const categorias = new Map();
    filasDeportistas.forEach((f) => {
      if (!categorias.has(f.categoria)) categorias.set(f.categoria, { total: 0, deben: 0, corresponde: 0 });
      const c = categorias.get(f.categoria);
      c.total += 1;
      if (correspondeEnMes(f)) c.corresponde += 1;
      if (debeEnMes(f)) c.deben += 1;
    });
    return {
      recSocios,
      recDep,
      porValidar: porValidar.length,
      montoPorValidar: porValidar.reduce((s, p) => s + (Number(p.monto_total_pagado) || 0), 0),
      condonados: aprobados.filter((p) => Number(p.monto_total_pagado) === 0).length,
      deudaAcumulada: [...filasDeportistas, ...filasSocios].reduce((s, f) => s + f.montoDeuda, 0),
      categorias: [...categorias.entries()].sort(([a], [b]) => ordenarCategorias(a, b)),
      sociosDeben: filasSocios.filter(debeEnMes).length,
      sociosCorresponde: filasSocios.filter(correspondeEnMes).length,
      becados: jugadores.filter((j) => obtenerPorcentajeBeca(j) > 0 && obtenerPorcentajeBeca(j) < 100).length,
      becaCompleta: jugadores.filter((j) => obtenerPorcentajeBeca(j) >= 100 || j.exento_mensualidad).length,
    };
  }, [pagos, mes, idx, filasDeportistas, filasSocios, jugadores]);

  const descargar = async () => {
    if (!ref.current) return;
    setExportando(true);
    ref.current.classList.add('id-exportando');
    try {
      const { default: html2canvas } = await import('html2canvas');
      const canvas = await html2canvas(ref.current, { backgroundColor: '#ffffff', scale: 2 });
      canvas.toBlob((blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `cierre-${NOMBRES[idx]}-${ANIO_INFORME}.png`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }, 'image/png');
    } catch (error) {
      showToast({ message: `No se pudo generar la imagen: ${error.message}`, type: 'error' });
    } finally {
      ref.current?.classList.remove('id-exportando');
      setExportando(false);
    }
  };

  return (
    <div className="fade-in">
      <div className="id-acciones">
        <select className="form-input cm-mes" aria-label="Mes del cierre" value={mes} onChange={(e) => setMes(Number(e.target.value))}>
          {MESES_INFORME.map((m, i) => <option key={m} value={i + 1}>{NOMBRES[i].charAt(0).toUpperCase() + NOMBRES[i].slice(1)} {ANIO_INFORME}</option>)}
        </select>
        <button type="button" className="btn-electric tc-btn" onClick={descargar} disabled={exportando}>
          <ImageIcon size={13} /> {exportando ? 'Generando…' : 'Descargar imagen'}
        </button>
      </div>
      <div className="id-scroll">
        <div ref={ref} className="id-informe cm-informe">
          <header className="id-cabecera">
            <div>
              <h3>Cierre de {NOMBRES[idx]} {ANIO_INFORME}</h3>
              <p>Centro de Cultura Física · emitido el {new Date().toLocaleDateString('es-CL')}</p>
            </div>
          </header>
          <div className="cm-kpis">
            <div><span>Recaudado por cuotas del mes</span><strong>{pesos(datos.recSocios + datos.recDep)}</strong><small>Socios {pesos(datos.recSocios)} · Deportistas {pesos(datos.recDep)}</small></div>
            <div><span>Comprobantes por validar</span><strong>{datos.porValidar}</strong><small>{pesos(datos.montoPorValidar)}</small></div>
            <div><span>Deuda acumulada a hoy</span><strong>{pesos(datos.deudaAcumulada)}</strong><small>Todos los meses vencidos</small></div>
            <div><span>Socios que deben el mes</span><strong>{datos.sociosDeben} de {datos.sociosCorresponde}</strong><small>{datos.condonados ? `${datos.condonados} meses condonados` : 'Sin condonaciones'}</small></div>
          </div>
          <table className="id-tabla cm-tabla">
            <thead>
              <tr><th className="id-nombre">Categoría</th><th className="id-num">Deportistas</th><th className="id-num">Les corresponde pagar</th><th className="id-num">Deben el mes</th><th className="id-num">% al día</th></tr>
            </thead>
            <tbody>
              {datos.categorias.map(([cat, c]) => (
                <tr key={cat}>
                  <th scope="row" className="id-nombre">{cat}</th>
                  <td className="id-num">{c.total}</td>
                  <td className="id-num">{c.corresponde}</td>
                  <td className={`id-num ${c.deben ? 'id-monto' : ''}`}>{c.deben}</td>
                  <td className="id-num">{c.corresponde ? `${Math.round(((c.corresponde - c.deben) / c.corresponde) * 100)}%` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="cm-pie">Becas: {datos.becados} parciales · {datos.becaCompleta} completas o exentos. “Recaudado” suma los pagos aprobados que corresponden a las cuotas de este mes.</p>
        </div>
      </div>
    </div>
  );
}
