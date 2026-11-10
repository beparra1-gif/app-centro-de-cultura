// Categoría formativa según el año de nacimiento y la temporada (año en curso).
// Regla del club (temporada 2026):
//   SUB-9            nacidos 2017 o después   (cumplen hasta 9 en la temporada)
//   SUB-11           2015–2016                (10–11)
//   SUB-13           2013–2014                (12–13)
//   SUB-15           2011–2012                (14–15)
//   SUB-17 / SUB-18  2006–2010                (16–20)
// Se calcula por edad que cumple en la temporada, así que cada enero avanza
// sola (en 2027 SUB-9 pasa a ser 2018 o después, etc.).
// Sin fecha de nacimiento la categoría se elige a mano.

export const CATEGORIAS_FORMATIVAS = ['SUB-9', 'SUB-11', 'SUB-13', 'SUB-15', 'SUB-17 / SUB-18'];

const TRAMOS = [
  { categoria: 'SUB-9', hasta: 9 },
  { categoria: 'SUB-11', hasta: 11 },
  { categoria: 'SUB-13', hasta: 13 },
  { categoria: 'SUB-15', hasta: 15 },
  { categoria: 'SUB-17 / SUB-18', hasta: 20 },
];

export const anioDeNacimiento = (fecha, anioRespaldo) => {
  const texto = String(fecha || '').trim();
  const iso = texto.match(/^(\d{4})-\d{2}-\d{2}/);
  if (iso) return Number(iso[1]);
  const chilena = texto.match(/^\d{1,2}[-/]\d{1,2}[-/](\d{4})$/);
  if (chilena) return Number(chilena[1]);
  const anio = Number(anioRespaldo);
  return Number.isInteger(anio) && anio > 1900 ? anio : null;
};

export const categoriaPorNacimiento = (fecha, { temporada = new Date().getFullYear(), anioRespaldo } = {}) => {
  const anio = anioDeNacimiento(fecha, anioRespaldo);
  if (!anio) return null;
  const edad = temporada - anio;
  if (edad < 3) return null;
  return TRAMOS.find((t) => edad <= t.hasta)?.categoria || null;
};

// Años de nacimiento que abarca una categoría en la temporada (para mostrarlo).
export const rangoAniosCategoria = (categoria, temporada = new Date().getFullYear()) => {
  const i = TRAMOS.findIndex((t) => t.categoria === categoria);
  if (i < 0) return '';
  const desde = temporada - TRAMOS[i].hasta;
  if (i === 0) return `${desde} o después`;
  const hasta = temporada - TRAMOS[i - 1].hasta - 1;
  return desde === hasta ? `${desde}` : `${desde}–${hasta}`;
};

// La categoría que corresponde guardar: la automática si hay fecha (o año) de
// nacimiento dentro de los tramos; si no, la elegida a mano.
export const categoriaEfectiva = (jugador = {}, opciones = {}) => (
  categoriaPorNacimiento(jugador.fecha_nacimiento, { ...opciones, anioRespaldo: jugador['año_nacimiento'] })
  || jugador.categoria
  || ''
);
