export const mockNotificaciones = [
  { id: 1, tipo: 'firma', titulo: 'Nueva Evaluacion Tecnica', mensaje: 'El Staff ha subido la evaluacion mensual. Requiere Acuse de Recibo.', leida: false, firmada: false },
  { id: 2, tipo: 'alerta', titulo: 'Cuota Vencida', mensaje: 'Presenta 2 meses de atraso en Tesoreria. Regularice su situacion.', leida: false, firmada: true }
];

export const mockAuditoria = [
  { id: 101, hora: '08:30', usuario: 'Super Admin', accion: 'Apertura de Sistema', detalle: 'Inicio de jornada de fin de semana.' },
  { id: 102, hora: '09:15', usuario: 'Tesorero', accion: 'Validacion Pago', detalle: 'Aprobado comprobante Familia Parra ($50.000).' },
  { id: 103, hora: '10:05', usuario: 'DT Juan', accion: 'Control Asistencia', detalle: 'Asistencia U15 Masculino registrada (95%).' }
];

export const mockComunicaciones = [
  { id: 1, TITULO: 'Suspension de Entrenamiento', CUERPO_TEXTO: 'Por reparaciones de la pista, el entrenamiento de hoy se traslada al Gimnasio B. Llegar 15 min antes.', FECHA: '07 Jul 2026', TIPO_COMUNICADO: 'Suspension', publico: true, audiencia: ['deportistas'], rama: 'Femenina', categoria: 'U15', urgencia: 'Alta', solicita_asistencia: false, reacciones: { '👍': 5, '❤️': 2, '😢': 1 }, asistencias: [] },
  { id: 2, TITULO: 'Cena Anual de Recaudacion', CUERPO_TEXTO: 'Invitamos a todos los apoderados e hinchas a la gran cena de este viernes. Los fondos seran para nueva indumentaria.', FECHA: '05 Jul 2026', TIPO_COMUNICADO: 'Evento', publico: true, audiencia: ['socios', 'apoderados'], rama: 'General', categoria: 'General', urgencia: 'Media', solicita_asistencia: true, reacciones: { '👍': 8, '❤️': 12 }, asistencias: [] },
  { id: 3, TITULO: 'Resultados de Evaluaciones U15', CUERPO_TEXTO: 'Los informes de evaluacion tecnica del mes de junio estan disponibles para los jugadores inscritos en la seccion Academia.', FECHA: '03 Jul 2026', TIPO_COMUNICADO: 'Rendimiento', publico: false, audiencia: ['deportistas', 'apoderados'], rama: 'Masculina', categoria: 'U15', urgencia: 'Baja', solicita_asistencia: false, reacciones: { '👍': 3 }, asistencias: [] },
  { id: 4, TITULO: 'Asamblea Extraordinaria de Socios', CUERPO_TEXTO: 'Se convoca a todos los socios a la asamblea del proximo jueves a las 19:30 hrs. Temas: reforma estatutaria y presupuesto 2027.', FECHA: '08 Jul 2026', TIPO_COMUNICADO: 'Asamblea', publico: false, audiencia: ['socios'], rama: 'General', categoria: 'General', urgencia: 'Critica', solicita_asistencia: true, reacciones: { '👍': 6 }, asistencias: [] },
];

export const mockFotos = [
  { id: 1, emoji: '🏀', titulo: 'Torneo U15 Valparaiso', fecha: '05 Jul 2026' },
  { id: 2, emoji: '🏆', titulo: 'Campeones Liga Zonal', fecha: '28 Jun 2026' },
  { id: 3, emoji: '💟', titulo: 'Entrega de Indumentaria', fecha: '20 Jun 2026' },
  { id: 4, emoji: '🌈', titulo: 'Fiesta de Aniversario', fecha: '15 Jun 2026' },
];

export const productosKioscoBase = [
  { id: 1, nombre: 'Agua Mineral 500cc', costo: 400, precio: 1000, ventas: 45, emoji: '💧', stock: 4, categoria: 'Bebida' },
  { id: 2, nombre: 'Bebida Zero 330cc', costo: 600, precio: 1500, ventas: 80, emoji: '🥤', stock: 40, categoria: 'Bebida' },
  { id: 3, nombre: 'Completo Italiano', costo: 800, precio: 2500, ventas: 110, emoji: '🌭', stock: 15, categoria: 'Comida' },
  { id: 4, nombre: 'Pizza (Trozo)', costo: 1000, precio: 2000, ventas: 12, emoji: '🍕', stock: 18, categoria: 'Comida' },
  { id: 5, nombre: 'Entrada General', costo: 0, precio: 2000, ventas: 150, emoji: '🎟️', stock: 300, categoria: 'Entradas' }
];

