import { describe, it, expect } from 'vitest';
const { planificarImportacion, mesesDePagoDb, esRegistradoEnApp, parsearCsv } = require('./importarPagosPlanilla');

// Datos ficticios (RUTs del rango de prueba 99.70x.xxx).
const CAB_DEP = '"Marca temporal","RUT 2","NOMBRE Y APELLIDO DEPORTISTA\n(solo primer nombre)","RUT COMPLETO\n (sin punto - sin guion)","Mes de registro","SUBIR COMPROBANTE","ESTADO VALIDACIÓN","monto","Observación","mes -año"';
const CAB_SOC = '"Marca temporal","NOMBRE Y APELLIDO DE SOCIO\n(solo primer nombre)","RUT COMPLETO\n (sin punto - sin guion)","Mes de registro","SUBIR COMPROBANTE","RUT 2","ESTADO VALIDACIÓN","Monto","Columna 9"';
const filaDep = (rut, nombre, mes, monto, estado = 'VALIDADO') => `"","","${nombre}","${rut}","${mes}","wsap","${estado}","${monto}","",""`;
const filaSoc = (rut, nombre, mes, monto, rut2 = '') => `"","${nombre}","${rut}","${mes}","wsap","${rut2}","VALIDADO","${monto}",""`;

const jugadores = [
  { rut_jugador: '99700101-1', nombres: 'Hijo', apellido_paterno: 'Prueba', rut_apoderado: '99.700.201-2', valor_mensualidad: 25000 },
  { rut_jugador: '99700102-K', nombres: 'Becada', apellido_paterno: 'Prueba', beca: 100 },
];
const cuentas = [
  { rut: '99.700.201-2', nombres: 'Socia', apellido_paterno: 'Apoderada', es_socio: true, correo: 'socia@test.local' },
  { rut: '99.700.202-K', nombres: 'Socio', apellido_paterno: 'Sinrut', es_socio: true },
];
const pagos = [
  // Enero del deportista ya registrado (importado antes).
  { id: 10, rut_jugador: '99700101-1', concepto_pago: 'Mensualidad', meses_correspondientes: 'enero-2026', monto_total_pagado: 25000, estado_pago: 'APROBADO' },
  // Duplicado importado de enero → se borra el más nuevo.
  { id: 11, rut_jugador: '99700101-1', concepto_pago: 'Mensualidad', meses_correspondientes: 'enero-2026', monto_total_pagado: 25000, estado_pago: 'VALIDADO' },
  // Febrero: uno de la app y uno importado igual → se borra el importado.
  { id: 12, rut_jugador: '99700101-1', concepto_pago: 'Mensualidad', meses_correspondientes: 'Febrero 2026', monto_total_pagado: 25000, estado_pago: 'aprobado' },
  { id: 13, rut_jugador: '99700101-1', concepto_pago: 'Mensualidad', meses_correspondientes: 'febrero-2026', monto_total_pagado: 25000, estado_pago: 'APROBADO' },
  // Marzo: dos abonos de la app con el mismo monto → no se tocan.
  { id: 14, rut_jugador: '99700101-1', concepto_pago: 'Mensualidad', meses_correspondientes: 'marzo-2026', monto_total_pagado: 12500, estado_pago: 'aprobado' },
  { id: 15, rut_jugador: '99700101-1', concepto_pago: 'Mensualidad', meses_correspondientes: 'marzo-2026', monto_total_pagado: 12500, estado_pago: 'aprobado', comprobante_url: '/x.png' },
  // Rechazado: no cuenta como "ya está".
  { id: 16, rut_jugador: '99700101-1', concepto_pago: 'Mensualidad', meses_correspondientes: 'abril-2026', monto_total_pagado: 25000, estado_pago: 'rechazado' },
  // Cuota socio de mayo de la socia (por rut_pagos).
  { id: 17, rut_pagos: '99700201-2', concepto_pago: 'Mensualidad Socio', meses_correspondientes: 'mayo-2026', monto_total_pagado: 21000, estado_pago: 'aprobado' },
];

