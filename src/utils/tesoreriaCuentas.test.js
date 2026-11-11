import { describe, it, expect } from 'vitest';
import { construirCuentasQuePagan, filtrarCuentasQuePagan, resumirCuentasQuePagan } from './tesoreriaCuentas';

const cuentas = [
  // Socia y apoderada de 2 deportistas (caso de Tesorería real).
  { rut: '11.111.111-1', nombres: 'Catalina', apellido_paterno: 'Socia', rol: 'socio_apoderado', es_socio: true, correo: 'cata@correo.cl', telefono: '911111111' },
  // Apoderado no socio, vinculado solo por correo.
  { rut: '22.222.222-2', nombres: 'Pedro', apellido_paterno: 'Apoderado', rol: 'apoderado', es_socio: false, correo: 'pedro@correo.cl' },
  // Socio sin hijos.
  { rut: '33.333.333-3', nombres: 'Sonia', apellido_paterno: 'Socia', rol: 'socio', es_socio: true },
  // Deportista mayor de edad que paga sus cuotas.
  { rut: '44.444.444-4', nombres: 'Diego', apellido_paterno: 'Adulto', rol: 'jugador', es_socio: false },
  // Staff sin cuotas: no debe aparecer.
  { rut: '55.555.555-5', nombres: 'Elena', apellido_paterno: 'Entrenadora', rol: 'staff', es_socio: false },
  // Directiva que además es socia.
  { rut: '66.666.666-6', nombres: 'Dora', apellido_paterno: 'Directiva', rol: 'directiva', es_socio: true },
];

const jugadores = [
  { rut_jugador: '70.000.001-1', nombres: 'Hijo', apellido_paterno: 'Uno', rut_apoderado: '11111111-1', rama: 'Básquetbol' },
  { rut_jugador: '70.000.002-2', nombres: 'Hija', apellido_paterno: 'Dos', rut_apoderado: '11.111.111-1', rama: 'Vóleibol', beca: 50 },
  { rut_jugador: '70.000.003-3', nombres: 'Hijo', apellido_paterno: 'Pedro', correo_apoderado: 'PEDRO@correo.cl', rama: 'Básquetbol' },
  { rut_jugador: '44.444.444-4', nombres: 'Diego', apellido_paterno: 'Adulto', rama: 'Básquetbol' },
  { rut_jugador: '70.000.009-9', nombres: 'Huérfano', apellido_paterno: 'Sin', rama: 'Básquetbol' },
];

const morosos = [
  { rut: '70.000.001-1', montoDeuda: 60000, mesesDeuda: 2, mesesMorosos: ['Sep', 'Oct'] },
  { rut: '70.000.009-9', montoDeuda: 30000, mesesDeuda: 1, mesesMorosos: ['Oct'] },
];
const sociosMorosos = [
  { rut: '11111111-1', montoDeuda: 21500, mesesDeuda: 1, mesesMorosos: ['Oct'] },
];

const filas = construirCuentasQuePagan({ cuentas, jugadores, morosos, sociosMorosos });
const fila = (rut) => filas.find((f) => f.rut === rut);

describe('construirCuentasQuePagan', () => {
  it('agrupa a la socia-apoderada en una sola fila con conceptos independientes', () => {
    const cata = fila('11.111.111-1');
    expect(cata.perfiles).toEqual(['Socio', 'Apoderado de 2']);
    expect(cata.socio).toMatchObject({ deuda: 21500, mesesMorosos: ['Oct'] });
    expect(cata.pupilos.map((p) => [p.nombre, p.deuda])).toEqual([['Hijo Uno', 60000], ['Hija Dos', 0]]);
    expect(cata.pupilos[1].beca).toBe(50);
    expect(cata.deudaTotal).toBe(81500);
    expect(cata.mesesDeudaTotal).toBe(3);
  });

  it('arma el teléfono sin duplicar el prefijo', () => {
    expect(fila('11.111.111-1').telefono).toBe('+56911111111');
    const conPrefijo = construirCuentasQuePagan({ cuentas: [{ rut: '1-9', es_socio: true, telefono: '+56 9 1234 5678' }] });
    expect(conPrefijo[0].telefono).toBe('+56912345678');
  });

  it('vincula pupilos por correo cuando falta el RUT del apoderado', () => {
    expect(fila('22.222.222-2').pupilos.map((p) => p.nombre)).toEqual(['Hijo Pedro']);
  });

  it('incluye socios sin hijos y directiva socia, y excluye a quien no paga nada', () => {
    expect(fila('33.333.333-3').perfiles).toEqual(['Socio']);
    expect(fila('66.666.666-6').perfiles).toEqual(['Directiva', 'Socio']);
    expect(fila('55.555.555-5')).toBeUndefined();
  });

  it('reconoce al deportista que paga sus propias cuotas', () => {
    const diego = fila('44.444.444-4');
    expect(diego.autogestionado).toBe(true);
    expect(diego.perfiles).toEqual(['Deportista (paga sus cuotas)']);
  });

  it('muestra al deportista sin responsable de pago con su deuda', () => {
    const huerfano = filas.find((f) => f.tipo === 'sin_responsable');
    expect(huerfano).toMatchObject({ nombre: 'Huérfano Sin', deudaTotal: 30000 });
  });

  it('ordena por deuda de mayor a menor', () => {
    expect(filas[0].rut).toBe('11.111.111-1');
  });
});

