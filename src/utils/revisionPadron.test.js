import { describe, expect, it } from 'vitest';
import { construirXlsx, listadoDeportistas } from './exportarDeportistas';
import { leerPrimeraHojaXlsx } from './leerXlsx';
import { planRevisionPadron } from './revisionPadron';

const jugadores = [
  { rut_jugador: '1-9', nombres: 'Ana', apellido_paterno: 'Díaz', categoria: 'U13', rama: 'Femenina' },
  { rut_jugador: '2-7', nombres: 'Bea', apellido_paterno: 'Soto', categoria: 'U13', rama: 'Femenina', estado: 'INACTIVO' },
  { rut_jugador: '3-5', nombres: 'Leo', apellido_paterno: 'Paz', categoria: 'U13', rama: 'Masculina' },
  { rut_jugador: '4-3', nombres: 'Ema', apellido_paterno: 'Ruiz', categoria: 'U15', rama: 'Femenina' },
];

describe('revisión del padrón con el Excel exportado', () => {
  it('lee el .xlsx exportado, y arma desactivar/reactivar con el motivo', async () => {
    const listado = listadoDeportistas(jugadores, []);
    const marcas = { '1-9': ['No', 'Se cambió de club'], '2-7': ['Sí', ''], '3-5': ['si', ''], '4-3': ['', ''] };
    listado.filas.forEach((f) => { [f.sigue, f.observacion] = marcas[f.rut]; });
    const filas = await leerPrimeraHojaXlsx(await construirXlsx(listado, 'Listado'));
    const plan = planRevisionPadron([...filas, ['', '', '', '', '9-9', '', '', '', '', '', '', '', '', 'No']], { jugadores });

    expect(plan.tipo).toBe('jugador');
    expect(plan.desactivar.map((d) => [d.persona.nombres, d.motivo])).toEqual([['Ana', 'Se cambió de club']]);
    expect(plan.reactivar.map((r) => r.persona.nombres)).toEqual(['Bea']);
    expect(plan.yaEstaban).toBe(1);
    expect(plan.sinMarca).toBe(1);
    expect(plan.noEncontrados).toEqual(['9-9']);
  });

  it('avisa si el archivo no es el listado', () => {
    expect(() => planRevisionPadron([['Nombre', 'Mail']], { jugadores })).toThrow(/RUT/);
  });
});

describe('leerPrimeraHojaXlsx', () => {
  it('lee textos compartidos (como guarda Excel) y celdas salteadas', async () => {
    const { zipSync, strToU8 } = await import('fflate');
    const bytes = zipSync({
      'xl/workbook.xml': strToU8('<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Hoja" sheetId="1" r:id="rId7"/></sheets></workbook>'),
      'xl/_rels/workbook.xml.rels': strToU8('<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId7" Type="x" Target="worksheets/hoja9.xml"/></Relationships>'),
      'xl/sharedStrings.xml': strToU8('<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><si><t>RUT</t></si><si><r><t>¿Sigue? </t></r><r><t>(Sí/No)</t></r></si><si><t>No</t></si></sst>'),
      'xl/worksheets/hoja9.xml': strToU8('<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c><c r="C1" t="s"><v>1</v></c></row><row r="2"><c r="A2" t="str"><v>1-9</v></c><c r="C2" t="s"><v>2</v></c></row></sheetData></worksheet>'),
    });
    expect(await leerPrimeraHojaXlsx(bytes)).toEqual([['RUT', '', '¿Sigue? (Sí/No)'], ['1-9', '', 'No']]);
  });
});

describe('resumenAltasBajas', () => {
  it('cuenta ingresos por fecha_ingreso y bajas/reactivaciones del historial', async () => {
    const { resumenAltasBajas } = await import('./revisionPadron');
    const r = resumenAltasBajas({
      hoy: new Date(2026, 10, 22),
      jugadores: [{ fecha_ingreso: '2026-11-03' }, { fecha_ingreso: '2026-03-01' }, { fecha_ingreso: '2024-01-01' }],
      historial: [
        { tipo: 'jugador', fecha: new Date(2026, 10, 20).toISOString(), estado_nuevo: 'INACTIVO' },
        { tipo: 'jugador', fecha: new Date(2026, 10, 21).toISOString(), estado_nuevo: 'ACTIVO' },
        { tipo: 'cuenta', fecha: new Date(2026, 10, 21).toISOString(), estado_nuevo: 'inactivo' },
      ],
    });
    expect(r).toHaveLength(12);
    expect(r[0]).toMatchObject({ etiqueta: 'Nov 2026', ingresos: 1, bajas: 1, reactivaciones: 1 });
    expect(r.find((m) => m.clave === '2026-03').ingresos).toBe(1);
    expect(r[11].etiqueta).toBe('Dic 2025');
  });
});
