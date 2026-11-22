// Usuarios y Cuentas → "Exportar": Excel (.xlsx) o PDF de deportistas con su
// apoderado, o de cuentas con sus pupilos, para pasar en limpio quiénes
// están. La columna "¿Sigue?" va vacía a propósito: se marca a mano.
import { estaActivo } from './estadoActivo';
import { DATOS_CLUB } from '../legal/avisoPrivacidad';

const norm = (rut = '') => String(rut || '').replace(/[.\s-]/g, '').trim().toUpperCase();
const correo = (c = '') => String(c || '').trim().toLowerCase();
const nombreCompleto = (p) => `${p.apellido_paterno || ''} ${p.apellido_materno || ''} ${p.nombres || ''}`;
const apellidos = (p) => `${p.apellido_paterno || ''} ${p.apellido_materno || ''}`.trim();
const fechaCl = (v) => {
  const t = String(v || '').slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(t) ? t.split('-').reverse().join('-') : '';
};
const telefono = (c) => (c?.telefono ? `${c.prefijo_tel || '+56'} ${c.telefono}` : '');

// Cada columna: clave de la fila, título, ancho en Excel (caracteres) y si va al PDF.
const COLUMNAS_DEPORTISTAS = [
  ['categoria', 'Categoría', 14], ['rama', 'Rama', 12],
  ['apellidos', 'Apellidos', 24, true], ['nombres', 'Nombres', 20, true], ['rut', 'RUT', 13, true],
  ['nacimiento', 'Nacimiento', 12, true], ['estado', 'Estado', 10, true],
  ['apoderado', 'Apoderado', 26, true], ['rutApoderado', 'RUT apoderado', 13],
  ['telApoderado', 'Teléfono apoderado', 16, true], ['correoApoderado', 'Correo apoderado', 28],
  ['parentesco', 'Parentesco', 12], ['estadoCuenta', 'Cuenta apoderado', 14],
  ['sigue', '¿Sigue? (Sí/No)', 12, true], ['observacion', 'Observación', 30],
];

const COLUMNAS_CUENTAS = [
  ['apellidos', 'Apellidos', 24, true], ['nombres', 'Nombres', 20, true], ['rut', 'RUT', 13, true],
  ['perfil', 'Perfil', 14, true], ['socio', 'Socio', 7], ['estado', 'Estado', 10, true],
  ['telefono', 'Teléfono', 16, true], ['correo', 'Correo', 28],
  ['pupilos', 'Pupilos', 45, true], ['sigue', '¿Sigue? (Sí/No)', 12, true], ['observacion', 'Observación', 30],
];

export const listadoDeportistas = (jugadores = [], cuentas = []) => {
  const porRut = new Map(cuentas.map((c) => [norm(c.rut), c]));
  const porCorreo = new Map(cuentas.filter((c) => correo(c.correo).includes('@')).map((c) => [correo(c.correo), c]));
  const filas = [...jugadores]
    .sort((a, b) => String(a.categoria || '').localeCompare(String(b.categoria || ''), 'es')
      || String(a.rama || '').localeCompare(String(b.rama || ''), 'es')
      || nombreCompleto(a).localeCompare(nombreCompleto(b), 'es'))
    .map((j) => {
      const apo = porRut.get(norm(j.rut_apoderado)) || porCorreo.get(correo(j.correo_apoderado)) || null;
      return {
        categoria: j.categoria || 'Sin categoría', rama: j.rama || 'Sin rama',
        apellidos: apellidos(j), nombres: j.nombres || '', rut: j.rut_jugador || '',
        nacimiento: fechaCl(j.fecha_nacimiento), estado: estaActivo(j) ? 'Activo' : (j.estado || 'Inactivo'),
        apoderado: apo ? `${apo.nombres || ''} ${apo.apellido_paterno || ''}`.trim() : 'Sin apoderado vinculado',
        rutApoderado: apo?.rut || j.rut_apoderado || '', telApoderado: telefono(apo),
        correoApoderado: apo?.correo || j.correo_apoderado || '', parentesco: j.parentesco_apoderado || '',
        estadoCuenta: apo ? (estaActivo(apo) ? 'Activa' : 'Inactiva') : '', sigue: '', observacion: '',
      };
    });
  return { columnas: COLUMNAS_DEPORTISTAS, filas, grupo: (f) => `${f.categoria} · ${f.rama}` };
};

