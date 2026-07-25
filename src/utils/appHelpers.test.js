import { describe, it, expect } from 'vitest';
import { calcularEff } from './appHelpers';

describe('calcularEff', () => {
  it('suma pts+reb+ast+stl+blk y resta las pérdidas', () => {
    const jugador = { pts: 20, reb: 8, ast: 5, stl: 2, blk: 1, to: 3 };
    expect(calcularEff(jugador)).toBe(33); // 20+8+5+2+1-3
  });

  it('con todo en cero, da 0', () => {
    expect(calcularEff({ pts: 0, reb: 0, ast: 0, stl: 0, blk: 0, to: 0 })).toBe(0);
  });

  it('muchas pérdidas puede dar un valor negativo', () => {
    expect(calcularEff({ pts: 0, reb: 0, ast: 0, stl: 0, blk: 0, to: 5 })).toBe(-5);
  });
});
