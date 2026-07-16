/**
 * Web App receptor de eventos del backend CCF.
 * Instalar dentro del Google Sheet "BASE_CCF": Extensiones > Apps Script,
 * pegar este archivo, y desplegar como Web App (ver README.md de esta carpeta).
 *
 * Registra en la pestaña AUDITORIA_CAMBIOS cada creación/edición/borrado que
 * hace el backend en jugadores, cuentas, pagos, etc. No modifica las pestañas
 * de datos (JUGADORES, CUENTAS, PAGOS_MENSUALIDADES) — solo deja un registro
 * de auditoría de "qué cambió, quién y cuándo".
 */

// Debe coincidir EXACTO con GOOGLE_SHEETS_WEBHOOK_TOKEN en el backend.
// No pegues el token real aca si vas a subir este archivo a un repositorio:
// reemplaza el valor directamente en el editor de Apps Script (Google), que
// vive fuera de git y no se comparte al hacer commit/push.
var SECRET_TOKEN = 'REEMPLAZA_CON_TU_TOKEN';

var HOJA_AUDITORIA = 'AUDITORIA_CAMBIOS';

var ENCABEZADOS = [
  'event_time', 'table', 'action', 'path', 'status_code',
  'actor_id', 'actor_rut', 'actor_rol', 'params_json', 'body_json',
  'note', 'run_at',
];

function doPost(e) {
  try {
    var token = (e.parameter && e.parameter.token) || '';
    if (token !== SECRET_TOKEN) {
      return respuestaJson({ ok: false, error: 'Token inválido.' }, 401);
    }

    var payload = JSON.parse(e.postData.contents || '{}');

    if (payload.type === 'ping') {
      return respuestaJson({ ok: true, pong: true });
    }

    var eventos = Array.isArray(payload.events) ? payload.events : [];
    if (eventos.length === 0) {
      return respuestaJson({ ok: true, appended: 0 });
    }

    var hoja = obtenerOCrearHoja(HOJA_AUDITORIA);
    var ahora = new Date().toISOString();

    var filas = eventos.map(function (evento) {
      var actor = evento.actor || {};
      return [
        evento.occurredAt || ahora,
        evento.table || '',
        evento.action || '',
        evento.path || '',
        evento.statusCode || '',
        actor.id || '',
        actor.rut || '',
        actor.rol || '',
        JSON.stringify(evento.params || {}),
        JSON.stringify(evento.body || {}),
        '',
        ahora,
      ];
    });

    hoja.getRange(hoja.getLastRow() + 1, 1, filas.length, ENCABEZADOS.length).setValues(filas);

    return respuestaJson({ ok: true, appended: filas.length });
  } catch (err) {
    return respuestaJson({ ok: false, error: String(err && err.message || err) }, 500);
  }
}

function obtenerOCrearHoja(nombre) {
  var libro = SpreadsheetApp.getActiveSpreadsheet();
  var hoja = libro.getSheetByName(nombre);
  if (!hoja) {
    hoja = libro.insertSheet(nombre);
  }
  if (hoja.getLastRow() === 0) {
    hoja.getRange(1, 1, 1, ENCABEZADOS.length).setValues([ENCABEZADOS]);
  }
  return hoja;
}

function respuestaJson(objeto) {
  return ContentService
    .createTextOutput(JSON.stringify(objeto))
    .setMimeType(ContentService.MimeType.JSON);
}
