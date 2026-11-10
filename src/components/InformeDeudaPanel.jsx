import { useMemo, useRef, useState } from 'react';
import { Download, FileText, Image as ImageIcon, Search, X } from 'lucide-react';
import { showToast } from '../utils/toast';
import CierreMesPanel from './CierreMesPanel';
import { hoyLocalISO } from '../utils/fechas';
import {
  ANIO_INFORME, ETIQUETA_ESTADO, MESES_INFORME, agruparPorCategoria, construirInformeDeportistas, construirInformeSocios,
  filtrarInforme, ordenarCategorias,
} from '../utils/informeDeuda';

// Tesorería → Informes: meses que adeuda cada deportista (por categoría) y
// cada socio, con filtros y descarga de lo filtrado como imagen (PNG) o
// planilla (CSV).

const pesos = (n) => `$${Math.round(Number(n) || 0).toLocaleString('es-CL')}`;
const SIMBOLO = { condonado: 'C', pagado: '✓', debe: '✕', parcial: '½', exento: 'B', 'no-aplica': '–', 'en-curso': '·', futuro: '' };
const FILTROS_INICIALES = { texto: '', rama: 'todas', categoria: 'todas', estado: 'con_deuda', mes: 'todos' };

function FilaPersona({ f }) {
  return (
    <tr>
      <th scope="row" className="id-nombre">
        {f.nombre}
        {f.beca > 0 && f.beca < 100 && <span className="id-beca"> beca {f.beca}%</span>}
      </th>
      {f.estados.map((e, i) => (
        <td key={MESES_INFORME[i]} className={`id-celda id-${e}`} title={`${MESES_INFORME[i]}: ${ETIQUETA_ESTADO[e]}`}>
          {SIMBOLO[e]}
        </td>
      ))}
      <td className="id-num">{f.mesesDeuda || ''}</td>
      <td className="id-num id-monto">{f.montoDeuda > 0 ? pesos(f.montoDeuda) : ''}</td>
    </tr>
  );
}

