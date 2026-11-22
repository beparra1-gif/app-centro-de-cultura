import { describe, expect, it } from 'vitest';
import { normalizarTelefonoChile, normalizarTelefonosBody } from './telefonoChile';

describe('normalizarTelefonoChile', () => {
  it('quita el +56 (aunque venga duplicado) y deja 9 dígitos', () => {
    expect(normalizarTelefonoChile('+56 9 1234 5678')).toBe('912345678');
    expect(normalizarTelefonoChile('+56+56912345678')).toBe('912345678');
    expect(normalizarTelefonoChile('56 56 9 1234 5678')).toBe('912345678');
    expect(normalizarTelefonoChile('912345678')).toBe('912345678');
    expect(normalizarTelefonoChile('9-1234-5678')).toBe('912345678');
    expect(normalizarTelefonoChile('322123456')).toBe('322123456');
  });
  it('completa el celular antiguo de 8 dígitos y el 0 inicial', () => {
    expect(normalizarTelefonoChile('12345678')).toBe('912345678');
    expect(normalizarTelefonoChile('0912345678')).toBe('912345678');
  });
  it('no borra lo que no reconoce', () => {
    expect(normalizarTelefonoChile('pedir a la mamá')).toBe('pedir a la mamá');
    expect(normalizarTelefonoChile('123')).toBe('123');
    expect(normalizarTelefonoChile('')).toBe('');
    expect(normalizarTelefonoChile(null)).toBe(null);
  });
});

describe('normalizarTelefonosBody', () => {
  it('normaliza los campos de teléfono y fija el prefijo +56', () => {
    const req = { body: { telefono: '+56 +56 9 8765 4321', prefijo_tel: '+56+56', num_emergencia: '56912345678', nombres: 'Ana' } };
    normalizarTelefonosBody(req, null, () => {});
    expect(req.body).toEqual({ telefono: '987654321', prefijo_tel: '+56', num_emergencia: '912345678', nombres: 'Ana' });
  });
  it('no agrega campos que no vinieron', () => {
    const req = { body: { nombres: 'Ana' } };
    normalizarTelefonosBody(req, null, () => {});
    expect(req.body).toEqual({ nombres: 'Ana' });
  });
});
