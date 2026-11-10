// Rutas de kiosco: caja de evento, inventario, egresos, productos, turnos, ventas y fiados.
// Extraído de server.js sin cambios de comportamiento.
const express = require('express');
const { authenticate, requireModule, requireAnyModule } = require('../security/auth');
const { pool } = require('../lib/db');

const router = express.Router();

// ==========================================
// 27. ENDPOINTS: CAJA EVENTO (FASE 3)
// ==========================================

router.get('/api/caja-evento/:eventoId', authenticate, requireModule('kiosco'), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM caja_evento_kiosco WHERE id_evento = $1 ORDER BY fecha_movimiento DESC`,
      [req.params.eventoId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('[GET /api/caja-evento/:eventoId]', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/api/caja-evento', authenticate, requireModule('kiosco'), async (req, res) => {
  const { id_evento, tipo_movimiento, concepto, monto_ingreso, monto_egreso, metodo_pago, responsable } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO caja_evento_kiosco (id_evento, tipo_movimiento, concepto, monto_ingreso, monto_egreso, metodo_pago, responsable)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [id_evento, tipo_movimiento, concepto, monto_ingreso || 0, monto_egreso || 0, metodo_pago, responsable]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('[POST /api/caja-evento]', err);
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 28. ENDPOINTS: INVENTARIO (FASE 3)
// ==========================================

router.get('/api/inventario', authenticate, requireAnyModule('kiosco', 'inventario'), async (req, res) => {
  try {
    const result = await pool.query(`SELECT * FROM catalogo_inventario ORDER BY nombre_articulo ASC`);
    res.json(result.rows);
  } catch (err) {
    console.error('[GET /api/inventario]', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/api/inventario', authenticate, requireAnyModule('kiosco', 'inventario'), async (req, res) => {
  const { codigo_articulo, nombre_articulo, categoria, cantidad_total, precio_unitario, ubicacion, proveedor } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO catalogo_inventario (codigo_articulo, nombre_articulo, categoria, cantidad_total, cantidad_disponible, precio_unitario, fecha_ingreso, ubicacion, proveedor)
       VALUES ($1, $2, $3, $4, $4, $5, CURRENT_DATE, $6, $7)
       RETURNING *`,
      [codigo_articulo, nombre_articulo, categoria, cantidad_total, precio_unitario, ubicacion, proveedor]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('[POST /api/inventario]', err);
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 29. ENDPOINTS: EGRESOS (FASE 3)
// ==========================================

router.get('/api/egresos', authenticate, requireModule('kiosco'), async (req, res) => {
  try {
    const result = await pool.query(`SELECT * FROM egresos ORDER BY fecha_egreso DESC`);
    res.json(result.rows);
  } catch (err) {
    console.error('[GET /api/egresos]', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/api/egresos', authenticate, requireModule('kiosco'), async (req, res) => {
  const { concepto, categoria, monto_egreso, responsable, observaciones } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO egresos (fecha_egreso, concepto, categoria, monto_egreso, responsable, estado, observaciones)
       VALUES (CURRENT_DATE, $1, $2, $3, $4, 'pendiente', $5)
       RETURNING *`,
      [concepto, categoria, monto_egreso, responsable, observaciones]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('[POST /api/egresos]', err);
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 29B. ENDPOINTS: KIOSCO POS (persistencia real de turnos/ventas/fiados)
// ==========================================

router.get('/api/kiosco-productos', authenticate, requireModule('kiosco'), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM kiosco_productos WHERE activo = true ORDER BY nombre ASC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error('[GET /api/kiosco-productos]', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/api/kiosco-productos', authenticate, requireModule('kiosco'), async (req, res) => {
  const { nombre, emoji, categoria, costo, precio, stock, talla } = req.body;
  if (!nombre || precio == null) {
    return res.status(400).json({ error: 'Nombre y precio son obligatorios.' });
  }
  try {
    const result = await pool.query(
      `INSERT INTO kiosco_productos (nombre, emoji, categoria, costo, precio, stock, talla)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [nombre, emoji || '📦', categoria || 'General', costo || 0, precio, stock || 0, talla || null]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('[POST /api/kiosco-productos]', err);
    res.status(500).json({ error: err.message });
  }
});

router.put('/api/kiosco-productos/:id', authenticate, requireModule('kiosco'), async (req, res) => {
  const camposPermitidos = ['nombre', 'emoji', 'categoria', 'costo', 'precio', 'stock', 'activo', 'talla'];
  const columnas = [];
  const valores = [];
  camposPermitidos.forEach((campo) => {
    if (req.body[campo] !== undefined) {
      columnas.push(`${campo} = $${columnas.length + 1}`);
      valores.push(req.body[campo]);
    }
  });
  if (columnas.length === 0) {
    return res.status(400).json({ error: 'No hay campos para actualizar.' });
  }
  valores.push(req.params.id);
  try {
    const result = await pool.query(
      `UPDATE kiosco_productos SET ${columnas.join(', ')}, updated_at = NOW() WHERE id = $${valores.length} RETURNING *`,
      valores
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Producto no encontrado.' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('[PUT /api/kiosco-productos/:id]', err);
    res.status(500).json({ error: err.message });
  }
});

// Baja lógica (activo=false) en vez de DELETE físico: conserva la trazabilidad
// de kiosco_ventas.producto_id de ventas históricas de ese producto.
router.delete('/api/kiosco-productos/:id', authenticate, requireModule('kiosco'), async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE kiosco_productos SET activo = false, updated_at = NOW() WHERE id = $1 RETURNING *`,
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Producto no encontrado.' });
    }
    res.json({ ok: true });
  } catch (err) {
    console.error('[DELETE /api/kiosco-productos/:id]', err);
    res.status(500).json({ error: err.message });
  }
});

router.get('/api/kiosco-turnos/actual', authenticate, requireModule('kiosco'), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM kiosco_turnos WHERE estado = 'abierto' ORDER BY fecha_apertura DESC LIMIT 1`
    );
    res.json(result.rows[0] || null);
  } catch (err) {
    console.error('[GET /api/kiosco-turnos/actual]', err);
    res.status(500).json({ error: err.message });
  }
});

