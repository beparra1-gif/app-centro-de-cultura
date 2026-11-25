import { describe, it, expect } from 'vitest';
const { partidoVisiblePara } = require('./audienciaPartido');

const sub13F = { rut_jugador: '11.111.111-1', rama: 'FEMENINA', categoria: 'SUB-13' };
const sub17M = { rut_jugador: '22222222-2', rama: 'MASCULINA', categoria: 'SUB-17 / SUB-18' };

describe('partidoVisiblePara', () => {
  it('sin audiencia o "todos": lo ve cualquiera, incluso sin sesión', () => {
    expect(partidoVisiblePara({}, null)).toBe(true);
    expect(partidoVisiblePara({ audiencia: { tipo: 'todos' } }, null)).toBe(true);
  });
  it('categoría: solo familias con un deportista de esa rama y categoría', () => {
    const p = { rama: 'Femenina', categoria: 'SUB-13', audiencia: { tipo: 'categoria' } };
    expect(partidoVisiblePara(p, [sub13F])).toBe(true);
    expect(partidoVisiblePara(p, [sub17M])).toBe(false);
    expect(partidoVisiblePara(p, null)).toBe(false);
  });
  it('categoría compuesta en la ficha y rama mixta', () => {
    expect(partidoVisiblePara({ rama: 'Masculina', categoria: 'SUB-18', audiencia: { tipo: 'categoria' } }, [sub17M])).toBe(true);
    expect(partidoVisiblePara({ rama: 'Mixta', categoria: 'SUB-13', audiencia: { tipo: 'categoria' } }, [sub13F])).toBe(true);
  });
  it('personas: solo los deportistas elegidos (RUT con o sin puntos)', () => {
    const p = { audiencia: { tipo: 'personas', ruts: ['11111111-1'] } };
    expect(partidoVisiblePara(p, [sub13F])).toBe(true);
    expect(partidoVisiblePara(p, [sub17M])).toBe(false);
  });
});
