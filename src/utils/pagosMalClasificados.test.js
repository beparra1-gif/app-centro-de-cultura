import { describe, it, expect } from 'vitest';
import { detectarPagosMalClasificados, mesDelPago, payloadReclasificacion } from './pagosMalClasificados';

const cuentas = [
  { rut: '11.111.111-1', nombres: 'Catalina', apellido_paterno: 'Socia', es_socio: true },
];
const jugadores = [
  { rut_jugador: '70.000.001-1', nombres: 'Hijo', apellido_paterno: 'Uno' },
];
const base = { rut_pagos: '11.111.111-1', estado_pago: 'aprobado', monto_total_pagado: 30000 };
const pagos = [
  // Mensualidad del hijo guardada como cuota de socio (el error).
  { ...base, id: 1, concepto_pago: 'Mensualidad Socio', rut_jugador: '70000001-1', meses_correspondientes: 'Marzo 2026' },
  // Cuota de socio legítima de marzo, aparte.
  { ...base, id: 2, concepto_pago: 'Mensualidad Socio', rut_jugador: null, meses_correspondientes: 'mar-2026', monto_total_pagado: 21000 },
  // Mismo error en abril, sin cuota de socio aparte.
  { ...base, id: 3, concepto_pago: 'Mensualidad Socio', rut_jugador: '70.000.001-1', meses_correspondientes: 'abr-2026' },
  // Mensualidad bien clasificada: no aparece.
  { ...base, id: 4, concepto_pago: 'Mensualidad', rut_jugador: '70.000.001-1', meses_correspondientes: 'May 2026' },
  // Rechazado: no aparece.
  { ...base, id: 5, concepto_pago: 'Mensualidad Socio', rut_jugador: '70.000.001-1', meses_correspondientes: 'Jun 2026', estado_pago: 'rechazado' },
  // Socio que paga su propia cuota con su RUT en rut_jugador: no aparece.
  { ...base, id: 6, concepto_pago: 'Mensualidad Socio', rut_jugador: '11.111.111-1', meses_correspondientes: 'Jul 2026' },
];

describe('detectarPagosMalClasificados', () => {
  const r = detectarPagosMalClasificados({ pagos, jugadores, cuentas });

  it('encuentra solo los pagos de un deportista guardados como cuota de socio', () => {
    expect(r.map((x) => x.id)).toEqual([1, 3]);
    expect(r[0]).toMatchObject({ deportista: 'Hijo Uno', pagador: 'Catalina Socia', mes: 'Marzo 2026', monto: 30000 });
  });

  it('marca cuando la cuota de socio de ese mes ya está pagada aparte', () => {
    expect(r.find((x) => x.id === 1).cuotaSocioPagadaAparte).toBe(true);
    expect(r.find((x) => x.id === 3).cuotaSocioPagadaAparte).toBe(false);
  });
});

describe('mesDelPago', () => {
  it('entiende los formatos de mes usados en la base', () => {
    expect(mesDelPago({ meses_correspondientes: 'Enero 2026' })).toMatchObject({ mes: 1, anio: 2026 });
    expect(mesDelPago({ meses_correspondientes: 'oct-2026' })).toMatchObject({ mes: 10, anio: 2026 });
    expect(mesDelPago({ meses_correspondientes: 'sinmes' })).toBeNull();
  });
});

describe('payloadReclasificacion', () => {
  const fecha = new Date(2026, 10, 7);
  it('a mensualidad: cambia el concepto, conserva el resto y deja nota', () => {
    const p = payloadReclasificacion({ ...pagos[0], notas_tesoreria: 'Efectivo' }, 'mensualidad', 'Ana Admin', fecha);
    expect(p).toMatchObject({ concepto_pago: 'Mensualidad', rut_jugador: '70000001-1', rut_pagos: '11.111.111-1', monto_total_pagado: 30000 });
    expect(p.notas_tesoreria).toMatch(/^Efectivo \[Reclasificado .* por Ana Admin el /);
  });

  it('confirmar cuota de socio: quita el RUT del deportista y conserva el concepto', () => {
    const p = payloadReclasificacion(pagos[2], 'socio', '', fecha);
    expect(p).toMatchObject({ concepto_pago: 'Mensualidad Socio', rut_jugador: null });
    expect(p.notas_tesoreria).toMatch(/^\[Confirmado como cuota de socio/);
  });
});
