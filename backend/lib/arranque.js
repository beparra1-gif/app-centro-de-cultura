// Tareas de arranque: migraciones idempotentes (ensure*) y saneamientos que
// antes se disparaban todas en paralelo dentro de app.listen. Ahora corren
// una tras otra, en el mismo orden de siempre; si una falla se registra el
// mismo mensaje de error de antes y se sigue con la siguiente.
const {
  ensureCuentasExtendedColumns,
  ensureJugadoresExtendedColumns,
  ensureJugadoresBecaNumerica,
  ensureBecaRevisionesTable,
  hashearClavesEnTextoPlano,
  ensureConsentimientoDatos,
  ensureCodigosAccesoTable,
  limpiarAuditoriaSensible,
  ensureBecaHistorialTable,
  ensureComunicacionesExtendedColumns,
  ensureQuizExtendedColumns,
  ensureEvaluacionesTable,
  ensureGamificacionPuntosTable,
  ensureQuizRespuestasTable,
  ensureAcademiaInteraccionesTable,
  ensureAsistenciaExtendedColumns,
  ensurePartidosLiveCoreColumns,
  ensurePartidosLiveMesaColumns,
  ensureTorneosTable,
  ensureTorneoEquiposTable,
  ensurePartidosLiveTorneoEquiposColumns,
  ensureClubesLogoColumn,
  ensureCuentasMesInicioCobroColumn,
  ensurePartidosLiveLogos,
  ensurePagosMensualidadesColumns,
  ensureLogoAssetsTable,
  ensureAcademiaVideosTable,
  ensureAcademiaPizarrasTable,
  ensureKioscoTables,
  ensureArriendosCanchaTable,
  ensureHorariosEntrenamientoTable,
  ensureHorariosEntrenamientoExcepcionesTable,
  ensureStaffTable,
  ensureCitacionesTables,
  ensureNotificacionesAppTable,
  ensureTarjetasColeccionadasTable,
  ensureAusenciasJugadorTable,
  ensureSuperAdminAccount,
  ensureUtmMensualTable,
} = require('./esquema');
const { refirmarUrlsAcademiaVideo } = require('./academia');
const { recalcularUtmHistoricaAnioActual } = require('./utm');

const TAREAS_DE_ARRANQUE = [
  [ensureCuentasExtendedColumns, '❌ Error verificando columnas extendidas de cuentas:'],
  [ensureJugadoresExtendedColumns, '❌ Error verificando columnas extendidas de jugadores:'],
  [ensureJugadoresBecaNumerica, '❌ Error migrando columna beca a porcentaje:'],
  [ensureBecaRevisionesTable, '❌ Error verificando tabla beca_revisiones:'],
  [hashearClavesEnTextoPlano, '❌ Error hasheando contraseñas en texto plano:'],
  [ensureConsentimientoDatos, '❌ Error verificando tablas de consentimiento:'],
  [ensureCodigosAccesoTable, '❌ Error verificando tabla codigos_acceso:'],
  [limpiarAuditoriaSensible, '❌ Error limpiando datos sensibles de auditoría:'],
  [ensureBecaHistorialTable, '❌ Error verificando tabla beca_historial:'],
  [ensureComunicacionesExtendedColumns, '❌ Error verificando columnas extendidas de comunicaciones:'],
  [ensureQuizExtendedColumns, '❌ Error verificando columnas extendidas de quiz_preguntas:'],
  [ensureEvaluacionesTable, '❌ Error verificando tabla evaluaciones:'],
  [ensureGamificacionPuntosTable, '❌ Error verificando tabla gamificacion_puntos:'],
  [ensureQuizRespuestasTable, '❌ Error verificando tabla quiz_respuestas:'],
  [ensureAcademiaInteraccionesTable, '❌ Error verificando tabla academia_material_interacciones:'],
  [ensureAsistenciaExtendedColumns, '❌ Error verificando columnas extendidas de asistencia:'],
  [ensurePartidosLiveCoreColumns, '❌ Error verificando columnas base partidos_live:'],
  [ensurePartidosLiveMesaColumns, '❌ Error verificando columnas avanzadas de mesa:'],
  [ensureTorneosTable, '❌ Error verificando tabla torneos:'],
  [ensureTorneoEquiposTable, '❌ Error verificando tabla torneo_equipos:'],
  [ensurePartidosLiveTorneoEquiposColumns, '❌ Error verificando columnas de equipos en partidos_live:'],
  [ensureClubesLogoColumn, '❌ Error verificando columna logo_url de clubes:'],
  [ensureCuentasMesInicioCobroColumn, '❌ Error verificando columna mes_inicio_cobro de cuentas:'],
  [ensurePartidosLiveLogos, '❌ Error verificando columnas de logos partidos_live:'],
  [ensurePagosMensualidadesColumns, '❌ Error verificando columnas pagos_mensualidades:'],
  [ensureLogoAssetsTable, '❌ Error verificando tabla logo_assets:'],
  [ensureAcademiaVideosTable, '❌ Error verificando tabla academia_videos:'],
  [ensureAcademiaPizarrasTable, '❌ Error verificando tabla academia_pizarras:'],
  [ensureKioscoTables, '❌ Error verificando tablas de kiosco:'],
  [ensureArriendosCanchaTable, '❌ Error verificando tabla arriendos_cancha:'],
  [ensureHorariosEntrenamientoTable, '❌ Error verificando tabla horarios_entrenamiento:'],
  [ensureHorariosEntrenamientoExcepcionesTable, '❌ Error verificando tabla horarios_entrenamiento_excepciones:'],
  [ensureStaffTable, '❌ Error verificando tabla staff:'],
  [ensureCitacionesTables, '❌ Error verificando tablas de citaciones:'],
  [ensureNotificacionesAppTable, '❌ Error verificando tabla notificaciones_app:'],
  [refirmarUrlsAcademiaVideo, '❌ Error re-firmando URLs de video de Academia:'],
  [ensureTarjetasColeccionadasTable, '❌ Error verificando tabla tarjetas_coleccionadas:'],
  [ensureAusenciasJugadorTable, '❌ Error verificando tabla ausencias_jugador:'],
  [ensureSuperAdminAccount, '❌ Error asegurando super admin:'],
  [
    async () => {
      await ensureUtmMensualTable();
      await recalcularUtmHistoricaAnioActual();
      console.log('📅 UTM histórica recalculada al arrancar.');
    },
    '❌ Error verificando/recalculando UTM histórica:',
  ],
];

const ejecutarTareasDeArranque = async () => {
  for (const [tarea, mensajeError] of TAREAS_DE_ARRANQUE) {
    try {
      await tarea();
    } catch (error) {
      console.error(mensajeError, error.message);
    }
  }
};

module.exports = { ejecutarTareasDeArranque };
