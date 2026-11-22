import { describe, expect, it } from 'vitest';
import { unzipSync, strFromU8 } from 'fflate';
import { construirXlsx, listadoCuentas, listadoDeportistas } from './exportarDeportistas';

describe('listadoDeportistas', () => {
  it('ordena por categoría y rama, y cruza el apoderado por RUT o correo', () => {
    const { filas, grupo } = listadoDeportistas(
      [
        { rut_jugador: '2-7', nombres: 'Bea', apellido_paterno: 'Soto', categoria: 'U15', rama: 'Femenina', correo_apoderado: 'MAMA@x.cl', estado: 'INACTIVO' },
        { rut_jugador: '1-9', nombres: 'Ana', apellido_paterno: 'Díaz', categoria: 'U13', rama: 'Femenina', rut_apoderado: '11.111.111-1', fecha_nacimiento: '2013-05-04' },
        { rut_jugador: '3-5', nombres: 'Leo', apellido_paterno: 'Paz', categoria: 'U13', rama: 'Masculina' },
      ],
      [
        { rut: '111111111', nombres: 'Juan', apellido_paterno: 'Díaz', telefono: '912345678' },
        { rut: '9-9', correo: 'mama@x.cl', nombres: 'Rosa', apellido_paterno: 'Soto', estado: 'inactivo' },
      ],
    );
    expect(filas.map((f) => f.nombres)).toEqual(['Ana', 'Leo', 'Bea']);
    expect(filas[0]).toMatchObject({ apoderado: 'Juan Díaz', telApoderado: '+56 912345678', nacimiento: '04-05-2013' });
    expect(filas[1].apoderado).toBe('Sin apoderado vinculado');
    expect(filas[2]).toMatchObject({ estado: 'INACTIVO', apoderado: 'Rosa Soto', estadoCuenta: 'Inactiva' });
    expect(grupo(filas[0])).toBe('U13 · Femenina');
  });
});

describe('listadoCuentas', () => {
  it('lista pupilos y marca inactivos', () => {
    const { filas } = listadoCuentas(
      [{ rut: '11.111.111-1', nombres: 'Juan', apellido_paterno: 'Díaz', es_socio: true, rol: 'socio' }],
      [{ rut_jugador: '1-9', nombres: 'Ana', apellido_paterno: 'Díaz', categoria: 'U13', rama: 'Femenina', rut_apoderado: '111111111', estado: 'BAJA' }],
    );
    expect(filas[0]).toMatchObject({ socio: 'Sí', estado: 'Activo', pupilos: 'Ana Díaz (U13 Femenina, inactivo)' });
  });
});

describe('construirXlsx', () => {
  it('arma un .xlsx con encabezado y celdas escapadas', async () => {
    const bytes = await construirXlsx({ columnas: [['a', 'Nombre', 10], ['b', 'Nota', 10]], filas: [{ a: 'Ñuñoa & <Cía>', b: '' }] }, 'U13');
    const zip = unzipSync(bytes);
    expect(Object.keys(zip)).toContain('xl/workbook.xml');
    const hoja = strFromU8(zip['xl/worksheets/sheet1.xml']);
    expect(hoja).toContain('>Nombre<');
    expect(hoja).toContain('Ñuñoa &amp; &lt;Cía&gt;');
    expect(hoja).toContain('<autoFilter ref="A1:B2"/>');
  });
});