export const listadoCuentas = (cuentas = [], jugadores = []) => {
  const filas = [...cuentas]
    .sort((a, b) => nombreCompleto(a).localeCompare(nombreCompleto(b), 'es'))
    .map((c) => {
      const pupilos = jugadores.filter((j) => (norm(j.rut_apoderado) && norm(j.rut_apoderado) === norm(c.rut))
        || (correo(c.correo).includes('@') && correo(j.correo_apoderado) === correo(c.correo)));
      return {
        apellidos: apellidos(c), nombres: c.nombres || '', rut: c.rut || '',
        perfil: c.perfil_principal || c.rol || '', socio: c.es_socio ? 'Sí' : 'No',
        estado: estaActivo(c) ? 'Activo' : (c.estado || 'Inactivo'), telefono: telefono(c), correo: c.correo || '',
        pupilos: pupilos.map((j) => `${j.nombres || ''} ${j.apellido_paterno || ''} (${[j.categoria, j.rama].filter(Boolean).join(' ')}${estaActivo(j) ? '' : ', inactivo'})`.replace(/\s+/g, ' ')).join(' | '),
        sigue: '', observacion: '',
      };
    });
  return { columnas: COLUMNAS_CUENTAS, filas, grupo: null };
};

const descargarBlob = (nombreArchivo, blob) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombreArchivo.replace(/\s+/g, '_');
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

