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

// Tarifas del club (confirmadas 2026-11-07), por deportista:
//  - un solo pupilo: $30.000
//  - hermanos: $25.000 cada uno
//  - hijo de socio: $15.000
//  - 2 hijos de socio: $12.000 cada uno (desde el 3ro, tope familiar $24.000)
// Un pupilo con valor_mensualidad propio (cargado a mano o desde la
// planilla) usa ese valor: es una condición especial y gana sobre la regla.
export const tarifaPorDeportista = (cantidadPupilos = 1, esSocio = false) => {
  const n = Math.max(1, Number(cantidadPupilos) || 1);
  if (esSocio) return n === 1 ? 15000 : (n === 2 ? 12000 : Math.round(24000 / n));
  return n === 1 ? 30000 : 25000;
};

// Cuota de deportistas de UNA familia (todos los pupilos del mismo
// apoderado). cuotaReferencial es la tarifa de un pupilo SIN valor propio:
// la de la regla, o el monto acordado de la familia repartido. Antes, si un
// hermano traía valor propio y el otro no, al segundo se le cobraba la mitad
// del valor del primero; y el descuento de socio dependía del perfil
// "socio_apoderado" en vez de que la cuenta fuera socia.
export const calcularCuotaDeportistasFamilia = ({ pupilosFamilia = [], esSocioApoderado = false, montoAcordado = 0 } = {}) => {
  const cantidadPupilos = pupilosFamilia.length;
  if (cantidadPupilos <= 0) return { cuotaDeportistas: 0, cuotaReferencial: 0 };

  const cuotaReferencial = Number.isFinite(montoAcordado) && montoAcordado > 0
    ? Math.round(montoAcordado / cantidadPupilos)
    : tarifaPorDeportista(cantidadPupilos, esSocioApoderado);
  const cuotaDeportistas = pupilosFamilia.reduce((acc, p) => acc + obtenerCuotaJugador(p, cuotaReferencial), 0);
  return { cuotaDeportistas: Math.round(cuotaDeportistas), cuotaReferencial };
};

// Cuota mensual real de UN pupilo dentro de su familia: si trae
// valor_mensualidad propio se usa tal cual (con beca/exención aplicada); si
// no, se reparte la tarifa referencial de la familia (ver
// calcularCuotaDeportistasFamilia).
export const obtenerCuotaJugador = (pupilo = {}, cuotaReferencial = 0) => {
  const monto = Number(pupilo?.valor_mensualidad || 0);
  const base = Number.isFinite(monto) && monto > 0 ? monto : cuotaReferencial;
  return calcularCuotaFinal(base, pupilo);
};
