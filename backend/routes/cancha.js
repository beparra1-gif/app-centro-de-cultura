// Rutas de arriendo de cancha y horarios de entrenamiento (con excepciones y choques).
// Extraído de server.js sin cambios de comportamiento.
const express = require('express');
const crypto = require('crypto');
const { authenticate, requireModule, authenticateOpcional } = require('../security/auth');
const { pool } = require('../lib/db');

const router = express.Router();

// ==========================================
// 36. ENDPOINTS: ARRIENDO CANCHA
// ==========================================

// Choca con cualquier reserva activa (no anulada) del mismo día cuyo rango
// horario se solape — condición estándar de solapamiento de intervalos.
// excluirId se usa al editar/reprogramar, para no chocar contra sí misma.
const buscarChoqueArriendoCancha = async (fecha, horaInicio, horaFin, excluirId = null) => {
  const params = [fecha, horaFin, horaInicio];
  let query = `
    SELECT id_arriendo, nombre_arrendatario, hora_inicio, hora_fin
    FROM arriendos_cancha
    WHERE fecha = $1 AND estado_pago != 'anulado'
      AND hora_inicio < $2 AND hora_fin > $3
  `;
  if (excluirId) {
    params.push(excluirId);
    query += ` AND id_arriendo != $4`;
  }
  const result = await pool.query(query, params);
  return result.rows[0] || null;
};

// Choca contra el horario de entrenamiento de esa fecha exacta (expande el
// patrón recurrente para un solo día, reusando expandirHorariosEnRango de la
// sección 37 — no se referencia hasta que llega un request, momento en el
// que ya está definida más abajo en el archivo).
const buscarChoqueEntrenamiento = async (fecha, horaInicio, horaFin) => {
  const instancias = await expandirHorariosEnRango(fecha, fecha);
  return instancias.find((i) => i.hora_inicio < horaFin && i.hora_fin > horaInicio) || null;
};

// Compone ambos choques: primero arriendo-vs-arriendo (comportamiento actual
// sin cambios), después arriendo-vs-entrenamiento. Un arriendo no puede
// coexistir con ninguno de los dos en la misma franja horaria.
const buscarConflictoCanchaEnFecha = async (fecha, horaInicio, horaFin, excluirIdArriendo = null) => {
  const choqueArriendo = await buscarChoqueArriendoCancha(fecha, horaInicio, horaFin, excluirIdArriendo);
  if (choqueArriendo) return { origen: 'arriendo', ...choqueArriendo };
  const choqueEntrenamiento = await buscarChoqueEntrenamiento(fecha, horaInicio, horaFin);
  if (choqueEntrenamiento) return { origen: 'entrenamiento', ...choqueEntrenamiento };
  return null;
};

const mensajeConflictoCancha = (conflicto) => {
  if (conflicto.origen === 'entrenamiento') {
    const categorias = Array.isArray(conflicto.categorias) ? conflicto.categorias.join('/') : '';
    return `La cancha ya tiene entrenamiento ese horario (${conflicto.rama} ${categorias}, ${conflicto.hora_inicio}-${conflicto.hora_fin}).`;
  }
  return `La cancha ya está arrendada ese horario (${conflicto.nombre_arrendatario}, ${conflicto.hora_inicio}-${conflicto.hora_fin}).`;
};

