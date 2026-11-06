// Rutas de comunicaciones (muro, comentarios, encuestas, reportes) y Academia (videos, pizarras, quiz, interacciones, ranking).
// Extraído de server.js sin cambios de comportamiento.
const express = require('express');
const multer = require('multer');
const path = require('path');
const { authenticate, requireRole, normalizarRutParaComparar, requireAnyModule, authenticateOpcional, requireModule } = require('../security/auth');
const { normalizarRol } = require('../security/accessControl');
const { pool } = require('../lib/db');
const { firmarArchivoAcademia } = require('../lib/academia');
const { ROLES_JUGADORES_ACOTADOS, academiaContenidoEsVisibleParaPupilos, obtenerPupilosDeActor } = require('../lib/actores');
const { calcularNivelDesdeXPTotal } = require('../lib/gamificacion');

const router = express.Router();

// Videos "cortos" subidos directo por el profesor (sin depender de un link de
// YouTube). Límite bajo a propósito — el pedido explícito fue que esto no
// recargue la app, así que no se acepta cualquier tamaño de archivo.
const uploadVideoMemoria = multer({
  storage: multer.memoryStorage(),
  fileFilter: (_req, file, cb) => {
    const permitido = ['video/mp4', 'video/webm', 'video/quicktime'];
    if (!permitido.includes(file.mimetype)) {
      cb(new Error('Formato de video no permitido. Usa MP4, WEBM o MOV.'));
      return;
    }
    cb(null, true);
  },
  limits: { fileSize: 25 * 1024 * 1024 },
});

// POST: sube un video corto y de paso crea la comunicación "Academia-Video"
// que lo hace aparecer en el mismo listado que el material por enlace.
router.post('/api/academia-videos', authenticate, requireRole('staff', 'admin', 'super_admin'), uploadVideoMemoria.single('archivo'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Debes seleccionar un archivo de video.' });
    }
    const titulo = String(req.body.titulo || '').trim();
    if (!titulo) {
      return res.status(400).json({ error: 'Falta el título del video.' });
    }

    const extension = path.extname(req.file.originalname).toLowerCase() || '.mp4';
    const slug = String(titulo).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'video';
    const filename = `${slug}-${Date.now()}${extension}`;

    const inserted = await pool.query(
      `INSERT INTO academia_videos (titulo, filename, mime_type, file_data, tamano_bytes, subido_por)
       VALUES ($1,$2,$3,$4,$5,$6)
       RETURNING id, titulo, filename, tamano_bytes, created_at`,
      [titulo, filename, req.file.mimetype, req.file.buffer, req.file.size, req.actor.rut]
    );
    const video = inserted.rows[0];
    // Ruta relativa a la raíz de la API (sin protocolo/host ni prefijo /api):
    // el frontend la resuelve contra su propio API_BASE_URL_CONFIG, que en dev
    // apunta a un puerto distinto (3000) del de Vite (5173).
    const urlVideo = `academia-videos/file/${video.id}?sig=${firmarArchivoAcademia('video', video.id)}`;

    const comunicacion = await pool.query(
      `INSERT INTO comunicaciones
        (titulo, cuerpo_texto, tipo, rama, categoria, urgencia, solicita_asistencia, reacciones, asistencias, categorias_objetivo, creado_por, academia_video_id)
       VALUES ($1,$2,'Academia-Video',$3,$4,'Baja',false,'{}','[]',$5,$6,$7)
       RETURNING *`,
      [
        titulo, urlVideo, req.body.rama || 'General', req.body.categoria || 'General',
        JSON.stringify(JSON.parse(req.body.categorias_objetivo || '[]')), req.actor.rut, video.id,
      ]
    );

    return res.status(201).json({ video, comunicacion: comunicacion.rows[0] });
  } catch (error) {
    console.error('[POST /api/academia-videos]', error);
    return res.status(500).json({ error: error.message || 'No se pudo subir el video.' });
  }
});

// GET: sirve el video con soporte de Range para que el <video> del navegador
// pueda buscar/adelantar sin descargar el archivo completo de una vez.
// Sin "authenticate": esta URL se usa directo en <video><source>, que el
// navegador no puede acompañar con header Authorization (ídem <img> de
// pizarras arriba) — en cambio exige la firma de firmarArchivoAcademia, que
// solo se entrega desde la subida (autenticada); ver comentario ahí arriba.
router.get('/api/academia-videos/file/:id', async (req, res) => {
  try {
    if (String(req.query.sig || '') !== firmarArchivoAcademia('video', req.params.id)) {
      return res.status(403).json({ error: 'Enlace de video inválido.' });
    }
    const result = await pool.query('SELECT mime_type, file_data, activo FROM academia_videos WHERE id = $1', [req.params.id]);
    const row = result.rows?.[0];
    if (!row || row.activo === false) {
      return res.status(404).json({ error: 'Video no encontrado.' });
    }

    const buffer = row.file_data;
    const total = buffer.length;
    const range = req.headers.range;

    res.setHeader('Cache-Control', 'public, max-age=604800');
    res.setHeader('Accept-Ranges', 'bytes');
    res.contentType(row.mime_type || 'video/mp4');

    if (!range) {
      res.setHeader('Content-Length', total);
      return res.send(buffer);
    }

    const match = /bytes=(\d*)-(\d*)/.exec(range);
    const start = match && match[1] ? parseInt(match[1], 10) : 0;
    const end = match && match[2] ? parseInt(match[2], 10) : total - 1;
    const chunkEnd = Math.min(end, total - 1);

    res.status(206);
    res.setHeader('Content-Range', `bytes ${start}-${chunkEnd}/${total}`);
    res.setHeader('Content-Length', chunkEnd - start + 1);
    return res.send(buffer.subarray(start, chunkEnd + 1));
  } catch (error) {
    console.error('[GET /api/academia-videos/file/:id]', error);
    return res.status(500).json({ error: error.message || 'No se pudo obtener el video.' });
  }
});

