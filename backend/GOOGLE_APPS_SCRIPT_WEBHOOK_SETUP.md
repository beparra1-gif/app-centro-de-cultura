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
const SCRIPT_VERSION = 'strict-schema-v4-2026-07-13';
const USE_TABLE_WHITELIST = false;

const KNOWN_SHEETS = new Set([
  'CUENTAS',
  'ENCUESTAS',
  'ENCUESTAS_RESPUESTAS',
  'PAGOS_MENSUALIDADES',
  'EGRESOS',
  'ALERTAS',
  'ASISTENCIA',
  'EVENTOS',
  'CAJA_EVENTO_KIOSCO',
  'MARCAS_TIEMPO',
  'CATALOGO_INVENTARIO',
  'QUIZ_PREGUNTAS',
  'PIZARRA_TACTICA',
  'ASISTENCIA_EVENTOS',
  'CONVOCATORIAS',
  'AUDITORIA_CAMBIOS',
  'PARTIDOS_LIVE',
  'JUGADORES',
  'EVALUACIONES',
  'JUGADORES_VISITA',
  'STAFF',
  'AUDITORIA',
  'ZZZ_TEST_SYNC',
  'ESTADISTICAS_STATS',
  'GAMIFICACION_PUNTOS',
  'TORNEOS',
  'CLUBES',
  'RESULTADOS',
  'COMUNICACIONES',
  'LESIONES',
  'DISCIPLINA',
  'ENTRENAMIENTOS'
]);

const SHEET_ALIASES = {
  ESTADISTICAS: 'ESTADISTICAS_STATS'
};

