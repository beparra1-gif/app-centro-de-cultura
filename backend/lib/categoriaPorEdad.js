// Categoría formativa por año de nacimiento (misma regla que
// src/utils/categoriaPorEdad.js). Temporada 2026: SUB-9 2017+, SUB-11
// 2015–2016, SUB-13 2013–2014, SUB-15 2011–2012, SUB-17 / SUB-18 2006–2010.
// Se calcula por la edad que se cumple en la temporada: avanza sola cada año.

const TRAMOS = [
  { categoria: 'SUB-9', hasta: 9 },
  { categoria: 'SUB-11', hasta: 11 },
  { categoria: 'SUB-13', hasta: 13 },
  { categoria: 'SUB-15', hasta: 15 },
  { categoria: 'SUB-17 / SUB-18', hasta: 20 },
];

const anioDeNacimiento = (fecha) => {
  const texto = String(fecha || '').trim();
  const iso = texto.match(/^(\d{4})-\d{2}-\d{2}/);
  if (iso) return Number(iso[1]);
  const chilena = texto.match(/^\d{1,2}[-/]\d{1,2}[-/](\d{4})$/);
  return chilena ? Number(chilena[1]) : null;
};

const categoriaPorNacimiento = (fecha, temporada = new Date().getFullYear()) => {
  const anio = anioDeNacimiento(fecha);
  if (!anio) return null;
  const edad = temporada - anio;
  if (edad < 3) return null;
  return TRAMOS.find((t) => edad <= t.hasta)?.categoria || null;
};

// Middleware: si el cuerpo trae fecha de nacimiento dentro de los tramos, la
// categoría se fija sola (sin fecha se respeta la elegida a mano).
const asignarCategoriaPorEdad = (req, _res, next) => {
  const categoria = categoriaPorNacimiento(req.body?.fecha_nacimiento);
  if (categoria) req.body.categoria = categoria;
  next();
};

module.exports = { categoriaPorNacimiento, asignarCategoriaPorEdad };
