import { describe, it, expect } from 'vitest';
const { calcularEmparejamientos } = require('./torneoBracket');

const equipo = (n) => ({ id_equipo: n, nombre_equipo: `Equipo ${n}`, logo_url: null });
const equipos = (n) => Array.from({ length: n }, (_, i) => equipo(i + 1));

describe('calcularEmparejamientos', () => {
  it('4 equipos (potencia de 2): 2 partidos reales, 0 pases directos', () => {
    const { partidosReales, pasesDirectos, totalRondas } = calcularEmparejamientos(equipos(4));
    expect(partidosReales).toHaveLength(2);
    expect(pasesDirectos).toHaveLength(0);
    expect(totalRondas).toBe(2);
    expect(partidosReales[0]).toMatchObject({ posicion: 0, local: equipo(1), visita: equipo(2) });
    expect(partidosReales[1]).toMatchObject({ posicion: 1, local: equipo(3), visita: equipo(4) });
  });

  it('2 equipos: 1 partido real, final directa', () => {
    const { partidosReales, pasesDirectos, totalRondas } = calcularEmparejamientos(equipos(2));
    expect(partidosReales).toHaveLength(1);
    expect(pasesDirectos).toHaveLength(0);
    expect(totalRondas).toBe(1);
  });

  it('6 equipos: 2 partidos reales + 2 pases directos', () => {
    const { partidosReales, pasesDirectos, totalRondas } = calcularEmparejamientos(equipos(6));
    expect(partidosReales).toHaveLength(2);
    expect(pasesDirectos).toHaveLength(2);
    expect(totalRondas).toBe(3);
    // Los pases directos van a la ronda 2, uno a cada lado del mismo cruce.
    expect(pasesDirectos[0]).toMatchObject({ posicion: 0, esLocal: true });
    expect(pasesDirectos[1]).toMatchObject({ posicion: 0, esLocal: false });
  });

  it('5 equipos: 1 partido real + 3 pases directos', () => {
    const { partidosReales, pasesDirectos, totalRondas } = calcularEmparejamientos(equipos(5));
    expect(partidosReales).toHaveLength(1);
    expect(pasesDirectos).toHaveLength(3);
    expect(totalRondas).toBe(3);
  });

  it('todos los equipos se usan exactamente una vez, sin repetir ni perder ninguno', () => {
    for (const n of [2, 3, 4, 5, 6, 7, 8, 9, 15, 16]) {
      const { partidosReales, pasesDirectos } = calcularEmparejamientos(equipos(n));
      const usados = [
        ...partidosReales.flatMap((p) => [p.local.id_equipo, p.visita.id_equipo]),
        ...pasesDirectos.map((p) => p.equipo.id_equipo),
      ];
      expect(new Set(usados).size).toBe(n);
      expect(usados).toHaveLength(n);
    }
  });

  it('rechaza menos de 2 equipos', () => {
    expect(() => calcularEmparejamientos(equipos(1))).toThrow();
    expect(() => calcularEmparejamientos([])).toThrow();
  });
});
