import { describe, it, expect } from 'vitest';

const { generarCodigoVerificacion, codigoValido, enmascararRut, folioCertificado, sumarDias, limpiarExtraCertificado, faltaParaEmitir } = require('./certificados');

describe('certificados', () => {
  it('genera códigos de 12 caracteres sin letras ambiguas y únicos', () => {
    const codigos = new Set(Array.from({ length: 500 }, () => generarCodigoVerificacion()));
    expect(codigos.size).toBe(500);
    for (const c of codigos) {
      expect(codigoValido(c)).toBe(true);
      expect(c).not.toMatch(/[01OIL]/);
    }
  });

  it('rechaza códigos con otro formato', () => {
    expect(codigoValido('abc')).toBe(false);
    expect(codigoValido("ABCDEFGHJKM'")).toBe(false);
    expect(codigoValido(undefined)).toBe(false);
  });

  it('enmascara el RUT dejando solo los últimos 3 dígitos y el DV', () => {
    expect(enmascararRut('12.345.678-9')).toBe('**.***.678-9');
    expect(enmascararRut('9876543-k')).toBe('**.***.543-K');
    expect(enmascararRut('')).toBe('');
  });

  it('arma el folio con año y correlativo', () => {
    expect(folioCertificado(12, new Date(2026, 10, 22))).toBe('CCF-2026-00012');
  });

  it('suma días cruzando meses y años sin desfase horario', () => {
    expect(sumarDias('2026-11-22', 90)).toBe('2027-02-20');
    expect(sumarDias('2026-02-27', 30)).toBe('2026-03-29');
  });

  it('limpia los datos extra del admin', () => {
    const e = limpiarExtraCertificado({
      monto_cuota: '$ 30.000',
      torneos: [' Liga A ', '', 5],
      horario_semana: [
        { dia: 'Miércoles', desde: '19:00', hasta: '20:30' },
        { dia: 'Lunes', desde: '17:30', hasta: '19:00' },
        { dia: 'Lunes', desde: '10:00', hasta: '11:00' }, // repetido: queda el primero
        { dia: 'Martes', desde: '25:00', hasta: '19:00' }, // hora inválida
        { dia: 'Jueves', desde: '20:00', hasta: '19:00' }, // termina antes de empezar
        { dia: 'Feriado', desde: '10:00', hasta: '11:00' },
      ],
    });
    expect(e).toEqual({
      monto_cuota: 30000,
      torneos: ['Liga A', '5'],
      horario_semana: [{ dia: 'Lunes', desde: '17:30', hasta: '19:00' }, { dia: 'Miércoles', desde: '19:00', hasta: '20:30' }],
    });
    expect(limpiarExtraCertificado(null)).toEqual({ monto_cuota: null, torneos: [], horario_semana: [] });
  });

  it('exige lo que cada plantilla necesita para emitirse', () => {
    const vacio = limpiarExtraCertificado({});
    expect(faltaParaEmitir('alumno_regular', { extra: vacio })).toBeNull();
    expect(faltaParaEmitir('participacion_permiso', { extra: vacio, presentadoAnte: '' })).toMatch(/establecimiento/);
    expect(faltaParaEmitir('participacion_permiso', { extra: vacio, presentadoAnte: 'Colegio X' })).toMatch(/horario/);
    expect(faltaParaEmitir('permanencia_participacion', { extra: vacio })).toMatch(/competición/);
    expect(faltaParaEmitir('vigencia_pago', { extra: { ...vacio, monto_cuota: 30000 }, alDiaVerificado: false })).toMatch(/al día/);
    expect(faltaParaEmitir('vigencia_pago', { extra: { ...vacio, monto_cuota: 30000 }, alDiaVerificado: true })).toBeNull();
  });
});
