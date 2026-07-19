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
