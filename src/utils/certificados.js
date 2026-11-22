// Certificados del club: textos (los de las plantillas Word de Secretaría,
// cambiando solo datos y fechas) y armado del PDF con firmas, timbre y QR de
// validación. Los ids deben coincidir con backend/lib/certificados.js.
import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { QRCodeCanvas } from 'qrcode.react';

export const CLUB_CERT = {
  nombre: 'Centro de Cultura Física Viña del Mar',
  nombreDeportivo: 'Club Deportivo de Básquetbol Centro de Cultura Física de Viña del Mar',
  rut: '71.406.800-8',
  domicilio: 'Calle José Francisco Vergara 702, Recreo, Viña del Mar',
  correo: 'cdculturafisica702@gmail.com',
  secretario: { nombre: 'Bernardo Patricio Parra Gutiérrez', cargo: 'Secretario' },
  presidente: { nombre: 'Herna Erika Campos Castro', cargo: 'Presidenta' },
};

// Competiciones de la plantilla: se ofrecen como sugerencia, el admin marca
// solo las que corresponden a cada deportista (no todos juegan todas).
export const TORNEOS_SUGERIDOS = [
  'Campeonato de la Asociación de Básquetbol de Viña del Mar.',
  'Campeonato de la Asociación de Básquetbol de Valparaíso.',
  'Liga Lib Centro Damas.',
  'Campeonato de la Asociación de Marga Marga.',
];

export const DIAS_SEMANA = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
export const TIPOS_ESTABLECIMIENTO = ['Colegio', 'Liceo', 'Escuela', 'Jardín infantil', 'Instituto', 'Universidad', 'Otro'];

// para: qué le sirve a la familia (se muestra al solicitar).
// campos: datos que el admin completa o revisa al emitir.
export const TIPOS_CERTIFICADO = [
  { id: 'alumno_regular', titulo: 'Certificado de alumno regular', para: 'Colegio, salud o trámites: acredita que está inscrito y activo (válido 90 días).', firmas: ['secretario'], campos: [] },
  { id: 'participacion_permiso', titulo: 'Certificado de participación y permiso', para: 'Para el colegio: pide facilidades de horario para asistir a entrenamientos.', firmas: ['secretario'], campos: ['presentado_ante', 'horario_semana'] },
  { id: 'vigencia_pago', titulo: 'Certificado de vigencia y pago de cuota', para: 'Acredita que está activo y al día con la cuota (válido 30 días). Solo se emite con todas las mensualidades pagadas.', firmas: ['secretario'], campos: ['monto_cuota'], requiereAlDia: true },
  { id: 'permanencia_participacion', titulo: 'Certificado de permanencia y participación', para: 'Trayectoria y torneos en que ha participado (becas, postulaciones).', firmas: ['secretario', 'presidente'], campos: ['torneos'] },
  { id: 'liberacion', titulo: 'Certificado de liberación', para: 'Libertad de acción para incorporarse a otro club (requiere estar al día).', firmas: ['secretario'], campos: [] },
];
export const tipoCertificado = (id) => TIPOS_CERTIFICADO.find((t) => t.id === id) || null;

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const partes = (iso) => String(iso || '').slice(0, 10).split('-').map(Number);
export const fechaLarga = (iso) => {
  const [a, m, d] = partes(iso);
  return a ? `${String(d).padStart(2, '0')} de ${MESES[m - 1]} de ${a}` : '';
};
export const fechaCorta = (iso) => {
  const [a, m, d] = partes(iso);
  return a ? `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${a}` : '';
};

