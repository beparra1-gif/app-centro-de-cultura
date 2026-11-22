import { describe, expect, it } from 'vitest';
import { cambioDeEstado, estaActivo } from './estadoActivo';

describe('cambioDeEstado', () => {
  it('deportista: guarda la fecha de baja o de reactivación', () => {
    expect(cambioDeEstado('jugador', false, '2026-11-21')).toEqual({ estado: 'INACTIVO', fecha_inicio_baja: '2026-11-21' });
    expect(cambioDeEstado('jugador', true, '2026-11-21', 'x')).toEqual({ estado: 'ACTIVO', fecha_fin_baja: '2026-11-21' });
    expect(cambioDeEstado('jugador', false, '2026-11-21', 'Se cambió de club').motivo_baja).toBe('Se cambió de club');
  });
  it('cuenta: solo el estado, y estaActivo lo reconoce', () => {
    expect(estaActivo(cambioDeEstado('cuenta', false))).toBe(false);
    expect(estaActivo(cambioDeEstado('cuenta', true))).toBe(true);
  });
});
