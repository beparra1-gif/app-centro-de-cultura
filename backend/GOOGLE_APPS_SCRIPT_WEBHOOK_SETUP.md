# Google Apps Script Webhook (No-Cost)

Este flujo sincroniza cambios `POST/PUT/PATCH/DELETE` desde backend hacia Google Sheet sin usar cuenta de servicio en backend.

## 1) Variables de entorno backend

Configura estas variables en tu backend deploy:

- `GOOGLE_SHEETS_WEBHOOK_ENABLED=true`
- `GOOGLE_SHEETS_WEBHOOK_URL=<URL_WEBAPP_APPS_SCRIPT>`
- `GOOGLE_SHEETS_WEBHOOK_TOKEN=<TOKEN_SECRETO>`
- `ADMIN_SYNC_TOKEN=<TOKEN_ADMIN_EXISTENTE>`

Notas:
- El webhook recibe lotes de eventos.
- Si falla el envio, el backend reintenta (cola en memoria del proceso).

## 2) Crear Apps Script

1. Abre tu Google Sheet.
2. `Extensions -> Apps Script`.
3. Reemplaza `Code.gs` por este codigo.
4. Cambia `WEBHOOK_TOKEN` por el mismo valor configurado en backend.
5. Deploy -> New deployment -> Web app.
6. Execute as: `Me`.
7. Who has access: `Anyone` (o `Anyone with link`).
8. Copia la URL y guardala en `GOOGLE_SHEETS_WEBHOOK_URL`.

