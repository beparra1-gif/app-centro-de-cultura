// Regla del club para teléfonos: el código de país va SIEMPRE aparte
// (prefijo_tel = '+56') y el número se guarda solo, 9 dígitos (ej. 912345678).
// Había fichas con el +56 duplicado ("+56 +56 9...", "56956...") que dejaban
// el número inservible para WhatsApp.

const PREFIJO_CHILE = '+56';

// Devuelve los 9 dígitos del número chileno. Si no se puede reconocer, deja
// el texto como venía (nunca borra un dato que no entiende).
const normalizarTelefonoChile = (valor) => {
  if (valor === null || valor === undefined) return valor;
  const texto = String(valor).trim();
  if (!texto) return '';
  let d = texto.replace(/\D/g, '');
  if (d.length === 10 && d.startsWith('0')) d = d.slice(1); // 0 de larga distancia antiguo
  while (d.length > 9 && d.startsWith('56')) d = d.slice(2); // +56 (una o más veces)
  if (d.length === 8) d = `9${d}`; // celular antiguo de 8 dígitos
  return d.length === 9 ? d : texto;
};

const CAMPOS_TELEFONO = ['telefono', 'num_segundo_contacto', 'num_emergencia'];

// Middleware para POST/PUT de cuentas, jugadores y staff: aplica la regla a
// lo que llega, así los registros nuevos y las ediciones ya quedan bien.
const normalizarTelefonosBody = (req, _res, next) => {
  const body = req.body;
  if (body && typeof body === 'object' && !Array.isArray(body)) {
    CAMPOS_TELEFONO.forEach((campo) => {
      if (typeof body[campo] === 'string') body[campo] = normalizarTelefonoChile(body[campo]);
    });
    if (body.prefijo_tel !== undefined || (typeof body.telefono === 'string' && body.telefono)) body.prefijo_tel = PREFIJO_CHILE;
  }
  next();
};

module.exports = { PREFIJO_CHILE, CAMPOS_TELEFONO, normalizarTelefonoChile, normalizarTelefonosBody };
