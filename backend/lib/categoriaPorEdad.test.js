import { describe, it, expect } from 'vitest';
import { categoriaPorNacimiento, asignarCategoriaPorEdad } from './categoriaPorEdad.js';

describe('categoriaPorNacimiento (backend, temporada 2026)', () => {
  it.each([
    ['2018-01-01', 'SUB-9'], ['2016-12-31', 'SUB-11'], ['2013-06-06', 'SUB-13'],
    ['2011-03-03', 'SUB-15'], ['2006-09-09', 'SUB-17 / SUB-18'], ['2005-01-01', null], ['', null],
  ])('%s → %s', (fecha, esperado) => {
    expect(categoriaPorNacimiento(fecha, 2026)).toBe(esperado);
  });

  it('el middleware fija la categoría solo si hay fecha válida', () => {
    const conFecha = { body: { fecha_nacimiento: '2014-02-02', categoria: 'SUB-15' } };
    asignarCategoriaPorEdad(conFecha, null, () => {});
    expect(conFecha.body.categoria).toBe(categoriaPorNacimiento('2014-02-02'));
    const sinFecha = { body: { categoria: 'SUB-15' } };
    asignarCategoriaPorEdad(sinFecha, null, () => {});
    expect(sinFecha.body.categoria).toBe('SUB-15');
  });
});
