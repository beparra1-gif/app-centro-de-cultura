import { describe, it, expect } from 'vitest';
import {
  construirInformeDeportistas, construirInformeSocios, filtrarInforme, agruparPorCategoria, inicioCobroJugador,
} from './informeDeuda';

// 7 de noviembre de 2026: se cobra hasta octubre; noviembre está en curso.
const HOY = new Date(2026, 10, 7);

const jugadores = [
  { rut_jugador: '99700101-1', nombres: 'Ana', apellido_paterno: 'Uno', rama: 'Femenina', categoria: 'SUB-13', fecha_ingreso: '2026-03-10' },
  { rut_jugador: '99700102-K', nombres: 'Beto', apellido_paterno: 'Dos', rama: 'MASCULINA', categoria: 'SUB-9' },
  { rut_jugador: '99700103-8', nombres: 'Cata', apellido_paterno: 'Tres', rama: 'FEMENINA', categoria: 'SUB-13', beca: 100 },
];
const morosos = [
  { rut: '99700101-1', mesesDeuda: 2, montoDeuda: 45000, mesesMorosos: ['Sep', 'Oct'], mesesParciales: ['Oct'] },
];

describe('construirInformeDeportistas', () => {
  const filas = construirInformeDeportistas({ jugadores, morosos, hoy: HOY });
  const ana = filas.find((f) => f.nombre === 'Ana Uno');

  it('marca cada mes: no corresponde, pagado, debe, parcial, en curso y próximo', () => {
    expect(ana.estados).toEqual([
      'no-aplica', 'no-aplica', 'pagado', 'pagado', 'pagado', 'pagado', 'pagado', 'pagado',
      'debe', 'parcial', 'en-curso', 'futuro',
    ]);
    expect(ana).toMatchObject({ rama: 'FEMENINA', categoria: 'SUB-13', mesesDeuda: 2, montoDeuda: 45000 });
  });

  it('beca 100% aparece como exento, no como pagado', () => {
    expect(filas.find((f) => f.nombre === 'Cata Tres').estados.slice(0, 10).every((e) => e === 'exento')).toBe(true);
  });

  it('agrupa por categoría en orden numérico con subtotales', () => {
    const grupos = agruparPorCategoria(filas);
    expect(grupos.map((g) => g.categoria)).toEqual(['SUB-9', 'SUB-13']);
    expect(grupos[1]).toMatchObject({ mesesDeuda: 2, montoDeuda: 45000, conDeuda: 1 });
  });

  it('filtra por estado, mes adeudado, rama y búsqueda', () => {
    expect(filtrarInforme(filas, { estado: 'con_deuda' }).map((f) => f.nombre)).toEqual(['Ana Uno']);
    expect(filtrarInforme(filas, { mes: 'Oct' }).map((f) => f.nombre)).toEqual(['Ana Uno']);
    expect(filtrarInforme(filas, { mes: 'Ago' })).toHaveLength(0);
    expect(filtrarInforme(filas, { rama: 'MASCULINA' }).map((f) => f.nombre)).toEqual(['Beto Dos']);
    expect(filtrarInforme(filas, { texto: 'beto' })).toHaveLength(1);
  });
});

describe('inicioCobroJugador', () => {
  it('ingreso en años anteriores cobra desde enero; en años futuros, nada', () => {
    expect(inicioCobroJugador({ fecha_ingreso: '2025-12-15' })).toBe(1);
    expect(inicioCobroJugador({ fecha_ingreso: '2027-02-01' })).toBe(13);
    expect(inicioCobroJugador({ mes_inicio_cobro: 'Mayo', fecha_ingreso: '2026-03-01' })).toBe(5);
  });
});

describe('construirInformeSocios', () => {
  it('solo cuentas socias, desde su fecha de ingreso como socio', () => {
    const filas = construirInformeSocios({
      cuentas: [
        { rut: '99.700.201-2', nombres: 'Sonia', apellido_paterno: 'Socia', es_socio: true, fecha_ingreso_socio: '2026-05-01' },
        { rut: '99.700.202-K', nombres: 'No', apellido_paterno: 'Socio', es_socio: false },
      ],
      sociosMorosos: [{ rut: '99700201-2', mesesDeuda: 1, montoDeuda: 21500, mesesMorosos: ['Oct'] }],
      hoy: HOY,
    });
    expect(filas).toHaveLength(1);
    expect(filas[0].estados.slice(0, 10)).toEqual(['no-aplica', 'no-aplica', 'no-aplica', 'no-aplica', 'pagado', 'pagado', 'pagado', 'pagado', 'pagado', 'debe']);
  });
});

describe('meses condonados', () => {
  it('un pago aprobado de $0 se muestra como condonado, no como pagado', () => {
    const [fila] = construirInformeDeportistas({
      jugadores: [{ rut_jugador: '99700101-1', nombres: 'Ana', apellido_paterno: 'Uno', fecha_ingreso: '2026-01-05' }],
      pagos: [{ rut_jugador: '99700101-1', concepto_pago: 'Mensualidad', meses_correspondientes: 'Febrero 2026', monto_total_pagado: 0, estado_pago: 'aprobado', notas_tesoreria: 'Deuda condonada' }],
      hoy: HOY,
    });
    expect(fila.estados.slice(0, 3)).toEqual(['pagado', 'condonado', 'pagado']);
  });
});