```javascript
const WEBHOOK_TOKEN = 'REEMPLAZAR_TOKEN';

function normalizeTableName(name) {
  return String(name || '').trim().toUpperCase();
}

function ensureSheet(ss, name) {
  const safeName = normalizeTableName(name || 'AUDITORIA_CAMBIOS');
  let sh = ss.getSheetByName(safeName);
  if (!sh) {
    sh = ss.insertSheet(safeName);
  }
  return sh;
}

function getHeaderMap(sheet) {
  const lastCol = Math.max(sheet.getLastColumn(), 1);
  const header = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  const map = {};
  for (let i = 0; i < header.length; i += 1) {
    const key = String(header[i] || '').trim();
    if (key) map[key] = i + 1;
  }
  return map;
}

function ensureHeaders(sheet, keys) {
  const headerMap = getHeaderMap(sheet);
  let nextCol = Object.keys(headerMap).length + 1;

  keys.forEach((key) => {
    if (!headerMap[key]) {
      sheet.getRange(1, nextCol).setValue(key);
      headerMap[key] = nextCol;
      nextCol += 1;
    }
  });

  return headerMap;
}

function findRowByKey(sheet, headerMap, keyField, keyValue) {
  const col = headerMap[keyField];
  if (!col) return -1;
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return -1;

  const values = sheet.getRange(2, col, lastRow - 1, 1).getValues();
  for (let i = 0; i < values.length; i += 1) {
    if (String(values[i][0]) === String(keyValue)) return i + 2;
  }
  return -1;
}

function chooseKeyField(eventObj) {
  const body = eventObj.body || {};
  const params = eventObj.params || {};

  if (body.id != null || params.id != null) return ['id', body.id != null ? body.id : params.id];
  if (body.rut_jugador != null || params.rut != null) return ['rut_jugador', body.rut_jugador != null ? body.rut_jugador : params.rut];
  if (body.rut != null || params.rut != null) return ['rut', body.rut != null ? body.rut : params.rut];
  if (body.correo != null) return ['correo', body.correo];

  return ['_event_id', Utilities.getUuid()];
}

function writeDataEvent(ss, eventObj) {
  const table = normalizeTableName(eventObj.table || 'AUDITORIA_CAMBIOS');
  const action = String(eventObj.action || '').toUpperCase();
  const body = eventObj.body || {};
  const params = eventObj.params || {};
  const actor = eventObj.actor || {};

  const sh = ensureSheet(ss, table);
  const keyPair = chooseKeyField(eventObj);
  const keyField = keyPair[0];
  const keyValue = keyPair[1];

  const payload = {
    _event_action: action,
    _event_time: eventObj.occurredAt || new Date().toISOString(),
    _event_path: eventObj.path || '',
    _event_status_code: eventObj.statusCode || '',
    _actor_id: actor.id || '',
    _actor_rut: actor.rut || '',
    _actor_rol: actor.rol || '',
    ...body,
    ...Object.keys(params || {}).reduce((acc, k) => {
      acc[`_param_${k}`] = params[k];
      return acc;
    }, {}),
  };

  payload[keyField] = keyValue;

  const keys = Object.keys(payload);
  const headerMap = ensureHeaders(sh, keys);

  let targetRow = findRowByKey(sh, headerMap, keyField, keyValue);
  if (action === 'DELETE') {
    if (targetRow < 0) {
      targetRow = sh.getLastRow() + 1;
    }
    payload._deleted = 'true';
    payload._deleted_at = new Date().toISOString();
  } else if (targetRow < 0) {
    targetRow = sh.getLastRow() + 1;
  }

  const rowValues = new Array(Object.keys(headerMap).length).fill('');
  Object.keys(payload).forEach((key) => {
    const col = headerMap[key];
    if (!col) return;
    rowValues[col - 1] = payload[key];
  });

  sh.getRange(targetRow, 1, 1, rowValues.length).setValues([rowValues]);
}

function appendAudit(ss, eventObj) {
  const sh = ensureSheet(ss, 'AUDITORIA_CAMBIOS');
  const keys = [
    'event_time',
    'table',
    'action',
    'path',
    'status_code',
    'actor_id',
    'actor_rut',
    'actor_rol',
    'params_json',
    'body_json'
  ];
  const headerMap = ensureHeaders(sh, keys);

  const actor = eventObj.actor || {};
  const row = new Array(Object.keys(headerMap).length).fill('');
  const values = {
    event_time: eventObj.occurredAt || new Date().toISOString(),
    table: eventObj.table || '',
    action: eventObj.action || '',
    path: eventObj.path || '',
    status_code: eventObj.statusCode || '',
    actor_id: actor.id || '',
    actor_rut: actor.rut || '',
    actor_rol: actor.rol || '',
    params_json: JSON.stringify(eventObj.params || {}),
    body_json: JSON.stringify(eventObj.body || {}),
  };

  Object.keys(values).forEach((k) => {
    const col = headerMap[k];
    if (!col) return;
    row[col - 1] = values[k];
  });

  sh.appendRow(row);
}

function doPost(e) {
  try {
    const token = (e && e.parameter && e.parameter.token)
      ? String(e.parameter.token)
      : '';

    const headerToken = (e && e.postData && e.postData.type)
      ? ''
      : '';

    // Apps Script no expone facilmente headers en Web App clasica.
    // Usamos token por query param: ?token=XYZ
    if (token !== WEBHOOK_TOKEN) {
      return ContentService.createTextOutput(JSON.stringify({ ok: false, error: 'unauthorized' }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    const raw = e.postData && e.postData.contents ? e.postData.contents : '{}';
    const payload = JSON.parse(raw);
    const events = Array.isArray(payload.events) ? payload.events : [payload];

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    events.forEach((evt) => {
      appendAudit(ss, evt);
      writeDataEvent(ss, evt);
    });

    return ContentService.createTextOutput(JSON.stringify({ ok: true, processed: events.length }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: String(error.message || error) }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
```

## 3) URL final en backend

Como el script usa token por query, tu URL queda asi:

`https://script.google.com/macros/s/<DEPLOYMENT_ID>/exec?token=<TOKEN>`

Guarda esta URL completa en `GOOGLE_SHEETS_WEBHOOK_URL`.

## 4) Probar conectividad

Con backend desplegado, prueba:

- `POST /api/admin/sync-sheets/webhook-ping` con header `x-sync-token: <ADMIN_SYNC_TOKEN>`
- `POST /api/admin/sync-sheets/webhook-flush` con header `x-sync-token: <ADMIN_SYNC_TOKEN>`

Si retorna `ok: true`, el canal esta listo.

## 5) Flujo final

- Cambios en app -> backend.
- Backend registra auditoria y envia evento al webhook.
- Apps Script escribe en:
  - Pestaña de la tabla correspondiente (ej: JUGADORES, CUENTAS, PAGOS_MENSUALIDADES)
  - Pestaña AUDITORIA_CAMBIOS

Con esto tienes trazabilidad completa sin costo de infraestructura extra.
