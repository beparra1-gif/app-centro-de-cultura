// Cálculo de nivel de Academia desde XP total.
// Extraído de server.js sin cambios de comportamiento.

// Nivel de Academia derivado de xp_total (100 XP por nivel). Réplica exacta
// de calcularNivelDesdeXP en src/utils/gamificacion.js — mantener ambas en sync.
const calcularNivelDesdeXPTotal = (xpTotal) => Math.floor(Number(xpTotal || 0) / 100) + 1;

module.exports = {
  calcularNivelDesdeXPTotal,
};
