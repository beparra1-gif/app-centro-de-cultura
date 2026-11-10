// jugadores.beca es un porcentaje de rebaja (0-100), no un booleano — un
// jugador puede tener una beca parcial (ej. 50%) además del caso 100% (no
// paga mensualidad). Clampa y castea para blindarse de valores fuera de
// rango o strings sueltos que puedan llegar desde la API/Sheets.
export const obtenerPorcentajeBeca = (jugador = {}) => {
  const valor = Number(jugador?.beca);
  if (!Number.isFinite(valor) || valor <= 0) return 0;
  return Math.min(valor, 100);
};

export const tieneBecaActiva = (jugador = {}) => obtenerPorcentajeBeca(jugador) > 0;

export const tieneBecaCompleta = (jugador = {}) => obtenerPorcentajeBeca(jugador) >= 100;

export const calcularCuotaConBeca = (valorMensualidad, jugador = {}) => {
  const base = Number(valorMensualidad) || 0;
  const porcentaje = obtenerPorcentajeBeca(jugador);
  if (porcentaje <= 0) return base;
  return Math.round(base * (1 - porcentaje / 100));
};

// Exento_mensualidad es distinto de beca: es "no paga nada" explícito (ej.
// hijo de staff), sin usar el mecanismo de % de beca. Existe para no
// confundir "la celda de mensualidad vino vacía en el Sheet" (que sigue
// cobrando la tarifa por defecto del club, ver calcularCuotaDeportistas en
// PerfilTesoreriaPanel) con "este jugador de verdad no debe pagar".
export const estaExentoDeMensualidad = (jugador = {}) => Boolean(jugador?.exento_mensualidad);

// No debe mensualidad por ningún motivo: exento explícito o beca del 100%.
export const noDebeMensualidad = (jugador = {}) => estaExentoDeMensualidad(jugador) || tieneBecaCompleta(jugador);

// Punto de entrada único para calcular la cuota real de un jugador — aplica
// exención primero (gana sobre cualquier otro cálculo) y luego el % de beca.
export const calcularCuotaFinal = (valorMensualidad, jugador = {}) => {
  if (estaExentoDeMensualidad(jugador)) return 0;
  return calcularCuotaConBeca(valorMensualidad, jugador);
};

// Tarifas del club por deportista, con HISTORIAL: cada período rige desde
// un mes ("YYYY-MM") hasta que empieza el siguiente. La cuota de cada mes usa
// la tarifa vigente ese mes (ej. la mensualidad subió de $25.000 a $30.000:
// los meses anteriores pagados con $25.000 quedan completos, no parciales).
// Se configura en Tesorería → Tarifas (GET/PUT /api/configuracion/tarifas).
//  - uno: un solo pupilo · hermanos: c/u · hijoSocio: un hijo de socio ·
//    dosHijosSocio: c/u con 2 (desde el 3ro, tope familiar = 2 × ese valor).
export const TARIFAS_POR_DEFECTO = [
  { desde: '2026-01', uno: 30000, hermanos: 25000, hijoSocio: 15000, dosHijosSocio: 12000 },
];
const CLAVES_TARIFA = ['uno', 'hermanos', 'hijoSocio', 'dosHijosSocio'];
let historialTarifas = TARIFAS_POR_DEFECTO;

const normalizarHistorial = (historial) => {
  const lista = (Array.isArray(historial) ? historial : [])
    .filter((t) => /^\d{4}-\d{2}$/.test(String(t?.desde || '')) && CLAVES_TARIFA.every((k) => Number(t[k]) >= 0))
    .map((t) => ({ ...t, ...Object.fromEntries(CLAVES_TARIFA.map((k) => [k, Number(t[k])])) }))
    .sort((a, b) => a.desde.localeCompare(b.desde));
  return lista.length ? lista : TARIFAS_POR_DEFECTO;
};
export const setHistorialTarifas = (historial) => { historialTarifas = normalizarHistorial(historial); };
export const obtenerHistorialTarifas = () => historialTarifas;

// mes: 1..12 del año del cobro (2026) o null = hoy.
const claveMes = (mes = null, anio = 2026) => {
  if (!mes) {
    const hoy = new Date();
    return `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`;
  }
  return `${anio}-${String(mes).padStart(2, '0')}`;
};
export const tarifaVigente = (mes = null, anio = 2026) => {
  const clave = claveMes(mes, anio);
  let vigente = historialTarifas[0];
  historialTarifas.forEach((t) => { if (t.desde <= clave) vigente = t; });
  return vigente;
};
const tarifaActual = () => historialTarifas[historialTarifas.length - 1];

export const tarifaPorDeportista = (cantidadPupilos = 1, esSocio = false, mes = null) => {
  const t = tarifaVigente(mes);
  const n = Math.max(1, Number(cantidadPupilos) || 1);
  if (esSocio) return n === 1 ? t.hijoSocio : (n === 2 ? t.dosHijosSocio : Math.round((t.dosHijosSocio * 2) / n));
  return n === 1 ? t.uno : t.hermanos;
};

// Cuota de deportistas de UNA familia (todos los pupilos del mismo
// apoderado) para un mes. cuotaReferencial es la tarifa de un pupilo SIN
// valor propio: la de la regla vigente ese mes, o el monto acordado de la
// familia repartido.
export const calcularCuotaDeportistasFamilia = ({ pupilosFamilia = [], esSocioApoderado = false, montoAcordado = 0, mes = null } = {}) => {
  const cantidadPupilos = pupilosFamilia.length;
  if (cantidadPupilos <= 0) return { cuotaDeportistas: 0, cuotaReferencial: 0 };

  const cuotaReferencial = Number.isFinite(montoAcordado) && montoAcordado > 0
    ? Math.round(montoAcordado / cantidadPupilos)
    : tarifaPorDeportista(cantidadPupilos, esSocioApoderado, mes);
  const cuotaDeportistas = pupilosFamilia.reduce((acc, p) => acc + obtenerCuotaJugador(p, cuotaReferencial, mes), 0);
  return { cuotaDeportistas: Math.round(cuotaDeportistas), cuotaReferencial };
};

// Monto propio de un pupilo para un mes: si su valor_mensualidad coincide con
// una tarifa estándar ACTUAL (ej. $30.000 = "uno"), en meses anteriores a un
// cambio de tarifa se usa la tarifa estándar de ese mes (ej. $25.000). Un
// monto especial que no coincide con ninguna tarifa se respeta siempre.
const montoPropioDelMes = (monto, mes) => {
  if (!mes) return monto;
  const actual = tarifaActual();
  const vigente = tarifaVigente(mes);
  if (vigente === actual) return monto;
  const clave = CLAVES_TARIFA.find((k) => actual[k] === monto);
  return clave ? vigente[clave] : monto;
};

// Cuota mensual real de UN pupilo dentro de su familia: su valor_mensualidad
// propio (ajustado al mes, ver arriba) o la tarifa referencial de la familia;
// siempre con beca/exención aplicada.
export const obtenerCuotaJugador = (pupilo = {}, cuotaReferencial = 0, mes = null) => {
  const monto = Number(pupilo?.valor_mensualidad || 0);
  const base = Number.isFinite(monto) && monto > 0 ? montoPropioDelMes(monto, mes) : cuotaReferencial;
  return calcularCuotaFinal(base, pupilo);
};