export const mockTesoreriaDB = {
  titular: 'Familia Parra Silva', esSocio: true, estadoCuenta: 'Moroso', mesesAtraso: 2, utmValor: 71506, textoUTM: 'Calculo fijado a la UTM del mes anterior (30 Junio 2026).',
  pupilos: [
    { id: 201, nombre: 'Tomas Parra', categoria: 'U15 Masculino', nivel: 12, xp: 2450 },
    { id: 202, nombre: 'Martina Parra', categoria: 'U13 Femenino', nivel: 8, xp: 1200 }
  ]
};

export const mock12Meses = [
  { id: 1, mes: 'Ene', estado: 'pagado' }, { id: 2, mes: 'Feb', estado: 'pagado' }, { id: 3, mes: 'Mar', estado: 'pagado' }, { id: 4, mes: 'Abr', estado: 'pagado' },
  { id: 5, mes: 'May', estado: 'pagado' }, { id: 6, mes: 'Jun', estado: 'pagado' }, { id: 7, mes: 'Jul', estado: 'pendiente' }, { id: 8, mes: 'Ago', estado: 'pendiente' },
  { id: 9, mes: 'Sep', estado: 'futuro' }, { id: 10, mes: 'Oct', estado: 'futuro' }, { id: 11, mes: 'Nov', estado: 'futuro' }, { id: 12, mes: 'Dic', estado: 'futuro' }
];

export const partidosPrueba = [
  { id: 1, fecha: '06 Jul 2026', rama: 'Femenina', torneo: 'Asoc. Valparaiso', categoria: 'U15 Femenino', miEquipo: 68, rival: 52, nombreRival: 'Los Leones' },
  { id: 2, fecha: '04 Jul 2026', rama: 'Masculina', torneo: 'Asoc. Valparaiso', categoria: 'U17 Masculino', miEquipo: 60, rival: 65, nombreRival: 'Sportiva Italiana' }
];

export const mockJugador = {
  AÑO_NACIMIENTO: '2011', NUMERO_CAMISETA: '8', POSICION_DE_JUEGO: 'Alero', ESTADO_DEPORTIVO: 'Activo', ASISTENCIA: '92%',
  ESTATURA: '1.75m', PESO: '65kg', MANO_HABIL: 'Derecha', CLUB_ANTERIOR: 'Libre', BECA: 'Media Beca (50%)',
  TALLA_CAMISETA: 'M', TALLA_SHORT: 'M', POLERA_ENTREGADA: true, POLERON_ENTREGADO: false
};

export const mockEvaluacion = [
  { subject: 'Tiro', score: 85, fullMark: 100 }, { subject: 'Defensa', score: 90, fullMark: 100 },
  { subject: 'Dribbling', score: 75, fullMark: 100 }, { subject: 'Fisico', score: 80, fullMark: 100 },
  { subject: 'Tactica', score: 88, fullMark: 100 }
];

export const mockQuiz = {
  TITULO_LECCION: 'Desmarque en Ofensiva', PREGUNTA: "Cual es el objetivo principal de un 'Corte en V' (V-Cut)?",
  OPCION_A: 'Tirar inmediatamente de tres puntos.', OPCION_B: 'Enganar al defensor para recibir el balon libre.',
  OPCION_C: 'Cometer una falta intencional.', RESPUESTA_CORRECTA: 'B',
  EXPLICACION_RESPUESTA: 'Correcto. El Corte en V lleva a tu defensor en una direccion para luego cambiar bruscamente.'
};

export const mockMorosos = [
  { id: 1, nombre: 'Familia Garcia Lopez', tipo: 'socio-apoderado', mesesDeuda: 3, montoDeuda: 198000, contacto: '+56 9 1234 5678', pupilos: ['Carlos Garcia - U15M'] },
  { id: 2, nombre: 'Juan Rodriguez P.', tipo: 'socio', mesesDeuda: 4, montoDeuda: 132000, contacto: '+56 9 8765 4321', pupilos: [] },
  { id: 3, nombre: 'Familia Torres M.', tipo: 'apoderado', mesesDeuda: 1, montoDeuda: 30000, contacto: '+56 9 1122 3344', pupilos: ['Sofia Torres - U13F'] },
  { id: 4, nombre: 'Familia Ramos Diaz', tipo: 'socio-apoderado', mesesDeuda: 2, montoDeuda: 130000, contacto: 'ramos.fam@mail.com', pupilos: ['Diego Ramos - U17M'] },
  { id: 5, nombre: 'Ana Castillo V.', tipo: 'apoderado', mesesDeuda: 2, montoDeuda: 60000, contacto: '+56 9 4433 2211', pupilos: ['Ignacio Castillo - U15M'] },
  { id: 6, nombre: 'Pedro Navarro H.', tipo: 'socio', mesesDeuda: 1, montoDeuda: 33000, contacto: '+56 9 5566 7788', pupilos: [] },
];