// 30000 → "treinta mil". Cubre montos de cuotas (hasta 999.999.999).
const UNIDADES = ['', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve', 'diez', 'once', 'doce', 'trece', 'catorce', 'quince', 'dieciséis', 'diecisiete', 'dieciocho', 'diecinueve', 'veinte', 'veintiuno', 'veintidós', 'veintitrés', 'veinticuatro', 'veinticinco', 'veintiséis', 'veintisiete', 'veintiocho', 'veintinueve'];
const DECENAS = ['', '', '', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa'];
const CENTENAS = ['', 'ciento', 'doscientos', 'trescientos', 'cuatrocientos', 'quinientos', 'seiscientos', 'setecientos', 'ochocientos', 'novecientos'];
const menorMil = (n) => {
  if (n === 100) return 'cien';
  const c = Math.floor(n / 100);
  const r = n % 100;
  const resto = r < 30 ? UNIDADES[r] : `${DECENAS[Math.floor(r / 10)]}${r % 10 ? ` y ${UNIDADES[r % 10]}` : ''}`;
  return [CENTENAS[c], resto].filter(Boolean).join(' ');
};
// Delante de "mil"/"millones": uno → un, veintiuno → veintiún.
const apocopar = (t) => t.replace(/veintiuno$/, 'veintiún').replace(/uno$/, 'un');
export const numeroEnLetras = (valor) => {
  const n = Math.floor(Number(valor) || 0);
  if (n === 0) return 'cero';
  const millones = Math.floor(n / 1e6);
  const miles = Math.floor((n % 1e6) / 1000);
  const resto = n % 1000;
  const txt = [];
  if (millones) txt.push(millones === 1 ? 'un millón' : `${apocopar(menorMil(millones))} millones`);
  if (miles) txt.push(miles === 1 ? 'mil' : `${apocopar(menorMil(miles))} mil`);
  if (resto) txt.push(menorMil(resto));
  return txt.join(' ');
};
// 24423033-4 → 24.423.033-4 (como en las plantillas de Secretaría).
export const rutConPuntos = (rut = '') => {
  const limpio = String(rut).replace(/[^0-9kK]/g, '').toUpperCase();
  if (limpio.length < 2) return String(rut || '');
  return `${limpio.slice(0, -1).replace(/\B(?=(\d{3})+(?!\d))/g, '.')}-${limpio.slice(-1)}`;
};
const pesos = (n) => `$ ${Math.round(Number(n) || 0).toLocaleString('es-CL')}`;
const capitalizar = (t) => (t ? t.charAt(0).toUpperCase() + t.slice(1) : t);

// Cuerpo del certificado: lista de bloques { texto, negrita, lista }.
export const cuerpoCertificado = (tipo, datos = {}) => {
  const d = { ...datos, rut: rutConPuntos(datos.rut) };
  const extra = d.extra || {};
  const categoria = [d.categoria, d.rama].filter(Boolean).join(' ').toUpperCase() || 'sin categoría';
  const quien = `Don / Doña: ${d.nombre}    RUT: ${d.rut}`;
  const peticion = 'Se extiende el presente certificado a petición del interesado para los fines que estime convenientes.';
  switch (tipo) {
    case 'alumno_regular':
      return [
        { texto: `La Secretaría del ${CLUB_CERT.nombre}, con domicilio en ${CLUB_CERT.domicilio}, certifica que:` },
        { texto: `Don / Doña: ${d.nombre}`, negrita: true },
        { texto: `RUT: ${d.rut}`, negrita: true },
        d.fecha_nacimiento && { texto: `Fecha de Nacimiento: ${fechaCorta(d.fecha_nacimiento)}`, negrita: true },
        { texto: 'Se encuentra actualmente inscrito(a) como ALUMNO(A) REGULAR de nuestra institución deportiva, participando activamente en los procesos formativos y de entrenamiento correspondientes a la categoría:' },
        { texto: `CATEGORÍA / SERIE: ${categoria}`, negrita: true },
        { texto: 'A la fecha de emisión de este documento, el/la deportista se encuentra con su matrícula vigente y cumple con las normas de conducta y compromiso establecidas en nuestro reglamento interno.' },
        { texto: 'Se extiende el presente certificado a petición del interesado para los fines que estime convenientes (escolares, de salud o administrativos).' },
      ].filter(Boolean);
    case 'liberacion':
      return [
        { texto: `El Directorio del club ${CLUB_CERT.nombre}, con domicilio en ${CLUB_CERT.domicilio}, por medio de secretaría certifica que:` },
        { texto: quien, negrita: true },
        { texto: 'A la fecha de emisión del presente documento, el/la deportista anteriormente mencionado(a) ha dado cumplimiento íntegro a todas las obligaciones pertinentes con nuestra institución.' },
        { texto: `Por lo tanto, el ${CLUB_CERT.nombre} le otorga la LIBERTAD DE ACCIÓN, no existiendo impedimento alguno por parte de este Club para que el/la interesado(a) pueda tramitar su incorporación a la entidad deportiva que estime conveniente.` },
        { texto: 'Se extiende el presente certificado a petición de la parte interesada para los fines que estime necesarios.' },
      ];
    case 'participacion_permiso':
      return [
        { texto: `AL ESTABLECIMIENTO EDUCACIONAL: ${(d.presentado_ante || d.colegio || '').toUpperCase()}`, negrita: true },
        { texto: 'DE NUESTRA CONSIDERACIÓN:', negrita: true },
        { texto: `El ${CLUB_CERT.nombre}, a través de su Secretaría General, tiene el agrado de certificar que Don / Doña: ${d.nombre}, RUT: ${d.rut}, es deportista activo de nuestra institución, integrando la categoría ${categoria}. El/la estudiante cumple con un régimen de entrenamientos y formación deportiva regular en nuestras dependencias ubicadas en ${CLUB_CERT.domicilio.replace(/^Calle /, '')}.` },
        { texto: 'Con el objetivo de fomentar un desarrollo integral que compatibilice sus responsabilidades académicas con la práctica deportiva, solicitamos a usted brindar las facilidades horarias necesarias para que el/la estudiante pueda asistir puntualmente a sus sesiones de entrenamiento, las cuales se realizan en los siguientes días y horarios:' },
        { tabla: (extra.horario_semana || []).map((h) => [h.dia.toUpperCase(), `${h.desde} a ${h.hasta} hrs.`]) },
        { texto: 'Como institución, promovemos que el deporte sea un aliado en la formación disciplinaria y valórica de nuestros jóvenes. Agradecemos de antemano la colaboración y el apoyo que su establecimiento educativo brinde al deportista para favorecer su asistencia regular a nuestras actividades.' },
        { texto: `Para cualquier validación de esta información, puede contactarse a nuestro correo oficial: ${CLUB_CERT.correo}, o escanear el código QR de este documento.` },
      ];
    case 'vigencia_pago': {
      const monto = extra.monto_cuota;
      return [
        { texto: `El ${CLUB_CERT.nombre}, a través de su Secretaría General, certifica que:` },
        { texto: quien, negrita: true },
        { texto: `Se encuentra debidamente inscrito(a) en nuestros registros como deportista activo de la institución, participando regularmente en las actividades correspondientes a la categoría ${categoria}.` },
        { texto: `Asimismo, se deja constancia de que el deportista mantiene su situación administrativa al día${monto ? `, cancelando por concepto de participación deportiva una cuota mensual de ${pesos(monto)} (${capitalizar(numeroEnLetras(monto))} pesos)` : ''}.` },
        { texto: 'Se extiende el presente documento a petición del interesado para los fines que estime convenientes, tales como acreditación de actividad extracurricular o trámites de bienestar.' },
      ];
    }
    case 'permanencia_participacion':
      return [
        { texto: 'A quien corresponda:', negrita: true },
        { texto: `Por medio del presente documento, el ${CLUB_CERT.nombreDeportivo}, RUT N° ${CLUB_CERT.rut}, certifica formalmente que:` },
        { texto: `La/el Deportista ${d.nombre}, cédula de identidad N° ${d.rut}, es integrante activo de nuestra institución${d.fecha_ingreso ? ` desde el ${fechaLarga(d.fecha_ingreso)}` : ''}, formando parte integral de nuestras actividades deportivas, tanto en el ámbito formativo como competitivo.` },
        { texto: 'Durante su trayectoria en el club, ha integrado los planteles que nos representan en exigentes torneos, destacando su participación en:' },
        { lista: extra.torneos || [] },
        { texto: 'A lo largo de su desempeño en estas competiciones, la/el deportista ha sobresalido en el ámbito socio-deportivo, demostrando día a día valores fundamentales como la responsabilidad, la disciplina, la perseverancia y el respeto. Asimismo, exhibe una excelente capacidad para el trabajo en equipo, un marcado espíritu de inclusión y, por sobre todo, un inquebrantable compromiso con nuestra institución.' },
        { texto: 'Se extiende este certificado a petición del interesado, para los fines académicos, deportivos o personales que estime convenientes.' },
      ];
    default:
      return [{ texto: quien, negrita: true }, { texto: peticion }];
  }
};

// --- Imágenes para el PDF ---
const cargarImagen = (src) => new Promise((resolve, reject) => {
  const img = new Image();
  img.onload = () => resolve(img);
  img.onerror = () => reject(new Error('No se pudo cargar una imagen del certificado.'));
  img.src = src;
});
// Rectángulo con "tinta" (ni transparente ni casi blanco) de una imagen: las
// firmas y el timbre traen mucho margen vacío que las dejaba flotando.
const zonaConTinta = (img) => {
  const c = document.createElement('canvas');
  c.width = img.width;
  c.height = img.height;
  const ctx = c.getContext('2d');
  ctx.drawImage(img, 0, 0);
  const { data } = ctx.getImageData(0, 0, c.width, c.height);
  let x0 = c.width; let y0 = c.height; let x1 = -1; let y1 = -1;
  for (let y = 0; y < c.height; y += 1) {
    for (let x = 0; x < c.width; x += 1) {
      const i = (y * c.width + x) * 4;
      if (data[i + 3] > 40 && !(data[i] > 225 && data[i + 1] > 225 && data[i + 2] > 225)) {
        if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      }
    }
  }
  return x1 < 0 ? { x: 0, y: 0, w: img.width, h: img.height } : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
};

// Achica (el logo pesa ~5 MB) y opcionalmente atenúa para la marca de agua.
// formato 'JPEG' (fondo blanco) para lo que no necesita transparencia: pesa mucho menos.
// recortar: deja solo la zona con tinta (firmas y timbre).
const imagenReducida = async (src, lado = 500, alpha = 1, formato = 'PNG', recortar = false) => {
  const img = await cargarImagen(src);
  const zona = recortar ? zonaConTinta(img) : { x: 0, y: 0, w: img.width, h: img.height };
  const escala = Math.min(1, lado / Math.max(zona.w, zona.h));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(zona.w * escala);
  canvas.height = Math.round(zona.h * escala);
  const ctx = canvas.getContext('2d');
  if (formato === 'JPEG') {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  ctx.globalAlpha = alpha;
  ctx.drawImage(img, zona.x, zona.y, zona.w, zona.h, 0, 0, canvas.width, canvas.height);
  const url = formato === 'JPEG' ? canvas.toDataURL('image/jpeg', 0.82) : canvas.toDataURL('image/png');
  return { url, ancho: canvas.width, alto: canvas.height, formato };
};
// El QR se dibuja con el mismo componente de la app, fuera de pantalla.
// flushSync lo renderiza de inmediato; luego se espera a que el canvas tenga
// contenido (antes un tiempo fijo corto fallaba con el navegador ocupado).
const qrComoImagen = async (valor) => {
  const div = document.createElement('div');
  const root = createRoot(div);
  flushSync(() => {
    root.render(createElement(QRCodeCanvas, { value: valor, size: 320, level: 'M', marginSize: 1, fgColor: '#0B1D3A' }));
  });
  let url = null;
  for (let i = 0; i < 100 && !url; i += 1) {
    const canvas = div.querySelector('canvas');
    // Un canvas en blanco comprime a muy pocos bytes; dibujado, el QR pesa varios KB.
    const datos = canvas && canvas.width > 0 ? canvas.toDataURL('image/png') : '';
    if (datos.length > 2000) url = datos;
    else await new Promise((r) => setTimeout(r, 50));
  }
  root.unmount();
  if (!url) throw new Error('No se pudo generar el código QR.');
  return url;
};

export const urlVerificacion = (codigo) => `${window.location.origin}/?verificar=${encodeURIComponent(codigo)}`;

// cert: fila emitida de /api/certificados; recursos: { firma_secretario, firma_presidente, timbre } (data URLs).
export const generarPdfCertificadoClub = async (cert, recursos = {}) => {
  const { jsPDF } = await import('jspdf');
  const d = cert.datos || {};
  const tipo = tipoCertificado(cert.tipo);
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const ancho = doc.internal.pageSize.getWidth();
  const alto = doc.internal.pageSize.getHeight();
  const mx = 62;
  const azul = [11, 29, 58];

  const [logo, marca, qr] = await Promise.all([
    imagenReducida('/logos/club-logo.png', 220, 1, 'JPEG'),
    imagenReducida('/logos/club-logo.png', 600, 0.06, 'JPEG'),
    qrComoImagen(urlVerificacion(cert.codigo_verificacion)),
  ]);
  doc.addImage(marca.url, 'JPEG', (ancho - 380) / 2, (alto - 380) / 2, 380, 380);

  // Encabezado
  doc.addImage(logo.url, 'JPEG', mx, 34, 58, 58);
  doc.setTextColor(...azul);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text(CLUB_CERT.nombre.toUpperCase(), mx + 72, 56);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text('Fundado el 9 de agosto de 1921 · Rama Básquetbol', mx + 72, 71);
  doc.text(CLUB_CERT.domicilio, mx + 72, 84);
  doc.setDrawColor(...azul);
  doc.setLineWidth(1.2);
  doc.line(mx, 104, ancho - mx, 104);

  let y = 142;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text((tipo?.titulo || d.titulo || 'Certificado').toUpperCase(), ancho / 2, y, { align: 'center' });
  y += 30;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10.5);
  doc.setTextColor(40, 40, 40);
  doc.text(`Viña del Mar, ${fechaLarga(d.fecha_emision)}.`, ancho - mx, y, { align: 'right' });
  y += 28;

  const anchoTexto = ancho - mx * 2;
  for (const bloque of cuerpoCertificado(cert.tipo, d)) {
    if (bloque.tabla) {
      // Tabla DÍA / HORARIO, como en la plantilla del permiso escolar.
      const anchos = [130, 190];
      const filas = [['DÍA', 'HORARIO'], ...bloque.tabla];
      const x0 = mx + (anchoTexto - anchos[0] - anchos[1]) / 2;
      doc.setLineWidth(0.6);
      doc.setDrawColor(...azul);
      filas.forEach((fila, i) => {
        const yFila = y - 12 + i * 20;
        if (i === 0) { doc.setFillColor(11, 29, 58); doc.rect(x0, yFila, anchos[0] + anchos[1], 20, 'F'); }
        doc.rect(x0, yFila, anchos[0], 20);
        doc.rect(x0 + anchos[0], yFila, anchos[1], 20);
        doc.setFont('helvetica', i === 0 ? 'bold' : 'normal');
        doc.setTextColor(...(i === 0 ? [255, 255, 255] : [40, 40, 40]));
        doc.text(fila[0], x0 + anchos[0] / 2, yFila + 14, { align: 'center' });
        doc.text(fila[1], x0 + anchos[0] + anchos[1] / 2, yFila + 14, { align: 'center' });
      });
      doc.setTextColor(40, 40, 40);
      y += filas.length * 20 + 12;
      continue;
    }
    if (bloque.lista) {
      for (const item of bloque.lista) {
        const lineas = doc.splitTextToSize(item, anchoTexto - 18);
        doc.text('•', mx + 4, y);
        doc.text(lineas, mx + 18, y);
        y += lineas.length * 14 + 3;
      }
      y += 8;
      continue;
    }
    doc.setFont('helvetica', bloque.negrita ? 'bold' : 'normal');
    const lineas = doc.splitTextToSize(bloque.texto, anchoTexto);
    doc.text(lineas, mx, y, { align: 'justify', maxWidth: anchoTexto });
    y += lineas.length * 14 + 10;
  }
  if (cert.vigencia_hasta) {
    doc.setFont('helvetica', 'italic');
    doc.text(`Este certificado es válido hasta el ${fechaLarga(cert.vigencia_hasta)}.`, mx, y);
    y += 18;
  }
  if (d.observacion) {
    doc.setFont('helvetica', 'normal');
    const lineas = doc.splitTextToSize(`Observación: ${d.observacion}`, anchoTexto);
    doc.text(lineas, mx, y);
    y += lineas.length * 14 + 8;
  }

  // Firmas (1 o 2) con timbre
  const firmantes = (tipo?.firmas || ['secretario']).map((k) => ({ ...CLUB_CERT[k], firma: recursos[`firma_${k}`] }));
  // Tamaños reales pedidos por Secretaría (medidos sobre el trazo, sin márgenes): firma 6,5 cm de ancho, timbre 8 cm.
  const CM = 72 / 2.54;
  const ANCHO_FIRMA = 6.5 * CM;
  const ANCHO_TIMBRE = 8 * CM;
  const firmas = await Promise.all(firmantes.map((f) => (f.firma ? imagenReducida(f.firma, 800, 1, 'PNG', true) : null)));
  const altoFirma = Math.max(0, ...firmas.filter(Boolean).map((img) => (img.alto / img.ancho) * ANCHO_FIRMA));
  const timbre = recursos.timbre ? await imagenReducida(recursos.timbre, 900, 1, 'PNG', true) : null;
  const altoTimbre = timbre ? (timbre.alto / timbre.ancho) * ANCHO_TIMBRE : 0;
  // Como en los certificados emitidos por Secretaría: la firma se apoya sobre
  // la línea del nombre (su trazo inferior apenas la cruza) y el timbre va más
  // abajo, sobre el nombre y el cargo. Sobre la línea se reserva el alto de la
  // firma; si no cabe antes del pie (QR), las firmas pasan a una página nueva.
  const sobreLinea = altoFirma * 0.92 + 8;
  // Bajo la línea va el timbre (en su posición de los emitidos): el bloque
  // sube lo necesario para que quepa antes del pie, sin chocar con el texto.
  const bajoLinea = altoTimbre ? altoTimbre + (firmantes.length > 1 ? 12 : -6) : 46;
  let yFirma = Math.max(y + sobreLinea, Math.min(alto - 230, alto - 124 - bajoLinea));
  if (yFirma + 46 > alto - 120) {
    doc.addPage();
    doc.addImage(marca.url, 'JPEG', (ancho - 380) / 2, (alto - 380) / 2, 380, 380);
    yFirma = 90 + sobreLinea;
  }
  const anchoCol = anchoTexto / firmantes.length;
  for (const [i, f] of firmantes.entries()) {
    const cx = mx + anchoCol * i + anchoCol / 2;
    const img = firmas[i];
    if (img) {
      const h = (img.alto / img.ancho) * ANCHO_FIRMA;
      // Apoyada en la línea: solo el ~8 % inferior del trazo baja de ella.
      doc.addImage(img.url, 'PNG', cx - ANCHO_FIRMA / 2, yFirma + 2 - h * 0.92, ANCHO_FIRMA, h, undefined, 'FAST');
    }
    doc.setDrawColor(60, 60, 60);
    doc.setLineWidth(0.6);
    doc.line(cx - 90, yFirma + 2, cx + 90, yFirma + 2);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(...azul);
    doc.text(f.nombre.toUpperCase(), cx, yFirma + 16, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.text(f.cargo.toUpperCase(), cx, yFirma + 29, { align: 'center' });
    doc.text(CLUB_CERT.nombre.toUpperCase(), cx, yFirma + 42, { align: 'center' });
  }
  if (timbre) {
    const t = timbre;
    const h = altoTimbre;
    // Como en los emitidos: con una firma, a su derecha desde la línea hacia
    // abajo; con dos, al centro bajo los nombres. Si no cabe sobre el pie (QR),
    // sube lo justo (como mucho hasta quedar sobre la línea).
    const x = firmantes.length > 1
      ? (ancho - ANCHO_TIMBRE) / 2
      : Math.min(mx + anchoCol / 2 + 10, ancho - 30 - ANCHO_TIMBRE);
    const preferido = yFirma + (firmantes.length > 1 ? 12 : -6);
    const top = Math.max(yFirma + 4 - h, Math.min(preferido, alto - 124 - h));
    doc.addImage(t.url, 'PNG', x, top, ANCHO_TIMBRE, h, undefined, 'FAST');
  }

  // Pie: QR de validación
  const yPie = alto - 108;
  doc.setDrawColor(210, 214, 222);
  doc.line(mx, yPie - 10, ancho - mx, yPie - 10);
  doc.addImage(qr, 'PNG', mx, yPie, 78, 78, undefined, 'FAST');
  doc.setFontSize(8.5);
  doc.setTextColor(60, 60, 60);
  doc.setFont('helvetica', 'bold');
  doc.text(`Folio ${cert.folio} · Código de verificación ${cert.codigo_verificacion}`, mx + 92, yPie + 18);
  doc.setFont('helvetica', 'normal');
  doc.text(doc.splitTextToSize(`Documento emitido electrónicamente. Para comprobar su autenticidad y vigencia escanee el código QR o ingrese a ${urlVerificacion(cert.codigo_verificacion)}`, anchoTexto - 92), mx + 92, yPie + 33);

  doc.save(`${cert.folio} - ${(tipo?.titulo || 'certificado')} - ${d.nombre || ''}.pdf`.replace(/[\\/:*?"<>|]/g, ''));
};
