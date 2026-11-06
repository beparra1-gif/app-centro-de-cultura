import { describe, it, expect } from 'vitest';
import { resumirAbonosMes, asignarAbonoEnOrden } from './abonosMes';

describe('resumirAbonosMes', () => {
  it('un abono parcial aprobado NO completa el mes y calcula lo que falta', () => {
    expect(resumirAbonosMes([{ estado: 'aprobado', monto: 10000 }], 30000))
      .toMatchObject({ abonado: 10000, faltante: 20000, completo: false, parcial: true });
  });

  it('varios abonos aprobados se suman hasta completar', () => {
    const r = resumirAbonosMes([{ estado: 'aprobado', monto: 10000 }, { estado: 'validado', monto: 20000 }], 30000);
    expect(r).toMatchObject({ abonado: 30000, faltante: 0, completo: true, parcial: false });
  });

  it('los pendientes no cuentan como abonado pero marcan revisión', () => {
    const r = resumirAbonosMes([{ estado: 'aprobado', monto: 10000 }, { estado: 'pendiente', monto: 20000 }], 30000);
    expect(r).toMatchObject({ abonado: 10000, enRevision: 20000, faltante: 20000, hayRevision: true, completo: false });
  });

  it('un pago aprobado de $0 es un mes eximido (completo)', () => {
    expect(resumirAbonosMes([{ estado: 'aprobado', monto: 0 }], 30000)).toMatchObject({ completo: true, faltante: 0 });
  });

  it('tolera $1 de diferencia por redondeo (cuotas UTM)', () => {
    expect(resumirAbonosMes([{ estado: 'aprobado', monto: 21644 }], 21645).completo).toBe(true);
  });

  it('rechazados no cuentan', () => {
    expect(resumirAbonosMes([{ estado: 'rechazado', monto: 30000 }], 30000)).toMatchObject({ completo: false, faltante: 30000 });
  });
});

describe('asignarAbonoEnOrden', () => {
  it('completa los meses en orden, el más antiguo primero', () => {
    expect(asignarAbonoEnOrden(40000, [{ clave: 'mar', faltante: 30000 }, { clave: 'abr', faltante: 30000 }]))
      .toEqual([{ clave: 'mar', monto: 30000 }, { clave: 'abr', monto: 10000 }]);
  });

  it('respeta lo que ya estaba abonado (solo completa el faltante)', () => {
    expect(asignarAbonoEnOrden(25000, [{ clave: 'mar', faltante: 5000 }, { clave: 'abr', faltante: 30000 }]))
      .toEqual([{ clave: 'mar', monto: 5000 }, { clave: 'abr', monto: 20000 }]);
  });

  it('nunca crea filas de $0 y el último mes recibe el excedente', () => {
    expect(asignarAbonoEnOrden(10000, [{ clave: 'mar', faltante: 30000 }, { clave: 'abr', faltante: 30000 }]))
      .toEqual([{ clave: 'mar', monto: 10000 }]);
    expect(asignarAbonoEnOrden(70000, [{ clave: 'mar', faltante: 30000 }, { clave: 'abr', faltante: 30000 }]))
      .toEqual([{ clave: 'mar', monto: 30000 }, { clave: 'abr', monto: 40000 }]);
  });
});
