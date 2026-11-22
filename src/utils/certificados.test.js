import { describe, it, expect } from 'vitest';
import { numeroEnLetras, fechaLarga, fechaCorta, cuerpoCertificado, rutConPuntos, TIPOS_CERTIFICADO } from './certificados';

describe('certificados del club', () => {
  it('escribe montos de cuota en palabras', () => {
    expect(numeroEnLetras(30000)).toBe('treinta mil');
    expect(numeroEnLetras(25000)).toBe('veinticinco mil');
    expect(numeroEnLetras(12500)).toBe('doce mil quinientos');
    expect(numeroEnLetras(21000)).toBe('veintiún mil');
    expect(numeroEnLetras(31000)).toBe('treinta y un mil');
    expect(numeroEnLetras(100000)).toBe('cien mil');
    expect(numeroEnLetras(1000)).toBe('mil');
    expect(numeroEnLetras(1250000)).toBe('un millón doscientos cincuenta mil');
    expect(numeroEnLetras(45678)).toBe('cuarenta y cinco mil seiscientos setenta y ocho');
  });

  it('muestra el RUT con puntos', () => {
    expect(rutConPuntos('24423033-4')).toBe('24.423.033-4');
    expect(rutConPuntos('9.876.543-k')).toBe('9.876.543-K');
    expect(rutConPuntos('')).toBe('');
  });

  it('formatea fechas sin desfase de zona horaria', () => {
    expect(fechaLarga('2026-04-02')).toBe('02 de abril de 2026');
    expect(fechaCorta('2013-10-22T00:00:00.000Z')).toBe('22/10/2013');
  });

  it('cada tipo arma un texto con los datos del deportista', () => {
    const datos = { nombre: 'Ana Pérez', rut: '12345678-5', categoria: 'SUB-13', rama: 'FEMENINA', fecha_nacimiento: '2013-01-02', extra: { monto_cuota: 30000, horario_semana: [{ dia: 'Lunes', desde: '17:30', hasta: '19:00' }], torneos: ['Liga A'] } };
    for (const t of TIPOS_CERTIFICADO) {
      const texto = cuerpoCertificado(t.id, datos).map((b) => b.texto || (b.lista || []).join(' ')).join(' ');
      expect(texto).toContain('Ana Pérez');
      expect(texto).toContain('12.345.678-5');
    }
    const cuota = cuerpoCertificado('vigencia_pago', datos).map((b) => b.texto).join(' ');
    expect(cuota).toContain('$ 30.000 (Treinta mil pesos)');
  });

  it('el permiso lleva la tabla de horarios y la permanencia solo las competiciones elegidas', () => {
    const datos = { nombre: 'Ana', rut: '12345678-5', extra: { horario_semana: [{ dia: 'Lunes', desde: '17:30', hasta: '19:00' }], torneos: ['Liga A'] } };
    const tabla = cuerpoCertificado('participacion_permiso', datos).find((b) => b.tabla);
    expect(tabla.tabla).toEqual([['LUNES', '17:30 a 19:00 hrs.']]);
    const lista = cuerpoCertificado('permanencia_participacion', datos).find((b) => b.lista);
    expect(lista.lista).toEqual(['Liga A']);
  });
});
