import { describe, it, expect } from 'vitest';
import { armarCertificado } from './certificadoPagos';

const HOY = new Date(2026, 10, 7);

describe('armarCertificado', () => {
  it('socio con un pupilo: secciones por concepto, pagado y deuda', () => {
    const cert = armarCertificado({
      titular: { nombre: 'Socia Prueba', rut: '99.700.201-2', esSocio: true, cuenta: { fecha_ingreso_socio: '2026-09-01' } },
      pupilos: [{ rut: '99700101-1', nombre: 'Hijo Prueba', fecha_ingreso: '2026-10-01' }],
      pagos: [
        { rut_pagos: '99700201-2', concepto_pago: 'Mensualidad Socio', meses_correspondientes: 'septiembre-2026', monto_total_pagado: 21500, estado_pago: 'aprobado' },
        { rut_jugador: '99700101-1', concepto_pago: 'Mensualidad', meses_correspondientes: 'octubre-2026', monto_total_pagado: 15000, estado_pago: 'APROBADO' },
        { rut_jugador: '99700101-1', concepto_pago: 'Mensualidad', meses_correspondientes: 'noviembre-2026', monto_total_pagado: 15000, estado_pago: 'pendiente' },
      ],
      sociosMorosos: [{ rut: '99700201-2', mesesDeuda: 1, montoDeuda: 21600, mesesMorosos: ['Oct'] }],
      hoy: HOY,
    });
    expect(cert.secciones.map((s) => [s.titulo, s.pagado, s.deuda])).toEqual([
      ['Cuota de socio', 21500, 21600],
      ['Mensualidad · Hijo Prueba', 15000, 0],
    ]);
    expect(cert.secciones[0].estados.slice(8, 11)).toEqual(['pagado', 'debe', 'en-curso']);
    expect(cert).toMatchObject({ deuda: 21600, pagado: 36500, alDia: false });
  });

  it('sin deuda: al día', () => {
    const cert = armarCertificado({ titular: { nombre: 'X', rut: '1-9' }, pupilos: [{ rut: '2-7', nombre: 'Y', fecha_ingreso: '2026-11-01' }], hoy: HOY });
    expect(cert.alDia).toBe(true);
  });
});