const xml = (v) => String(v ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
  // Caracteres de control no permitidos en XML (rompen el archivo en Excel).
  // eslint-disable-next-line no-control-regex
  .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
const letraColumna = (i) => (i < 26 ? String.fromCharCode(65 + i) : String.fromCharCode(64 + Math.floor(i / 26)) + String.fromCharCode(65 + (i % 26)));

// Hoja .xlsx mínima (texto, encabezado en negrita, fila congelada y filtros).
export const construirXlsx = async ({ columnas, filas }, nombreHoja = 'Listado') => {
  const { zipSync, strToU8 } = await import('fflate');
  const fila = (valores, r, estilo) => `<row r="${r}">${valores.map((v, c) => `<c r="${letraColumna(c)}${r}" t="inlineStr"${estilo ? ' s="1"' : ''}><is><t xml:space="preserve">${xml(v)}</t></is></c>`).join('')}</row>`;
  const ultima = `${letraColumna(columnas.length - 1)}${filas.length + 1}`;
  const hoja = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
    + '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>'
    + `<cols>${columnas.map(([, , ancho], i) => `<col min="${i + 1}" max="${i + 1}" width="${ancho}" customWidth="1"/>`).join('')}</cols>`
    + `<sheetData>${fila(columnas.map(([, titulo]) => titulo), 1, true)}${filas.map((f, i) => fila(columnas.map(([clave]) => f[clave]), i + 2, false)).join('')}</sheetData>`
    + `<autoFilter ref="A1:${ultima}"/></worksheet>`;
  const archivos = {
    '[Content_Types].xml': '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>',
    '_rels/.rels': '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
    'xl/workbook.xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${xml(nombreHoja.slice(0, 31))}" sheetId="1" r:id="rId1"/></sheets><definedNames><definedName name="_xlnm._FilterDatabase" localSheetId="0" hidden="1">'${xml(nombreHoja.slice(0, 31))}'!$A$1:$${letraColumna(columnas.length - 1)}$${filas.length + 1}</definedName></definedNames></workbook>`,
    'xl/_rels/workbook.xml.rels': '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>',
    'xl/styles.xml': '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>',
    'xl/worksheets/sheet1.xml': hoja,
  };
  return zipSync(Object.fromEntries(Object.entries(archivos).map(([k, v]) => [k, strToU8(v)])));
};

export const descargarExcel = async (nombreArchivo, listado, nombreHoja) => {
  const bytes = await construirXlsx(listado, nombreHoja);
  descargarBlob(nombreArchivo, new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
};

// PDF horizontal con las columnas marcadas para PDF; los deportistas van en
// secciones por categoría y rama, con el total de cada una.
export const descargarPdf = async (nombreArchivo, { columnas, filas, grupo }, titulo, subtitulo = '') => {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'landscape' });
  const ancho = doc.internal.pageSize.getWidth();
  const alto = doc.internal.pageSize.getHeight();
  const mx = 30;
  const cols = columnas.filter((c) => c[3]);
  const totalPeso = cols.reduce((s, c) => s + c[2], 0);
  const anchos = cols.map((c) => ((ancho - mx * 2) * c[2]) / totalPeso);
  let y = 0;

  const cabeceraTabla = () => {
    doc.setFillColor(11, 29, 58);
    doc.rect(mx, y, ancho - mx * 2, 18, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    let x = mx;
    cols.forEach((c, i) => { doc.text(c[1], x + 4, y + 12); x += anchos[i]; });
    y += 18;
  };
  const nuevaPagina = () => { doc.addPage(); y = 36; cabeceraTabla(); };

  doc.setTextColor(11, 29, 58);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text(titulo, mx, 40);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(90, 90, 90);
  doc.text(`${DATOS_CLUB.nombre} · ${subtitulo ? `${subtitulo} · ` : ''}${filas.length} en total · emitido el ${new Date().toLocaleDateString('es-CL')}`, mx, 56);
  y = 72;
  cabeceraTabla();

  let grupoActual = null;
  filas.forEach((f, n) => {
    const g = grupo ? grupo(f) : null;
    if (g !== null && g !== grupoActual) {
      if (y > alto - 60) nuevaPagina();
      grupoActual = g;
      const cantidad = filas.filter((x) => grupo(x) === g).length;
      doc.setFillColor(226, 234, 246);
      doc.rect(mx, y, ancho - mx * 2, 16, 'F');
      doc.setTextColor(11, 29, 58);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.text(`${g} (${cantidad})`, mx + 4, y + 11);
      y += 16;
    }
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    const lineas = cols.map((c, i) => doc.splitTextToSize(String(f[c[0]] ?? ''), anchos[i] - 8));
    const altoFila = Math.max(1, ...lineas.map((l) => l.length)) * 10 + 6;
    if (y + altoFila > alto - 30) nuevaPagina();
    if (n % 2) { doc.setFillColor(246, 247, 250); doc.rect(mx, y, ancho - mx * 2, altoFila, 'F'); }
    doc.setTextColor(30, 30, 30);
    let x = mx;
    lineas.forEach((l, i) => {
      doc.text(l, x + 4, y + 11);
      // Casilla para marcar a mano en "¿Sigue?".
      if (cols[i][0] === 'sigue') { doc.setDrawColor(150, 150, 150); doc.rect(x + 6, y + 3, 9, 9); }
      x += anchos[i];
    });
    doc.setDrawColor(225, 225, 230);
    doc.line(mx, y + altoFila, ancho - mx, y + altoFila);
    y += altoFila;
  });

  const paginas = doc.getNumberOfPages();
  for (let p = 1; p <= paginas; p += 1) {
    doc.setPage(p);
    doc.setFontSize(8);
    doc.setTextColor(140, 140, 140);
    doc.text(`Página ${p} de ${paginas}`, ancho - mx, alto - 14, { align: 'right' });
  }
  doc.save(nombreArchivo.replace(/\s+/g, '_'));
};