router.get('/api/arriendos-cancha', authenticate, requireModule('cancha_arriendo'), async (req, res) => {
  const { desde, hasta, estado_pago } = req.query;
  try {
    const condiciones = [];
    const params = [];
    if (desde) { params.push(desde); condiciones.push(`fecha >= $${params.length}`); }
    if (hasta) { params.push(hasta); condiciones.push(`fecha <= $${params.length}`); }
    if (estado_pago) { params.push(estado_pago); condiciones.push(`estado_pago = $${params.length}`); }
    const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';
    const result = await pool.query(
      `SELECT * FROM arriendos_cancha ${where} ORDER BY fecha ASC, hora_inicio ASC`,
      params
    );
    res.json(result.rows);
  } catch (err) {
    console.error('[GET /api/arriendos-cancha]', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/api/arriendos-cancha', authenticate, requireModule('cancha_arriendo'), async (req, res) => {
  const {
    nombre_arrendatario, telefono_contacto, email_contacto,
    fecha, hora_inicio, hora_fin, valor_arriendo,
    estado_pago, metodo_pago, observaciones, registrado_por,
  } = req.body;

  if (!String(nombre_arrendatario || '').trim()) {
    return res.status(400).json({ error: 'Falta el nombre de quien arrienda.' });
  }
  if (!fecha || !hora_inicio || !hora_fin) {
    return res.status(400).json({ error: 'Falta fecha, hora de inicio o hora de término.' });
  }
  if (hora_fin <= hora_inicio) {
    return res.status(400).json({ error: 'La hora de término debe ser posterior a la hora de inicio.' });
  }

  try {
    const conflicto = await buscarConflictoCanchaEnFecha(fecha, hora_inicio, hora_fin);
    if (conflicto) {
      return res.status(409).json({ error: mensajeConflictoCancha(conflicto), conflicto });
    }

    const result = await pool.query(
      `INSERT INTO arriendos_cancha
       (nombre_arrendatario, telefono_contacto, email_contacto, fecha, hora_inicio, hora_fin,
        valor_arriendo, estado_pago, metodo_pago, observaciones, registrado_por)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [
        nombre_arrendatario.trim(), telefono_contacto || null, email_contacto || null,
        fecha, hora_inicio, hora_fin, valor_arriendo || 0,
        estado_pago || 'pendiente', metodo_pago || null, observaciones || null, registrado_por || null,
      ]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('[POST /api/arriendos-cancha]', err);
    res.status(500).json({ error: err.message });
  }
});

// Recibe una lista explícita de fechas (elegidas a mano una por una, o
// generadas por el frontend con un patrón diaria/semanal/mensual, o una
// mezcla de ambas) — el backend ya no necesita saber cómo se armó la lista,
// solo insertar lo que no choque. Reemplaza el viejo endpoint /serie
// (que solo aceptaba un patrón fijo) para que "reserva única" y "varias
// fechas" sean el mismo flujo del lado del formulario.
router.post('/api/arriendos-cancha/lote', authenticate, requireModule('cancha_arriendo'), async (req, res) => {
  const {
    nombre_arrendatario, telefono_contacto, email_contacto,
    fechas, hora_inicio, hora_fin,
    valor_arriendo, estado_pago, metodo_pago, observaciones, registrado_por,
  } = req.body;

  if (!String(nombre_arrendatario || '').trim()) {
    return res.status(400).json({ error: 'Falta el nombre de quien arrienda.' });
  }
  if (!Array.isArray(fechas) || fechas.length === 0) {
    return res.status(400).json({ error: 'Elige al menos una fecha.' });
  }
  if (fechas.length > 366) {
    return res.status(400).json({ error: 'Elige como máximo 366 fechas por reserva.' });
  }
  if (!hora_inicio || !hora_fin) {
    return res.status(400).json({ error: 'Falta hora de inicio u hora de término.' });
  }
  if (hora_fin <= hora_inicio) {
    return res.status(400).json({ error: 'La hora de término debe ser posterior a la hora de inicio.' });
  }

  try {
    const fechasUnicas = [...new Set(fechas)].sort();
    const serieId = fechasUnicas.length > 1 ? crypto.randomUUID() : null;
    const creados = [];
    const omitidos = [];

    // Una sola expansión para todo el rango del lote (no una query de
    // entrenamientos por fecha dentro del loop, que sería N+1 hasta 366
    // veces) — se agrupa por fecha para chequear cada una en memoria.
    const instanciasEnRango = await expandirHorariosEnRango(fechasUnicas[0], fechasUnicas[fechasUnicas.length - 1]);
    const instanciasPorFecha = new Map();
    instanciasEnRango.forEach((i) => {
      if (!instanciasPorFecha.has(i.fecha)) instanciasPorFecha.set(i.fecha, []);
      instanciasPorFecha.get(i.fecha).push(i);
    });

    for (const fechaStr of fechasUnicas) {
      const choque = await buscarChoqueArriendoCancha(fechaStr, hora_inicio, hora_fin);
      if (choque) {
        omitidos.push({ fecha: fechaStr, motivo: `Choca con ${choque.nombre_arrendatario} (${choque.hora_inicio}-${choque.hora_fin})` });
        continue;
      }
      const choqueEntrenamiento = (instanciasPorFecha.get(fechaStr) || [])
        .find((i) => i.hora_inicio < hora_fin && i.hora_fin > hora_inicio);
      if (choqueEntrenamiento) {
        const categorias = Array.isArray(choqueEntrenamiento.categorias) ? choqueEntrenamiento.categorias.join('/') : '';
        omitidos.push({ fecha: fechaStr, motivo: `Choca con entrenamiento ${choqueEntrenamiento.rama} ${categorias} (${choqueEntrenamiento.hora_inicio}-${choqueEntrenamiento.hora_fin})` });
        continue;
      }

      const result = await pool.query(
        `INSERT INTO arriendos_cancha
         (nombre_arrendatario, telefono_contacto, email_contacto, fecha, hora_inicio, hora_fin,
          valor_arriendo, estado_pago, metodo_pago, observaciones, serie_id, serie_tipo, registrado_por)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
         RETURNING *`,
        [
          nombre_arrendatario.trim(), telefono_contacto || null, email_contacto || null,
          fechaStr, hora_inicio, hora_fin, valor_arriendo || 0,
          estado_pago || 'pendiente', metodo_pago || null, observaciones || null,
          serieId, serieId ? 'manual' : null, registrado_por || null,
        ]
      );
      creados.push(result.rows[0]);
    }

    res.status(201).json({ serieId, creados, omitidos });
  } catch (err) {
    console.error('[POST /api/arriendos-cancha/lote]', err);
    res.status(500).json({ error: err.message });
  }
});

router.put('/api/arriendos-cancha/:id', authenticate, requireModule('cancha_arriendo'), async (req, res) => {
  const {
    nombre_arrendatario, telefono_contacto, email_contacto,
    fecha, hora_inicio, hora_fin, valor_arriendo,
    estado_pago, metodo_pago, observaciones, monto_pagado,
  } = req.body;

  try {
    if (fecha && hora_inicio && hora_fin) {
      if (hora_fin <= hora_inicio) {
        return res.status(400).json({ error: 'La hora de término debe ser posterior a la hora de inicio.' });
      }
      const conflicto = await buscarConflictoCanchaEnFecha(fecha, hora_inicio, hora_fin, req.params.id);
      if (conflicto) {
        return res.status(409).json({ error: mensajeConflictoCancha(conflicto), conflicto });
      }
    }

    // Si mandan monto_pagado y/o valor_arriendo sin estado_pago explícito, el
    // estado se deriva acá (pendiente/parcial/pagado) — así "Anular"/
    // "Reactivar" (que solo mandan estado_pago) siguen pisando el estado sin
    // que un monto_pagado viejo los contradiga. Editar el valor de una
    // reserva ya pagada (ej. corregir un precio) también recalcula el
    // estado contra el monto_pagado existente, sin tratarlo como sobrepago
    // — esa validación solo aplica cuando se está registrando un pago nuevo.
    let estadoFinal = estado_pago || null;
    const registrandoPago = monto_pagado !== undefined && monto_pagado !== null;
    if (!estado_pago && (registrandoPago || valor_arriendo != null)) {
      const filaActual = (!registrandoPago || valor_arriendo == null)
        ? (await pool.query('SELECT valor_arriendo, monto_pagado FROM arriendos_cancha WHERE id_arriendo = $1', [req.params.id])).rows[0]
        : null;
      const valorRef = valor_arriendo != null ? Number(valor_arriendo) : Number(filaActual?.valor_arriendo || 0);
      let montoRef;
      if (registrandoPago) {
        montoRef = Number(monto_pagado);
        if (Number.isNaN(montoRef) || montoRef < 0) {
          return res.status(400).json({ error: 'El monto pagado no puede ser negativo.' });
        }
        if (montoRef > valorRef) {
          return res.status(400).json({ error: `El monto pagado no puede superar el valor del arriendo ($${valorRef.toLocaleString('es-CL')}).` });
        }
      } else {
        montoRef = Number(filaActual?.monto_pagado || 0);
      }
      estadoFinal = montoRef <= 0 ? 'pendiente' : montoRef >= valorRef ? 'pagado' : 'parcial';
    }

    const result = await pool.query(
      `UPDATE arriendos_cancha SET
        nombre_arrendatario = COALESCE($1, nombre_arrendatario),
        telefono_contacto = COALESCE($2, telefono_contacto),
        email_contacto = COALESCE($3, email_contacto),
        fecha = COALESCE($4, fecha),
        hora_inicio = COALESCE($5, hora_inicio),
        hora_fin = COALESCE($6, hora_fin),
        valor_arriendo = COALESCE($7, valor_arriendo),
        estado_pago = COALESCE($8, estado_pago),
        metodo_pago = COALESCE($9, metodo_pago),
        observaciones = COALESCE($10, observaciones),
        monto_pagado = COALESCE($11, monto_pagado),
        updated_at = NOW()
       WHERE id_arriendo = $12
       RETURNING *`,
      [
        nombre_arrendatario || null, telefono_contacto || null, email_contacto || null,
        fecha || null, hora_inicio || null, hora_fin || null, valor_arriendo ?? null,
        estadoFinal, metodo_pago || null, observaciones || null,
        monto_pagado ?? null, req.params.id,
      ]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Arriendo no encontrado.' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('[PUT /api/arriendos-cancha/:id]', err);
    res.status(500).json({ error: err.message });
  }
});

router.delete('/api/arriendos-cancha/:id', authenticate, requireModule('cancha_arriendo'), async (req, res) => {
  try {
    const result = await pool.query(`DELETE FROM arriendos_cancha WHERE id_arriendo = $1 RETURNING id_arriendo`, [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Arriendo no encontrado.' });
    }
    res.json({ ok: true });
  } catch (err) {
    console.error('[DELETE /api/arriendos-cancha/:id]', err);
    res.status(500).json({ error: err.message });
  }
});

router.delete('/api/arriendos-cancha/serie/:serieId', authenticate, requireModule('cancha_arriendo'), async (req, res) => {
  try {
    const result = await pool.query(`DELETE FROM arriendos_cancha WHERE serie_id = $1 RETURNING id_arriendo`, [req.params.serieId]);
    res.json({ ok: true, borrados: result.rows.length });
  } catch (err) {
    console.error('[DELETE /api/arriendos-cancha/serie/:serieId]', err);
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 37. ENDPOINTS: HORARIOS DE ENTRENAMIENTO
// ==========================================

// Puro, sin DB: fechas ISO dentro de [desdeISO,hastaISO] donde aplica el
// patrón de recurrencia de UN horario (acota por vigencia si tiene, y
// chequea dias_mes o dias_semana según tipo_recurrencia). Reusado por
// expandirHorariosEnRango (horarios ya guardados) y por
// calcularAdvertenciasChoqueHorario (horario candidato, aún no insertado) —
// evita triplicar este loop día-por-día en el archivo.
const expandirPatronEnRango = (horario, desdeISO, hastaISO) => {
  const inicioVigencia = horario.fecha_inicio ? new Date(horario.fecha_inicio).toISOString().slice(0, 10) : null;
  const finVigencia = horario.fecha_fin ? new Date(horario.fecha_fin).toISOString().slice(0, 10) : null;
  const desdeEfectivo = inicioVigencia && inicioVigencia > desdeISO ? inicioVigencia : desdeISO;
  const hastaEfectivo = finVigencia && finVigencia < hastaISO ? finVigencia : hastaISO;

  const fechas = [];
  const inicio = new Date(`${desdeEfectivo}T00:00:00`);
  const fin = new Date(`${hastaEfectivo}T00:00:00`);
  for (let d = new Date(inicio); d <= fin; d.setDate(d.getDate() + 1)) {
    const coincide = horario.tipo_recurrencia === 'mensual'
      ? Array.isArray(horario.dias_mes) && horario.dias_mes.includes(d.getDate())
      : Array.isArray(horario.dias_semana) && horario.dias_semana.includes(d.getDay());
    if (coincide) fechas.push(d.toISOString().slice(0, 10));
  }
  return fechas;
};

// Expande horarios activos (o una lista ya cargada, para no repetir el
// SELECT) + sus excepciones en instancias concretas dentro de [desde,hasta].
const expandirHorariosEnRango = async (desde, hasta, horariosDados = null) => {
  const horarios = horariosDados || (await pool.query(`SELECT * FROM horarios_entrenamiento WHERE activo = true`)).rows;
  if (horarios.length === 0) return [];

  const excepciones = (await pool.query(
    `SELECT * FROM horarios_entrenamiento_excepciones WHERE fecha BETWEEN $1 AND $2`,
    [desde, hasta]
  )).rows;
  const excepcionesPorHorarioFecha = new Map(
    excepciones.map((e) => [`${e.id_horario}_${e.fecha.toISOString().slice(0, 10)}`, e])
  );

  const instancias = [];
  horarios.forEach((h) => {
    expandirPatronEnRango(h, desde, hasta).forEach((fechaStr) => {
      const excepcion = excepcionesPorHorarioFecha.get(`${h.id_horario}_${fechaStr}`);
      if (excepcion?.tipo === 'cancelado') return;
      instancias.push({
        id_horario: h.id_horario,
        fecha: fechaStr,
        rama: h.rama,
        categorias: h.categorias || [],
        hora_inicio: excepcion?.hora_inicio_nueva || h.hora_inicio,
        hora_fin: excepcion?.hora_fin_nueva || h.hora_fin,
        lugar: excepcion?.lugar_nuevo || h.lugar,
        entrenadores: h.entrenadores || [],
        es_reprogramado: excepcion?.tipo === 'reprogramado',
      });
    });
  });
  instancias.sort((a, b) => (a.fecha + a.hora_inicio).localeCompare(b.fecha + b.hora_inicio));
  return instancias;
};

router.get('/api/horarios-entrenamiento', authenticate, requireModule('horarios_entrenamiento'), async (req, res) => {
  try {
    const incluirInactivos = String(req.query.incluirInactivos || '').toLowerCase() === 'true';
    const where = incluirInactivos ? '' : 'WHERE activo = true';
    const result = await pool.query(
      `SELECT * FROM horarios_entrenamiento ${where} ORDER BY rama, hora_inicio`
    );
    res.json(result.rows);
  } catch (err) {
    console.error('[GET /api/horarios-entrenamiento]', err);
    res.status(500).json({ error: err.message });
  }
});

// Pública (sin exigir el módulo de gestión): lista cruda de horarios activos
// para el widget del Muro, que necesita el horario base agrupado por
// categoría ("Martes y Jueves 18:00" o "Días 1 y 15 de cada mes"), no fechas
// concretas expandidas.
router.get('/api/horarios-entrenamiento/publico', authenticateOpcional, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id_horario, rama, categorias, tipo_recurrencia, dias_semana, dias_mes, fecha_inicio, fecha_fin, hora_inicio, hora_fin, lugar, entrenadores
       FROM horarios_entrenamiento WHERE activo = true
       ORDER BY rama, hora_inicio`
    );
    res.json(result.rows);
  } catch (err) {
    console.error('[GET /api/horarios-entrenamiento/publico]', err);
    res.status(500).json({ error: err.message });
  }
});

// Expande el horario recurrente + excepciones en instancias concretas dentro
// de un rango de fechas — pública porque la usa tanto el calendario de
// gestión (con módulo) como la grilla de Arriendo de Cancha (que solo
// necesita cancha_arriendo, no horarios_entrenamiento) para mostrar ambas
// capas juntas.
router.get('/api/horarios-entrenamiento/instancias', authenticateOpcional, async (req, res) => {
  const { desde, hasta } = req.query;
  if (!desde || !hasta) {
    return res.status(400).json({ error: 'Falta desde/hasta.' });
  }
  try {
    const instancias = await expandirHorariosEnRango(desde, hasta);
    res.json(instancias);
  } catch (err) {
    console.error('[GET /api/horarios-entrenamiento/instancias]', err);
    res.status(500).json({ error: err.message });
  }
});

// Filtra un arreglo de números crudo (del body) a enteros dentro de [min,max], sin duplicados.
const limpiarDiasArray = (valores, min, max) => {
  if (!Array.isArray(valores)) return [];
  const set = new Set(
    valores.map(Number).filter((n) => Number.isInteger(n) && n >= min && n <= max)
  );
  return [...set].sort((a, b) => a - b);
};

// Igual idea para arreglos de texto (categorías, entrenadores): trim,
// descarta vacíos, dedupe, cap de largo y cantidad.
const limpiarTextoArray = (valores, maxLen = 255, maxItems = 20) => {
  if (!Array.isArray(valores)) return [];
  const set = new Set(
    valores.map((v) => String(v || '').trim().slice(0, maxLen)).filter(Boolean)
  );
  return [...set].slice(0, maxItems);
};

const DIAS_VENTANA_ADVERTENCIA_DEFECTO = 90;

// Advertencia (no bloqueante) de que un horario recién creado/editado choca
// con arriendos ya reservados dentro de su vigencia (o los próximos 90 días
// si no tiene fecha_fin, sin advertir sobre fechas pasadas). Una sola query
// de rango + cruce en memoria contra expandirPatronEnRango, para no lanzar
// una query por fecha del patrón.
const calcularAdvertenciasChoqueHorario = async (horario) => {
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  const inicioVigencia = horario.fecha_inicio ? new Date(horario.fecha_inicio) : null;
  const desde = inicioVigencia && inicioVigencia > hoy ? inicioVigencia : hoy;
  const hasta = horario.fecha_fin
    ? new Date(horario.fecha_fin)
    : new Date(desde.getTime() + DIAS_VENTANA_ADVERTENCIA_DEFECTO * 86400000);
  if (hasta < desde) return [];

  const desdeISO = desde.toISOString().slice(0, 10);
  const hastaISO = hasta.toISOString().slice(0, 10);
  const fechasPatron = new Set(expandirPatronEnRango(horario, desdeISO, hastaISO));
  if (fechasPatron.size === 0) return [];

  const { rows: arriendosEnVentana } = await pool.query(
    `SELECT id_arriendo, nombre_arrendatario, fecha, hora_inicio, hora_fin FROM arriendos_cancha
     WHERE fecha BETWEEN $1 AND $2 AND estado_pago != 'anulado'
       AND hora_inicio < $3 AND hora_fin > $4`,
    [desdeISO, hastaISO, horario.hora_fin, horario.hora_inicio]
  );
  return arriendosEnVentana
    .filter((a) => fechasPatron.has(a.fecha.toISOString().slice(0, 10)))
    .map((a) => ({ fecha: a.fecha.toISOString().slice(0, 10), nombre_arrendatario: a.nombre_arrendatario, hora_inicio: a.hora_inicio, hora_fin: a.hora_fin }));
};

router.post('/api/horarios-entrenamiento', authenticate, requireModule('horarios_entrenamiento'), async (req, res) => {
  const { rama, categorias, tipo_recurrencia, dias_semana, dias_mes, fecha_inicio, fecha_fin, hora_inicio, hora_fin, lugar, entrenadores, registrado_por } = req.body;

  if (!String(rama || '').trim()) {
    return res.status(400).json({ error: 'Falta la rama.' });
  }
  const categoriasFinal = limpiarTextoArray(categorias, 50);
  if (categoriasFinal.length === 0) {
    return res.status(400).json({ error: 'Elige al menos una categoría.' });
  }
  const entrenadoresFinal = limpiarTextoArray(entrenadores, 255);
  const tipoFinal = tipo_recurrencia === 'mensual' ? 'mensual' : 'semanal';
  const diasSemanaFinal = tipoFinal === 'semanal' ? limpiarDiasArray(dias_semana, 0, 6) : [];
  const diasMesFinal = tipoFinal === 'mensual' ? limpiarDiasArray(dias_mes, 1, 31) : [];
  if (tipoFinal === 'semanal' && diasSemanaFinal.length === 0) {
    return res.status(400).json({ error: 'Elige al menos un día de la semana.' });
  }
  if (tipoFinal === 'mensual' && diasMesFinal.length === 0) {
    return res.status(400).json({ error: 'Elige al menos un día del mes (1-31).' });
  }
  if (!hora_inicio || !hora_fin) {
    return res.status(400).json({ error: 'Falta hora de inicio u hora de término.' });
  }
  if (hora_fin <= hora_inicio) {
    return res.status(400).json({ error: 'La hora de término debe ser posterior a la hora de inicio.' });
  }
  if (fecha_inicio && fecha_fin && fecha_fin < fecha_inicio) {
    return res.status(400).json({ error: 'La fecha de término de vigencia debe ser posterior a la de inicio.' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO horarios_entrenamiento (rama, categorias, tipo_recurrencia, dias_semana, dias_mes, fecha_inicio, fecha_fin, hora_inicio, hora_fin, lugar, entrenadores, registrado_por)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING *`,
      [
        rama.trim(), categoriasFinal, tipoFinal, diasSemanaFinal, diasMesFinal,
        fecha_inicio || null, fecha_fin || null, hora_inicio, hora_fin,
        lugar || null, entrenadoresFinal, registrado_por || null,
      ]
    );
    const horarioCreado = result.rows[0];
    const advertenciasChoque = await calcularAdvertenciasChoqueHorario(horarioCreado);
    res.status(201).json({ ...horarioCreado, advertenciasChoque });
  } catch (err) {
    console.error('[POST /api/horarios-entrenamiento]', err);
    res.status(500).json({ error: err.message });
  }
});

router.put('/api/horarios-entrenamiento/:id', authenticate, requireModule('horarios_entrenamiento'), async (req, res) => {
  const { rama, categorias, tipo_recurrencia, dias_semana, dias_mes, fecha_inicio, fecha_fin, hora_inicio, hora_fin, lugar, entrenadores, activo } = req.body;

  if (hora_inicio && hora_fin && hora_fin <= hora_inicio) {
    return res.status(400).json({ error: 'La hora de término debe ser posterior a la hora de inicio.' });
  }
  if (fecha_inicio && fecha_fin && fecha_fin < fecha_inicio) {
    return res.status(400).json({ error: 'La fecha de término de vigencia debe ser posterior a la de inicio.' });
  }

  const categoriasFinal = categorias !== undefined ? limpiarTextoArray(categorias, 50) : null;
  if (categorias !== undefined && categoriasFinal.length === 0) {
    return res.status(400).json({ error: 'Elige al menos una categoría.' });
  }
  const entrenadoresFinal = entrenadores !== undefined ? limpiarTextoArray(entrenadores, 255) : null;
  const tipoFinal = tipo_recurrencia === 'mensual' || tipo_recurrencia === 'semanal' ? tipo_recurrencia : null;
  const diasSemanaFinal = tipoFinal === 'semanal' ? limpiarDiasArray(dias_semana, 0, 6) : (tipoFinal ? [] : null);
  const diasMesFinal = tipoFinal === 'mensual' ? limpiarDiasArray(dias_mes, 1, 31) : (tipoFinal ? [] : null);
  if (tipoFinal === 'semanal' && diasSemanaFinal.length === 0) {
    return res.status(400).json({ error: 'Elige al menos un día de la semana.' });
  }
  if (tipoFinal === 'mensual' && diasMesFinal.length === 0) {
    return res.status(400).json({ error: 'Elige al menos un día del mes (1-31).' });
  }

  try {
    const result = await pool.query(
      `UPDATE horarios_entrenamiento SET
        rama = COALESCE($1, rama),
        categorias = COALESCE($2, categorias),
        tipo_recurrencia = COALESCE($3, tipo_recurrencia),
        dias_semana = COALESCE($4, dias_semana),
        dias_mes = COALESCE($5, dias_mes),
        fecha_inicio = $6,
        fecha_fin = $7,
        hora_inicio = COALESCE($8, hora_inicio),
        hora_fin = COALESCE($9, hora_fin),
        lugar = COALESCE($10, lugar),
        entrenadores = COALESCE($11, entrenadores),
        activo = COALESCE($12, activo),
        updated_at = NOW()
       WHERE id_horario = $13
       RETURNING *`,
      [
        rama || null, categoriasFinal, tipoFinal, diasSemanaFinal, diasMesFinal,
        fecha_inicio || null, fecha_fin || null,
        hora_inicio || null, hora_fin || null, lugar || null, entrenadoresFinal,
        activo === undefined ? null : Boolean(activo),
        req.params.id,
      ]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Horario no encontrado.' });
    }
    const horarioActualizado = result.rows[0];
    const advertenciasChoque = await calcularAdvertenciasChoqueHorario(horarioActualizado);
    res.json({ ...horarioActualizado, advertenciasChoque });
  } catch (err) {
    console.error('[PUT /api/horarios-entrenamiento/:id]', err);
    res.status(500).json({ error: err.message });
  }
});

router.delete('/api/horarios-entrenamiento/:id', authenticate, requireModule('horarios_entrenamiento'), async (req, res) => {
  try {
    const result = await pool.query(`DELETE FROM horarios_entrenamiento WHERE id_horario = $1 RETURNING id_horario`, [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Horario no encontrado.' });
    }
    res.json({ ok: true });
  } catch (err) {
    console.error('[DELETE /api/horarios-entrenamiento/:id]', err);
    res.status(500).json({ error: err.message });
  }
});

router.get('/api/horarios-entrenamiento/:id/excepciones', authenticate, requireModule('horarios_entrenamiento'), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM horarios_entrenamiento_excepciones WHERE id_horario = $1 ORDER BY fecha ASC`,
      [req.params.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('[GET /api/horarios-entrenamiento/:id/excepciones]', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/api/horarios-entrenamiento/:id/excepciones', authenticate, requireModule('horarios_entrenamiento'), async (req, res) => {
  const { fecha, tipo, hora_inicio_nueva, hora_fin_nueva, lugar_nuevo, motivo, registrado_por } = req.body;
  const tipoFinal = tipo === 'reprogramado' ? 'reprogramado' : 'cancelado';

  if (!fecha) {
    return res.status(400).json({ error: 'Falta la fecha de la excepción.' });
  }
  if (tipoFinal === 'reprogramado' && (!hora_inicio_nueva || !hora_fin_nueva)) {
    return res.status(400).json({ error: 'Para reprogramar, indica la nueva hora de inicio y término.' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO horarios_entrenamiento_excepciones
       (id_horario, fecha, tipo, hora_inicio_nueva, hora_fin_nueva, lugar_nuevo, motivo, registrado_por)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (id_horario, fecha) DO UPDATE SET
         tipo = EXCLUDED.tipo,
         hora_inicio_nueva = EXCLUDED.hora_inicio_nueva,
         hora_fin_nueva = EXCLUDED.hora_fin_nueva,
         lugar_nuevo = EXCLUDED.lugar_nuevo,
         motivo = EXCLUDED.motivo
       RETURNING *`,
      [
        req.params.id, fecha, tipoFinal,
        tipoFinal === 'reprogramado' ? hora_inicio_nueva : null,
        tipoFinal === 'reprogramado' ? hora_fin_nueva : null,
        lugar_nuevo || null, motivo || null, registrado_por || null,
      ]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('[POST /api/horarios-entrenamiento/:id/excepciones]', err);
    res.status(500).json({ error: err.message });
  }
});

router.delete('/api/horarios-entrenamiento-excepciones/:id', authenticate, requireModule('horarios_entrenamiento'), async (req, res) => {
  try {
    const result = await pool.query(`DELETE FROM horarios_entrenamiento_excepciones WHERE id_excepcion = $1 RETURNING id_excepcion`, [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Excepción no encontrada.' });
    }
    res.json({ ok: true });
  } catch (err) {
    console.error('[DELETE /api/horarios-entrenamiento-excepciones/:id]', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
