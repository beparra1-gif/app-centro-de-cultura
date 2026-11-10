// Pool de PostgreSQL y gestores de sincronización con Google Sheets.
// Extraído de server.js sin cambios de comportamiento.
const { Pool } = require('pg');
const { setPool } = require('../security/auth');
const { createSheetsSyncManager } = require('../google-sheets-sync');
const { createSheetsWebhookSyncManager } = require('../google-sheets-webhook-sync');

// ========== DATABASE POOL ==========
const rawDatabaseUrl = String(process.env.DATABASE_URL || '');
const safeDatabaseUrl = rawDatabaseUrl.includes('sslmode=require')
  ? rawDatabaseUrl.replace('sslmode=require', 'sslmode=no-verify')
  : rawDatabaseUrl;

const shouldUseSsl =
  String(process.env.NODE_ENV || '').toLowerCase() === 'production' ||
  rawDatabaseUrl.includes('ondigitalocean.com') ||
  rawDatabaseUrl.includes('sslmode=require') ||
  rawDatabaseUrl.includes('sslmode=no-verify');

const pool = new Pool({
  connectionString: safeDatabaseUrl,
  ssl: shouldUseSsl ? { rejectUnauthorized: false } : false
});

pool.on('error', (err) => {
  console.error('Error en pool:', err);
});

setPool(pool);

const sheetsSyncManager = createSheetsSyncManager({
  pool,
  logger: console,
});

const sheetsWebhookSyncManager = createSheetsWebhookSyncManager({
  logger: console,
});

module.exports = {
  pool,
  sheetsSyncManager,
  sheetsWebhookSyncManager,
};