export default function InformeDeudaPanel({ jugadores = [], cuentas = [], morosos = [], sociosMorosos = [], pagos = [] }) {
  const [tipo, setTipo] = useState('deportistas');
  const [filtros, setFiltros] = useState(FILTROS_INICIALES);
  const [exportando, setExportando] = useState(false);
  const informeRef = useRef(null);
  const set = (clave) => (e) => setFiltros((f) => ({ ...f, [clave]: e.target.value }));

  const filasDeportistas = useMemo(() => construirInformeDeportistas({ jugadores, morosos, pagos }), [jugadores, morosos, pagos]);
  const filasSocios = useMemo(() => construirInformeSocios({ cuentas, sociosMorosos, pagos }), [cuentas, sociosMorosos, pagos]);
  const esDeportistas = tipo === 'deportistas';
  const base = esDeportistas ? filasDeportistas : filasSocios;

  const ramas = useMemo(() => [...new Set(filasDeportistas.map((f) => f.rama))].sort(), [filasDeportistas]);
  const categorias = useMemo(() => (
    [...new Set(filasDeportistas.filter((f) => filtros.rama === 'todas' || f.rama === filtros.rama).map((f) => f.categoria))].sort(ordenarCategorias)
  ), [filasDeportistas, filtros.rama]);

  const filtradas = useMemo(
    () => filtrarInforme(base, esDeportistas ? filtros : { ...filtros, rama: 'todas', categoria: 'todas' }),
    [base, filtros, esDeportistas]
  );
  const grupos = useMemo(
    () => (esDeportistas
      ? agruparPorCategoria(filtradas)
      : [{ categoria: 'Socios', filas: [...filtradas].sort((a, b) => (b.mesesDeuda - a.mesesDeuda) || a.nombre.localeCompare(b.nombre, 'es')) }]),
    [filtradas, esDeportistas]
  );
  const totales = {
    personas: filtradas.length,
    conDeuda: filtradas.filter((f) => f.mesesDeuda > 0).length,
    meses: filtradas.reduce((s, f) => s + f.mesesDeuda, 0),
    monto: filtradas.reduce((s, f) => s + f.montoDeuda, 0),
  };

  const descripcionFiltros = [
    esDeportistas && filtros.rama !== 'todas' ? `Rama ${filtros.rama}` : null,
    esDeportistas && filtros.categoria !== 'todas' ? `Categoría ${filtros.categoria}` : null,
    filtros.estado === 'con_deuda' ? 'Solo con deuda' : filtros.estado === 'al_dia' ? 'Solo al día' : null,
    filtros.mes !== 'todos' ? `Deben ${filtros.mes}` : null,
    filtros.texto.trim() ? `Búsqueda “${filtros.texto.trim()}”` : null,
  ].filter(Boolean).join(' · ') || 'Todos';
  const nombreArchivo = `informe-deuda-${tipo}-${[filtros.rama, filtros.categoria].filter((v) => v !== 'todas' && esDeportistas).join('-') || 'todos'}-${hoyLocalISO()}`
    .toLowerCase().replace(/[^a-z0-9-]+/g, '-');

  const descargar = (blob, extension) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${nombreArchivo}.${extension}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const descargarImagen = async () => {
    if (!informeRef.current || filtradas.length === 0) return;
    setExportando(true);
    // Sin scroll horizontal ni tema oscuro durante la captura: la imagen
    // sale completa (12 meses) y legible.
    informeRef.current.classList.add('id-exportando');
    try {
      const { default: html2canvas } = await import('html2canvas');
      const canvas = await html2canvas(informeRef.current, { backgroundColor: '#ffffff', scale: 2, useCORS: true });
      canvas.toBlob((blob) => {
        if (blob) descargar(blob, 'png');
        else showToast({ message: 'No se pudo generar la imagen.', type: 'error' });
      }, 'image/png');
    } catch (error) {
      showToast({ message: `No se pudo generar la imagen: ${error.message}`, type: 'error' });
    } finally {
      informeRef.current?.classList.remove('id-exportando');
      setExportando(false);
    }
  };

  const descargarCsv = () => {
    const celda = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const cabecera = [esDeportistas ? 'Categoría' : '', esDeportistas ? 'Rama' : '', 'Nombre', 'RUT', ...MESES_INFORME, 'Meses adeudados', 'Monto adeudado']
      .filter((c, i) => esDeportistas || i > 1);
    const lineas = grupos.flatMap((g) => g.filas.map((f) => [
      ...(esDeportistas ? [f.categoria, f.rama] : []),
      f.nombre, f.rut, ...f.estados.map((e) => ETIQUETA_ESTADO[e]), f.mesesDeuda, Math.round(f.montoDeuda),
    ]));
    const csv = [cabecera, ...lineas].map((l) => l.map(celda).join(';')).join('\r\n');
    descargar(new Blob([`${String.fromCharCode(0xFEFF)}${csv}`], { type: 'text/csv;charset=utf-8' }), 'csv');
  };

  const selectorTipo = (
    <div className="segment-control id-tipo" role="tablist" aria-label="Tipo de informe">
      {[['deportistas', 'Deportistas por categoría'], ['socios', 'Socios'], ['cierre', 'Cierre de mes']].map(([valor, etiqueta]) => (
        <button key={valor} type="button" role="tab" aria-selected={tipo === valor} className={`segment-btn ${tipo === valor ? 'active' : ''}`} onClick={() => setTipo(valor)}>
          {etiqueta}
        </button>
      ))}
    </div>
  );

  if (tipo === 'cierre') {
    return (
      <div className="fade-in">
        {selectorTipo}
        <CierreMesPanel pagos={pagos} filasDeportistas={filasDeportistas} filasSocios={filasSocios} jugadores={jugadores} />
      </div>
    );
  }

  return (
    <div className="fade-in">
      {selectorTipo}

      <div className="id-filtros">
        <div className="tc-buscador id-buscar">
          <Search size={16} className="tc-buscador-icono" />
          <input type="search" className="form-input" placeholder="Buscar nombre o RUT…" aria-label="Buscar en el informe" value={filtros.texto} onChange={set('texto')} />
          {filtros.texto && (
            <button type="button" className="tc-buscador-limpiar" onClick={() => setFiltros((f) => ({ ...f, texto: '' }))} aria-label="Limpiar búsqueda"><X size={14} /></button>
          )}
        </div>
        {esDeportistas && (
          <>
            <select className="form-input" aria-label="Rama" value={filtros.rama} onChange={(e) => setFiltros((f) => ({ ...f, rama: e.target.value, categoria: 'todas' }))}>
              <option value="todas">Todas las ramas</option>
              {ramas.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
            <select className="form-input" aria-label="Categoría" value={filtros.categoria} onChange={set('categoria')}>
              <option value="todas">Todas las categorías</option>
              {categorias.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </>
        )}
        <select className="form-input" aria-label="Estado" value={filtros.estado} onChange={set('estado')}>
          <option value="con_deuda">Solo con deuda</option>
          <option value="al_dia">Solo al día</option>
          <option value="todos">Todos</option>
        </select>
        <select className="form-input" aria-label="Mes adeudado" value={filtros.mes} onChange={set('mes')}>
          <option value="todos">Cualquier mes</option>
          {MESES_INFORME.map((m) => <option key={m} value={m}>Deben {m}</option>)}
        </select>
      </div>

      <div className="id-acciones">
        <button type="button" className="btn-secondary tc-btn" onClick={() => setFiltros(FILTROS_INICIALES)}>Limpiar filtros</button>
        <div className="id-acciones-descarga">
          <button type="button" className="btn-secondary tc-btn" onClick={descargarCsv} disabled={filtradas.length === 0}>
            <FileText size={13} /> Excel (CSV)
          </button>
          <button type="button" className="btn-electric tc-btn" onClick={descargarImagen} disabled={exportando || filtradas.length === 0}>
            {exportando ? <><Download size={13} /> Generando…</> : <><ImageIcon size={13} /> Descargar imagen</>}
          </button>
        </div>
      </div>

      <div className="id-scroll" tabIndex={0} role="region" aria-label="Informe (se desplaza hacia los lados)">
        <div ref={informeRef} className="id-informe">
          <header className="id-cabecera">
            <div>
              <h3>Informe de deuda {ANIO_INFORME} — {esDeportistas ? 'Deportistas' : 'Socios'}</h3>
              <p>{descripcionFiltros} · al {hoyLocalISO().split('-').reverse().join('-')}</p>
            </div>
            <div className="id-totales">
              <span><b>{totales.personas}</b> {totales.personas === 1 ? 'persona' : 'personas'}</span>
              <span><b>{totales.conDeuda}</b> con deuda</span>
              <span><b>{totales.meses}</b> meses</span>
              <span><b>{pesos(totales.monto)}</b></span>
            </div>
          </header>

          {filtradas.length === 0 ? (
            <p className="tc-vacio">Nadie coincide con estos filtros.</p>
          ) : (
            <table className="id-tabla">
              <thead>
                <tr>
                  <th scope="col" className="id-nombre">Nombre</th>
                  {MESES_INFORME.map((m) => <th key={m} scope="col" className="id-mes">{m}</th>)}
                  <th scope="col" className="id-num">Meses</th>
                  <th scope="col" className="id-num">Monto</th>
                </tr>
              </thead>
              {grupos.map((g) => (
                <tbody key={g.categoria}>
                  {esDeportistas && (
                    <tr className="id-grupo">
                      <th colSpan={MESES_INFORME.length + 1} scope="rowgroup">
                        {g.categoria} · {g.filas.length} {g.filas.length === 1 ? 'deportista' : 'deportistas'}{g.conDeuda ? ` · ${g.conDeuda} con deuda` : ''}
                      </th>
                      <td className="id-num">{g.mesesDeuda || ''}</td>
                      <td className="id-num id-monto">{g.montoDeuda > 0 ? pesos(g.montoDeuda) : ''}</td>
                    </tr>
                  )}
                  {g.filas.map((f) => <FilaPersona key={f.id} f={f} />)}
                </tbody>
              ))}
            </table>
          )}

          <footer className="id-leyenda">
            {['pagado', 'condonado', 'debe', 'parcial', 'exento', 'no-aplica', 'en-curso'].map((e) => (
              <span key={e}><i className={`id-celda id-${e}`}>{SIMBOLO[e]}</i> {ETIQUETA_ESTADO[e]}</span>
            ))}
          </footer>
        </div>
      </div>
    </div>
  );
}

