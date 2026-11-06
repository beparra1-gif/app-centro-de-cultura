// Aviso de privacidad y consentimiento para el tratamiento de datos
// personales — Ley N° 19.628, modificada por la Ley N° 21.719 (D.O.
// 13-12-2024, vigente desde el 1 de diciembre de 2026).
//
// Acotado, a pedido del Club, al uso que el propio Club hace de los datos y
// de las imágenes. Sigue el consentimiento del art. 12, los datos sensibles
// del art. 16 y las reglas de niños, niñas y adolescentes del art. 16 quáter. Es un
// BORRADOR: debe revisarlo un abogado antes de publicarlo. Datos del
// responsable tomados del Certificado de Directorio de Persona Jurídica sin
// Fines de Lucro emitido el 24-08-2026 (directiva elegida el 10-11-2025 por
// 2 años: actualizar representanteLegal tras la próxima elección).
//
// Si el texto cambia de forma sustancial, subir VERSION_AVISO: todas las
// cuentas vuelven a verlo en su siguiente ingreso y la nueva aceptación queda
// registrada (tabla consentimientos_datos).
export const VERSION_AVISO = '2026-11-v2';
export const FECHA_AVISO = '6 de noviembre de 2026';

// Datos del responsable (art. 14 ter letras b y c). rut y correoSolicitudes
// son opcionales: si se agregan, el aviso los muestra automáticamente.
export const DATOS_CLUB = {
  nombre: 'Centro de Cultura Física Viña del Mar',
  inscripcion: 'N° 224149, del 22 de marzo de 1990',
  rut: '',
  representanteLegal: 'Herna Erika Campos Castro, presidenta',
  domicilio: 'calle José Francisco Vergara s/n, Viña del Mar, Región de Valparaíso',
  correoSolicitudes: '',
  whatsapp: '+56 9 5329 7869',
};

// Canal para ejercer derechos (art. 14 ter letra c): correo si existe,
// siempre WhatsApp y domicilio postal.
const canalesContacto = () => {
  const canales = [
    DATOS_CLUB.correoSolicitudes ? `al correo ${DATOS_CLUB.correoSolicitudes}` : null,
    `al WhatsApp del Club ${DATOS_CLUB.whatsapp}`,
    `por escrito a ${DATOS_CLUB.domicilio}`,
  ].filter(Boolean);
  return `${canales.slice(0, -1).join(', ')} o ${canales[canales.length - 1]}`;
};

