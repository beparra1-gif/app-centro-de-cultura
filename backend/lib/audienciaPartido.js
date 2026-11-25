// A quién va dirigido un partido (próximo o resultado) publicado desde
// Resultados. partidos_live.audiencia:
//   null / { tipo: 'todos' }          → todo el club y la portada pública
//   { tipo: 'categoria' }             → deportistas de la rama/categoría del partido (y sus familias)
//   { tipo: 'personas', ruts: [...] } → solo esos deportistas (y sus familias)
// Misma regla en src/utils/audienciaPartido.js (frontend, para contar destinatarios).

const norm = (t = '') => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toUpperCase();
const normRut = (r = '') => String(r || '').replace(/[.\s-]/g, '').trim().toUpperCase();

const tipoAudiencia = (partido = {}) => {
  const a = partido.audiencia;
  return a && typeof a === 'object' && a.tipo ? a.tipo : 'todos';
};

// Rama "Mixta"/"Adulto" o vacía no restringe; la categoría de la ficha puede
// venir compuesta ("SUB-17 / SUB-18").
const deportistaEnCategoria = (jugador = {}, partido = {}) => {
  const rama = norm(partido.rama);
  if (rama && !['MIXTA', 'ADULTO'].includes(rama) && norm(jugador.rama) !== rama) return false;
  const cat = norm(partido.categoria).replace(/\s+/g, '');
  if (!cat) return true;
  return norm(jugador.categoria).split('/').map((c) => c.replace(/\s+/g, '')).includes(cat);
};

// pupilos: fichas del actor ({ rut_jugador, rama, categoria }); null = sin sesión.
const partidoVisiblePara = (partido = {}, pupilos = null) => {
  const tipo = tipoAudiencia(partido);
  if (tipo === 'todos') return true;
  if (!pupilos || pupilos.length === 0) return false;
  if (tipo === 'personas') {
    const ruts = new Set((partido.audiencia?.ruts || []).map(normRut));
    return pupilos.some((p) => ruts.has(normRut(p.rut_jugador)));
  }
  return pupilos.some((p) => deportistaEnCategoria(p, partido));
};

module.exports = { tipoAudiencia, deportistaEnCategoria, partidoVisiblePara };