// PUT: actualiza metadata del video (título/publicado) y, si existe, sincroniza
// la comunicación enlazada (título/rama/categoría/categorías/publicado). Para
// reemplazar el archivo hay que borrar y volver a subir.
router.put('/api/academia-videos/:id', authenticate, requireRole('staff', 'admin', 'super_admin'), async (req, res) => {
  const { titulo, rama, categoria, categorias_objetivo, activo } = req.body;
  try {
    const existente = await pool.query('SELECT subido_por FROM academia_videos WHERE id = $1', [req.params.id]);
    if (existente.rows.length === 0) {
      return res.status(404).json({ error: 'Video no encontrado.' });
    }
    const esAdminOSuper = ['admin', 'super_admin'].includes(normalizarRol(req.actor.rol));
    if (!esAdminOSuper) {
      const rutSubio = normalizarRutParaComparar(existente.rows[0].subido_por || '');
      if (!rutSubio || rutSubio !== normalizarRutParaComparar(req.actor.rut)) {
        return res.status(403).json({ error: 'No puedes editar contenido de otro profesor.' });
      }
    }

    const result = await pool.query(
      `UPDATE academia_videos SET titulo = COALESCE($1, titulo), activo = COALESCE($2, activo) WHERE id = $3
       RETURNING id, titulo, filename, tamano_bytes, activo, created_at`,
      [titulo ?? null, activo !== undefined ? Boolean(activo) : null, req.params.id]
    );

    const comunicacionVinculada = await pool.query('SELECT id FROM comunicaciones WHERE academia_video_id = $1', [req.params.id]);
    if (comunicacionVinculada.rows.length > 0) {
      await pool.query(
        `UPDATE comunicaciones SET
           titulo = COALESCE($1, titulo), rama = COALESCE($2, rama), categoria = COALESCE($3, categoria),
           categorias_objetivo = COALESCE($4::jsonb, categorias_objetivo), activo = COALESCE($5, activo), updated_at = NOW()
         WHERE id = $6`,
        [
          titulo ?? null, rama ?? null, categoria ?? null,
          categorias_objetivo !== undefined ? JSON.stringify(categorias_objetivo) : null,
          activo !== undefined ? Boolean(activo) : null,
          comunicacionVinculada.rows[0].id,
        ]
      );
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('[PUT /api/academia-videos/:id]', error);
    res.status(500).json({ error: error.message || 'No se pudo actualizar el video.' });
  }
});

router.delete('/api/academia-videos/:id', authenticate, requireRole('staff', 'admin', 'super_admin'), async (req, res) => {
  const client = await pool.connect();
  try {
    const existente = await client.query('SELECT subido_por FROM academia_videos WHERE id = $1', [req.params.id]);
    if (existente.rows.length === 0) {
      return res.status(404).json({ error: 'Video no encontrado.' });
    }
    const esAdminOSuper = ['admin', 'super_admin'].includes(normalizarRol(req.actor.rol));
    if (!esAdminOSuper) {
      const rutSubio = normalizarRutParaComparar(existente.rows[0].subido_por || '');
      if (!rutSubio || rutSubio !== normalizarRutParaComparar(req.actor.rut)) {
        return res.status(403).json({ error: 'No puedes eliminar contenido de otro profesor.' });
      }
    }

    await client.query('BEGIN');
    await client.query('DELETE FROM comunicaciones WHERE academia_video_id = $1', [req.params.id]);
    await client.query('DELETE FROM academia_videos WHERE id = $1', [req.params.id]);
    await client.query('COMMIT');
    res.json({ ok: true });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('[DELETE /api/academia-videos/:id]', error);
    res.status(500).json({ error: error.message || 'No se pudo borrar el video.' });
  } finally {
    client.release();
  }
});

const uploadPizarraMemoria = multer({
  storage: multer.memoryStorage(),
  fileFilter: (_req, file, cb) => {
    const permitido = ['image/png', 'image/jpeg', 'image/webp'];
    if (!permitido.includes(file.mimetype)) {
      cb(new Error('Formato de imagen no permitido para la pizarra. Usa PNG, JPG o WEBP.'));
      return;
    }
    cb(null, true);
  },
  limits: { fileSize: 5 * 1024 * 1024 },
});

// Staff/super_admin ven todo sin filtrar (incluye no publicado, para poder
// gestionarlo desde "Mis Publicaciones"). El resto solo ve lo publicado y
// dirigido a la rama/categoría de sus propios pupilos.
router.get('/api/academia-pizarras', authenticate, requireAnyModule('academia'), async (req, res) => {
  try {
    const esProfesor = ['staff', 'super_admin'].includes(normalizarRol(req.actor.rol));
    const result = await pool.query(
      `SELECT id, nombre_tactica, descripcion, imagen_filename, rama, categorias_objetivo, creado_por, activo, created_at
       FROM academia_pizarras ORDER BY created_at DESC LIMIT 300`
    );
    // imagen_sig: la URL de la imagen (GET .../imagen/:id, sin authenticate
    // porque la sirve un <img src=...>) exige esta firma — así solo quien ya
    // pasó por este listado autenticado puede construir una URL válida, en
    // vez de poder adivinar IDs secuenciales sin sesión.
    const conFirma = result.rows.map((p) => ({ ...p, imagen_sig: firmarArchivoAcademia('pizarra', p.id) }));
    if (esProfesor) {
      return res.json(conFirma);
    }
    const pizarrasActivas = conFirma.filter((p) => p.activo !== false);
    const pupilos = await obtenerPupilosDeActor(req.actor);
    res.json(pizarrasActivas.filter((p) => academiaContenidoEsVisibleParaPupilos(p, pupilos)));
  } catch (error) {
    console.error('[GET /api/academia-pizarras]', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/api/academia-pizarras', authenticate, requireRole('staff', 'admin', 'super_admin'), uploadPizarraMemoria.single('archivo'), async (req, res) => {
  try {
    const nombreTactica = String(req.body.nombre_tactica || '').trim();
    if (!nombreTactica) {
      return res.status(400).json({ error: 'Falta el nombre de la táctica.' });
    }

    let filename = null;
    let mimeType = null;
    let data = null;
    if (req.file) {
      const extension = path.extname(req.file.originalname).toLowerCase() || '.png';
      const slug = nombreTactica.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'pizarra';
      filename = `${slug}-${Date.now()}${extension}`;
      mimeType = req.file.mimetype;
      data = req.file.buffer;
    }

    const result = await pool.query(
      `INSERT INTO academia_pizarras (nombre_tactica, descripcion, imagen_filename, imagen_mime_type, imagen_data, rama, categorias_objetivo, creado_por)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING id, nombre_tactica, descripcion, imagen_filename, rama, categorias_objetivo, creado_por, created_at`,
      [
        nombreTactica, req.body.descripcion || '', filename, mimeType, data,
        req.body.rama || 'General', JSON.stringify(JSON.parse(req.body.categorias_objetivo || '[]')), req.actor.rut,
      ]
    );
    res.status(201).json({ ...result.rows[0], imagen_sig: firmarArchivoAcademia('pizarra', result.rows[0].id) });
  } catch (error) {
    console.error('[POST /api/academia-pizarras]', error);
    res.status(500).json({ error: error.message || 'No se pudo guardar la pizarra.' });
  }
});

// Sin "authenticate": esta URL se usa directo en <img src>, que el navegador
// no puede acompañar con header Authorization — exigir token acá rompería la
// carga de imagen para cualquier usuario, logueado o no. En cambio exige la
// firma que entrega GET /api/academia-pizarras (ese sí autenticado y
// filtrado), que sigue siendo el control de acceso principal.
router.get('/api/academia-pizarras/imagen/:id', async (req, res) => {
  try {
    if (String(req.query.sig || '') !== firmarArchivoAcademia('pizarra', req.params.id)) {
      return res.status(403).json({ error: 'Enlace de imagen inválido.' });
    }
    const result = await pool.query('SELECT imagen_mime_type, imagen_data, activo FROM academia_pizarras WHERE id = $1', [req.params.id]);
    const row = result.rows?.[0];
    if (!row || !row.imagen_data || row.activo === false) {
      return res.status(404).json({ error: 'Imagen no encontrada.' });
    }
    res.setHeader('Cache-Control', 'private, max-age=604800');
    res.contentType(row.imagen_mime_type || 'image/png');
    return res.send(row.imagen_data);
  } catch (error) {
    console.error('[GET /api/academia-pizarras/imagen/:id]', error);
    return res.status(500).json({ error: error.message });
  }
});

// PUT: solo metadata (nombre/descripción/rama/categorías/publicado). Para
// cambiar la imagen capturada hay que borrar y crear de nuevo.
router.put('/api/academia-pizarras/:id', authenticate, requireRole('staff', 'admin', 'super_admin'), async (req, res) => {
  const { nombre_tactica, descripcion, rama, categorias_objetivo, activo } = req.body;
  try {
    const existente = await pool.query('SELECT creado_por FROM academia_pizarras WHERE id = $1', [req.params.id]);
    if (existente.rows.length === 0) {
      return res.status(404).json({ error: 'Pizarra no encontrada.' });
    }
    const esAdminOSuper = ['admin', 'super_admin'].includes(normalizarRol(req.actor.rol));
    if (!esAdminOSuper) {
      const rutCreador = normalizarRutParaComparar(existente.rows[0].creado_por || '');
      if (!rutCreador || rutCreador !== normalizarRutParaComparar(req.actor.rut)) {
        return res.status(403).json({ error: 'No puedes editar contenido de otro profesor.' });
      }
    }
    const result = await pool.query(
      `UPDATE academia_pizarras SET
         nombre_tactica = COALESCE($1, nombre_tactica), descripcion = COALESCE($2, descripcion),
         rama = COALESCE($3, rama), categorias_objetivo = COALESCE($4::jsonb, categorias_objetivo),
         activo = COALESCE($5, activo)
       WHERE id = $6
       RETURNING id, nombre_tactica, descripcion, imagen_filename, rama, categorias_objetivo, creado_por, activo, created_at`,
      [
        nombre_tactica ?? null, descripcion ?? null, rama ?? null,
        categorias_objetivo !== undefined ? JSON.stringify(categorias_objetivo) : null,
        activo !== undefined ? Boolean(activo) : null,
        req.params.id,
      ]
    );
    res.json(result.rows[0]);
  } catch (error) {
    console.error('[PUT /api/academia-pizarras/:id]', error);
    res.status(500).json({ error: error.message || 'No se pudo actualizar la pizarra.' });
  }
});

router.delete('/api/academia-pizarras/:id', authenticate, requireRole('staff', 'admin', 'super_admin'), async (req, res) => {
  try {
    const existente = await pool.query('SELECT creado_por FROM academia_pizarras WHERE id = $1', [req.params.id]);
    if (existente.rows.length === 0) {
      return res.status(404).json({ error: 'Pizarra no encontrada.' });
    }
    const esAdminOSuper = ['admin', 'super_admin'].includes(normalizarRol(req.actor.rol));
    if (!esAdminOSuper) {
      const rutCreador = normalizarRutParaComparar(existente.rows[0].creado_por || '');
      if (!rutCreador || rutCreador !== normalizarRutParaComparar(req.actor.rut)) {
        return res.status(403).json({ error: 'No puedes eliminar contenido de otro profesor.' });
      }
    }
    await pool.query('DELETE FROM academia_pizarras WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (error) {
    console.error('[DELETE /api/academia-pizarras/:id]', error);
    res.status(500).json({ error: error.message || 'No se pudo borrar la pizarra.' });
  }
});

// ==========================================
// 1. ENDPOINTS: COMUNICACIONES
// ==========================================

// GET: Todas las comunicaciones
const ACADEMIA_TIPOS_LOWER = new Set(['academia-video', 'academia-imagen', 'academia-documento']);

// Sin sesión (visitante del feed público de Noticias) o con sesión pero sin
// módulo staff: nunca ve contenido de Academia sin publicar ni fuera de la
// rama/categoría de sus propios pupilos. Antes esta ruta era 100% pública y
// sin filtrar — cualquiera con la URL veía todo, incluido material docente.
const filtrarComunicacionesParaActor = async (filas, actor) => {
  const esProfesor = actor && ['staff', 'super_admin'].includes(normalizarRol(actor.rol));
  if (esProfesor) return filas;

  if (!actor) {
    return filas.filter((f) => !ACADEMIA_TIPOS_LOWER.has(String(f.tipo || '').toLowerCase()));
  }

  const pupilos = await obtenerPupilosDeActor(actor);
  return filas.filter((f) => {
    if (!ACADEMIA_TIPOS_LOWER.has(String(f.tipo || '').toLowerCase())) return true;
    if (f.activo === false) return false;
    return academiaContenidoEsVisibleParaPupilos(f, pupilos);
  });
};

router.get('/api/comunicaciones', authenticateOpcional, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        id, titulo, cuerpo_texto, tipo, rama, categoria, urgencia,
        solicita_asistencia, reacciones, asistencias,
        citacion_id, convocatoria_ruts, convocatoria_alertas_morosidad,
        responsable_nombre, responsable_rol, categorias_objetivo,
        creado_por, academia_video_id, activo,
        created_at as fecha
      FROM comunicaciones
      ORDER BY created_at DESC
    `);
    res.json(await filtrarComunicacionesParaActor(result.rows, req.actor));
  } catch (err) {
    console.error('Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET: Comunicación por ID
router.get('/api/comunicaciones/:id', authenticateOpcional, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM comunicaciones WHERE id = $1',
      [req.params.id]
    );
    const fila = result.rows[0];
    if (!fila) return res.json({});
    const visibles = await filtrarComunicacionesParaActor([fila], req.actor);
    res.json(visibles[0] || {});
  } catch (err) {
    console.error('[GET /api/comunicaciones/:id]', err);
    res.status(500).json({ error: err.message });
  }
});

// POST: sube un archivo de video para una comunicación del Muro (no de
// Academia — mismo tipo de subida, reutiliza la tabla academia_videos
// porque es genérica: solo guarda el blob y lo sirve con soporte de Range,
// nada ahí es específico de Academia). Devuelve solo la URL; crear la
// comunicación en sí sigue el flujo normal de POST /api/comunicaciones,
// igual que ya pasa con imagen (subir → pegar URL en cuerpo_texto → Publicar).
router.post('/api/comunicaciones/video', authenticate, requireRole('staff', 'admin', 'super_admin'), uploadVideoMemoria.single('archivo'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Debes seleccionar un archivo de video.' });
    }
    const extension = path.extname(req.file.originalname).toLowerCase() || '.mp4';
    const filename = `comunicacion-video-${Date.now()}${extension}`;

    const inserted = await pool.query(
      `INSERT INTO academia_videos (titulo, filename, mime_type, file_data, tamano_bytes, subido_por)
       VALUES ($1,$2,$3,$4,$5,$6)
       RETURNING id`,
      [filename, filename, req.file.mimetype, req.file.buffer, req.file.size, req.actor.rut]
    );
    const id = inserted.rows[0].id;
    // Misma convención de ruta relativa que usa Academia (ver comentario en
    // GET /api/academia-videos/file/:id): el frontend la resuelve contra
    // API_BASE_URL_CONFIG, no contra el origen de Vite.
    return res.status(201).json({ id, url: `academia-videos/file/${id}?sig=${firmarArchivoAcademia('video', id)}` });
  } catch (error) {
    console.error('[POST /api/comunicaciones/video]', error);
    return res.status(500).json({ error: error.message || 'No se pudo subir el video.' });
  }
});

// POST: Crear comunicación. requireRole (no requireModule('admin_dashboard'))
// porque 'staff' publica material de Academia desde este mismo endpoint y no
// tiene el módulo admin_dashboard — antes quedaba bloqueado con 403.
router.post('/api/comunicaciones', authenticate, requireRole('staff', 'admin', 'super_admin'), async (req, res) => {
  const {
    titulo, cuerpo_texto, tipo, rama, categoria, urgencia, solicita_asistencia,
    citacion_id, convocatoria_ruts, convocatoria_alertas_morosidad,
    responsable_nombre, responsable_rol, categorias_objetivo,
  } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO comunicaciones
       (titulo, cuerpo_texto, tipo, rama, categoria, urgencia, solicita_asistencia, reacciones, asistencias,
        citacion_id, convocatoria_ruts, convocatoria_alertas_morosidad, responsable_nombre, responsable_rol, categorias_objetivo, creado_por)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
       RETURNING *`,
      [
        titulo, cuerpo_texto, tipo, rama, categoria, urgencia, solicita_asistencia || false, '{}', '[]',
        citacion_id || null, JSON.stringify(convocatoria_ruts || []), JSON.stringify(convocatoria_alertas_morosidad || []),
        responsable_nombre || null, responsable_rol || null, JSON.stringify(categorias_objetivo || []), req.actor.rut,
      ]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('[POST /api/comunicaciones]', err);
    res.status(500).json({ error: err.message });
  }
});

// PUT: Actualizar comunicación. requireRole (no requireModule('admin_dashboard'))
// para que 'staff' pueda editar SU material de Academia — solo lo puede tocar
// quien lo creó (creado_por) o un admin/super_admin.
router.put('/api/comunicaciones/:id', authenticate, requireRole('staff', 'admin', 'super_admin'), async (req, res) => {
  const { titulo, cuerpo_texto, urgencia, rama, categoria, categorias_objetivo, activo } = req.body;
  try {
    const existente = await pool.query('SELECT creado_por FROM comunicaciones WHERE id = $1', [req.params.id]);
    if (existente.rows.length === 0) {
      return res.status(404).json({ error: 'Comunicación no encontrada.' });
    }
    const esAdminOSuper = ['admin', 'super_admin'].includes(normalizarRol(req.actor.rol));
    if (!esAdminOSuper) {
      const rutCreador = normalizarRutParaComparar(existente.rows[0].creado_por || '');
      if (!rutCreador || rutCreador !== normalizarRutParaComparar(req.actor.rut)) {
        return res.status(403).json({ error: 'No puedes editar contenido de otro profesor.' });
      }
    }

    const result = await pool.query(
      `UPDATE comunicaciones
       SET titulo = COALESCE($1, titulo),
           cuerpo_texto = COALESCE($2, cuerpo_texto),
           urgencia = COALESCE($3, urgencia),
           rama = COALESCE($4, rama),
           categoria = COALESCE($5, categoria),
           categorias_objetivo = COALESCE($6::jsonb, categorias_objetivo),
           activo = COALESCE($7, activo),
           updated_at = NOW()
       WHERE id = $8
       RETURNING *`,
      [
        titulo ?? null, cuerpo_texto ?? null, urgencia ?? null, rama ?? null, categoria ?? null,
        categorias_objetivo !== undefined ? JSON.stringify(categorias_objetivo) : null,
        activo !== undefined ? Boolean(activo) : null,
        req.params.id,
      ]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('[PUT /api/comunicaciones/:id]', err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE: Eliminar comunicación. Mismo criterio de dueño que el PUT de arriba.
router.delete('/api/comunicaciones/:id', authenticate, requireRole('staff', 'admin', 'super_admin'), async (req, res) => {
  try {
    const existente = await pool.query('SELECT creado_por FROM comunicaciones WHERE id = $1', [req.params.id]);
    if (existente.rows.length === 0) {
      return res.status(404).json({ error: 'Comunicación no encontrada.' });
    }
    const esAdminOSuper = ['admin', 'super_admin'].includes(normalizarRol(req.actor.rol));
    if (!esAdminOSuper) {
      const rutCreador = normalizarRutParaComparar(existente.rows[0].creado_por || '');
      if (!rutCreador || rutCreador !== normalizarRutParaComparar(req.actor.rut)) {
        return res.status(403).json({ error: 'No puedes eliminar contenido de otro profesor.' });
      }
    }
    await pool.query('DELETE FROM comunicaciones WHERE id = $1', [req.params.id]);
    res.json({ message: 'Comunicación eliminada' });
  } catch (err) {
    console.error('[DELETE /api/comunicaciones/:id]', err);
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 2. ENDPOINTS: COMENTARIOS
// ==========================================

// GET: Comentarios de una comunicación — antes sin "authenticate" (a
// diferencia del POST justo debajo, que sí lo exige), así que cualquiera sin
// sesión podía leer comentarios/usuario_id de contenido pensado para
// apoderados de pupilos o staff. El frontend nunca llama esto desde la vista
// pública/sin login, así que no rompe nada.
router.get('/api/comunicaciones/:comId/comentarios', authenticate, requireModule('comunicaciones'), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM comentarios 
       WHERE comunicacion_id = $1 
       ORDER BY created_at ASC`,
      [req.params.comId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('[GET /api/comunicaciones/:comId/comentarios]', err);
    res.status(500).json({ error: err.message });
  }
});

// POST: Crear comentario
router.post('/api/comunicaciones/:comId/comentarios', authenticate, requireModule('comunicaciones'), async (req, res) => {
  const { usuario_id, texto, parent_id } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO comentarios 
       (comunicacion_id, usuario_id, texto, parent_id, likes)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [req.params.comId, usuario_id, texto, parent_id || null, 0]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('[POST /api/comunicaciones/:comId/comentarios]', err);
    res.status(500).json({ error: err.message });
  }
});

// PUT: Like comentario
router.put('/api/comentarios/:comentId/like', authenticate, requireModule('comunicaciones'), async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE comentarios 
       SET likes = likes + 1
       WHERE id = $1
       RETURNING *`,
      [req.params.comentId]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('[PUT /api/comentarios/:comentId/like]', err);
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 6. ENDPOINTS: REPORTES & ANALYTICS
// ==========================================

// GET: Reportes de engagement
router.get('/api/reportes/engagement', authenticate, requireModule('reportes'), async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        (SELECT COUNT(*) FROM comunicaciones) as total_comunicaciones,
        (SELECT SUM(CAST(reacciones->>key AS INTEGER)) FROM comunicaciones, jsonb_object_keys(reacciones) key) as total_reacciones,
        (SELECT COUNT(*) FROM comentarios) as total_comentarios,
        (SELECT COUNT(DISTINCT usuario_id) FROM comentarios) as usuarios_activos
    `);
    res.json(result.rows[0]);
  } catch (err) {
    console.error('[GET /api/reportes/engagement]', err);
    res.status(500).json({ error: err.message });
  }
});

// GET: Top comunicaciones
router.get('/api/reportes/top-comunicaciones', authenticate, requireModule('reportes'), async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        c.id,
        c.titulo,
        COUNT(com.id) as comentarios,
        (SELECT SUM(CAST(value AS INTEGER)) FROM jsonb_each_text(c.reacciones)) as reacciones
      FROM comunicaciones c
      LEFT JOIN comentarios com ON c.id = com.comunicacion_id
      GROUP BY c.id, c.titulo
      ORDER BY comentarios DESC
      LIMIT 10
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('[GET /api/reportes/top-comunicaciones]', err);
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 7. ENCUESTAS
// ==========================================

// GET: Encuestas
router.get('/api/encuestas', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM encuestas ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    console.error('[GET /api/encuestas]', err);
    res.status(500).json({ error: err.message });
  }
});

// POST: Crear encuesta
router.post('/api/encuestas', authenticate, requireModule('admin_dashboard'), async (req, res) => {
  const { pregunta, opciones } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO encuestas (pregunta, opciones, votos)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [pregunta, JSON.stringify(opciones), JSON.stringify({})]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('[POST /api/encuestas]', err);
    res.status(500).json({ error: err.message });
  }
});

// PUT: Votar en encuesta
router.put('/api/encuestas/:encuestaId/votar', authenticate, requireModule('comunicaciones'), async (req, res) => {
  const { opcion } = req.body;
  try {
    const encuesta = await pool.query('SELECT votos FROM encuestas WHERE id = $1', [req.params.encuestaId]);
    const votos = encuesta.rows[0]?.votos || {};
    votos[opcion] = (votos[opcion] || 0) + 1;
    
    const result = await pool.query(
      'UPDATE encuestas SET votos = $1 WHERE id = $2 RETURNING *',
      [JSON.stringify(votos), req.params.encuestaId]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('[PUT /api/encuestas/:encuestaId/votar]', err);
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 20. ENDPOINTS: QUIZ (FASE 2)
// ==========================================

// GET: Todas las preguntas
// Staff/super_admin ven todas las preguntas activas (para gestionarlas). El
// resto solo ve las dirigidas a la rama/categoría de sus propios pupilos.
router.get('/api/quiz', authenticate, requireModule('academia'), async (req, res) => {
  try {
    const esProfesor = ['staff', 'super_admin'].includes(normalizarRol(req.actor.rol));
    const result = await pool.query(
      `SELECT * FROM quiz_preguntas WHERE activo = true ORDER BY dificultad ASC`
    );
    if (esProfesor) {
      return res.json(result.rows);
    }
    const pupilos = await obtenerPupilosDeActor(req.actor);
    res.json(result.rows.filter((q) => academiaContenidoEsVisibleParaPupilos(q, pupilos)));
  } catch (err) {
    console.error('[GET /api/quiz]', err);
    res.status(500).json({ error: err.message });
  }
});

// POST: Crear pregunta. requireRole en vez de requireModule('academia'): ese
// módulo también lo tienen jugadores/apoderados, que antes podían crear
// preguntas llamando la API directo aunque ninguna pantalla lo permitiera.
router.post('/api/quiz', authenticate, requireRole('staff', 'admin', 'super_admin'), async (req, res) => {
  const { titulo, tipo_quiz, rama, pregunta, opciones_json, respuesta_correcta, dificultad, categorias_objetivo } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO quiz_preguntas (titulo, tipo_quiz, rama, pregunta, opciones_json, respuesta_correcta, dificultad, categorias_objetivo, creado_por)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        titulo, tipo_quiz, rama, pregunta, JSON.stringify(opciones_json), respuesta_correcta, dificultad,
        JSON.stringify(categorias_objetivo || []), req.actor.rut,
      ]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('[POST /api/quiz]', err);
    res.status(500).json({ error: err.message });
  }
});

// PUT/DELETE: la PK real de quiz_preguntas es id_pregunta (no id) — la ruta
// usa :id por convención pero filtra por id_pregunta. A diferencia de
// materiales/videos/pizarras (dueño o admin), el quiz lo puede editar/borrar
// cualquier staff/admin/superadmin — con pocas cuentas de staff en el club,
// tiene más sentido que el banco de preguntas se mantenga entre todos.
router.put('/api/quiz/:id', authenticate, requireRole('staff', 'admin', 'super_admin'), async (req, res) => {
  const { titulo, tipo_quiz, rama, categorias_objetivo, pregunta, opciones_json, respuesta_correcta, dificultad, activo } = req.body;
  try {
    const existente = await pool.query('SELECT id_pregunta FROM quiz_preguntas WHERE id_pregunta = $1', [req.params.id]);
    if (existente.rows.length === 0) {
      return res.status(404).json({ error: 'Pregunta no encontrada.' });
    }
    const result = await pool.query(
      `UPDATE quiz_preguntas SET
         titulo = COALESCE($1, titulo), tipo_quiz = COALESCE($2, tipo_quiz), rama = COALESCE($3, rama),
         categorias_objetivo = COALESCE($4::jsonb, categorias_objetivo), pregunta = COALESCE($5, pregunta),
         opciones_json = COALESCE($6::json, opciones_json), respuesta_correcta = COALESCE($7, respuesta_correcta),
         dificultad = COALESCE($8, dificultad), activo = COALESCE($9, activo), updated_at = NOW()
       WHERE id_pregunta = $10
       RETURNING *`,
      [
        titulo ?? null, tipo_quiz ?? null, rama ?? null,
        categorias_objetivo !== undefined ? JSON.stringify(categorias_objetivo) : null,
        pregunta ?? null, opciones_json !== undefined ? JSON.stringify(opciones_json) : null,
        respuesta_correcta ?? null, dificultad ?? null,
        activo !== undefined ? Boolean(activo) : null,
        req.params.id,
      ]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('[PUT /api/quiz/:id]', err);
    res.status(500).json({ error: err.message });
  }
});

router.delete('/api/quiz/:id', authenticate, requireRole('staff', 'admin', 'super_admin'), async (req, res) => {
  try {
    const existente = await pool.query('SELECT id_pregunta FROM quiz_preguntas WHERE id_pregunta = $1', [req.params.id]);
    if (existente.rows.length === 0) {
      return res.status(404).json({ error: 'Pregunta no encontrada.' });
    }
    await pool.query('DELETE FROM quiz_preguntas WHERE id_pregunta = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error('[DELETE /api/quiz/:id]', err);
    res.status(500).json({ error: err.message });
  }
});

// POST: registra la respuesta de un jugador a una pregunta (una sola vez por
// pregunta+jugador vía UNIQUE+ON CONFLICT — reintentar tras refrescar la
// página no duplica ni vuelve a otorgar puntos). Reemplaza el flujo anterior
// donde el frontend llamaba POST /api/gamificacion por separado sin dejar
// registro de a qué pregunta correspondía la respuesta.
router.post('/api/quiz/:id/responder', authenticate, requireModule('academia'), async (req, res) => {
  const { rut_jugador, opcion_seleccionada } = req.body;
  const rutJugador = String(rut_jugador || '').trim();
  if (!rutJugador || !opcion_seleccionada) {
    return res.status(400).json({ error: 'Falta el deportista o la opción elegida.' });
  }
  try {
    const rolNormalizado = normalizarRol(req.actor.rol);
    if (ROLES_JUGADORES_ACOTADOS.includes(rolNormalizado)) {
      const pupilos = await obtenerPupilosDeActor(req.actor);
      if (!pupilos.some((p) => normalizarRutParaComparar(p.rut_jugador) === normalizarRutParaComparar(rutJugador))) {
        return res.status(403).json({ error: 'No puedes responder por ese deportista.' });
      }
    }

    const pregunta = (await pool.query(
      'SELECT id_pregunta, titulo, respuesta_correcta FROM quiz_preguntas WHERE id_pregunta = $1 AND activo = true',
      [req.params.id]
    )).rows[0];
    if (!pregunta) {
      return res.status(404).json({ error: 'Pregunta no encontrada.' });
    }

    const esCorrecta = opcion_seleccionada === pregunta.respuesta_correcta;
    const puntos = esCorrecta ? 50 : 0;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const insertado = await client.query(
        `INSERT INTO quiz_respuestas (id_pregunta, rut_jugador, opcion_seleccionada, es_correcta, puntos_obtenidos, respondido_por)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (id_pregunta, rut_jugador) DO NOTHING
         RETURNING *`,
        [req.params.id, rutJugador, opcion_seleccionada, esCorrecta, puntos, req.actor.rut]
      );

      if (insertado.rows.length === 0) {
        await client.query('ROLLBACK');
        const previa = (await pool.query(
          'SELECT * FROM quiz_respuestas WHERE id_pregunta = $1 AND rut_jugador = $2',
          [req.params.id, rutJugador]
        )).rows[0];
        return res.json({ ...previa, duplicado: true });
      }

      if (esCorrecta) {
        await client.query(
          `INSERT INTO gamificacion_puntos (rut_jugador, tipo_logro, puntos_obtenidos, descripcion)
           VALUES ($1, 'quiz_correcto', $2, $3)`,
          [rutJugador, puntos, `Respuesta correcta: ${pregunta.titulo || 'Quiz'}`]
        );
      }

      await client.query('COMMIT');
      res.status(201).json({ ...insertado.rows[0], duplicado: false });
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('[POST /api/quiz/:id/responder]', err);
    res.status(500).json({ error: err.message });
  }
});

// GET: respuestas de una pregunta + quiénes de la audiencia objetivo (misma
// rama/categoría, vía academiaContenidoEsVisibleParaPupilos) todavía no
// respondieron. Uso exclusivo del dashboard de staff.
router.get('/api/quiz/:id/respuestas', authenticate, requireRole('staff', 'admin', 'super_admin'), async (req, res) => {
  try {
    const pregunta = (await pool.query('SELECT * FROM quiz_preguntas WHERE id_pregunta = $1', [req.params.id])).rows[0];
    if (!pregunta) {
      return res.status(404).json({ error: 'Pregunta no encontrada.' });
    }

    const respuestas = (await pool.query(
      `SELECT qr.*, j.nombres, j.apellido_paterno, j.apellido_materno, j.rama, j.categoria
       FROM quiz_respuestas qr
       JOIN jugadores j ON j.rut_jugador = qr.rut_jugador
       WHERE qr.id_pregunta = $1
       ORDER BY qr.created_at ASC`,
      [req.params.id]
    )).rows;

    const todosJugadores = (await pool.query('SELECT rut_jugador, nombres, apellido_paterno, apellido_materno, rama, categoria FROM jugadores')).rows;
    const rutsQueRespondieron = new Set(respuestas.map((r) => normalizarRutParaComparar(r.rut_jugador)));
    const audiencia = todosJugadores.filter((j) => academiaContenidoEsVisibleParaPupilos(pregunta, [{ rut_jugador: j.rut_jugador, rama: j.rama, categoria: j.categoria }]));
    const pendientes = audiencia.filter((j) => !rutsQueRespondieron.has(normalizarRutParaComparar(j.rut_jugador)));

    res.json({
      pregunta,
      respuestas,
      pendientes,
      resumen: {
        totalAudiencia: audiencia.length,
        totalRespondieron: respuestas.length,
        totalCorrectas: respuestas.filter((r) => r.es_correcta).length,
        totalIncorrectas: respuestas.filter((r) => !r.es_correcta).length,
      },
    });
  } catch (err) {
    console.error('[GET /api/quiz/:id/respuestas]', err);
    res.status(500).json({ error: err.message });
  }
});

// POST: registra que un jugador abrió/reprodujo un material de Academia
// (video interno o link externo). Fire-and-forget desde el frontend, no
// otorga puntos — solo mide alcance real. ON CONFLICT DO NOTHING = idempotente
// aunque se dispare más de una vez para el mismo material/jugador.
router.post('/api/academia-material-interacciones', authenticate, requireModule('academia'), async (req, res) => {
  const { comunicacion_id, rut_jugador } = req.body;
  const rutJugador = String(rut_jugador || '').trim();
  const comunicacionId = Number(comunicacion_id);
  if (!rutJugador || !Number.isFinite(comunicacionId)) {
    return res.status(400).json({ error: 'Falta el material o el deportista.' });
  }
  try {
    const rolNormalizado = normalizarRol(req.actor.rol);
    if (ROLES_JUGADORES_ACOTADOS.includes(rolNormalizado)) {
      const pupilos = await obtenerPupilosDeActor(req.actor);
      if (!pupilos.some((p) => normalizarRutParaComparar(p.rut_jugador) === normalizarRutParaComparar(rutJugador))) {
        return res.status(403).json({ error: 'No puedes registrar interacción por ese deportista.' });
      }
    }
    const result = await pool.query(
      `INSERT INTO academia_material_interacciones (comunicacion_id, rut_jugador)
       VALUES ($1, $2)
       ON CONFLICT (comunicacion_id, rut_jugador) DO NOTHING
       RETURNING *`,
      [comunicacionId, rutJugador]
    );
    res.status(201).json({ ok: true, duplicado: result.rows.length === 0 });
  } catch (err) {
    console.error('[POST /api/academia-material-interacciones]', err);
    res.status(500).json({ error: err.message });
  }
});

// GET: quiénes interactuaron con un material + quiénes de la audiencia
// objetivo todavía no. Uso exclusivo del dashboard de staff.
router.get('/api/academia-material-interacciones/:comunicacionId', authenticate, requireRole('staff', 'admin', 'super_admin'), async (req, res) => {
  try {
    const material = (await pool.query('SELECT * FROM comunicaciones WHERE id = $1', [req.params.comunicacionId])).rows[0];
    if (!material || !String(material.tipo || '').toLowerCase().startsWith('academia-')) {
      return res.status(404).json({ error: 'Material no encontrado.' });
    }

    const interacciones = (await pool.query(
      `SELECT ai.*, j.nombres, j.apellido_paterno, j.apellido_materno, j.rama, j.categoria
       FROM academia_material_interacciones ai
       JOIN jugadores j ON j.rut_jugador = ai.rut_jugador
       WHERE ai.comunicacion_id = $1
       ORDER BY ai.primera_apertura ASC`,
      [req.params.comunicacionId]
    )).rows;

    const todosJugadores = (await pool.query('SELECT rut_jugador, nombres, apellido_paterno, apellido_materno, rama, categoria FROM jugadores')).rows;
    const rutsQueInteractuaron = new Set(interacciones.map((r) => normalizarRutParaComparar(r.rut_jugador)));
    const audiencia = todosJugadores.filter((j) => academiaContenidoEsVisibleParaPupilos(material, [{ rut_jugador: j.rut_jugador, rama: j.rama, categoria: j.categoria }]));
    const pendientes = audiencia.filter((j) => !rutsQueInteractuaron.has(normalizarRutParaComparar(j.rut_jugador)));

    res.json({
      material,
      interacciones,
      pendientes,
      resumen: { totalAudiencia: audiencia.length, totalInteractuaron: interacciones.length },
    });
  } catch (err) {
    console.error('[GET /api/academia-material-interacciones/:comunicacionId]', err);
    res.status(500).json({ error: err.message });
  }
});

// GET: ranking de puntos/nivel por jugador, filtrable por rama/categoría.
// LEFT JOIN para que también aparezcan jugadores con 0 puntos (no solo los
// que ya tienen registros en gamificacion_puntos).
router.get('/api/academia/ranking', authenticate, requireRole('staff', 'admin', 'super_admin'), async (req, res) => {
  try {
    const rama = String(req.query.rama || '').trim() || null;
    const categoria = String(req.query.categoria || '').trim() || null;
    const result = await pool.query(
      `SELECT j.rut_jugador, j.nombres, j.apellido_paterno, j.apellido_materno, j.rama, j.categoria,
              COALESCE(SUM(gp.puntos_obtenidos), 0) AS xp_total,
              COUNT(gp.id_logro) AS logros_totales
       FROM jugadores j
       LEFT JOIN gamificacion_puntos gp ON gp.rut_jugador = j.rut_jugador
       WHERE ($1::text IS NULL OR j.rama = $1) AND ($2::text IS NULL OR j.categoria = $2)
       GROUP BY j.rut_jugador, j.nombres, j.apellido_paterno, j.apellido_materno, j.rama, j.categoria
       ORDER BY xp_total DESC, j.apellido_paterno ASC`,
      [rama, categoria]
    );
    const filas = result.rows.map((fila, idx) => ({
      ...fila,
      xp_total: Number(fila.xp_total),
      posicion: idx + 1,
      nivel: calcularNivelDesdeXPTotal(fila.xp_total),
    }));
    res.json(filas);
  } catch (err) {
    console.error('[GET /api/academia/ranking]', err);
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 34. ENDPOINTS: ENCUESTAS RESPUESTAS (FASE 3)
// ==========================================

router.get('/api/encuestas/:encuestaId/respuestas', authenticate, requireModule('admin_dashboard'), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM encuestas_respuestas WHERE id_encuesta = $1 ORDER BY fecha_respuesta DESC`,
      [req.params.encuestaId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('[GET /api/encuestas/:encuestaId/respuestas]', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/api/encuestas/:encuestaId/respuesta', authenticate, requireModule('comunicaciones'), async (req, res) => {
  const { rut_respondente, opcion_seleccionada, comentario_adicional } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO encuestas_respuestas (id_encuesta, rut_respondente, opcion_seleccionada, comentario_adicional)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [req.params.encuestaId, rut_respondente, opcion_seleccionada, comentario_adicional]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('[POST /api/encuestas/:encuestaId/respuesta]', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
