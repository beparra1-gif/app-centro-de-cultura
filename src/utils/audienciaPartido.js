// A quién va dirigido un partido publicado desde Resultados. Misma regla que
// backend/lib/audienciaPartido.js (allí se aplica; aquí solo se cuenta y se
// describe para el admin).

const norm = (t = '') => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toUpperCase();
const normRut = (r = '') => String(r || '').replace(/[.\s-]/g, '').trim().toUpperCase();

export const deportistaEnCategoria = (jugador = {}, partido = {}) => {
  const rama = norm(partido.rama);
  if (rama && !['MIXTA', 'ADULTO'].includes(rama) && norm(jugador.rama) !== rama) return false;
  const cat = norm(partido.categoria).replace(/\s+/g, '');
  if (!cat) return true;
  return norm(jugador.categoria).split('/').map((c) => c.replace(/\s+/g, '')).includes(cat);
};

// Deportistas (de `jugadores`) que recibirán el aviso; null = todo el club.
export const destinatariosPartido = (partido = {}, jugadores = []) => {
  const tipo = partido.audiencia?.tipo || 'todos';
  if (tipo === 'todos') return null;
  if (tipo === 'personas') {
    const ruts = new Set((partido.audiencia.ruts || []).map(normRut));
    return jugadores.filter((j) => ruts.has(normRut(j.rut_jugador)));
  }
  return jugadores.filter((j) => deportistaEnCategoria(j, partido));
};

// Texto corto para el admin: "Para: Femenina SUB-13 (12 deportistas y sus familias)".
export const describirAudiencia = (partido = {}, jugadores = []) => {
  const tipo = partido.audiencia?.tipo || 'todos';
  if (tipo === 'todos') return 'Para: todo el club y la portada pública';
  const n = destinatariosPartido(partido, jugadores).length;
  const quienes = `${n} deportista${n === 1 ? '' : 's'} y sus familias`;
  if (tipo === 'personas') return `Para: deportistas elegidos (${quienes})`;
  return `Para: ${[partido.rama, partido.categoria].filter(Boolean).join(' ')} (${quienes})`;
};
