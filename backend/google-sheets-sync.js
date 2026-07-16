const { google } = require('googleapis');
const { SHEET_TABLE_MAP } = require('./import-google-sheets');

const normalizeValue = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const match = raw.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return match ? match[1] : raw;
};

const quoteIdent = (ident = '') => `"${String(ident || '').replace(/"/g, '""')}"`;

const tableToSheetMap = new Map(
  SHEET_TABLE_MAP.map((entry) => [String(entry.table || '').trim().toLowerCase(), String(entry.sheet || '').trim()])
);

const coerceCellValue = (value) => {
  if (value == null) return '';
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
};

const getOrderedColumns = async (pool, tableName) => {
  const result = await pool.query(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = $1
     ORDER BY ordinal_position`,
    [tableName]
  );
  return result.rows.map((row) => row.column_name);
};

const getOrderByClause = async (pool, tableName) => {
  const result = await pool.query(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = $1
       AND column_name IN ('updated_at', 'created_at', 'id', 'id_' || $1)
     ORDER BY CASE column_name
       WHEN 'updated_at' THEN 1
       WHEN 'created_at' THEN 2
       WHEN 'id' THEN 3
       ELSE 4
     END
     LIMIT 1`,
    [tableName]
  );

  const col = result.rows[0]?.column_name;
  return col ? ` ORDER BY ${quoteIdent(col)} DESC` : '';
};

// Los paneles de variables de entorno (DigitalOcean, etc.) suelen corromper
// claves privadas PEM multilinea: agregan comillas envolventes, colapsan
// saltos de linea reales a \r\n, o dejan \n como texto literal en vez de
// salto real. Normalizamos todo eso antes de pasarla a la libreria de auth.
const normalizePrivateKey = (rawValue) => {
  let key = String(rawValue || '').trim();

  if (
    (key.startsWith('"') && key.endsWith('"')) ||
    (key.startsWith("'") && key.endsWith("'"))
  ) {
    key = key.slice(1, -1).trim();
  }

  key = key.replace(/\\r\\n/g, '\n').replace(/\\n/g, '\n').replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  return key.trim();
};

const buildSheetsClient = ({ googleServiceEmail, googleServicePrivateKey }) => {
  const email = String(googleServiceEmail || '').trim();
  const privateKey = normalizePrivateKey(googleServicePrivateKey);

  if (!email || !privateKey) {
    throw new Error('Faltan GOOGLE_SERVICE_ACCOUNT_EMAIL y/o GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY para escribir en Google Sheets.');
  }

  if (!privateKey.includes('BEGIN PRIVATE KEY')) {
    throw new Error(
      'GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY no tiene formato PEM valido (falta "BEGIN PRIVATE KEY"). ' +
      'Revisa que se haya copiado completa desde el JSON de la cuenta de servicio, sin comillas extra.'
    );
  }

  const auth = new google.auth.JWT(
    email,
    null,
    privateKey,
    ['https://www.googleapis.com/auth/spreadsheets']
  );

  return google.sheets({ version: 'v4', auth });
};

const resolveSheetNameForTable = (tableName) => {
  const key = String(tableName || '').trim().toLowerCase();
  return tableToSheetMap.get(key) || String(tableName || '').trim().toUpperCase();
};

