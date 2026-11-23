import { describe, expect, it } from 'vitest';
import { enAlcance, leerAlcance, sinRestriccion } from './alcanceStaff';

const j = (rama, categoria) => ({ rama, categoria });

describe('alcance del staff por rama y categoría', () => {
  it('pares rama|categoría: 1 de hombres y 3 de mujeres', () => {
    const a = leerAlcance({ categorias_asignadas: ['MASCULINA|SUB-13', 'FEMENINA|SUB-13', 'FEMENINA|SUB-15', 'FEMENINA|SUB-17'] });
    expect(enAlcance(a, j('MASCULINA', 'SUB-13'))).toBe(true);
    expect(enAlcance(a, j('masculina', 'sub-13'))).toBe(true);
    expect(enAlcance(a, j('MASCULINA', 'SUB-15'))).toBe(false);
    expect(enAlcance(a, j('FEMENINA', 'SUB-17'))).toBe(true);
    expect(enAlcance(a, j('FEMENINA', 'SUB-9'))).toBe(false);
    expect(a.categorias).toEqual(['sub-13', 'sub-15', 'sub-17']);
  });
  it('formato antiguo: solo categoría (cualquier rama) y ramas_asignadas', () => {
    expect(enAlcance(leerAlcance({ categorias_asignadas: ['SUB-13'] }), j('FEMENINA', 'SUB-13'))).toBe(true);
    const a = leerAlcance({ categorias_asignadas: ['SUB-13'], ramas_asignadas: ['MASCULINA'] });
    expect(enAlcance(a, j('FEMENINA', 'SUB-13'))).toBe(false);
    expect(enAlcance(a, j('MASCULINA', 'SUB-13'))).toBe(true);
  });
  it('sin asignación ve todo', () => {
    const a = leerAlcance({});
    expect(sinRestriccion(a)).toBe(true);
    expect(enAlcance(a, j('FEMENINA', 'SUB-9'))).toBe(true);
  });
});
