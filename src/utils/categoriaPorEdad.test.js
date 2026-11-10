import { describe, it, expect } from 'vitest';
import { categoriaPorNacimiento, categoriaEfectiva, rangoAniosCategoria, anioDeNacimiento } from './categoriaPorEdad';

const t2026 = { temporada: 2026 };

describe('categoriaPorNacimiento (temporada 2026)', () => {
  it.each([
    ['2019-03-01', 'SUB-9'], ['2017-12-31', 'SUB-9'],
    ['2016-01-01', 'SUB-11'], ['2015-06-15', 'SUB-11'],
    ['2014-05-05', 'SUB-13'], ['2013-01-01', 'SUB-13'],
    ['2012-08-20', 'SUB-15'], ['2011-02-02', 'SUB-15'],
    ['2010-12-31', 'SUB-17 / SUB-18'], ['2006-01-01', 'SUB-17 / SUB-18'],
  ])('%s → %s', (fecha, categoria) => {
    expect(categoriaPorNacimiento(fecha, t2026)).toBe(categoria);
  });

  it('fuera de los tramos o sin fecha: sin categoría automática', () => {
    expect(categoriaPorNacimiento('2005-12-31', t2026)).toBeNull();
    expect(categoriaPorNacimiento('', t2026)).toBeNull();
    expect(categoriaPorNacimiento(null, t2026)).toBeNull();
    expect(categoriaPorNacimiento('2025-01-01', t2026)).toBeNull();
  });

  it('avanza sola con la temporada', () => {
    expect(categoriaPorNacimiento('2017-05-05', { temporada: 2027 })).toBe('SUB-11');
  });

  it('acepta dd-mm-aaaa y el año de nacimiento como respaldo', () => {
    expect(anioDeNacimiento('15-03-2013')).toBe(2013);
    expect(categoriaPorNacimiento('', { ...t2026, anioRespaldo: 2012 })).toBe('SUB-15');
  });
});

describe('categoriaEfectiva', () => {
  it('con fecha manda la automática; sin fecha, la elegida', () => {
    expect(categoriaEfectiva({ fecha_nacimiento: '2014-01-01', categoria: 'SUB-15' }, t2026)).toBe('SUB-13');
    expect(categoriaEfectiva({ fecha_nacimiento: '', categoria: 'SUB-15' }, t2026)).toBe('SUB-15');
  });
});

describe('rangoAniosCategoria', () => {
  it('describe los años de cada categoría', () => {
    expect(rangoAniosCategoria('SUB-9', 2026)).toBe('2017 o después');
    expect(rangoAniosCategoria('SUB-11', 2026)).toBe('2015–2016');
    expect(rangoAniosCategoria('SUB-17 / SUB-18', 2026)).toBe('2006–2010');
  });
});
