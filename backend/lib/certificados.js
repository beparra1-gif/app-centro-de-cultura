// Certificados del club: tipos válidos (de las plantillas Word de Secretaría),
// código de verificación (va en el QR) y datos mínimos que se muestran al
// verificar sin iniciar sesión.
const crypto = require('crypto');

// Mantener los ids alineados con src/utils/certificados.js (textos del PDF).
// vigenciaDias: lo que dice cada plantilla; null = sin vencimiento.
const TIPOS_CERTIFICADO = {
  alumno_regular: { titulo: 'Certificado de alumno regular', vigenciaDias: 90 },
  liberacion: { titulo: 'Certificado de liberación', vigenciaDias: null },
  participacion_permiso: { titulo: 'Certificado de participación y permiso', vigenciaDias: null },
  vigencia_pago: { titulo: 'Certificado de vigencia y pago de cuota', vigenciaDias: 30 },
  permanencia_participacion: { titulo: 'Certificado de permanencia y participación', vigenciaDias: null },
};

// Imágenes que sube un admin (nunca van en el código público de la app).
const RECURSOS_CERTIFICADO = ['firma_secretario', 'firma_presidente', 'timbre'];

// Sin 0/O/1/I/L para que se pueda dictar o tipear sin confusiones.
const ALFABETO = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const generarCodigoVerificacion = (largo = 12) => {
  const bytes = crypto.randomBytes(largo);
  return Array.from(bytes, (b) => ALFABETO[b % ALFABETO.length]).join('');
};

const codigoValido = (codigo) => typeof codigo === 'string' && new RegExp(`^[${ALFABETO}]{12}$`).test(codigo);

// 12345678-9 → **.***.678-9: confirma a quién corresponde sin publicar el RUT completo.
const enmascararRut = (rut = '') => {
  const limpio = String(rut).replace(/[^0-9kK]/g, '').toUpperCase();
  if (limpio.length < 4) return '';
  const cuerpo = limpio.slice(0, -1);
  return `**.***.${cuerpo.slice(-3)}-${limpio.slice(-1)}`;
};

const folioCertificado = (id, fecha = new Date()) => `CCF-${fecha.getFullYear()}-${String(id).padStart(5, '0')}`;

// Suma días a una fecha AAAA-MM-DD (sin desfase de zona horaria).
const sumarDias = (fechaISO, dias) => {
  const [a, m, d] = String(fechaISO).split('-').map(Number);
  const f = new Date(Date.UTC(a, m - 1, d + dias));
  return f.toISOString().slice(0, 10);
};

// Datos propios de cada plantilla que el admin completa al emitir.
const textoCorto = (v, max) => String(v ?? '').trim().slice(0, max);
const listaCorta = (v, maxItems, maxLargo) => (Array.isArray(v) ? v : [])
  .map((x) => textoCorto(x, maxLargo)).filter(Boolean).slice(0, maxItems);
const DIAS_SEMANA = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;
const limpiarExtraCertificado = (extra = {}) => {
  const e = extra && typeof extra === 'object' ? extra : {};
  const monto = Math.round(Number(String(e.monto_cuota ?? '').replace(/[^\d]/g, '')));
  // Un tramo por día, en orden de la semana; se descartan horas mal escritas.
  const horarioSemana = (Array.isArray(e.horario_semana) ? e.horario_semana : [])
    .filter((h) => h && DIAS_SEMANA.includes(h.dia) && HORA.test(h.desde) && HORA.test(h.hasta) && h.desde < h.hasta)
    .map((h) => ({ dia: h.dia, desde: h.desde, hasta: h.hasta }))
    .filter((h, i, arr) => arr.findIndex((x) => x.dia === h.dia) === i)
    .sort((a, b) => DIAS_SEMANA.indexOf(a.dia) - DIAS_SEMANA.indexOf(b.dia));
  return {
    horario_semana: horarioSemana,
    torneos: listaCorta(e.torneos, 15, 140),
    monto_cuota: Number.isFinite(monto) && monto > 0 ? monto : null,
  };
};

// Lo que cada plantilla necesita para poder emitirse. Devuelve un error o null.
const faltaParaEmitir = (tipo, { extra, presentadoAnte, alDiaVerificado }) => {
  if (tipo === 'participacion_permiso') {
    if (!presentadoAnte) return 'Indica el establecimiento educacional al que va dirigido.';
    if (!extra.horario_semana.length) return 'Indica al menos un día y horario de entrenamiento.';
  }
  if (tipo === 'permanencia_participacion' && !extra.torneos.length) return 'Indica al menos una competición en la que participa.';
  if (tipo === 'vigencia_pago') {
    if (!extra.monto_cuota) return 'Indica el monto de la cuota mensual.';
    // shortcut: el servidor no recalcula la deuda (vive en el frontend, misma lógica de Tesorería);
    // la bandeja del admin bloquea si hay meses pendientes y envía esta confirmación.
    if (alDiaVerificado !== true) return 'Solo se emite con todas las mensualidades al día.';
  }
  return null;
};

module.exports = {
  TIPOS_CERTIFICADO, RECURSOS_CERTIFICADO, generarCodigoVerificacion, codigoValido, enmascararRut,
  folioCertificado, sumarDias, limpiarExtraCertificado, faltaParaEmitir, DIAS_SEMANA,
};
