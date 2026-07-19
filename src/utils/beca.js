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
