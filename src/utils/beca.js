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

// Tarifa por defecto de mensualidad deportistas para UNA familia (todos los
// pupilos del mismo apoderado), usada solo cuando NINGÚN pupilo de la
// familia trae valor_mensualidad propio desde el Sheet. Si al menos uno sí
// lo trae, se usa la suma de esos montos (ya con beca/exención aplicada) en
// vez de la tarifa por defecto — mismo criterio en Tesorería y en Morosos
// para que ambas pantallas muestren siempre el mismo número por familia.
export const calcularCuotaDeportistasFamilia = ({ pupilosFamilia = [], esSocioApoderado = false, montoAcordado = 0 } = {}) => {
  const cantidadPupilos = pupilosFamilia.length;
  if (cantidadPupilos <= 0) return { cuotaDeportistas: 0, cuotaReferencial: 0 };

  const pupilosConCuota = pupilosFamilia.filter((p) => !noDebeMensualidad(p));
  if (pupilosConCuota.length === 0) return { cuotaDeportistas: 0, cuotaReferencial: 0 };

  const sumaDesdeSheet = pupilosConCuota.reduce((acc, p) => {
    const monto = Number(p?.valor_mensualidad || 0);
    const base = Number.isFinite(monto) && monto > 0 ? monto : 0;
    return acc + calcularCuotaFinal(base, p);
  }, 0);

  let cuotaDeportistas;
  if (sumaDesdeSheet > 0) {
    cuotaDeportistas = Math.round(sumaDesdeSheet);
  } else if (Number.isFinite(montoAcordado) && montoAcordado > 0) {
    cuotaDeportistas = montoAcordado;
  } else if (esSocioApoderado) {
    // Socio + apoderado: 15.000 (1 pupilo); desde 2, 12.000 c/u con el 3ro
    // gratis (tope 24.000).
    cuotaDeportistas = cantidadPupilos === 1 ? 15000 : 24000;
  } else {
    // Apoderado sin membresía socio: 30.000 (1 pupilo), 25.000 c/u desde 2.
    cuotaDeportistas = cantidadPupilos === 1 ? 30000 : 25000 * cantidadPupilos;
  }

  const cuotaReferencial = Math.round(cuotaDeportistas / cantidadPupilos);
  return { cuotaDeportistas, cuotaReferencial };
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
