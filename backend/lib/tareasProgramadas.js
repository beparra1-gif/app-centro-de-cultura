// Tareas cron que se registran al cargar la app (limpieza de notificaciones, UTM mensual, citaciones vencidas).
// Extraído de server.js sin cambios de comportamiento.
const cron = require('node-cron');
const { pool } = require('./db');
const { recalcularUtmHistoricaAnioActual } = require('./utm');
const { barrerCitacionesVencidas } = require('./notificaciones');

// Limpiar notificaciones antiguas cada 7 días (la tabla real es
// notificaciones_app; esta consulta apuntaba a una tabla "notificaciones"
// que nunca existió con ese nombre y fallaba en silencio cada domingo).
cron.schedule('0 3 * * 0', async () => {
  console.log('[CRON] Limpiando notificaciones antiguas...');
  try {
    await pool.query(`
      DELETE FROM notificaciones_app
      WHERE creado_en < NOW() - INTERVAL '30 days'
    `);
  } catch (err) {
    console.error('[CRON] Error limpiando notificaciones antiguas:', err.message);
  }
});

cron.schedule('0 6 1 * *', async () => {
  console.log('[CRON] Recalculando UTM histórica del año en curso...');
  try {
    await recalcularUtmHistoricaAnioActual();
    console.log('[CRON] UTM histórica recalculada.');
  } catch (err) {
    console.error('[CRON] Error recalculando UTM histórica:', err.message);
  }
});

// Marca 'no asiste' automáticamente a quien no respondió una citación antes
// de su hora_maxima_confirmacion (ver barrerCitacionesVencidas).
cron.schedule('*/5 * * * *', async () => {
  try {
    await barrerCitacionesVencidas();
  } catch (err) {
    console.error('[CRON] Error en barrido de citaciones vencidas:', err.message);
  }
});

