// Certificado de pagos del año (PDF) para una familia o socio: estado de
// cada mes por concepto (cuota de socio y mensualidad de cada pupilo), lo
// pagado y si está al día. Usa los mismos estados que Tesorería → Informes.

import { DATOS_CLUB } from '../legal/avisoPrivacidad';
import { ANIO_INFORME, MESES_INFORME, construirInformeDeportistas, construirInformeSocios } from './informeDeuda';

const norm = (rut = '') => String(rut || '').replace(/[.\s-]/g, '').trim().toUpperCase();
const esCuotaSocio = (p = {}) => String(p.concepto_pago || '').trim().toLowerCase().startsWith('mensualidad socio');
const aprobado = (p = {}) => ['aprobado', 'validado'].includes(String(p.estado_pago || '').toLowerCase());
const anioDe = (p = {}) => Number((String(p.meses_correspondientes || '').match(/(20\d{2})/) || [])[1]) || ANIO_INFORME;
const pesos = (n) => `$${Math.round(Number(n) || 0).toLocaleString('es-CL')}`;

export const ETIQUETA_CORTA = {
  pagado: 'Pagado', condonado: 'Condonado', debe: 'Pendiente', parcial: 'Abono parcial', exento: 'Exento',
  'no-aplica': '—', 'en-curso': 'En curso', futuro: '',
};

// pupilos: forma de pupiloMapper (rut, nombre, fecha_ingreso, …).
export const armarCertificado = ({ titular = {}, pupilos = [], pagos = [], morosos = [], sociosMorosos = [], hoy = new Date() } = {}) => {
  const secciones = [];
  if (titular.esSocio && titular.rut) {
    const fila = construirInformeSocios({
      cuentas: [{ ...titular.cuenta, rut: titular.rut, es_socio: true }], sociosMorosos, pagos, hoy,
    })[0];
    const pagado = pagos.filter((p) => esCuotaSocio(p) && aprobado(p) && anioDe(p) === ANIO_INFORME && norm(p.rut_pagos) === norm(titular.rut))
      .reduce((s, p) => s + (Number(p.monto_total_pagado) || 0), 0);
    if (fila) secciones.push({ titulo: 'Cuota de socio', estados: fila.estados, deuda: fila.montoDeuda, pagado });
  }
  pupilos.forEach((p) => {
    const fila = construirInformeDeportistas({
      jugadores: [{ ...p, rut_jugador: p.rut, nombres: p.nombre, apellido_paterno: '' }], morosos, pagos, hoy,
    })[0];
    const pagado = pagos.filter((x) => !esCuotaSocio(x) && aprobado(x) && anioDe(x) === ANIO_INFORME && norm(x.rut_jugador) === norm(p.rut))
      .reduce((s, x) => s + (Number(x.monto_total_pagado) || 0), 0);
    if (fila) secciones.push({ titulo: `Mensualidad · ${p.nombre}`, estados: fila.estados, deuda: fila.montoDeuda, pagado });
  });
  const deuda = secciones.reduce((s, x) => s + x.deuda, 0);
  return { titular, secciones, deuda, pagado: secciones.reduce((s, x) => s + x.pagado, 0), alDia: deuda <= 0, emitido: hoy };
};

export const generarPdfCertificado = async (cert) => {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const ancho = doc.internal.pageSize.getWidth();
  const mx = 40;
  let y = 0;

  doc.setFillColor(11, 29, 58);
  doc.rect(0, 0, ancho, 78, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text(DATOS_CLUB.nombre.toUpperCase(), mx, 34);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`Personalidad jurídica ${DATOS_CLUB.inscripcion}`, mx, 52);
  doc.text(DATOS_CLUB.domicilio, mx, 66);

  y = 112;
  doc.setTextColor(11, 29, 58);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(17);
  doc.text(`Certificado de pagos ${ANIO_INFORME}`, mx, y);
  y += 24;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(40, 40, 40);
  doc.text(`Titular: ${cert.titular.nombre || ''}${cert.titular.rut ? ` · RUT ${cert.titular.rut}` : ''}`, mx, y);
  y += 16;
  doc.text(`Emitido el ${cert.emitido.toLocaleDateString('es-CL')}`, mx, y);
  y += 26;

  const anchoMes = (ancho - mx * 2) / 12;
  const colores = {
    pagado: [214, 245, 223], condonado: [232, 232, 236], debe: [253, 222, 220], parcial: [255, 236, 209], exento: [221, 233, 255],
  };
  cert.secciones.forEach((sec) => {
    if (y > 700) { doc.addPage(); y = 60; }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(11, 29, 58);
    doc.text(sec.titulo, mx, y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(60, 60, 60);
    doc.text(`Pagado ${pesos(sec.pagado)}${sec.deuda > 0 ? ` · Pendiente ${pesos(sec.deuda)}` : ' · Al día'}`, ancho - mx, y, { align: 'right' });
    y += 10;
    MESES_INFORME.forEach((m, i) => {
      const estado = sec.estados[i];
      const x = mx + i * anchoMes;
      const color = colores[estado];
      if (color) { doc.setFillColor(...color); doc.rect(x + 1, y, anchoMes - 2, 34, 'F'); }
      doc.setDrawColor(220, 220, 225);
      doc.rect(x + 1, y, anchoMes - 2, 34);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(40, 40, 40);
      doc.text(m, x + anchoMes / 2, y + 13, { align: 'center' });
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.text(ETIQUETA_CORTA[estado] || '', x + anchoMes / 2, y + 26, { align: 'center' });
    });
    y += 54;
  });

  if (y > 700) { doc.addPage(); y = 60; }
  y += 6;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...(cert.alDia ? [19, 122, 57] : [179, 38, 30]));
  const fecha = cert.emitido.toLocaleDateString('es-CL');
  doc.text(
    cert.alDia
      ? `Al ${fecha}, la cuenta se encuentra AL DÍA con sus pagos.`
      : `Al ${fecha}, la cuenta registra un saldo pendiente de ${pesos(cert.deuda)}.`,
    mx, y
  );
  y += 18;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(110, 110, 110);
  doc.text(`Total pagado en ${ANIO_INFORME}: ${pesos(cert.pagado)}. Documento generado desde la app del club; los meses en curso aún no vencen.`, mx, y);
  doc.text(`Consultas: ${DATOS_CLUB.whatsapp}`, mx, y + 14);

  const nombre = `certificado-pagos-${String(cert.titular.rut || 'cuenta').replace(/[^0-9kK]/g, '')}-${cert.emitido.toISOString().slice(0, 10)}.pdf`;
  doc.save(nombre);
  return nombre;
};
