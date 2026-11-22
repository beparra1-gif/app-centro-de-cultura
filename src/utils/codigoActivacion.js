// Entrega del código de activación del club por WhatsApp (Modificar cuenta,
// Altas y bajas → Cuentas sin activar).

// Número para wa.me: solo dígitos con código de país (Chile por defecto).
export const telefonoParaWhatsApp = (telefono = '') => {
  const digitos = String(telefono || '').replace(/\D/g, '');
  if (digitos.startsWith('56') && digitos.length === 11) return digitos;
  if (digitos.length === 9 && digitos.startsWith('9')) return `56${digitos}`;
  if (digitos.length === 8) return `569${digitos}`;
  return digitos.length >= 10 ? digitos : '';
};

// datos = respuesta de cuentasAPI.generarCodigoActivacion.
export const mensajeCodigoActivacion = (datos) => {
  const nombre = String(datos?.nombre || '').split(' ')[0];
  return [
    `Hola${nombre ? ` ${nombre}` : ''}! Este es tu código de activación de la app del Club Centro de Cultura Física: ${datos?.codigo}`,
    '',
    `1. Entra a ${window.location.origin}`,
    '2. Toca "Ingreso Usuarios CCF" y luego "¿Primera vez u olvidaste tu contraseña?"',
    `3. Elige "Tengo un código del club", ingresa tu RUT (${datos?.rut || ''}) y el código, y crea tu contraseña.`,
    '',
    `El código vence en ${datos?.vigencia_horas || 48} horas y sirve una sola vez. No lo compartas con nadie.`,
  ].join('\n');
};
