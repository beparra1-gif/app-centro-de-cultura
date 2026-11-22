import { describe, expect, it } from 'vitest';
import { mismoTexto, unicosSinMayusculas } from './texto';
import { categoriasDeRama } from './categoriasDeportivas';
import { filtrarInforme } from './informeDeuda';

describe('rama sin distinguir mayúsculas', () => {
  it('masculina = MASCULINA = Masculina', () => {
    expect(mismoTexto('masculina', ' MASCULINA ')).toBe(true);
    expect(mismoTexto('Sub-15', 'SUB-15')).toBe(true);
    expect(mismoTexto('Femenina', 'Masculina')).toBe(false);
    expect(unicosSinMayusculas(['MASCULINA', 'masculina', 'Femenina', ''])).toEqual(['MASCULINA', 'Femenina']);
  });
  it('categorías e informe aceptan cualquier forma', () => {
    expect(categoriasDeRama('MASCULINA')).toEqual(categoriasDeRama('Masculina'));
    expect(categoriasDeRama('MASCULINA').length).toBeGreaterThan(0);
    const filas = [{ rama: 'masculina', categoria: 'sub-15', estados: [], nombre: 'A', rut: '1' }, { rama: 'FEMENINA', categoria: 'SUB-15', estados: [], nombre: 'B', rut: '2' }];
    expect(filtrarInforme(filas, { rama: 'MASCULINA', categoria: 'SUB-15' }).map((f) => f.nombre)).toEqual(['A']);
  });
});

describe('coincideAlguna', () => {
  it('[] deja pasar todo; con elegidas compara sin mayúsculas', async () => {
    const { coincideAlguna } = await import('./texto');
    expect(coincideAlguna([], 'SUB-13')).toBe(true);
    expect(coincideAlguna(['sub-13', 'SUB-15'], 'SUB-13')).toBe(true);
    expect(coincideAlguna(['SUB-15'], 'SUB-13')).toBe(false);
  });
});
