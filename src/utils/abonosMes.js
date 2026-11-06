// Abonos por mes: los pagos de un mismo mes (y concepto) se SUMAN hasta
// completar la cuota de ese mes. Antes, cualquier pago aprobado marcaba el
// mes como pagado sin importar el monto: un abono de $5.000 sobre una cuota
// de $30.000 dejaba el mes en verde y su deuda desaparecía.
//
// Usado por la grilla de meses (PerfilTesoreriaPanel) y por el cálculo de
// morosos/deuda (App.jsx), para que ambos coincidan.

// Margen por redondeos (cuotas en UTM, repartos de abonos).
export const TOLERANCIA_PESOS = 1;

const esAprobado = (estado) => ['aprobado', 'validado'].includes(String(estado || '').toLowerCase());
const esPendiente = (estado) => String(estado || '').toLowerCase() === 'pendiente';

// pagos: [{ estado, monto }] del mes y concepto. cuota: monto del mes.
// Un pago APROBADO de $0 es un mes eximido a propósito por el club (regla
// vigente: "mes sin cobro puntual"): cuenta como completo.
export const resumirAbonosMes = (pagos = [], cuota = 0) => {
  let abonado = 0;
  let enRevision = 0;
  let hayRevision = false;
  let eximido = false;
  pagos.forEach(({ estado, monto }) => {
    const valor = Number(monto) || 0;
    if (esAprobado(estado)) {
      if (valor <= 0) eximido = true;
      else abonado += valor;
    } else if (esPendiente(estado)) {
      hayRevision = true;
      enRevision += Math.max(0, valor);
    }
  });
  const cuotaMes = Math.max(0, Math.round(Number(cuota) || 0));
  const completo = eximido || (cuotaMes > 0 ? abonado >= cuotaMes - TOLERANCIA_PESOS : abonado > 0);
  const faltante = completo ? 0 : Math.max(0, cuotaMes - abonado);
  return {
    abonado: Math.round(abonado),
    enRevision: Math.round(enRevision),
    cuota: cuotaMes,
    faltante: Math.round(faltante),
    completo,
    parcial: !completo && abonado > 0,
    hayRevision,
  };
};

// Reparte un abono completando los meses EN ORDEN (el más antiguo primero),
// en vez de dividirlo en partes iguales. items: [{ clave, faltante }] ya
// ordenados. Devuelve [{ clave, monto }] solo con montos > 0 (un pago de $0
// significaría "mes eximido", así que nunca se crea por un abono).
export const asignarAbonoEnOrden = (montoAbono = 0, items = []) => {
  let restante = Math.max(0, Math.round(Number(montoAbono) || 0));
  const asignaciones = [];
  items.forEach((item, idx) => {
    if (restante <= 0) return;
    const esUltimo = idx === items.length - 1;
    // El último mes recibe todo lo que quede (por si se abona más de lo debido).
    const monto = esUltimo ? restante : Math.min(restante, Math.max(0, Math.round(item.faltante)));
    if (monto > 0) {
      asignaciones.push({ clave: item.clave, monto });
      restante -= monto;
    }
  });
  return asignaciones;
};
