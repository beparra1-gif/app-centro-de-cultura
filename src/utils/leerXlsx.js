// Lee la primera hoja de un .xlsx como filas de texto (sin fórmulas ni
// formatos). Alcanza para volver a subir el listado exportado después de
// marcar "¿Sigue?" en Excel, que al guardar pasa los textos a sharedStrings.
const textoDe = (nodo) => Array.from(nodo?.getElementsByTagName('t') || []).map((t) => t.textContent).join('');
const indiceColumna = (ref = '') => {
  const letras = String(ref).replace(/[^A-Z]/gi, '').toUpperCase();
  return [...letras].reduce((n, c) => n * 26 + (c.charCodeAt(0) - 64), 0) - 1;
};

export const leerPrimeraHojaXlsx = async (buffer) => {
  const { unzipSync, strFromU8 } = await import('fflate');
  const zip = unzipSync(new Uint8Array(buffer));
  const parser = new DOMParser();
  const leer = (ruta) => (zip[ruta] ? parser.parseFromString(strFromU8(zip[ruta]), 'application/xml') : null);
  const compartidos = Array.from(leer('xl/sharedStrings.xml')?.getElementsByTagName('si') || []).map(textoDe);
  // Primera hoja según el libro (Excel puede renombrar sheet1.xml).
  const libro = leer('xl/workbook.xml');
  const rels = leer('xl/_rels/workbook.xml.rels');
  const idHoja = libro?.getElementsByTagName('sheet')[0]?.getAttribute('r:id');
  const destino = Array.from(rels?.getElementsByTagName('Relationship') || []).find((r) => r.getAttribute('Id') === idHoja)?.getAttribute('Target');
  const ruta = destino ? `xl/${destino.replace(/^\/?xl\//, '')}` : Object.keys(zip).find((k) => /^xl\/worksheets\/[^/]+\.xml$/.test(k));
  const hoja = ruta && leer(ruta);
  if (!hoja) throw new Error('El archivo no tiene hojas. ¿Es un Excel (.xlsx)?');
  return Array.from(hoja.getElementsByTagName('row')).map((fila) => {
    const valores = [];
    Array.from(fila.getElementsByTagName('c')).forEach((c, i) => {
      const col = c.getAttribute('r') ? indiceColumna(c.getAttribute('r')) : i;
      const tipo = c.getAttribute('t');
      const v = c.getElementsByTagName('v')[0]?.textContent ?? '';
      valores[col] = tipo === 's' ? (compartidos[Number(v)] ?? '') : tipo === 'inlineStr' ? textoDe(c) : v;
    });
    return Array.from(valores, (v) => String(v ?? '').trim());
  });
};
