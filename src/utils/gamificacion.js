// 100 XP por nivel. Réplica exacta de calcularNivelDesdeXPTotal en
// backend/server.js — mantener ambas en sync si cambia la fórmula.
export const calcularNivelDesdeXP = (xpTotal) => Math.floor(Number(xpTotal || 0) / 100) + 1;

export const calcularProgresoNivel = (xpTotal) => {
  const xp = Number(xpTotal || 0);
  const nivel = calcularNivelDesdeXP(xp);
  const xpDesdeNivel = xp - (nivel - 1) * 100;
  const xpFaltante = 100 - xpDesdeNivel;
  return {
    nivel,
    xpDesdeNivel,
    xpFaltante,
    porcentaje: Math.min(100, Math.max(0, xpDesdeNivel)),
  };
};