const csvDeportistas = [CAB_DEP,
  filaDep('997001011', 'HIJO PRUEBA', 'Enero', '25000'),
  filaDep('997001011', 'HIJO PRUEBA', 'Abril', '25000'),
  filaDep('997001011', 'HIJO PRUEBA', 'mayo', '25000'),
  filaDep('997001011', 'HIJO PRUEBA', 'mayo', '25000'),
  filaDep('99700102K', 'Becada Prueba', 'Enero', ''),
  filaDep('997009999', 'No Existe', 'Enero', '30000'),
  filaDep('997001011', 'HIJO PRUEBA', '', '25000'),
  filaDep('997001011', 'HIJO PRUEBA', 'Junio', '25000', 'PENDIENTE'),
].join('\n');
const csvSocios = [CAB_SOC,
  filaSoc('997002012', 'Socia Apoderada', 'Mayo', '21000'),
  filaSoc('997002012', 'Socia', 'Junio', '42352'),
  filaSoc('', 'Socio Sinrut', 'Agosto', '', '99700202-k'),
].join('\n');

const plan = planificarImportacion({ csvDeportistas, csvSocios, jugadores, cuentas, pagos, utmPorMes: { 8: 71650 } });
const agregados = (tipo) => plan.agregar.filter((a) => a.tipo === tipo).map((a) => `${a.mes}:${a.monto}`);

describe('planificarImportacion', () => {
  it('agrega solo lo que falta (los rechazados no cuentan como registrados)', () => {
    expect(agregados('deportista')).toEqual(['abril:25000', 'mayo:25000', 'enero:0']);
    expect(plan.yaEstaban.map((y) => `${y.tipo}:${y.mes}`)).toEqual(['deportista:enero', 'socio:mayo']);
  });

  it('el pago del deportista queda a nombre de quien paga y como mensualidad', () => {
    const p = plan.agregar.find((a) => a.mes === 'abril').pago;
    expect(p).toMatchObject({ rut_jugador: '99700101-1', rut_pagos: '99.700.201-2', concepto_pago: 'Mensualidad', meses_correspondientes: 'abril-2026' });
    expect(p.notas_tesoreria).toMatch(/Pagos deportistas, fila 3/);
  });

  it('sin monto: usa la cuota (beca 100% → $0) y lo anota', () => {
    const becada = plan.agregar.find((a) => a.nombre === 'Becada Prueba');
    expect(becada).toMatchObject({ monto: 0, sinMonto: true });
    expect(becada.pago.notas_tesoreria).toMatch(/monto no informado/);
  });

  it('socios: RUT de la columna C o, si falta, de la F; cuota del mes si no hay monto', () => {
    expect(agregados('socio')).toEqual(['junio:42352', 'agosto:21495']);
    const sinRut = plan.agregar.find((a) => a.nombre === 'Socio Sinrut');
    expect(sinRut.pago).toMatchObject({ rut_pagos: '99.700.202-K', rut_jugador: null, concepto_pago: 'Mensualidad Socio' });
  });

  it('informa omitidos con su motivo', () => {
    expect(plan.omitidos.map((o) => o.motivo).sort()).toEqual([
      'El deportista no está en la base (revisa el RUT)',
      'Estado "pendiente" (solo se importan los VALIDADO)',
      'Mes no reconocido ("")',
    ]);
  });

  it('avisa filas repetidas en la planilla', () => {
    expect(plan.avisos.some((a) => a.mes === 'mayo' && /2 veces/.test(a.detalle))).toBe(true);
  });

  it('duplicados: nunca borra los registrados desde la app; de los importados deja uno', () => {
    expect(plan.duplicadosBorrar.map((d) => d.id).sort()).toEqual([11, 13]);
  });

  it('rechaza una hoja equivocada (Google devuelve la primera hoja si el nombre no existe)', () => {
    expect(() => planificarImportacion({ csvDeportistas: csvSocios, csvSocios })).toThrow(/Pagos deportistas/);
  });
});

describe('utilidades', () => {
  it('mesesDePagoDb entiende los formatos de la base y expande rangos', () => {
    expect(mesesDePagoDb('abril-2026')).toEqual([{ mes: 4, anio: 2026 }]);
    expect(mesesDePagoDb('Febrero-Abril 2026').map((m) => m.mes)).toEqual([2, 3, 4]);
    expect(mesesDePagoDb('Enero 2025')).toEqual([{ mes: 1, anio: 2025 }]);
  });
  it('esRegistradoEnApp distingue app de importados', () => {
    expect(esRegistradoEnApp({ estado_pago: 'aprobado' })).toBe(true);
    expect(esRegistradoEnApp({ estado_pago: 'APROBADO' })).toBe(false);
    expect(esRegistradoEnApp({ estado_pago: 'VALIDADO', comprobante_url: '/c.png' })).toBe(true);
  });
  it('parsearCsv respeta comillas y saltos de línea dentro de campos', () => {
    expect(parsearCsv('"a,b","c\nd"\n1,2')).toEqual([['a,b', 'c\nd'], ['1', '2']]);
  });
});
