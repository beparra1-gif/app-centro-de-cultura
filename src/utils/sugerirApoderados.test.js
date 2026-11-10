import { describe, it, expect } from 'vitest';
import { estaVinculado, sugerirApoderados } from './sugerirApoderados';

const cuentas = [
  { id: 1, rut: '99.700.201-2', nombres: 'Ana María', apellido_paterno: 'Pérez', telefono: '912345678', rol: 'apoderado', correo: 'ana@test.local' },
  { id: 2, rut: '99.700.202-K', nombres: 'Luis', apellido_paterno: 'Pérez', telefono: '987654321', rol: 'socio' },
  { id: 3, rut: '99.700.203-8', nombres: 'Carla', apellido_paterno: 'Soto', telefono: '911112222', rol: 'apoderado' },
  { id: 4, rut: '99.700.204-6', nombres: 'Diego', apellido_paterno: 'Soto', rol: 'jugador' },
];

describe('sugerirApoderados', () => {
  const r = sugerirApoderados({
    cuentas,
    jugadores: [
      { rut_jugador: '1-9', nombres: 'Tomás', apellido_paterno: 'Pérez', num_emergencia: '+56 9 1234 5678', nombre_emergencia: 'Ana María Pérez' },
      { rut_jugador: '2-7', nombres: 'Sofía', apellido_paterno: 'Rojas', apellido_materno: 'Soto' },
      { rut_jugador: '3-5', nombres: 'Vinculado', apellido_paterno: 'Pérez', correo_apoderado: 'ANA@test.local' },
      { rut_jugador: '4-3', nombres: 'Sin', apellido_paterno: 'Pistas' },
    ],
  });

  it('excluye a los deportistas ya vinculados', () => {
    expect(r.map((x) => x.jugador.rut_jugador)).toEqual(['1-9', '2-7', '4-3']);
  });

  it('teléfono + contacto de emergencia: sugerencia segura con motivos', () => {
    const tomas = r[0];
    expect(tomas.segura).toBe(true);
    expect(tomas.sugerencias[0].cuenta.id).toBe(1);
    expect(tomas.sugerencias[0].motivos).toEqual(['mismo teléfono que el contacto de emergencia', 'contacto de emergencia: Ana María Pérez', 'apellido Pérez']);
    // El otro Pérez queda como alternativa, no como segura.
    expect(tomas.sugerencias[1].cuenta.id).toBe(2);
  });

  it('solo por apellido (materno) no es segura y nunca sugiere cuentas de deportista', () => {
    const sofia = r.find((x) => x.jugador.rut_jugador === '2-7');
    expect(sofia.segura).toBe(false);
    expect(sofia.sugerencias.map((s) => s.cuenta.id)).toEqual([3]);
  });

  it('sin pistas: sin sugerencias', () => {
    expect(r.find((x) => x.jugador.rut_jugador === '4-3').sugerencias).toEqual([]);
  });

  it('estaVinculado por RUT o correo', () => {
    expect(estaVinculado({ rut_apoderado: '99700203-8' }, cuentas)).toBe(true);
    expect(estaVinculado({}, cuentas)).toBe(false);
  });
});