const ALLOWED_FIELDS_BY_TABLE = {
  JUGADORES: [
    'RUT_JUGADOR','CORREO_APODERADO','CORREO_JUGADOR','PASSWORD_JUGADOR','FORZAR_CLAVE_JUGADOR','PARENTESCO_APODERADO','NOMBRES','APELLIDO_PATERNO','APELLIDO_MATERNO','FECHA_NACIMIENTO','AÑO_NACIMIENTO','COLEGIO','RAMA','CATEGORIA','POSICION_DE_JUEGO','ESTATURA','PESO','MANO_HABIL','NUMERO_CAMISETA','CLUB_ANTERIOR','FECHA_INGRESO','MES_INICIO_COBRO','BECA','VALOR_MENSUALIDAD','MATRICULA_PAGADA','TALLA_CAMISETA','TALLA_SHORT','POLERA ENTREGADA','POLERON_ENTREGADO','DERECHOS_IMAGEN','PREVISION','TIPO_SANGRE','ALERGIAS','NOMBRE_EMERGENCIA','PARENTESCO_EMERGENCIA','NUM_EMERGENCIA','ESTADO','FOTO_JUGADOR','ESTADO_DEPORTIVO','FECHA_INICIO_BAJA','FECHA_FIN_BAJA','XP_PUNTOS'
  ],
  PAGOS_MENSUALIDADES: ['ID_PAGO','FECHA_REGISTRO','RUT_PAGOS','CONCEPTO_PAGO','CANTIDAD_MESES_PAGADOS','MESES_CORRESPONDIENTES','MONTO_TOTAL_PAGADO','COMPROBANTE_URL','ESTADO_PAGO','FECHA_APROBACION','NOTAS_TESORERIA'],
  EGRESOS: ['ID_EGRESO','FECHA_GASTO','DETALLE_DESCRIPCION','MONTO_PAGADO','ID_TORNEO_O_PARTIDO','COMPROBANTE_GASTO_URL','RUT_RESPONSABLE','CATEGORIA_EGRESO','METODO_PAGO'],
  ALERTAS: ['ID_ALERTA','FECHA_EMISION','TIPO','FECHA_AFECTADA','HORA_AFECTADA','CATEGORIA_DESTINO','MENSAJE','ENTRENADOR_AUTOR'],
  ASISTENCIA: ['ID_ASISTENCIA','FECHA','RAMA','CATEGORIA','RUT_JUGADOR','ESTADO_ASISTENCIA','OBSERVACION','ENTRENADOR_CARGO'],
  EVENTOS: ['ID_EVENTO','FECHA','HORA','TITULO','LUGAR','DESCRIPCION'],
  CAJA_EVENTO_KIOSCO: ['ID TRANSACCION','ID_EVENTO','FECHA_HORA','TIPO MOVIMIENTO','ID_PRODUCTO','PRODUCTO_O_CONCEPTO','CANTIDAD','PRECIO_UNITARIO','MONTO_TOTAL','MEDIO_PAGO','RUT_VOLUNTARIO'],
  MARCAS_TIEMPO: ['ID_MARCA','ID_PARTIDO','EQUIPO','RUT_JUGADOR','NOMBRE_JUGADOR','DORSAL','TIEMPO_RELOJ_REAL','TIEMPO_JUEGO','TIPO_DESTACADO','DESCRIPCION_EDICION'],
  CATALOGO_INVENTARIO: ['ID_PRODUCTO','CATEGORIA','NOMBRE_PRODUCTO','COSTO_COMPRA','PRECIO_VENTA','STOCK_ACTUAL','STOCK_CRITICO','ESTADO_PRODUCTO'],
  QUIZ_PREGUNTAS: ['ID_PREGUNTA','ID_LECCION','PREGUNTA','OPCION_A','OPCION_B','OPCION_C','RESPUESTA_CORRECTA','EXPLICACION_RESPUESTA'],
  PIZARRA_TACTICA: ['ID_LECCION','FECHA_PUBLICACION','RUT_AUTOR','RAMA_DESTINO','CATEGORIA_DESTINO','TITULO_LECCION','TIPO_CONTENIDO','ETIQUETAS','MULTIMEDIA_URL','PUNTOS_ENFASIS','ESTADO_PUBLICACION'],
  ASISTENCIA_EVENTOS: ['ID_ASISTENCIA','ID_EVENTO','RUT_JUGADOR','ESTADO_CONFIRMACION','MOTIVO_AUSENCIA','NECESITA_TRANSPORTE','CUPOS_AUTOS_OFRECIDOS','RESERVA_BUS_ACOMAPAÑANTE','ASISTENCIA_REAL_CANCHA'],
  CONVOCATORIAS: ['ID_CONV','FECHA_CREACION','RAMA','CATEGORIA','COMPETENCIA','DIA_PARTIDO','HORA_CITACION','HORA_PARTIDO','LUGAR','TITULARES','RESERVAS','ENTRENADOR','ESTADO'],
  AUDITORIA_CAMBIOS: ['event_time','table','action','path','status_code','actor_id','actor_rut','actor_rol','params_json','body_json','_event_action','_event_time','_event_path','_event_status_code','_actor_id','_actor_rut','_actor_rol','_event_id','note','run_at'],
  PARTIDOS_LIVE: ['ID_PARTIDO','ID_TORNEO','FECHA_HORA','CANCHA_SEDE','CATEGORIA_RAMA','EQUIPO_LOCAL','EQUIPO_VISITANTE','MODO_ESTADISTICA','PERIODO ACTUAL','PTS_LOCAL','PTS_VISITANTE','FALTAS_LOCAL_CUARTO','FALTAS_VISITA_CUARTO','TIEMPOS_MUERTOS_LOCAL','TIEMPOS_MUERTOS_VISITA','ESTADO_JUEGO','LINK_TRANSMISION_VIVO','RUT_PLANILLERO','FLECHA_POSESION','BONUS_LOCAL','BONUS_VISITANTE','RELOJ_PARTIDO','ARBITRO_PRINCIPAL','ARBITRO_ASISTENTE'],
  EVALUACIONES: ['ID_EVALUACIONES','FECHA_EVALUACION','RUT_JUGADOR','RUT_EVALUADOR','PORCENTAJE_ASISTENCIA','RADAR_TIRO','RADAR_DEFENSA','RADAR_DRIBBLING','RADAR_FISICO','RADAR_INTELIGENCIA_TACTICA','FORTALEZA_ACTUAL','ASPECTO_A_MEJORAR','METAS_CORTOPLAZO','COMENTARIOS_GENERALES','ACUSE_RECIBO_APODERADO'],
  JUGADORES_VISITA: ['ID_JUGADOR_VISITA','ID_EQUIPO_VISITANTE','RUT_JUGADOR','NOMBRE_COMPLETO','DORSAL','CATEGORIA_RAMA','ID_PARTIDO_ASOCIADO','TELEFONO_CONTACTO','ENTRENADOR_VISITA','ASISTENTE_VISITA'],
  STAFF: ['CORREO','RUT_O_ID','PASSWORD','NOMBRES','APELLIDOS_MATERNO','APELLIDO_PATERNO','FECHA_NACIMIENTO','ROL','CARGO','BIO','CERTIFICACIONES','FOTO_PERFIL_URL','ESTADO'],
  AUDITORIA: ['ID_LOG','TIMESTAMP','USUARIO','ACCION','DETALLE'],
  ZZZ_TEST_SYNC: ['_event_action','_event_time','_event_path','_event_status_code','_actor_id','_actor_rut','_actor_rol','created_at','marker','_event_id'],
  ESTADISTICAS_STATS: ['ID_REGISTRO','ID_PARTIDO','EQUIPO','RUT_JUGADOR','NOMBRE_JUGADOR','DORSAL','TIROS_LIBRES_ANOTADOS','DOBLES_ANOTADOS','TRIPLES_ANOTADOS','TOTAL_PUNTOS','REBOTES_TOTALES','ASISTENCIAS','ROBOS','BLOQUEOS','PERDIDAS','FALTAS_PERSONALES','VALORACION_EFF','NOTAS_SCOUTING_DT'],
  GAMIFICACION_PUNTOS: ['ID_REGISTRO','FECHA','RUT_JUGADOR','ID_LECCION','VIDEO_VISTO','PREGUNTAS_CORRECTAS','TOTAL_PREGUNTAS','PUNTOS_AUTOMATICOS_GANADOS'],
  TORNEOS: ['ID_TORNEO','NOMBRE_TORNEO','ORGANIZADOR','CATEGORIAS_INCLUIDAS','RAMA','FECHA_INICIO','FECHA_TERMINO','ESTADO_TORNEO','BASES_TORNEO_URL','FIXTURE_DOCUMENTOS_URL'],
  CLUBES: ['ID_CLUB','NOMBRE_OFICIAL','NOMBRE_CORTO','LOGO_URL','COLOR_PRIMARIO','COLOR_SECUNDARIO','CIUDAD_ORIGEN','ASOCIACION_LIGA','DIRECCION_SEDE_GIMNASIO'],
  RESULTADOS: ['ID_RESULTADO','ID_PARTIDO','FECHA_PUBLICACION','RIVAL','PTS_CCF','PTS_RIVAL','RESULTADO_FINAL','CONTEXTO_JUEGO','FRASE_MOTIVACIONAL','FOTO_DESTACADA_URL','ESTADO_PUBLICACION'],
  COMUNICACIONES: ['ID_POST','FECHA','AUTOR_RUT','TIPO_COMUNICADO','TITULO','LIKES','COOMENTARIOS','CUERPO_TEXTO','IMAGEN_ADJUNTA_URL','LINK_ADJUNTO','RAMA_DESTINO','CATEGORIA_DESTINO','ACUSE_DE_RECIBO','ESTADO_AVISO','FECHA_EXPIRACION','NOTIFICACION_PUSH'],
  CUENTAS: ['CORREO_APODERADO','RUT','PASSWORD','NOMBRES','APELLIDO_PATERNO','APELLIDO_MATERNO','FECHA_NACIMIENTO','ESTADO_CIVIL','DIRECCION','COMUNA','PREFIJO_TEL','TELEFONO','PROFESIÓN_OFICIO','NOMBRE_SEGUNDO_CONTACTO','PARENTESCO_SEGUNDO_CONTACTO','NUM_SEGUNDO_CONTACTO','ES_SOCIO','FECHA_INGRESO_SOCIO','ROL','FORZAR_CLAVE','FOTO_PERFIL_URL','ESTADO','AUTORIZACION_IMAGEN','DIA_PAGO_ACORDADO'],
  ENCUESTAS: ['ID','PREGUNTA','OPCIONES','VOTOS'],
  ENCUESTAS_RESPUESTAS: ['ID_ENCUESTA','RUT_RESPONDENTE','OPCION_SELECCIONADA','COMENTARIO_ADICIONAL'],
  LESIONES: ['RUT_JUGADOR','TIPO_LESION','DESCRIPCION','FECHA_LESION','FECHA_RECUPERACION_ESTIMADA','MEDICO_TRATANTE','ESTADO_LESION'],
  DISCIPLINA: ['RUT_JUGADOR','TIPO_SANCION','RAZON_SANCION','FECHA_SANCION','DURACION_DIAS','MULTA_APLICADA','APLICADA_POR','ESTADO'],
  ENTRENAMIENTOS: ['RAMA','CATEGORIA','FECHA_ENTRENAMIENTO','HORA_INICIO','HORA_FIN','LUGAR','ENTRENADOR_A_CARGO','TEMA_ENTRENAMIENTO','CAPACIDAD']
};

