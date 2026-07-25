import { describe, it, expect } from 'vitest';
const { normalizarRutParaComparar, hashPassword, verifyPassword } = require('./auth');

describe('normalizarRutParaComparar', () => {
  it('quita puntos y guión', () => {
    expect(normalizarRutParaComparar('12.345.678-9')).toBe('123456789');
  });

  it('pasa todo a mayúsculas (dígito verificador K)', () => {
    expect(normalizarRutParaComparar('12345678-k')).toBe('12345678K');
  });

  it('recorta espacios en los extremos', () => {
    expect(normalizarRutParaComparar('  11111111-1  ')).toBe('111111111');
  });

  it('dos formatos distintos del mismo rut normalizan igual', () => {
    expect(normalizarRutParaComparar('12.345.678-9')).toBe(normalizarRutParaComparar('12345678-9'));
  });

  it('rut vacío o undefined da string vacío', () => {
    expect(normalizarRutParaComparar('')).toBe('');
    expect(normalizarRutParaComparar()).toBe('');
  });
});

describe('hashPassword / verifyPassword', () => {
  it('el hash resultante es distinto del texto plano', async () => {
    const hash = await hashPassword('QaTest2026!');
    expect(hash).not.toBe('QaTest2026!');
    expect(hash.startsWith('$2')).toBe(true);
  });

  it('verifica correcta una contraseña que coincide con su hash', async () => {
    const hash = await hashPassword('QaTest2026!');
    const resultado = await verifyPassword('QaTest2026!', hash);
    expect(resultado.valid).toBe(true);
    expect(resultado.needsRehash).toBe(false);
  });

  it('rechaza una contraseña que no coincide con el hash', async () => {
    const hash = await hashPassword('QaTest2026!');
    const resultado = await verifyPassword('otra-clave', hash);
    expect(resultado.valid).toBe(false);
  });

  it('cuentas legadas en texto plano: coincide y marca needsRehash', async () => {
    const resultado = await verifyPassword('claveVieja', 'claveVieja');
    expect(resultado.valid).toBe(true);
    expect(resultado.needsRehash).toBe(true);
  });
});
