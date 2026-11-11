import { describe, it, expect } from 'vitest';
import { cumpleanosDelMes } from './cumpleanos';

describe('cumpleanosDelMes', () => {
  const hoy = new Date(2026, 10, 11);
  it('lista los del mes ordenados por día, sin inactivos ni repetidos', () => {
    const r = cumpleanosDelMes({
      hoy,
      jugadores: [
        { rut_jugador: '1-9', nombres: 'B', fecha_nacimiento: '2014-11-20T00:00:00.000Z', categoria: 'SUB-13' },
        { rut_jugador: '2-7', nombres: 'A', fecha_nacimiento: '2012-11-03' },
        { rut_jugador: '3-5', nombres: 'Baja', fecha_nacimiento: '2012-11-05', estado: 'BAJA' },
        { rut_jugador: '4-3', nombres: 'Otro mes', fecha_nacimiento: '2012-10-05' },
      ],
      cuentas: [{ rut: '1-9', nombres: 'B cuenta', fecha_nacimiento: '2014-11-20' }],
    });
    expect(r.map((c) => [c.nombre, c.dia, c.cumple])).toEqual([['A', 3, 14], ['B', 20, 12]]);
  });
});
