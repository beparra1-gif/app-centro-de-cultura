import { describe, expect, it } from 'vitest';
import { construirCsvCuentas, construirCsvDeportistas } from './exportarDeportistas';

describe('construirCsvDeportistas', () => {
  it('ordena por categoría y rama, y cruza el apoderado por RUT o correo', () => {
    const csv = construirCsvDeportistas(
      [
        { rut_jugador: '2-7', nombres: 'Bea', apellido_paterno: 'Soto', categoria: 'U15', rama: 'Femenina', correo_apoderado: 'MAMA@x.cl', estado: 'INACTIVO' },
        { rut_jugador: '1-9', nombres: 'Ana', apellido_paterno: 'Díaz', categoria: 'U13', rama: 'Femenina', rut_apoderado: '11.111.111-1' },
        { rut_jugador: '3-5', nombres: 'Leo', apellido_paterno: 'Paz', categoria: 'U13', rama: 'Masculina' },
      ],
      [
        { rut: '111111111', nombres: 'Juan', apellido_paterno: 'Díaz', telefono: '912345678' },
        { rut: '9-9', correo: 'mama@x.cl', nombres: 'Rosa', apellido_paterno: 'Soto', estado: 'inactivo' },
      ],
    );
    const lineas = csv.slice(1).split(String.fromCharCode(13, 10));
    expect(lineas).toHaveLength(4);
    expect(lineas[1]).toContain('"U13";"Femenina";"Díaz";"Ana"');
    expect(lineas[1]).toContain('"Juan Díaz";"111111111";"+56 912345678"');
    expect(lineas[2]).toContain('"Sin apoderado vinculado"');
    expect(lineas[3]).toContain('"INACTIVO"');
    expect(lineas[3]).toContain('"Rosa Soto"');
    expect(lineas[3]).toContain('"Inactiva"');
  });
});

describe('construirCsvCuentas', () => {
  it('lista pupilos y marca inactivos', () => {
    const csv = construirCsvCuentas(
      [{ rut: '11.111.111-1', nombres: 'Juan', apellido_paterno: 'Díaz', es_socio: true, rol: 'socio' }],
      [{ rut_jugador: '1-9', nombres: 'Ana', apellido_paterno: 'Díaz', categoria: 'U13', rama: 'Femenina', rut_apoderado: '111111111', estado: 'BAJA' }],
    );
    const fila = csv.slice(1).split(String.fromCharCode(13, 10))[1];
    expect(fila).toContain('"Sí";"Activo"');
    expect(fila).toContain('"Ana Díaz (U13 Femenina, inactivo)"');
  });
});
