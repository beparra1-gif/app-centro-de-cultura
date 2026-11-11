import { describe, it, expect } from 'vitest';
import { sugerirHermanos } from './sugerirHermanos';
import { planUnirHermanos } from './hermanos';

const j = (rut, nombres, ap, am, extra = {}) => ({ rut_jugador: rut, nombres, apellido_paterno: ap, apellido_materno: am, estado: 'ACTIVO', ...extra });

describe('sugerirHermanos', () => {
  it('propone a quienes comparten los dos apellidos', () => {
    const r = sugerirHermanos([j('1-9', 'Ana', 'Rojas', 'Pérez'), j('2-7', 'Beto', 'Rojas', 'Perez'), j('3-5', 'Caro', 'Rojas', 'Soto')]);
    expect(r).toHaveLength(1);
    expect(r[0].jugadores.map((x) => x.nombres).sort()).toEqual(['Ana', 'Beto']);
    expect(r[0].segura).toBe(false);
  });

  it('dos pistas distintas = segura; teléfono une aunque cambie un apellido', () => {
    const r = sugerirHermanos([
      j('1-9', 'Ana', 'Rojas', 'Pérez', { num_emergencia: '+56 9 1234 5678' }),
      j('2-7', 'Beto', 'Rojas', 'Pérez', { num_emergencia: '912345678' }),
      j('3-5', 'Caro', 'Soto', 'Lagos', { num_emergencia: '9 1234 5678' }),
    ]);
    expect(r).toHaveLength(1);
    expect(r[0].jugadores).toHaveLength(3);
    expect(r[0].segura).toBe(true);
  });

  it('no sugiere a quienes ya son familia', () => {
    const r = sugerirHermanos([j('1-9', 'Ana', 'Rojas', 'Pérez', { grupo_familiar: 'g' }), j('2-7', 'Beto', 'Rojas', 'Pérez', { grupo_familiar: 'g' })]);
    expect(r).toHaveLength(0);
  });

  it('ignora inactivos', () => {
    const r = sugerirHermanos([j('1-9', 'Ana', 'Rojas', 'Pérez'), j('2-7', 'Beto', 'Rojas', 'Pérez', { estado: 'BAJA' })]);
    expect(r).toHaveLength(0);
  });
});

describe('planUnirHermanos', () => {
  it('reutiliza el grupo existente y arrastra a su grupo previo', () => {
    const todos = [j('1-9', 'A', 'X', 'Y', { grupo_familiar: 'g1' }), j('2-7', 'B', 'X', 'Y', { grupo_familiar: 'g2' }), j('3-5', 'C', 'X', 'Y', { grupo_familiar: 'g2' })];
    const { grupo, actualizar } = planUnirHermanos([todos[0], todos[1]], todos);
    expect(grupo).toBe('g1');
    expect(actualizar.map((x) => x.nombres).sort()).toEqual(['B', 'C']);
  });
});