describe('filtrarCuentasQuePagan', () => {
  it('por defecto muestra solo quien tiene deuda', () => {
    expect(filtrarCuentasQuePagan(filas).map((f) => f.nombre)).toEqual(['Catalina Socia', 'Huérfano Sin']);
  });

  it('busca por nombre de un pupilo sin tildes', () => {
    const r = filtrarCuentasQuePagan(filas, { texto: 'hija dos', estado: 'todas' });
    expect(r.map((f) => f.nombre)).toEqual(['Catalina Socia']);
  });

  it('filtra por perfil y rama', () => {
    expect(filtrarCuentasQuePagan(filas, { estado: 'todas', perfil: 'socios' })).toHaveLength(3);
    expect(filtrarCuentasQuePagan(filas, { estado: 'todas', perfil: 'autogestionados' })).toHaveLength(1);
    expect(filtrarCuentasQuePagan(filas, { estado: 'todas', rama: 'Vóleibol' }).map((f) => f.nombre)).toEqual(['Catalina Socia']);
  });
});

describe('resumirCuentasQuePagan', () => {
  it('separa lo que se debe de cuota socio y de mensualidades', () => {
    expect(resumirCuentasQuePagan(filas)).toEqual({ total: 111500, socios: 21500, deportistas: 90000, conDeuda: 2 });
  });
});

describe('hermanos marcados a mano (grupo_familiar)', () => {
  const base = [
    { rut_jugador: '80.000.001-1', nombres: 'Ana', apellido_paterno: 'Rojas', grupo_familiar: 'fam-1' },
    { rut_jugador: '80.000.002-2', nombres: 'Beto', apellido_paterno: 'Rojas', grupo_familiar: 'fam-1' },
    { rut_jugador: '80.000.003-3', nombres: 'Solo', apellido_paterno: 'Suelto' },
  ];
  const deudas = [
    { rut: '80.000.001-1', montoDeuda: 25000, mesesDeuda: 1 },
    { rut: '80.000.002-2', montoDeuda: 50000, mesesDeuda: 2 },
  ];

  it('sin apoderado: una sola fila por familia con la deuda sumada', () => {
    const r = construirCuentasQuePagan({ cuentas: [], jugadores: base, morosos: deudas });
    const familia = r.find((f) => f.pupilos.length === 2);
    expect(familia).toMatchObject({ tipo: 'sin_responsable', nombre: 'Hermanos Rojas', deudaTotal: 75000, mesesDeudaTotal: 3 });
    expect(familia.perfiles).toEqual(['Sin responsable de pago', '2 hermanos']);
    expect(r.filter((f) => f.tipo === 'sin_responsable')).toHaveLength(2);
  });

  it('si un hermano ya tiene apoderado, el otro se cobra a esa misma cuenta', () => {
    const conApoderado = base.map((j, i) => (i === 0 ? { ...j, rut_apoderado: '11.111.111-1' } : j));
    const r = construirCuentasQuePagan({ cuentas, jugadores: conApoderado, morosos: deudas });
    const cata = r.find((f) => f.rut === '11.111.111-1');
    expect(cata.pupilos.map((p) => p.nombre)).toEqual(['Ana Rojas', 'Beto Rojas']);
    expect(r.some((f) => f.tipo === 'sin_responsable' && f.nombre.includes('Rojas'))).toBe(false);
  });
});
