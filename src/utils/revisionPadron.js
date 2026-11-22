// Subir de vuelta el listado exportado (Excel) con "¿Sigue?" marcado:
// arma el plan de quiénes se desactivan (No) o se reactivan (Sí) sin tocar
// nada todavía. La "Observación" pasa a ser el motivo de baja.
import { estaActivo } from './estadoActivo';

const norm = (rut = '') => String(rut || '').replace(/[.\s-]/g, '').trim().toUpperCase();
const sinTildes = (t = '') => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[¿?]/g, '').trim();
const SI = new Set(['si', 's', 'yes', '1', 'sigue']);
const NO = new Set(['no', 'n', '0', 'no sigue']);

export const planRevisionPadron = (filas = [], { jugadores = [], cuentas = [] } = {}) => {
  const iCab = filas.findIndex((f) => f.some((c) => sinTildes(c) === 'rut'));
  if (iCab < 0) throw new Error('No encontré la columna "RUT". Sube el mismo Excel que exportaste desde aquí.');
  const cab = filas[iCab].map(sinTildes);
  const col = (pred) => cab.findIndex(pred);
  const cRut = col((c) => c === 'rut');
  const cSigue = col((c) => c.startsWith('sigue'));
  const cObs = col((c) => c.startsWith('observacion'));
  if (cSigue < 0) throw new Error('No encontré la columna "¿Sigue? (Sí/No)".');
  const esDeportistas = cab.includes('apoderado') || cab.includes('categoria');
  const tipo = esDeportistas ? 'jugador' : 'cuenta';
  const porRut = new Map((esDeportistas ? jugadores.map((j) => [norm(j.rut_jugador), j]) : cuentas.map((c) => [norm(c.rut), c])));

  const plan = { tipo, desactivar: [], reactivar: [], yaEstaban: 0, sinMarca: 0, noEncontrados: [], marcaInvalida: [] };
  filas.slice(iCab + 1).forEach((f) => {
    const rut = f[cRut];
    if (!rut) return;
    const marca = sinTildes(f[cSigue]);
    if (!marca) { plan.sinMarca += 1; return; }
    const persona = porRut.get(norm(rut));
    if (!persona) { plan.noEncontrados.push(rut); return; }
    if (!SI.has(marca) && !NO.has(marca)) { plan.marcaInvalida.push(`${rut} (“${f[cSigue]}”)`); return; }
    const activo = estaActivo(persona);
    const motivo = cObs >= 0 ? String(f[cObs] || '').trim() : '';
    if (NO.has(marca) && activo) plan.desactivar.push({ persona, motivo });
    else if (SI.has(marca) && !activo) plan.reactivar.push({ persona });
    else plan.yaEstaban += 1;
  });
  return plan;
};

// Informe "Altas y bajas": últimos 12 meses. Ingresos = deportistas por
// fecha_ingreso; bajas y reactivaciones = historial de estados (solo existe
// desde que se empezó a registrar, nov-2026).
const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
export const resumenAltasBajas = ({ historial = [], jugadores = [], hoy = new Date() } = {}) => {
  const meses = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(hoy.getFullYear(), hoy.getMonth() - 11 + i, 1);
    return { clave: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, etiqueta: `${MESES[d.getMonth()]} ${d.getFullYear()}`, ingresos: 0, bajas: 0, reactivaciones: 0 };
  });
  const porClave = new Map(meses.map((m) => [m.clave, m]));
  jugadores.forEach((j) => { const m = porClave.get(String(j.fecha_ingreso || '').slice(0, 7)); if (m) m.ingresos += 1; });
  historial.filter((h) => h.tipo === 'jugador').forEach((h) => {
    const f = new Date(h.fecha);
    const m = porClave.get(`${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}`);
    if (!m) return;
    if (estaActivo({ estado: h.estado_nuevo })) m.reactivaciones += 1; else m.bajas += 1;
  });
  return meses.reverse();
};
