const MODULOS_ACCESO = [
  { id: 'comunicaciones', etiqueta: 'Comunicaciones', categoria: 'General', descripcion: 'Muro, noticias y publicaciones públicas.' },
  { id: 'academia', etiqueta: 'Academia', categoria: 'Formación', descripcion: 'Materiales, quiz y pizarra táctica.' },
  { id: 'perfil', etiqueta: 'Cuenta / Perfil', categoria: 'Personal', descripcion: 'Perfil, tesorería y estados de cuenta.' },
  { id: 'jugador', etiqueta: 'Jugador / QR', categoria: 'Personal', descripcion: 'Ficha deportiva, QR y asistencia.' },
  { id: 'asistencia_staff', etiqueta: 'Asistencia Staff', categoria: 'Operación', descripcion: 'Nómina, asistencia y control de lista.' },
  { id: 'evaluacion_staff', etiqueta: 'Radar / Evaluación', categoria: 'Operación', descripcion: 'Radar biomecánico y seguimiento técnico.' },
  { id: 'scoreboard_live', etiqueta: 'Mesa / Scoreboard', categoria: 'Operación', descripcion: 'Marcador en vivo, play by play y transmisión.' },
  { id: 'kiosco', etiqueta: 'Kiosco', categoria: 'Operación', descripcion: 'Caja, inventario, fiados y POS.' },
  { id: 'admin_dashboard', etiqueta: 'Admin', categoria: 'Gestión', descripcion: 'Panel administrativo, usuarios y reportes.' },
  { id: 'salud', etiqueta: 'Salud', categoria: 'Gestión', descripcion: 'Estado del sistema, alertas y timeline.' },
  { id: 'auditoria', etiqueta: 'Auditoría', categoria: 'Gestión', descripcion: 'Trazabilidad de acciones y eventos.' },
  { id: 'citaciones', etiqueta: 'Citaciones', categoria: 'Gestión', descripcion: 'Convocatorias, autorizaciones y control.' },
  { id: 'resultados', etiqueta: 'Resultados', categoria: 'Gestión', descripcion: 'Registro manual de resultados de partidos.' },
  { id: 'invitados', etiqueta: 'Invitados', categoria: 'Gestión', descripcion: 'Jugadores de equipos invitados.' },
  { id: 'reportes', etiqueta: 'Reportes', categoria: 'Gestión', descripcion: 'Exportaciones, métricas y resúmenes.' },
  { id: 'validacion_pagos', etiqueta: 'Validación Pagos', categoria: 'Gestión', descripcion: 'Revisión y validación de mensualidades.' },
  { id: 'inventario', etiqueta: 'Inventario', categoria: 'Operación', descripcion: 'Stock y productos del kiosco.' },
  { id: 'cancha_arriendo', etiqueta: 'Arriendo de Cancha', categoria: 'Operación', descripcion: 'Calendario, cobros y análisis de arriendo de la cancha.' },
  { id: 'horarios_entrenamiento', etiqueta: 'Horarios de Entrenamiento', categoria: 'Operación', descripcion: 'Horario semanal recurrente por categoría y sus excepciones puntuales.' },
  { id: 'torneos', etiqueta: 'Torneos', categoria: 'Operación', descripcion: 'Creación de torneos, equipos, partidos y tabla de posiciones.' },
  { id: 'mesa_publica', etiqueta: 'Vista Pública', categoria: 'Público', descripcion: 'Resultados y contenidos públicos.' },
];

const ROLES_BASE = {
  visita: ['comunicaciones', 'jugador', 'mesa_publica'],
  jugador: ['comunicaciones', 'academia', 'jugador'],
  deportista: ['comunicaciones', 'academia', 'jugador'],
  apoderado: ['comunicaciones', 'academia', 'perfil', 'jugador'],
  socio: ['comunicaciones', 'academia', 'perfil', 'jugador'],
  socio_apoderado: ['comunicaciones', 'academia', 'perfil', 'jugador'],
  'socio-apoderado': ['comunicaciones', 'academia', 'perfil', 'jugador'],
  directiva: ['comunicaciones', 'academia', 'perfil', 'jugador'],
  staff: ['comunicaciones', 'academia', 'asistencia_staff', 'evaluacion_staff', 'citaciones', 'resultados'],
  mesa: ['scoreboard_live'],
  admin: ['comunicaciones', 'perfil', 'kiosco', 'admin_dashboard', 'citaciones', 'resultados', 'auditoria', 'reportes', 'validacion_pagos', 'inventario', 'salud', 'invitados', 'cancha_arriendo', 'torneos', 'horarios_entrenamiento'],
  super_admin: MODULOS_ACCESO.map((modulo) => modulo.id),
  superadmin: MODULOS_ACCESO.map((modulo) => modulo.id),
};

const PERMISOS_POR_DEFECTO = MODULOS_ACCESO.reduce((acumulado, modulo) => {
  acumulado[modulo.id] = false;
  return acumulado;
}, {});

const normalizarRol = (rol = '') => {
  const rolNormalizado = String(rol || '').trim().toLowerCase();
  if (rolNormalizado === 'deportista') return 'jugador';
  return rolNormalizado;
};

const crearPermisosDesdeLista = (modulos = []) => {
  const permisos = { ...PERMISOS_POR_DEFECTO };
  modulos.forEach((modulo) => {
    if (modulo) permisos[modulo] = true;
  });
  return permisos;
};

const obtenerPermisosBasePorRol = (rol = '') => {
  const rolNormalizado = normalizarRol(rol);
  if (rolNormalizado === 'superadmin') {
    return crearPermisosDesdeLista(MODULOS_ACCESO.map((modulo) => modulo.id));
  }

  return crearPermisosDesdeLista(ROLES_BASE[rolNormalizado] || []);
};

const fusionarPermisos = (base = {}, override = {}) => ({
  ...PERMISOS_POR_DEFECTO,
  ...base,
  ...override,
});

const obtenerPermisosEfectivos = ({ rol, override = {} } = {}) => {
  const base = obtenerPermisosBasePorRol(rol);
  if (normalizarRol(rol) === 'super_admin') {
    return crearPermisosDesdeLista(MODULOS_ACCESO.map((modulo) => modulo.id));
  }

  return fusionarPermisos(base, override);
};

const puedeVerModulo = ({ rol, modulo, override = {} } = {}) => {
  const permisos = obtenerPermisosEfectivos({ rol, override });
  return Boolean(permisos[modulo]);
};

export {
  MODULOS_ACCESO,
  ROLES_BASE,
  obtenerPermisosBasePorRol,
  obtenerPermisosEfectivos,
  puedeVerModulo,
  normalizarRol,
};