const ALLOWED_CANONICAL_BY_TABLE = Object.fromEntries(
  Object.entries(ALLOWED_FIELDS_BY_TABLE).map(([table, headers]) => [
    table,
    new Set(headers.map((h) => normalizeHeaderKey(h)))
  ])
);

function normalizeTableName(name) {
  return String(name || '').trim().toUpperCase();
}

function resolveSheetName(tableName) {
  const normalized = normalizeTableName(tableName || 'AUDITORIA_CAMBIOS');
  const aliased = SHEET_ALIASES[normalized] || normalized;
  if (KNOWN_SHEETS.has(aliased)) return aliased;
  return 'AUDITORIA_CAMBIOS';
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

function normalizeHeaderKey(value) {
  return String(value || '')
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Z0-9]/g, '');
}

function buildCanonicalHeaderIndex(headerMap) {
  const index = {};
  Object.keys(headerMap).forEach((header) => {
    const canonical = normalizeHeaderKey(header);
    if (canonical && !index[canonical]) {
      index[canonical] = headerMap[header];
    }
  });
  return index;
}

function filterPayloadByTable(payload, table) {
  if (!USE_TABLE_WHITELIST) return payload;

  const allowed = ALLOWED_CANONICAL_BY_TABLE[table];
  if (!allowed) return payload;

  const filtered = {};
  Object.keys(payload).forEach((key) => {
    if (allowed.has(normalizeHeaderKey(key))) {
      filtered[key] = payload[key];
    }
  });

  return filtered;
}