router.get('/api/kiosco-turnos', authenticate, requireModule('kiosco'), async (req, res) => {
  const { desde, hasta, estado } = req.query;
  try {
    const condiciones = [];
    const valores = [];
    if (estado) {
      valores.push(estado);
      condiciones.push(`estado = $${valores.length}`);
    }
    if (desde) {
      valores.push(desde);
      condiciones.push(`dia >= $${valores.length}`);
    }
    if (hasta) {
      valores.push(hasta);
      condiciones.push(`dia <= $${valores.length}`);
    }
    const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';
    const result = await pool.query(
      `SELECT * FROM kiosco_turnos ${where} ORDER BY fecha_apertura DESC LIMIT 200`,
      valores
    );
    res.json(result.rows);
  } catch (err) {
    console.error('[GET /api/kiosco-turnos]', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/api/kiosco-turnos', authenticate, requireModule('kiosco'), async (req, res) => {
  const { responsable, dia, monto_inicial } = req.body;
  if (!responsable || !dia) {
    return res.status(400).json({ error: 'Responsable y día son obligatorios.' });
  }
  try {
    const abierto = await pool.query(`SELECT id FROM kiosco_turnos WHERE estado = 'abierto' LIMIT 1`);
    if (abierto.rows.length > 0) {
      return res.status(409).json({ error: 'Ya hay un turno abierto. Ciérralo antes de abrir uno nuevo.' });
    }
    const result = await pool.query(
      `INSERT INTO kiosco_turnos (responsable, dia, monto_inicial, estado)
       VALUES ($1, $2, $3, 'abierto')
       RETURNING *`,
      [responsable, dia, monto_inicial || 0]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('[POST /api/kiosco-turnos]', err);
    res.status(500).json({ error: err.message });
  }
});

router.put('/api/kiosco-turnos/:id/cerrar', authenticate, requireModule('kiosco'), async (req, res) => {
  const {
    total_efectivo_ventas,
    total_transferencia_ventas,
    total_egresos,
    total_pendientes,
    caja_neta_final,
    firma_base64,
    cerrado_por,
    ticket_final,
  } = req.body;
  try {
    const result = await pool.query(
      `UPDATE kiosco_turnos SET
         estado = 'cerrado',
         fecha_cierre = NOW(),
         total_efectivo_ventas = $1,
         total_transferencia_ventas = $2,
         total_egresos = $3,
         total_pendientes = $4,
         caja_neta_final = $5,
         firma_base64 = $6,
         cerrado_por = $7,
         ticket_final = $8
       WHERE id = $9 AND estado = 'abierto'
       RETURNING *`,
      [
        total_efectivo_ventas || 0,
        total_transferencia_ventas || 0,
        total_egresos || 0,
        total_pendientes || 0,
        caja_neta_final || 0,
        firma_base64 || null,
        cerrado_por || null,
        ticket_final || 0,
        req.params.id,
      ]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Turno no encontrado o ya estaba cerrado.' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('[PUT /api/kiosco-turnos/:id/cerrar]', err);
    res.status(500).json({ error: err.message });
  }
});

// Solo permite borrar turnos ya cerrados (el actual/abierto no se puede eliminar
// desde el historial). Las ventas/egresos asociados no se borran: quedan con
// turno_id en null (ON DELETE SET NULL), preservando el registro de cada venta.
router.delete('/api/kiosco-turnos/:id', authenticate, requireModule('kiosco'), async (req, res) => {
  try {
    const result = await pool.query(
      `DELETE FROM kiosco_turnos WHERE id = $1 AND estado = 'cerrado' RETURNING id`,
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Turno no encontrado o no está cerrado (no se puede borrar el turno activo).' });
    }
    res.json({ ok: true, deleted: { id: result.rows[0].id } });
  } catch (err) {
    console.error('[DELETE /api/kiosco-turnos/:id]', err);
    res.status(500).json({ error: err.message });
  }
});

router.get('/api/kiosco-ventas', authenticate, requireModule('kiosco'), async (req, res) => {
  const { turno_id, desde, hasta } = req.query;
  try {
    const condiciones = [];
    const valores = [];
    if (turno_id) {
      valores.push(turno_id);
      condiciones.push(`turno_id = $${valores.length}`);
    }
    if (desde) {
      valores.push(desde);
      condiciones.push(`fecha >= $${valores.length}`);
    }
    if (hasta) {
      valores.push(`${hasta} 23:59:59`);
      condiciones.push(`fecha <= $${valores.length}`);
    }
    const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';
    const result = await pool.query(
      `SELECT * FROM kiosco_ventas ${where} ORDER BY fecha DESC LIMIT 2000`,
      valores
    );
    res.json(result.rows);
  } catch (err) {
    console.error('[GET /api/kiosco-ventas]', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/api/kiosco-ventas', authenticate, requireModule('kiosco'), async (req, res) => {
  const { turno_id, ticket_numero, producto_id, producto_nombre, cantidad, precio_unitario, subtotal, metodo_pago } = req.body;
  if (!producto_nombre || !cantidad || !metodo_pago) {
    return res.status(400).json({ error: 'Producto, cantidad y método de pago son obligatorios.' });
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    if (producto_id) {
      const stockActual = await client.query('SELECT stock FROM kiosco_productos WHERE id = $1 FOR UPDATE', [producto_id]);
      const stockDisponible = Number(stockActual.rows[0]?.stock ?? 0);
      if (stockActual.rows.length > 0 && stockDisponible < cantidad) {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: `Stock insuficiente: quedan ${stockDisponible} unidades.` });
      }
      await client.query('UPDATE kiosco_productos SET stock = GREATEST(0, stock - $1), updated_at = NOW() WHERE id = $2', [cantidad, producto_id]);
    }

    const venta = await client.query(
      `INSERT INTO kiosco_ventas (turno_id, ticket_numero, producto_id, producto_nombre, cantidad, precio_unitario, subtotal, metodo_pago)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [turno_id || null, ticket_numero || null, producto_id || null, producto_nombre, cantidad, precio_unitario || 0, subtotal || 0, metodo_pago]
    );

    await client.query('COMMIT');
    res.json(venta.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[POST /api/kiosco-ventas]', err);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

router.delete('/api/kiosco-ventas', authenticate, requireModule('kiosco'), async (req, res) => {
  try {
    await pool.query('DELETE FROM kiosco_ventas');
    res.json({ ok: true });
  } catch (err) {
    console.error('[DELETE /api/kiosco-ventas]', err);
    res.status(500).json({ error: err.message });
  }
});

router.get('/api/kiosco-fiados', authenticate, requireModule('kiosco'), async (req, res) => {
  const { estado } = req.query;
  try {
    const where = estado ? `WHERE estado = $1` : '';
    const result = await pool.query(
      `SELECT * FROM kiosco_fiados ${where} ORDER BY fecha_ultimo_movimiento DESC LIMIT 500`,
      estado ? [estado] : []
    );
    res.json(result.rows);
  } catch (err) {
    console.error('[GET /api/kiosco-fiados]', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/api/kiosco-fiados/cargo', authenticate, requireModule('kiosco'), async (req, res) => {
  const { fiado_id, nombre, detalle, monto, turno_id, ticket_numero } = req.body;
  if (!monto || Number(monto) <= 0) {
    return res.status(400).json({ error: 'El monto debe ser mayor a 0.' });
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    let fiado;

    if (fiado_id) {
      const actualizado = await client.query(
        `UPDATE kiosco_fiados SET monto_total = monto_total + $1, estado = 'abierto', fecha_ultimo_movimiento = NOW()
         WHERE id = $2 RETURNING *`,
        [monto, fiado_id]
      );
      if (actualizado.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Cuenta pendiente no encontrada.' });
      }
      fiado = actualizado.rows[0];
    } else {
      if (!nombre) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'El nombre es obligatorio para una cuenta nueva.' });
      }
      const creado = await client.query(
        `INSERT INTO kiosco_fiados (nombre, detalle, monto_total, estado)
         VALUES ($1, $2, $3, 'abierto')
         RETURNING *`,
        [nombre, detalle || '', monto]
      );
      fiado = creado.rows[0];
    }

    await client.query(
      `INSERT INTO kiosco_fiados_movimientos (fiado_id, tipo, monto, turno_id, ticket_numero)
       VALUES ($1, 'cargo', $2, $3, $4)`,
      [fiado.id, monto, turno_id || null, ticket_numero || null]
    );

    await client.query('COMMIT');
    res.json(fiado);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[POST /api/kiosco-fiados/cargo]', err);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

router.post('/api/kiosco-fiados/:id/pago', authenticate, requireModule('kiosco'), async (req, res) => {
  const { monto, metodo_pago, turno_id } = req.body;
  if (!monto || Number(monto) <= 0) {
    return res.status(400).json({ error: 'El monto debe ser mayor a 0.' });
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const actual = await client.query('SELECT * FROM kiosco_fiados WHERE id = $1 FOR UPDATE', [req.params.id]);
    if (actual.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Cuenta pendiente no encontrada.' });
    }
    const nuevoMonto = Math.max(0, Number(actual.rows[0].monto_total) - Number(monto));
    const actualizado = await client.query(
      `UPDATE kiosco_fiados SET monto_total = $1, estado = $2, fecha_ultimo_movimiento = NOW()
       WHERE id = $3 RETURNING *`,
      [nuevoMonto, nuevoMonto <= 0 ? 'pagado' : 'abierto', req.params.id]
    );

    await client.query(
      `INSERT INTO kiosco_fiados_movimientos (fiado_id, tipo, monto, metodo_pago, turno_id)
       VALUES ($1, 'pago', $2, $3, $4)`,
      [req.params.id, monto, metodo_pago || 'efectivo', turno_id || null]
    );

    await client.query('COMMIT');
    res.json(actualizado.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[POST /api/kiosco-fiados/:id/pago]', err);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

router.get('/api/kiosco-egresos', authenticate, requireModule('kiosco'), async (req, res) => {
  const { turno_id } = req.query;
  try {
    const where = turno_id ? `WHERE turno_id = $1` : '';
    const result = await pool.query(
      `SELECT * FROM kiosco_egresos ${where} ORDER BY fecha DESC LIMIT 500`,
      turno_id ? [turno_id] : []
    );
    res.json(result.rows);
  } catch (err) {
    console.error('[GET /api/kiosco-egresos]', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/api/kiosco-egresos', authenticate, requireModule('kiosco'), async (req, res) => {
  const { turno_id, descripcion, monto, nombre_receptor, apellido_receptor, rut_receptor, firma_receptor } = req.body;
  if (!descripcion || !monto) {
    return res.status(400).json({ error: 'Descripción y monto son obligatorios.' });
  }
  if (!String(nombre_receptor || '').trim() || !String(apellido_receptor || '').trim() || !String(rut_receptor || '').trim() || !firma_receptor) {
    return res.status(400).json({ error: 'Para registrar un egreso se requiere nombre, apellido, RUT y firma de quien recibe.' });
  }
  try {
    const result = await pool.query(
      `INSERT INTO kiosco_egresos (turno_id, descripcion, monto, nombre_receptor, apellido_receptor, rut_receptor, firma_receptor)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [turno_id || null, descripcion, monto, nombre_receptor.trim(), apellido_receptor.trim(), rut_receptor.trim(), firma_receptor]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('[POST /api/kiosco-egresos]', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
