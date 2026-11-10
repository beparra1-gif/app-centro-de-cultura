// Estado compartido de la sincronización con Google Sheets (lock isSheetsSyncRunning y último resultado).
// Extraído de server.js sin cambios de comportamiento.

const estadoSincronizacionSheets = { isSheetsSyncRunning: false, lastSheetsSyncStatus: null };

module.exports = {
  estadoSincronizacionSheets,
};
