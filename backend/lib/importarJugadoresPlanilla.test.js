import { describe, it, expect } from 'vitest';
const { planificarImportacionJugadores, parsearNacimiento, parsearIngreso } = require('./importarJugadoresPlanilla');

// RUTs ficticios del rango de prueba 99.71x.xxx.
const dv = (cuerpo) => {
  let suma = 0;
  let mul = 2;
  for (const d of String(cuerpo).split('').reverse()) { suma += Number(d) * mul; mul = mul === 7 ? 2 : mul + 1; }
  const r = 11 - (suma % 11);
  return r === 11 ? '0' : r === 10 ? 'K' : String(r);
};
const rut = (n) => `${n}-${dv(n)}`;
const [H1, H2, J3, J4, APO, APO2] = [99710001, 99710002, 99710003, 99710004, 99710101, 99710102].map(rut);
const fila = (...c) => c.join('\t');
const CAB = fila('Nombre completo del jugador', 'Rut', 'Fecha de nacimiento', 'Fecha de ingreso al club', 'Nombre (APODERADO)', 'Rut (APODERADO)');

describe('fechas de la planilla', () => {
  it.each([
    ['11 octubre 2012', '2012-10-11'], ['21/06/2011', '2011-06-21'], ['16.07.2011', '2011-07-16'],
    ['6/7/2012', '2012-07-06'], ['29 - marzo - 2011', '2011-03-29'], ['05 de Noviembre de 2013', '2013-11-05'],
    ['23 nov 2011', '2011-11-23'], ['31/02/2012', null], ['', null],
  ])('nacimiento %s', (t, esperado) => expect(parsearNacimiento(t)).toBe(esperado));

  it.each([
    ['Mayo 2025', '2025-05-01'], ['Marzo, 2026', '2026-03-01'], ['Mayo del 2025', '2025-05-01'],
    ['24 junio 2026', '2026-06-01'], ['2do semestre 2022', '2022-07-01'], ['2024', '2024-01-01'],
    ['20.10.2026', '2026-10-01'], ['44197', '2021-01-01'], ['pronto', null],
  ])('ingreso %s', (t, esperado) => expect(parsearIngreso(t)).toBe(esperado));
});

describe('planificarImportacionJugadores', () => {
  const texto = [
    CAB,
    fila('Benjamín Ignacio Godoy Muñoz', H1, '23 nov 2011', 'Febrero 2026', 'Andre Muñoz Moyano', `${APO} `),
    fila('Matias Mauricio Godoy Muñoz', H2.replace('-', ''), '29 julio 2013', 'Febrero 2026', 'Andrea Muñoz Moyano', APO.replace('-', '')),
    fila('Ya Existe Sin Apoderado', J3, '01/01/2012', 'Mayo 2025', 'Otra Persona', APO2),
    fila('Con Otro Apoderado', J4, '', '', 'Andrea Muñoz', APO),
    fila('Rut Malo', '12345678-0', '', '', '', ''),
    fila('Repetido', H1, '', '', '', ''),
  ].join('\n');
  const jugadores = [
    { rut_jugador: J3, nombres: 'Ya', apellido_paterno: 'Existe', fecha_nacimiento: '2012-01-01', fecha_ingreso: null, rut_apoderado: null },
    { rut_jugador: J4, nombres: 'Con', apellido_paterno: 'Otro', rut_apoderado: rut(99710199) },
  ];
  const cuentas = [{ rut: APO2, nombres: 'Otra', apellido_paterno: 'Persona', correo: 'otra@correo.cl' }];
  const plan = planificarImportacionJugadores({ texto, jugadores, cuentas, rama: 'Masculina', hoy: new Date('2026-11-20') });

  it('crea los que faltan con su apoderado y categoría por edad', () => {
    expect(plan.crear.map((c) => c.ficha.rut_jugador)).toEqual([H1, H2]);
    expect(plan.crear[0].ficha).toMatchObject({ nombres: 'Benjamín Ignacio', apellido_paterno: 'Godoy', apellido_materno: 'Muñoz', fecha_nacimiento: '2011-11-23', fecha_ingreso: '2026-02-01', rama: 'Masculina', categoria: 'SUB-15', rut_apoderado: APO });
  });

  it('junta al apoderado repetido en una sola cuenta nueva', () => {
    const a = plan.apoderados.find((x) => x.rut === APO);
    expect(a.existe).toBe(false);
    expect(a.variantes).toEqual(['Andre Muñoz Moyano', 'Andrea Muñoz Moyano', 'Andrea Muñoz']);
    expect(plan.resumen.crearApoderados).toBe(1);
  });

  it('completa solo campos vacíos y reutiliza la cuenta existente', () => {
    expect(plan.completar).toHaveLength(1);
    expect(plan.completar[0].cambios).toEqual({ fecha_ingreso: '2025-05-01', rut_apoderado: APO2, correo_apoderado: 'otra@correo.cl' });
  });

  it('no pisa un apoderado distinto: lo informa como conflicto', () => {
    expect(plan.conflictos).toEqual([expect.objectContaining({ rut: J4, planilla: APO })]);
    expect(plan.yaEstaban.map((y) => y.rut)).toEqual([J4]);
  });

  it('omite RUT inválido y repetido', () => {
    expect(plan.omitidos.map((o) => o.motivo)).toEqual(['RUT del jugador inválido', 'RUT repetido en la planilla']);
  });
});