// Aviso acotado a lo que hace el propio Club con los datos y las imágenes
// (pedido del Club, 2026-11-06).
export const SECCIONES_AVISO = [
  {
    titulo: '1. Quién es responsable de tus datos y cómo contactarnos',
    texto: `${DATOS_CLUB.nombre} (el "Club"), persona jurídica sin fines de lucro inscrita en el Registro Nacional de Personas Jurídicas sin Fines de Lucro con el ${DATOS_CLUB.inscripcion}${DATOS_CLUB.rut ? `, RUT ${DATOS_CLUB.rut}` : ''}, representada legalmente por ${DATOS_CLUB.representanteLegal}, con domicilio en ${DATOS_CLUB.domicilio}, es la responsable de los datos personales registrados en esta aplicación. Para cualquier consulta o solicitud sobre tus datos puedes escribir ${canalesContacto()}.`,
  },
  {
    titulo: '2. Qué datos usa el Club',
    texto: 'Identificación y contacto (nombre, RUT, fecha de nacimiento, correo, teléfono, dirección y comuna); actividad deportiva (rama, categoría, asistencia, citaciones, evaluaciones y estadísticas); pagos (cuotas, comprobantes, becas y deudas); fotografías (de perfil y de la tarjeta del deportista); y datos de salud necesarios para la seguridad deportiva (alergias, tipo de sangre, lesiones y contacto de emergencia).',
  },
  {
    titulo: '3. Para qué los usa el Club',
    texto: 'Solo para las actividades del Club: gestionar la inscripción y la membresía; organizar entrenamientos, citaciones, partidos y torneos; registrar asistencia, evaluaciones y estadísticas; administrar cuotas, pagos y becas; enviarte comunicaciones del Club; y actuar ante emergencias de salud durante las actividades. El Club no vende tus datos ni los usa para fines ajenos a su actividad deportiva.',
  },
  {
    titulo: '4. Uso de tu imagen',
    texto: 'Con tu autorización (casilla opcional al final), el Club puede publicar fotografías y videos de entrenamientos, partidos y actividades en el muro de esta aplicación y en sus redes sociales, para difundir la actividad del Club. Si no lo autorizas, tu imagen solo se usará dentro de la aplicación para identificarte (foto de perfil y tarjeta del deportista). Puedes retirar esta autorización cuando quieras.',
  },
  {
    titulo: '5. Datos de salud',
    texto: 'Son datos sensibles: el Club solo los usa con tu consentimiento expreso, para proteger la integridad de los deportistas, y solo los ven el cuerpo técnico y la administración del Club.',
  },
  {
    titulo: '6. Niños, niñas y adolescentes',
    texto: 'El Club trata sus datos atendiendo a su interés superior. Los datos e imágenes de menores de 14 años se usan con la autorización de su madre, padre, representante legal o de quien tenga su cuidado personal. Desde los 14 años el adolescente puede autorizar por sí mismo, salvo sus datos de salud: mientras sea menor de 16 años, esos datos requieren la autorización de su madre, padre o representante.',
  },
  {
    titulo: '7. Por cuánto tiempo',
    texto: 'Mientras mantengas tu relación con el Club. Después, solo el tiempo necesario para cumplir obligaciones legales o contables del Club; luego se eliminan.',
  },
  {
    titulo: '8. Tus derechos',
    texto: `Puedes pedir acceso, rectificación, supresión, oposición, portabilidad y bloqueo temporal de tus datos escribiendo ${canalesContacto()}. Responderemos dentro de 30 días corridos, prorrogables por una sola vez por otros 30. Puedes retirar tu autorización en cualquier momento; eso no afecta el uso hecho antes, aunque puede impedir usar la aplicación. Si no respondemos a tiempo o rechazamos tu solicitud, puedes recurrir a la Agencia de Protección de Datos Personales.`,
  },
];

// Tramo de edad del titular de la cuenta (art. 16 quáter), lo informa el
// backend (GET /api/consentimiento/estado):
//  'adulto'        → 18+ o cuentas que no son de un deportista
//  'adolescente16' → 16 y 17: consiente todo por sí mismo
//  'adolescente14' → 14 y 15: consiente sus datos, pero NO los de salud
//  'nino'          → menor de 14 (o deportista sin fecha de nacimiento):
//                    el consentimiento lo da su madre, padre o apoderado
export const casillasPara = (tramo) => {
  const imagen = {
    campo: 'autoriza_imagen',
    obligatorio: false,
    texto: '(Opcional) Autorizo el uso de fotografías y videos de las actividades en los canales del Club (muro, redes sociales).',
  };
  if (tramo === 'nino') {
    return [{
      campo: 'declara_lectura',
      obligatorio: true,
      texto: 'Leí este aviso. Entiendo que mi madre, padre o apoderado es quien autoriza al Club a usar mis datos.',
    }];
  }
  if (tramo === 'adolescente14') {
    return [
      {
        campo: 'acepta_tratamiento',
        obligatorio: true,
        texto: 'He leído el aviso y autorizo al Club a tratar mis datos personales para las finalidades indicadas. Entiendo que mis datos de salud los autoriza mi madre, padre o apoderado.',
      },
      imagen,
    ];
  }
  return [
    {
      campo: 'acepta_tratamiento',
      obligatorio: true,
      texto: tramo === 'adolescente16'
        ? 'He leído el aviso y autorizo al Club a tratar mis datos personales para las finalidades indicadas.'
        : 'He leído el aviso y autorizo al Club a tratar mis datos personales, y los de los deportistas a mi cargo, para las finalidades indicadas.',
    },
    {
      campo: 'acepta_datos_salud',
      obligatorio: true,
      texto: tramo === 'adolescente16'
        ? 'Autorizo expresamente el tratamiento de mis datos de salud necesarios para la seguridad en la práctica deportiva.'
        : 'Autorizo expresamente el tratamiento de los datos de salud, míos y de los deportistas a mi cargo, necesarios para la seguridad en la práctica deportiva.',
    },
    imagen,
  ];
};