const syncTableToSheet = async ({ pool, sheetsClient, spreadsheetId, tableName, logger = console }) => {
  const table = String(tableName || '').trim();
  if (!table) return { ok: false, table, reason: 'tabla vacia' };

  const columns = await getOrderedColumns(pool, table);
  if (!columns.length) {
    return { ok: false, table, reason: 'tabla no existe o sin columnas' };
  }

  const orderBy = await getOrderByClause(pool, table);
  const dataRes = await pool.query(`SELECT * FROM ${quoteIdent(table)}${orderBy}`);
  const rows = Array.isArray(dataRes.rows) ? dataRes.rows : [];

  const values = [
    columns,
    ...rows.map((row) => columns.map((column) => coerceCellValue(row[column]))),
  ];

  const sheetName = resolveSheetNameForTable(table);

  // Limpiar primero para evitar residuos cuando disminuye el numero de filas/columnas.
  await sheetsClient.spreadsheets.values.clear({
    spreadsheetId,
    range: `${sheetName}!A:ZZ`,
  });

  await sheetsClient.spreadsheets.values.update({
    spreadsheetId,
    range: `${sheetName}!A1`,
    valueInputOption: 'RAW',
    requestBody: { values },
  });

  logger.log(`[SHEETS-WRITE] ${table} -> ${sheetName}: ${rows.length} filas sincronizadas.`);
  return { ok: true, table, sheet: sheetName, rows: rows.length };
};

const createSheetsSyncManager = ({
  pool,
  logger = console,
  googleSheetId = process.env.GOOGLE_SHEET_ID,
  googleServiceEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
  googleServicePrivateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY,
  enabled = String(process.env.GOOGLE_SHEET_BIDIRECTIONAL_SYNC || 'false').toLowerCase() === 'true',
  debounceMs = Number(process.env.GOOGLE_SHEET_SYNC_DEBOUNCE_MS || 4000),
} = {}) => {
  const spreadsheetId = normalizeValue(googleSheetId);
  const safeDebounce = Number.isFinite(debounceMs) && debounceMs >= 0 ? debounceMs : 4000;

  let sheetsClient = null;
  let timer = null;
  let flushing = false;
  const pendingTables = new Set();

  const isConfigured = () => {
    return Boolean(enabled && spreadsheetId && googleServiceEmail && googleServicePrivateKey);
  };

  const ensureClient = () => {
    if (!sheetsClient) {
      sheetsClient = buildSheetsClient({ googleServiceEmail, googleServicePrivateKey });
    }
    return sheetsClient;
  };

  const flush = async () => {
    if (flushing) return;
    if (!isConfigured()) return;

    const tables = Array.from(pendingTables);
    if (!tables.length) return;

    pendingTables.clear();
    flushing = true;

    try {
      const client = ensureClient();
      for (const tableName of tables) {
        try {
          await syncTableToSheet({
            pool,
            sheetsClient: client,
            spreadsheetId,
            tableName,
            logger,
          });
        } catch (error) {
          logger.error(`[SHEETS-WRITE] Error sincronizando ${tableName}: ${error.message}`);
        }
      }
    } finally {
      flushing = false;
      if (pendingTables.size > 0) {
        timer = setTimeout(() => {
          timer = null;
          void flush();
        }, safeDebounce);
      }
    }
  };

  const enqueueTable = (tableName) => {
    if (!tableName) return;
    pendingTables.add(String(tableName).trim());

    if (!isConfigured()) return;

    if (!timer) {
      timer = setTimeout(() => {
        timer = null;
        void flush();
      }, safeDebounce);
    }
  };

  const syncAllMappedTables = async () => {
    if (!isConfigured()) {
      return {
        ok: false,
        reason: 'Sync bidireccional no configurado. Requiere GOOGLE_SHEET_BIDIRECTIONAL_SYNC=true y credenciales de servicio.',
      };
    }

    const client = ensureClient();
    const tables = Array.from(new Set(SHEET_TABLE_MAP.map((item) => item.table).filter(Boolean)));
    const results = [];

    for (const tableName of tables) {
      try {
        const result = await syncTableToSheet({
          pool,
          sheetsClient: client,
          spreadsheetId,
          tableName,
          logger,
        });
        results.push(result);
      } catch (error) {
        results.push({ ok: false, table: tableName, error: error.message });
      }
    }

    return {
      ok: results.every((item) => item.ok),
      total: results.length,
      results,
    };
  };

  return {
    isConfigured,
    enqueueTable,
    flush,
    syncAllMappedTables,
  };
};

module.exports = {
  createSheetsSyncManager,
  syncTableToSheet,
};
