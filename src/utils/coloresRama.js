// Paleta única por rama de entrenamiento (masculina/femenina/mixta), usada en
// el widget del Muro (badge pastel) y en los calendarios de Cancha/Horarios
// (barra sólida). Deliberadamente fuera de la paleta de arriendos (naranja
// #FF9500 pendiente, verde #34C759 pagado, gris #8E8E93 anulado) para que
// ambas capas del calendario de Cancha se distingan a simple vista.
const PALETA_RAMA = {
  masculina: { barra: '#0A84FF', badgeBg: 'rgba(10,132,255,0.12)', badgeColor: '#0a4da2' },
  femenina: { barra: '#FF2D92', badgeBg: 'rgba(255,45,146,0.12)', badgeColor: '#a3145f' },
  mixta: { barra: '#5E5CE6', badgeBg: 'rgba(94,92,230,0.14)', badgeColor: '#3d3ba0' },
};
const FALLBACK = { barra: '#5E5CE6', badgeBg: 'rgba(120,120,128,0.12)', badgeColor: '#555' };

const entradaRama = (rama = '') => PALETA_RAMA[String(rama).toLowerCase()] || FALLBACK;

export const colorBarraPorRama = (rama) => entradaRama(rama).barra;
export const colorBadgePorRama = (rama) => {
  const { badgeBg, badgeColor } = entradaRama(rama);
  return { bg: badgeBg, color: badgeColor };
};
