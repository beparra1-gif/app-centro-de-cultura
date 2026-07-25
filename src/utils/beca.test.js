import { describe, it, expect } from 'vitest';
import { calcularCuotaFinal, obtenerPorcentajeBeca, tieneBecaCompleta } from './beca';

describe('obtenerPorcentajeBeca', () => {
  it('sin campo beca, da 0', () => {
    expect(obtenerPorcentajeBeca({})).toBe(0);
  });

  it('clampa valores por sobre 100', () => {
    expect(obtenerPorcentajeBeca({ beca: 150 })).toBe(100);
  });

  it('valores negativos o no numéricos dan 0', () => {
    expect(obtenerPorcentajeBeca({ beca: -20 })).toBe(0);
    expect(obtenerPorcentajeBeca({ beca: 'abc' })).toBe(0);
  });
});

describe('tieneBecaCompleta', () => {
  it('100 es beca completa, 99 no', () => {
    expect(tieneBecaCompleta({ beca: 100 })).toBe(true);
    expect(tieneBecaCompleta({ beca: 99 })).toBe(false);
  });
});

describe('calcularCuotaFinal', () => {
  it('sin beca, cobra el valor completo', () => {
    expect(calcularCuotaFinal(25000, {})).toBe(25000);
  });

  it('con beca parcial, descuenta el porcentaje', () => {
    expect(calcularCuotaFinal(25000, { beca: 50 })).toBe(12500);
  });

  it('con beca completa (100%), cuota queda en 0', () => {
    expect(calcularCuotaFinal(25000, { beca: 100 })).toBe(0);
  });

  it('exento_mensualidad gana sobre cualquier beca (incluso sin beca)', () => {
    expect(calcularCuotaFinal(25000, { exento_mensualidad: true })).toBe(0);
    expect(calcularCuotaFinal(25000, { exento_mensualidad: true, beca: 20 })).toBe(0);
  });

  it('redondea el resultado a un entero', () => {
    // 9999 * (1 - 15/100) = 8499.15 -> redondea a 8499
    expect(calcularCuotaFinal(9999, { beca: 15 })).toBe(8499);
  });
});