function appendUsingExistingHeaders(sheet, payload) {
  const headerMap = getHeaderMap(sheet);
  const headers = Object.keys(headerMap);
  const canonicalHeaderIndex = buildCanonicalHeaderIndex(headerMap);

  // Modo estricto: no se crean columnas nuevas. Si no hay cabeceras, se omite.
  if (headers.length === 0) return;

  const rowValues = new Array(headers.length).fill('');
  const unknown = {};

  Object.keys(payload).forEach((key) => {
    const directCol = headerMap[key];
    const canonicalCol = canonicalHeaderIndex[normalizeHeaderKey(key)] || null;
    const col = directCol || canonicalCol;

    if (!col) {
      unknown[key] = payload[key];
      return;
    }

    const value = payload[key];
    rowValues[col - 1] = value == null ? '' : value;
  });

  // Si existe columna _extras_json, guardamos campos no mapeados sin abrir columnas nuevas.
  if (headerMap._extras_json && Object.keys(unknown).length > 0) {
    rowValues[headerMap._extras_json - 1] = JSON.stringify(unknown);
  }

  sheet.appendRow(rowValues);
}

function writeDataEvent(ss, eventObj) {
  const table = resolveSheetName(eventObj.table || 'AUDITORIA_CAMBIOS');
  const action = String(eventObj.action || '').toUpperCase();
  const body = eventObj.body || {};
  const params = eventObj.params || {};
  const actor = eventObj.actor || {};

  const sh = ensureSheet(ss, table);

  const payload = {
    _event_id: Utilities.getUuid(),
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

  if (action === 'DELETE') {
    payload._deleted = 'true';
    payload._deleted_at = new Date().toISOString();
  }

  const filteredPayload = filterPayloadByTable(payload, table);

  // Append-only + esquema estricto: solo columnas ya existentes en la hoja.
  appendUsingExistingHeaders(sh, filteredPayload);
}

function appendAudit(ss, eventObj) {
  const sh = ensureSheet(ss, 'AUDITORIA_CAMBIOS');

  const actor = eventObj.actor || {};
  const payload = {
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

  const filteredPayload = filterPayloadByTable(payload, 'AUDITORIA_CAMBIOS');
  appendUsingExistingHeaders(sh, filteredPayload);
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
      return ContentService.createTextOutput(JSON.stringify({ ok: false, error: 'unauthorized', script_version: SCRIPT_VERSION }))
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

    return ContentService.createTextOutput(JSON.stringify({ ok: true, processed: events.length, script_version: SCRIPT_VERSION }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: String(error.message || error), script_version: SCRIPT_VERSION }))
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
