import { describe, it, expect } from 'vitest';
import { agruparFamilias, hermanosDe, planUnirHermanos } from './hermanos';

const j = (rut, nombres, extra = {}) => ({ rut_jugador: rut, nombres, ...extra });

describe('hermanos', () => {
  it('une por apoderado, correo o grupo_familiar (transitivo)', () => {
    const lista = [
      j('1-9', 'A', { rut_apoderado: '11.111.111-1' }),
      j('2-7', 'B', { rut_apoderado: '11111111-1', grupo_familiar: 'g' }),
      j('3-5', 'C', { grupo_familiar: 'g' }),
      j('4-3', 'D'),
    ];
    const fam = agruparFamilias(lista);
    expect(fam.get('19')).toBe(fam.get('35'));
    expect(fam.get('43')).not.toBe(fam.get('19'));
    expect(hermanosDe(lista[2], lista).map((x) => x.nombres).sort()).toEqual(['A', 'B']);
  });

  it('planUnirHermanos reutiliza el grupo existente y arrastra a su grupo previo', () => {
    const todos = [j('1-9', 'A', { grupo_familiar: 'g1' }), j('2-7', 'B', { grupo_familiar: 'g2' }), j('3-5', 'C', { grupo_familiar: 'g2' })];
    const { grupo, actualizar } = planUnirHermanos([todos[0], todos[1]], todos);
    expect(grupo).toBe('g1');
    expect(actualizar.map((x) => x.nombres).sort()).toEqual(['B', 'C']);
  });
});
