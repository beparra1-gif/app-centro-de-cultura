// Fecha calendario (YYYY-MM-DD) en la zona horaria LOCAL del dispositivo.
//
// No usar `new Date().toISOString().slice(0, 10)` para "hoy": toISOString
// está en UTC, y en Chile (UTC-3/UTC-4) desde las 20:00–21:00 devuelve la
// fecha de MAÑANA — ej. Pasar Lista de un entrenamiento nocturno quedaba
// registrado al día siguiente y el "hoy" del Kiosco saltaba de día en pleno
// evento.
export const fechaLocalISO = (fecha = new Date()) => {
  const d = fecha instanceof Date ? fecha : new Date(fecha);
  if (Number.isNaN(d.getTime())) return '';
  const anio = d.getFullYear();
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${anio}-${mes}-${dia}`;
};

export const hoyLocalISO = () => fechaLocalISO(new Date());

// Año/mes/día de una fecha CALENDARIO que viene del backend (columnas DATE
// como fecha_ingreso). node-postgres la serializa como medianoche del huso
// del servidor: en producción (UTC) "2026-03-01" llega como
// "2026-03-01T00:00:00.000Z", que con new Date() en Chile es el 28 de
// febrero a las 21:00 → getMonth() daba el mes ANTERIOR. Se lee la parte
// YYYY-MM-DD del texto tal cual; solo si no la tiene se usa Date local.
export const partesFechaCalendario = (valor) => {
  if (valor == null || valor === '') return null;
  const m = String(valor).trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return { anio: Number(m[1]), mes: Number(m[2]), dia: Number(m[3]) };
  const d = valor instanceof Date ? valor : new Date(valor);
  if (Number.isNaN(d.getTime())) return null;
  return { anio: d.getFullYear(), mes: d.getMonth() + 1, dia: d.getDate() };
};
