import { useState } from 'react';
import { Plus, Save, Trash2 } from 'lucide-react';
import * as api from '../api/client';
import { showToast } from '../utils/toast';
import { confirmAction } from '../utils/confirmDialog';
import { obtenerHistorialTarifas, setHistorialTarifas } from '../utils/beca';

// Tesorería → Tarifas: mensualidad de deportistas con historial. Cada fila
// rige desde su mes hasta que empieza la siguiente; la deuda de cada mes se
// calcula con la tarifa vigente ese mes (ej. subió de $25.000 a $30.000 en
// septiembre: los meses anteriores pagados con $25.000 quedan completos).
// Solo admin/super admin pueden guardar (el backend lo exige).

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const CAMPOS = [
  ['uno', 'Un pupilo'],
  ['hermanos', 'Hermanos (c/u)'],
  ['hijoSocio', 'Hijo de socio'],
  ['dosHijosSocio', '2 hijos de socio (c/u)'],
];
const nombreMes = (desde) => {
  const [anio, mes] = String(desde).split('-').map(Number);
  return `${MESES[mes - 1] || desde} ${anio}`;
};

export default function TarifasPanel({ puedeEditar = false, onGuardado }) {
  const [filas, setFilas] = useState(() => obtenerHistorialTarifas().map((t) => ({ ...t })));
  const [guardando, setGuardando] = useState(false);
  const ultima = filas[filas.length - 1];

  const cambiar = (i, campo, valor) => setFilas((prev) => prev.map((f, j) => (j === i ? { ...f, [campo]: valor } : f)));
  const agregar = () => {
    const hoy = new Date();
    const desde = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`;
    setFilas((prev) => [...prev, { ...prev[prev.length - 1], desde: prev.some((f) => f.desde === desde) ? '' : desde, nota: '' }]);
  };
  const quitar = (i) => setFilas((prev) => prev.filter((_, j) => j !== i));

  const guardar = async () => {
    const historial = filas.map((f) => ({ ...f, ...Object.fromEntries(CAMPOS.map(([k]) => [k, Number(f[k])])) }));
    if (historial.some((f) => !/^\d{4}-\d{2}$/.test(f.desde) || CAMPOS.some(([k]) => !Number.isFinite(f[k]) || f[k] < 0))) {
      showToast({ message: 'Completa el mes de inicio y los montos de cada tarifa.', type: 'error' });
      return;
    }
    const ordenadas = [...historial].sort((a, b) => a.desde.localeCompare(b.desde));
    const confirmado = await confirmAction({
      title: 'Guardar tarifas',
      message: `La deuda de cada mes se recalcula con la tarifa vigente ese mes. Tarifa actual: un pupilo $${Number(ordenadas.at(-1).uno).toLocaleString('es-CL')}, desde ${nombreMes(ordenadas.at(-1).desde)}.`,
      confirmText: 'Guardar',
    });
    if (!confirmado) return;
    setGuardando(true);
    try {
      const r = await api.configuracionAPI.guardarTarifas(ordenadas);
      setHistorialTarifas(r.historial);
      setFilas(r.historial.map((t) => ({ ...t })));
      showToast({ message: 'Tarifas guardadas. La deuda se recalculó.', type: 'success' });
      await onGuardado?.();
    } catch (error) {
      showToast({ message: error.message || 'No se pudieron guardar las tarifas.', type: 'error' });
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="fade-in">
      <p className="uc-ayuda">
        Cada tarifa rige <b>desde su mes</b> hasta que empieza la siguiente. Si la mensualidad sube, agrega una tarifa nueva
        con el mes desde el que se cobra: los meses anteriores siguen con la tarifa de entonces (un pago de $25.000 de un mes
        en que la cuota era $25.000 queda <b>pagado</b>, no como abono parcial). Un deportista con monto propio igual a una
        tarifa actual también sigue este historial; los montos especiales se respetan.
      </p>
      <div className="tf-lista">
        {filas.map((f, i) => (
          <article key={`${f.desde}-${i}`} className={`tf-fila ${f === ultima ? 'tf-actual' : ''}`}>
            <header>
              <label>
                Desde
                <input type="month" className="form-input" value={f.desde} disabled={!puedeEditar} onChange={(e) => cambiar(i, 'desde', e.target.value)} aria-label={`Mes de inicio de la tarifa ${i + 1}`} />
              </label>
              {f === ultima && <span className="tc-chip-mini">Vigente</span>}
              {puedeEditar && filas.length > 1 && (
                <button type="button" className="btn-secondary tc-btn" onClick={() => quitar(i)} aria-label={`Quitar tarifa desde ${f.desde}`}><Trash2 size={13} /></button>
              )}
            </header>
            <div className="tf-campos">
              {CAMPOS.map(([k, etiqueta]) => (
                <label key={k}>
                  {etiqueta}
                  <input type="number" min="0" step="500" className="form-input" value={f[k]} disabled={!puedeEditar} onChange={(e) => cambiar(i, k, e.target.value)} />
                </label>
              ))}
            </div>
          </article>
        ))}
      </div>
      {puedeEditar && (
        <div className="id-acciones">
          <button type="button" className="btn-secondary tc-btn" onClick={agregar}><Plus size={13} /> Nueva tarifa desde un mes</button>
          <button type="button" className="btn-electric tc-btn" onClick={guardar} disabled={guardando}><Save size={13} /> {guardando ? 'Guardando…' : 'Guardar tarifas'}</button>
        </div>
      )}
    </div>
  );
}
