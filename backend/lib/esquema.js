// Migraciones idempotentes de arranque (ensure*) y tareas de saneamiento de datos.
// Extraído de server.js sin cambios de comportamiento.
const { hashPassword } = require('../security/auth');
const { pool, sheetsSyncManager } = require('./db');
const { formatearRut, validarRutChileno } = require('./rut');
const { columnasTablaCache } = require('./cuentas');

const ensureSuperAdminAccount = async () => {
  const enabled = String(process.env.AUTO_BOOTSTRAP_SUPER_ADMIN || '').toLowerCase() === 'true';
  if (!enabled) return;

  const email = process.env.SUPER_ADMIN_EMAIL;
  const rut = process.env.SUPER_ADMIN_RUT;
  const password = process.env.SUPER_ADMIN_PASSWORD;
  const nombres = process.env.SUPER_ADMIN_NOMBRES || 'Super';
  const apellido = process.env.SUPER_ADMIN_APELLIDO || 'Admin';

  if (!email || !rut || !password) {
    console.warn('⚠️ AUTO_BOOTSTRAP_SUPER_ADMIN activo pero faltan variables SUPER_ADMIN_EMAIL/RUT/PASSWORD');
    return;
  }

  if (!validarRutChileno(rut)) {
    console.warn('⚠️ SUPER_ADMIN_RUT inválido, no se creó cuenta super admin');
    return;
  }

  const rutFmt = formatearRut(rut);
  const passwordHash = await hashPassword(password);

  await pool.query(
    `INSERT INTO cuentas (
      correo, rut, password, nombres, apellido_paterno, rol, estado,
      es_socio, forzar_clave, autorizacion_imagen
    ) VALUES ($1,$2,$3,$4,$5,'super_admin','activo',false,false,true)
    ON CONFLICT (correo)
    DO UPDATE SET
      rut = EXCLUDED.rut,
      password = EXCLUDED.password,
      nombres = EXCLUDED.nombres,
      apellido_paterno = EXCLUDED.apellido_paterno,
      rol = 'super_admin',
      estado = 'activo',
      updated_at = NOW()`,
    [email, rutFmt, passwordHash, nombres, apellido]
  );

  console.log(`🔐 Super admin asegurado: ${email} (${rutFmt})`);
};

// Diseño de marco cosmético de la tarjeta coleccionable, elegido libremente
// por el jugador/apoderado — independiente de la rareza por nivel (que sigue
// reflejando progresión). No es un campo administrativo: no va en
// CAMPOS_JUGADOR_SOLO_ADMIN, así que el apoderado dueño ya puede guardarlo
// a través del PUT /api/jugadores/:rut existente.
const ensureJugadoresExtendedColumns = async () => {
  await pool.query(`ALTER TABLE jugadores ADD COLUMN IF NOT EXISTS diseno_marco VARCHAR(20) DEFAULT 'clasico'`);
  console.log('🎴 Columna diseno_marco de jugadores verificada');

  // Distinto de beca: beca es un % de rebaja, exento_mensualidad es "no paga
  // nada" (ej. hijo de staff) sin necesidad de usar el mecanismo de beca.
  // Igual que valor_mensualidad vacío no significa $0 (ver
  // calcularCuotaDeportistas en el frontend), esto da una forma explícita de
  // marcarlo en vez de dejar la celda de mensualidad en blanco.
  await pool.query(`ALTER TABLE jugadores ADD COLUMN IF NOT EXISTS exento_mensualidad BOOLEAN DEFAULT false`);
  console.log('🎓 Columna exento_mensualidad de jugadores verificada');

  // Hijo/pupilo de socio: tarifa rebajada ($15.000; 2 hijos $12.000 c/u)
  // aunque la ficha no esté vinculada a la cuenta del apoderado (la mayoría
  // de las fichas no lo están). Viene de "¿Es Socio Activo?" de la planilla.
  await pool.query(`ALTER TABLE jugadores ADD COLUMN IF NOT EXISTS apoderado_socio BOOLEAN DEFAULT false`);
  console.log('🤝 Columna apoderado_socio de jugadores verificada');

  // foto_jugador es la foto de perfil "oficial" del deportista, usada en
  // varias pantallas (avatar del header, Tesoreria, Tarjeta Oficial CCF).
  // foto_tarjeta_coleccion es una foto DISTINTA, solo para la tarjeta
  // coleccionable con marco metalico — el jugador pidio explicitamente que
  // subir una no cambiara la otra.
  await pool.query(`ALTER TABLE jugadores ADD COLUMN IF NOT EXISTS foto_tarjeta_coleccion TEXT`);
  console.log('🃏 Columna foto_tarjeta_coleccion de jugadores verificada');

  // Vigencia de la beca actual (espejo rápido de la última fila de
  // beca_historial, ver ensureBecaHistorialTable) — sin esto no había forma
  // de saber desde cuándo corre una beca ni de alertar que está por vencer,
  // solo existía el % pelado en jugadores.beca.
  await pool.query(`ALTER TABLE jugadores ADD COLUMN IF NOT EXISTS beca_fecha_inicio DATE`);
  await pool.query(`ALTER TABLE jugadores ADD COLUMN IF NOT EXISTS beca_fecha_fin DATE`);
  await pool.query(`ALTER TABLE jugadores ADD COLUMN IF NOT EXISTS beca_motivo VARCHAR(100)`);
  console.log('🎓 Columnas de vigencia de beca (beca_fecha_inicio/fin/motivo) verificadas');
};

// Historial completo de cada ajuste de beca (no solo la revisión mensual de
// beca_revisiones): cada vez que se otorga/cambia una beca queda una fila
// permanente acá con quién, cuándo, y el período que cubre — "para tener
// siempre la claridad" de qué pasó con la beca de un jugador en el tiempo.
const ensureBecaHistorialTable = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS beca_historial (
      id SERIAL PRIMARY KEY,
      rut_jugador VARCHAR(20) NOT NULL,
      porcentaje NUMERIC(5,2) NOT NULL,
      motivo VARCHAR(100),
      fecha_inicio DATE NOT NULL,
      fecha_fin DATE,
      creado_por VARCHAR(20),
      creado_en TIMESTAMP DEFAULT NOW()
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_beca_historial_rut ON beca_historial(rut_jugador)`);
  console.log('🎓 Tabla beca_historial verificada');
};

// beca empezó como BOOLEAN (sí/no) pero el club maneja porcentajes de rebaja
// (hasta 100%) — se migra una sola vez a NUMERIC. El USING solo tiene sentido
// mientras la columna sigue siendo boolean, así que se guarda contra
// information_schema para no re-ejecutarlo (y romper) en bootes siguientes.
const ensureJugadoresBecaNumerica = async () => {
  const tipoActual = await pool.query(
    `SELECT data_type FROM information_schema.columns WHERE table_name = 'jugadores' AND column_name = 'beca'`
  );
  if (tipoActual.rows[0]?.data_type === 'boolean') {
    // El DEFAULT false debe sacarse antes del cambio de tipo: Postgres intenta
    // convertir el default existente al tipo nuevo automáticamente y "false"
    // no es un literal numeric válido.
    await pool.query(`ALTER TABLE jugadores ALTER COLUMN beca DROP DEFAULT`);
    await pool.query(
      `ALTER TABLE jugadores ALTER COLUMN beca TYPE NUMERIC(5,2)
       USING (CASE WHEN beca = true THEN 100 WHEN beca = false THEN 0 ELSE NULL END)`
    );
    console.log('🎓 Columna beca migrada de booleano a porcentaje (NUMERIC)');
  }
  await pool.query(`ALTER TABLE jugadores ALTER COLUMN beca SET DEFAULT 0`);
};

// Trazabilidad mensual de revisión de becas: una fila por jugador becado por
// mes confirma que el admin/superadmin designado validó que la beca sigue
// vigente ese mes. Ausencia de fila para el mes actual = pendiente de revisar.
// Limpieza idempotente de filas de auditoría escritas antes de
// sanitizarBodyParaRegistro: quita contraseñas en texto plano y comprobantes
// en base64 de valores_nuevos.changes. Corre en cada arranque pero solo toca
// filas que todavía tienen esos datos (el WHERE las filtra), así que tras la
// primera vez no modifica nada. El Sheet se reescribe completo en el
// siguiente sync, así que también queda limpio.
const limpiarAuditoriaSensible = async () => {
  const clavesSensibles = ['password', 'password_jugador', 'currentPassword', 'newPassword'];
  const conClaves = await pool.query(
    `UPDATE auditoria
     SET valores_nuevos = jsonb_set(
       valores_nuevos::jsonb,
       '{changes}',
       (valores_nuevos::jsonb -> 'changes') - $1::text[]
     )::json
     WHERE jsonb_typeof(valores_nuevos::jsonb -> 'changes') = 'object'
       AND (valores_nuevos::jsonb -> 'changes') ?| $1::text[]`,
    [clavesSensibles]
  );
  const conArchivos = await pool.query(
    `UPDATE auditoria
     SET valores_nuevos = jsonb_set(
       valores_nuevos::jsonb,
       '{changes,comprobante_url}',
       '"[archivo omitido]"'::jsonb
     )::json
     WHERE jsonb_typeof(valores_nuevos::jsonb -> 'changes') = 'object'
       AND (valores_nuevos::jsonb -> 'changes' ->> 'comprobante_url') LIKE 'data:%'`
  );
  const total = (conClaves.rowCount || 0) + (conArchivos.rowCount || 0);
  if (total > 0) {
    console.log(`🧹 Auditoría: ${conClaves.rowCount} filas sin contraseñas, ${conArchivos.rowCount} sin comprobantes base64.`);
    sheetsSyncManager.enqueueTable('auditoria');
  }
};

// Cuentas legadas guardaban la contraseña en texto plano; verifyPassword solo
// la re-hasheaba cuando la persona volvía a iniciar sesión, así que las que no
// entraban hace tiempo seguían en claro en la BD (y en la pestaña CUENTAS del
// Sheet, que llegó a estar compartido públicamente). Se hashean todas al
// arrancar y se activa forzar_clave: esa clave ya estuvo expuesta, así que en
// el próximo ingreso deben elegir una nueva. Idempotente: tras la primera
// vez ninguna fila cumple el WHERE.
const hashearClavesEnTextoPlano = async () => {
  const pendientes = await pool.query(
    `SELECT id, password FROM cuentas
     WHERE COALESCE(password, '') <> '' AND password !~ '^\\$2[aby]\\$'`
  );
  for (const fila of pendientes.rows) {
    const hash = await hashPassword(fila.password);
    await pool.query(
      `UPDATE cuentas SET password = $1, forzar_clave = true, updated_at = NOW()
       WHERE id = $2 AND password = $3`,
      [hash, fila.id, fila.password]
    );
  }
  if (pendientes.rows.length > 0) {
    console.log(`🔐 ${pendientes.rows.length} contraseñas en texto plano convertidas a hash (forzar_clave activado).`);
    sheetsSyncManager.enqueueTable('cuentas');
  }
};

const ensureBecaRevisionesTable = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS beca_revisiones (
      id SERIAL PRIMARY KEY,
      rut_jugador VARCHAR(20) NOT NULL,
      mes VARCHAR(7) NOT NULL,
      porcentaje NUMERIC(5,2) NOT NULL,
      revisado_por VARCHAR(20),
      revisado_en TIMESTAMP DEFAULT NOW(),
      UNIQUE(rut_jugador, mes)
    )
  `);
  console.log('🎓 Tabla beca_revisiones verificada');
};

const ensureCuentasExtendedColumns = async () => {
  const ddl = [
    `ALTER TABLE cuentas ADD COLUMN IF NOT EXISTS perfil_principal VARCHAR(50) DEFAULT 'apoderado'`,
    `ALTER TABLE cuentas ADD COLUMN IF NOT EXISTS cargo_directiva VARCHAR(50)`,
    `ALTER TABLE cuentas ADD COLUMN IF NOT EXISTS socio_admin BOOLEAN DEFAULT false`,
    `ALTER TABLE cuentas ADD COLUMN IF NOT EXISTS aprobado_superadmin BOOLEAN DEFAULT false`,
    `ALTER TABLE cuentas ADD COLUMN IF NOT EXISTS acceso_nivel VARCHAR(30) DEFAULT 'estandar'`,
    `ALTER TABLE cuentas ADD COLUMN IF NOT EXISTS utm_valor_referencia DECIMAL(12,2)`,
    `ALTER TABLE cuentas ADD COLUMN IF NOT EXISTS monto_mensual_base DECIMAL(12,2)`,
    `ALTER TABLE cuentas ADD COLUMN IF NOT EXISTS monto_mensual_override DECIMAL(12,2)`,
    `ALTER TABLE cuentas ADD COLUMN IF NOT EXISTS condiciones_pago TEXT`,
    `ALTER TABLE cuentas ADD COLUMN IF NOT EXISTS fecha_corte_utm DATE`,
    `ALTER TABLE cuentas ADD COLUMN IF NOT EXISTS permisos_override JSONB DEFAULT '{}'::jsonb`,
    `ALTER TABLE cuentas ADD COLUMN IF NOT EXISTS requiere_foto_perfil BOOLEAN DEFAULT false`,
  ];

  for (const statement of ddl) {
    await pool.query(statement);
  }
  console.log('🧩 Columnas extendidas de cuentas verificadas');
};

// El post que anuncia una citación en el Muro (comunicaciones) solo vivía en
// el estado local del navegador que la creaba: un apoderado en otra sesión
// nunca llegaba a ver la tarjeta de confirmar/rechazar. Estas columnas le dan
// persistencia real al vínculo comunicación ↔ citación.
const ensureComunicacionesExtendedColumns = async () => {
  const ddl = [
    // Sin FK: ensureCitacionesTables/ensureComunicacionesExtendedColumns corren
    // en paralelo en el arranque (no están encadenadas), así que una referencia
    // a citaciones(id) podría fallar por orden de ejecución.
    `ALTER TABLE comunicaciones ADD COLUMN IF NOT EXISTS citacion_id INTEGER`,
    `ALTER TABLE comunicaciones ADD COLUMN IF NOT EXISTS convocatoria_ruts JSONB DEFAULT '[]'::jsonb`,
    `ALTER TABLE comunicaciones ADD COLUMN IF NOT EXISTS convocatoria_alertas_morosidad JSONB DEFAULT '[]'::jsonb`,
    `ALTER TABLE comunicaciones ADD COLUMN IF NOT EXISTS responsable_nombre VARCHAR(255)`,
    `ALTER TABLE comunicaciones ADD COLUMN IF NOT EXISTS responsable_rol VARCHAR(50)`,
    // Material de Academia llegaba a todos sin distinción de rama/categoría.
    // Este arreglo guarda a qué categoría(s) específicas va dirigido un
    // material (independiente del campo "categoria" singular ya usado por
    // otras comunicaciones); vacío = visible para todas (comportamiento igual al anterior).
    `ALTER TABLE comunicaciones ADD COLUMN IF NOT EXISTS categorias_objetivo JSONB DEFAULT '[]'::jsonb`,
    // creado_por: RUT de quien publicó, seteado por el servidor (nunca por el
    // cliente) — habilita el panel "Mis Publicaciones" de Academia y el
    // chequeo de dueño en PUT/DELETE.
    `ALTER TABLE comunicaciones ADD COLUMN IF NOT EXISTS creado_por VARCHAR(255)`,
    // academia_video_id: enlaza la comunicación autogenerada al subir un
    // video con su fila real en academia_videos (sin FK, mismo estilo que
    // citacion_id de arriba), para poder editar/borrar ambas juntas y para
    // que el frontend distinga "video subido" de "link externo" sin adivinar por tipo.
    `ALTER TABLE comunicaciones ADD COLUMN IF NOT EXISTS academia_video_id INTEGER`,
    // activo: publicado/despublicado. Todo lo existente queda publicado (true).
    `ALTER TABLE comunicaciones ADD COLUMN IF NOT EXISTS activo BOOLEAN NOT NULL DEFAULT true`,
    // torneo_id: mismo criterio sin FK que citacion_id/academia_video_id —
    // enlaza el post automático de "campeón" con el torneo que lo generó.
    `ALTER TABLE comunicaciones ADD COLUMN IF NOT EXISTS torneo_id INTEGER`,
  ];

  for (const statement of ddl) {
    await pool.query(statement);
  }
  console.log('🧩 Columnas extendidas de comunicaciones verificadas');
};

// El módulo de Lista (StaffAsistenciaPanel) no guardaba nada realmente: el
// botón "Confirmar y Guardar" solo mostraba un toast. sesion_id agrupa todas
// las filas de una misma pasada de lista (una fecha/rama/categoría/entrenador)
// para poder listarla, editarla o borrarla como unidad en el historial.
const ensureAsistenciaExtendedColumns = async () => {
  const ddl = [
    `CREATE TABLE IF NOT EXISTS asistencia (
      id_asistencia SERIAL PRIMARY KEY,
      fecha DATE,
      rama VARCHAR(50),
      categoria VARCHAR(50),
      rut_jugador VARCHAR(20),
      estado_asistencia VARCHAR(50),
      observacion TEXT,
      entrenador_cargo VARCHAR(255),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    `ALTER TABLE asistencia ADD COLUMN IF NOT EXISTS sesion_id VARCHAR(50)`,
    `ALTER TABLE asistencia ADD COLUMN IF NOT EXISTS hora_inicio VARCHAR(5)`,
    `ALTER TABLE asistencia ADD COLUMN IF NOT EXISTS hora_fin VARCHAR(5)`,
    `ALTER TABLE asistencia ADD COLUMN IF NOT EXISTS nombre_jugador VARCHAR(255)`,
    `ALTER TABLE asistencia ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`,
    `CREATE INDEX IF NOT EXISTS idx_asistencia_sesion ON asistencia (sesion_id)`,
  ];

  for (const statement of ddl) {
    await pool.query(statement);
  }
  console.log('🧩 Columnas extendidas de asistencia verificadas');
};

const ensurePartidosLiveLogos = async () => {
  const ddl = [
    `ALTER TABLE partidos_live ADD COLUMN IF NOT EXISTS logo_local_url VARCHAR(255)`,
    `ALTER TABLE partidos_live ADD COLUMN IF NOT EXISTS logo_visitante_url VARCHAR(255)`,
    `ALTER TABLE partidos_live ADD COLUMN IF NOT EXISTS torneo_nombre VARCHAR(255)`,
    `ALTER TABLE partidos_live ADD COLUMN IF NOT EXISTS torneo_logo_url VARCHAR(255)`,
  ];
  for (const statement of ddl) {
    await pool.query(statement);
  }
  console.log('🏆 Columnas de logos en partidos_live verificadas');
};

const ensurePartidosLiveCoreColumns = async () => {
  const ddl = [
    `ALTER TABLE partidos_live ADD COLUMN IF NOT EXISTS rama VARCHAR(50) DEFAULT 'Mixta'`,
    `ALTER TABLE partidos_live ADD COLUMN IF NOT EXISTS categoria VARCHAR(50) DEFAULT 'SUB-13'`,
  ];

  for (const statement of ddl) {
    await pool.query(statement);
  }

  console.log('🏀 Columnas base rama/categoria en partidos_live verificadas');
};

const ensurePartidosLiveMesaColumns = async () => {
  const ddl = [
    `ALTER TABLE partidos_live ADD COLUMN IF NOT EXISTS competencia_nombre VARCHAR(255)`,
    `ALTER TABLE partidos_live ADD COLUMN IF NOT EXISTS competencia_logo_url VARCHAR(255)`,
    `ALTER TABLE partidos_live ADD COLUMN IF NOT EXISTS mesa_payload JSONB DEFAULT '{}'::jsonb`,
    `ALTER TABLE partidos_live ADD COLUMN IF NOT EXISTS play_by_play_json JSONB DEFAULT '[]'::jsonb`,
    `ALTER TABLE partidos_live ADD COLUMN IF NOT EXISTS eventos_json JSONB DEFAULT '[]'::jsonb`,
    `ALTER TABLE partidos_live ADD COLUMN IF NOT EXISTS operadores_json JSONB DEFAULT '{}'::jsonb`,
    `ALTER TABLE partidos_live ADD COLUMN IF NOT EXISTS analisis_json JSONB DEFAULT '{}'::jsonb`,
    `ALTER TABLE partidos_live ADD COLUMN IF NOT EXISTS iniciado_at TIMESTAMP`,
    `ALTER TABLE partidos_live ADD COLUMN IF NOT EXISTS finalizado_at TIMESTAMP`,
    `ALTER TABLE partidos_live ADD COLUMN IF NOT EXISTS id_torneo INT`,
    // Permite cargar un partido (para que cuente en la tabla de posiciones)
    // sin que aparezca en el muro público de "Últimos Resultados" — pensado
    // para partidos de terceros de un torneo externo que se cargan solo por
    // completitud de la tabla, no como noticia del club.
    `ALTER TABLE partidos_live ADD COLUMN IF NOT EXISTS publicado BOOLEAN DEFAULT true`,
  ];

  for (const statement of ddl) {
    await pool.query(statement);
  }

  console.log('📋 Columnas avanzadas de mesa en partidos_live verificadas');
};

// torneos solo vivía en el script de migración suelto (backend/migrations/init.js)
// — si un despliegue nunca lo corrió, la tabla no existía y la tabla de
// posiciones/el selector de torneo fallaban con "relation torneos does not exist".
const ensureTorneosTable = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS torneos (
      id_torneo SERIAL PRIMARY KEY,
      nombre_torneo VARCHAR(255),
      rama VARCHAR(50),
      categoria VARCHAR(50),
      fecha_inicio DATE,
      fecha_fin DATE,
      ubicacion VARCHAR(255),
      organizador VARCHAR(255),
      cantidad_equipos INT,
      formato VARCHAR(50),
      estado VARCHAR(50),
      ganador VARCHAR(255),
      subcampeón VARCHAR(255),
      premios TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await pool.query(`ALTER TABLE torneos ADD COLUMN IF NOT EXISTS tipo VARCHAR(20) DEFAULT 'interno'`);
  await pool.query(`ALTER TABLE torneos ADD COLUMN IF NOT EXISTS tipo_formato VARCHAR(20) NOT NULL DEFAULT 'liga'`);
  await pool.query(`ALTER TABLE torneos ADD COLUMN IF NOT EXISTS bracket_generado BOOLEAN NOT NULL DEFAULT false`);
  await pool.query(`ALTER TABLE torneos ADD COLUMN IF NOT EXISTS publicar_resultado_en_muro BOOLEAN NOT NULL DEFAULT true`);
  console.log('🏆 Tabla torneos verificada');
};

// Equipos reales (nombre + logo) de un torneo — antes los "equipos" eran
// solo texto libre tipeado en Mesa de Control al armar un partido, sin
// registro propio ni logo persistente. id_club es opcional: se llena cuando
// el equipo corresponde a un club ya existente en el directorio (tabla
// clubes), para heredar su logo_url; si es un equipo nuevo, queda NULL y el
// logo se guarda directo en logo_url.
const ensureTorneoEquiposTable = async () => {
  await ensureTorneosTable();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS torneo_equipos (
      id_equipo SERIAL PRIMARY KEY,
      id_torneo INT NOT NULL REFERENCES torneos(id_torneo) ON DELETE CASCADE,
      nombre_equipo VARCHAR(255) NOT NULL,
      logo_url VARCHAR(255),
      id_club INT REFERENCES clubes(id_club),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(id_torneo, nombre_equipo)
    )
  `);
  console.log('👥 Tabla torneo_equipos verificada');
};

// Vínculo débil (sin FK dura) entre un partido y los equipos reales del
// torneo — mismo criterio que ya usa id_torneo hoy. equipo_local/
// equipo_visitante (texto) siguen siendo la fuente de verdad para el nombre
// mostrado y para la agregación de la tabla de posiciones; estas columnas
// solo permiten recuperar el equipo real (y su logo) al editar un partido.
const ensurePartidosLiveTorneoEquiposColumns = async () => {
  await pool.query(`ALTER TABLE partidos_live ADD COLUMN IF NOT EXISTS id_equipo_local INT`);
  await pool.query(`ALTER TABLE partidos_live ADD COLUMN IF NOT EXISTS id_equipo_visitante INT`);
  // ronda_bracket/posicion_bracket: NULL en partidos normales (liga o fuera
  // de torneo). Para un torneo de eliminación directa marcan a qué ronda y
  // qué cruce dentro de esa ronda pertenece el partido, así el backend sabe
  // qué dos partidos de la ronda N alimentan a cuál partido de la ronda N+1.
  await pool.query(`ALTER TABLE partidos_live ADD COLUMN IF NOT EXISTS ronda_bracket INT`);
  await pool.query(`ALTER TABLE partidos_live ADD COLUMN IF NOT EXISTS posicion_bracket INT`);
  console.log('🏆 Columnas id_equipo_local/id_equipo_visitante/ronda_bracket/posicion_bracket de partidos_live verificadas');
};

// clubes nunca tuvo columna de logo (LogoPicker ya leía c.logo_url ||
// c.club_logo_url esperando que existiera, pero ninguna de las dos existía
// — por eso un club creado desde la app nunca aportaba su logo al
// autocompletado). Se agrega la real y se deja de lado el fallback muerto.
const ensureClubesLogoColumn = async () => {
  await pool.query(`ALTER TABLE clubes ADD COLUMN IF NOT EXISTS logo_url VARCHAR(255)`);
  await pool.query(`ALTER TABLE clubes ADD COLUMN IF NOT EXISTS color_hex VARCHAR(7)`);
  console.log('🛡️ Columnas logo_url/color_hex de clubes verificadas');
};

// jugadores ya tiene mes_inicio_cobro (texto libre, ej. "marzo") para saber
// desde cuándo se le cobra mensualidad — cuentas solo tenía fecha_ingreso_socio
// (fecha de ingreso al club), que no siempre coincide con el mes real desde el
// que se debe cobrar la cuota de socio. Se agrega la misma columna acá para
// que el admin pueda fijarlo explícito y construirSociosMorosos (App.jsx) no
// tenga que adivinarlo solo desde la fecha de ingreso.
const ensureCuentasMesInicioCobroColumn = async () => {
  await pool.query(`ALTER TABLE cuentas ADD COLUMN IF NOT EXISTS mes_inicio_cobro VARCHAR(50)`);
  console.log('🛡️ Columna mes_inicio_cobro de cuentas verificada');
};

const ensurePagosMensualidadesColumns = async () => {
  const ddl = [
    `ALTER TABLE pagos_mensualidades ADD COLUMN IF NOT EXISTS rut_pagos VARCHAR(20)`,
  ];

  for (const statement of ddl) {
    await pool.query(statement);
  }

  console.log('💳 Columnas de pagos_mensualidades verificadas');
};

const ensureLogoAssetsTable = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS logo_assets (
      id SERIAL PRIMARY KEY,
      nombre VARCHAR(255),
      tipo VARCHAR(50) DEFAULT 'logo',
      filename VARCHAR(255) UNIQUE NOT NULL,
      mime_type VARCHAR(100) NOT NULL,
      file_data BYTEA NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  console.log('🖼️ Tabla logo_assets verificada');
};

const ensureAcademiaVideosTable = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS academia_videos (
      id SERIAL PRIMARY KEY,
      titulo VARCHAR(255) NOT NULL,
      filename VARCHAR(255) UNIQUE NOT NULL,
      mime_type VARCHAR(100) NOT NULL,
      file_data BYTEA NOT NULL,
      tamano_bytes INTEGER,
      subido_por VARCHAR(255),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await pool.query(`ALTER TABLE academia_videos ADD COLUMN IF NOT EXISTS activo BOOLEAN NOT NULL DEFAULT true`);
  console.log('🎬 Tabla academia_videos verificada');
};

// pizarra_tactica ya existía pero atada a id_partido (anotaciones de un
// partido en vivo, módulo scoreboard_live) — no servía para material
// docente general. academia_pizarras es la versión desacoplada: una
// captura de la pizarra (cancha + fichas + trazos) más metadata, dirigida
// a una rama/categoría como el resto del material de Academia.
const ensureAcademiaPizarrasTable = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS academia_pizarras (
      id SERIAL PRIMARY KEY,
      nombre_tactica VARCHAR(255) NOT NULL,
      descripcion TEXT,
      imagen_filename VARCHAR(255) UNIQUE,
      imagen_mime_type VARCHAR(100),
      imagen_data BYTEA,
      rama VARCHAR(50),
      categorias_objetivo JSONB DEFAULT '[]'::jsonb,
      creado_por VARCHAR(255),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await pool.query(`ALTER TABLE academia_pizarras ADD COLUMN IF NOT EXISTS activo BOOLEAN NOT NULL DEFAULT true`);
  console.log('🏀 Tabla academia_pizarras verificada');
};

// quiz_preguntas se creó en migrations/init.js sin dueño ni targeting
// multi-categoría (solo una "categoria" singular, nunca usada por el
// formulario de creación). Se deja esa columna vieja intacta y se agrega
// categorias_objetivo (mismo criterio que materiales/pizarras) + creado_por.
const ensureQuizExtendedColumns = async () => {
  await pool.query(`ALTER TABLE quiz_preguntas ADD COLUMN IF NOT EXISTS creado_por VARCHAR(255)`);
  await pool.query(`ALTER TABLE quiz_preguntas ADD COLUMN IF NOT EXISTS categorias_objetivo JSONB DEFAULT '[]'::jsonb`);
  console.log('🧠 Columnas extendidas de quiz_preguntas verificadas');
};

// gamificacion_puntos solo existía en migrations/init.js (script suelto, no se
// corre solo al arrancar) — el dashboard de Academia y el ranking dependen de
// que esta tabla exista siempre, así que se agrega acá con el mismo DDL.
// Igual que gamificacion_puntos, esta tabla solo vivía en el script de
// migración suelto (backend/migrations/init.js) — si un despliegue nunca lo
// corrió, quedaba inexistente. La copiamos acá para que el boot la garantice.
const ensureEvaluacionesTable = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS evaluaciones (
      id_evaluacion SERIAL PRIMARY KEY,
      rut_jugador VARCHAR(20) REFERENCES jugadores(rut_jugador),
      evaluador_rut VARCHAR(20),
      fecha_evaluacion DATE,
      tipo_evaluacion VARCHAR(50),
      puntaje_tecnica INT,
      puntaje_actitud INT,
      puntaje_condicion INT,
      puntaje_mental INT,
      puntaje_coordinacion INT,
      puntaje_coordinacion_ocular INT,
      puntaje_equilibrio INT,
      puntaje_orientacion INT,
      lateralidad VARCHAR(20),
      comentarios TEXT,
      recomendaciones TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  // La tabla ya existía en producción antes de sumar la evaluación
  // psicomotriz — CREATE TABLE IF NOT EXISTS no le agrega columnas nuevas.
  await pool.query(`ALTER TABLE evaluaciones ADD COLUMN IF NOT EXISTS puntaje_coordinacion INT`);
  await pool.query(`ALTER TABLE evaluaciones ADD COLUMN IF NOT EXISTS puntaje_coordinacion_ocular INT`);
  await pool.query(`ALTER TABLE evaluaciones ADD COLUMN IF NOT EXISTS puntaje_equilibrio INT`);
  await pool.query(`ALTER TABLE evaluaciones ADD COLUMN IF NOT EXISTS puntaje_orientacion INT`);
  await pool.query(`ALTER TABLE evaluaciones ADD COLUMN IF NOT EXISTS lateralidad VARCHAR(20)`);
  console.log('📋 Tabla evaluaciones verificada');
};

// Álbum de tarjetas coleccionables: cada fila es "rut_coleccionista ya tiene
// la tarjeta de rut_coleccionado en su álbum", agregada al escanear el QR de
// colección de la tarjeta ajena. UNIQUE evita duplicados si vuelve a escanear.
const ensureTarjetasColeccionadasTable = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS tarjetas_coleccionadas (
      id SERIAL PRIMARY KEY,
      rut_coleccionista VARCHAR(20) NOT NULL REFERENCES jugadores(rut_jugador),
      rut_coleccionado VARCHAR(20) NOT NULL REFERENCES jugadores(rut_jugador),
      fecha_coleccion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(rut_coleccionista, rut_coleccionado)
    )
  `);
  console.log('🃏 Tabla tarjetas_coleccionadas verificada');
};

// Ausencia prolongada: la reporta el apoderado (o admin/staff) con un motivo
// y un período obligatorio (fecha_inicio/fecha_fin). Mientras hoy caiga
// dentro de ese rango, la jugadora queda bloqueada para ser citada y Pasar
// Lista debe avisar que está de baja en vez de pedir marcar presente/ausente.
// confirmada_vuelta es un paso aparte y OPCIONAL (staff/DT confirma que ya
// está apta para jugar) — no condiciona el des-bloqueo automático, que
// depende solo de la fecha: como pidió el usuario, "cuando haya pasado el
// período se habilita" sin depender de una confirmación manual.
const ensureAusenciasJugadorTable = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ausencias_jugador (
      id SERIAL PRIMARY KEY,
      rut_jugador VARCHAR(20) NOT NULL REFERENCES jugadores(rut_jugador),
      motivo TEXT NOT NULL,
      fecha_inicio DATE NOT NULL,
      fecha_fin DATE NOT NULL,
      reportado_por_rut VARCHAR(20),
      reportado_por_nombre VARCHAR(255),
      confirmada_vuelta BOOLEAN NOT NULL DEFAULT false,
      fecha_confirmacion TIMESTAMP,
      confirmada_por_nombre VARCHAR(255),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_ausencias_jugador_rut ON ausencias_jugador(rut_jugador)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_ausencias_jugador_vigencia ON ausencias_jugador(fecha_inicio, fecha_fin)`);
  console.log('🚑 Tabla ausencias_jugador verificada');
};

const ensureGamificacionPuntosTable = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS gamificacion_puntos (
      id_logro SERIAL PRIMARY KEY,
      rut_jugador VARCHAR(20) REFERENCES jugadores(rut_jugador),
      tipo_logro VARCHAR(100),
      puntos_obtenidos INT,
      descripcion TEXT,
      fecha_logro TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      validado BOOLEAN DEFAULT false,
      validador_rut VARCHAR(20),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  console.log('🏆 Tabla gamificacion_puntos verificada');
};

// Registro real de respuestas de quiz (antes solo se guardaba un punto de
// gamificación cuando la respuesta era correcta, sin decir a qué pregunta
// correspondía, y nada impedía "re-responder" tras refrescar la página).
// UNIQUE(id_pregunta, rut_jugador) hace todo upsert-seguro vía ON CONFLICT.
const ensureQuizRespuestasTable = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS quiz_respuestas (
      id SERIAL PRIMARY KEY,
      id_pregunta INTEGER NOT NULL REFERENCES quiz_preguntas(id_pregunta) ON DELETE CASCADE,
      rut_jugador VARCHAR(20) NOT NULL REFERENCES jugadores(rut_jugador),
      opcion_seleccionada VARCHAR(10) NOT NULL,
      es_correcta BOOLEAN NOT NULL,
      puntos_obtenidos INT NOT NULL DEFAULT 0,
      respondido_por VARCHAR(20),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(id_pregunta, rut_jugador)
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_quiz_respuestas_pregunta ON quiz_respuestas (id_pregunta)`);
  console.log('📝 Tabla quiz_respuestas verificada');
};

// Registro de qué deportista abrió/reprodujo cada material de Academia, para
// medir alcance real (quién interactuó vs. quién nunca lo vio).
const ensureAcademiaInteraccionesTable = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS academia_material_interacciones (
      id SERIAL PRIMARY KEY,
      comunicacion_id INTEGER NOT NULL REFERENCES comunicaciones(id) ON DELETE CASCADE,
      rut_jugador VARCHAR(20) NOT NULL REFERENCES jugadores(rut_jugador),
      primera_apertura TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(comunicacion_id, rut_jugador)
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_academia_material_interacciones_com ON academia_material_interacciones (comunicacion_id)`);
  console.log('👁️ Tabla academia_material_interacciones verificada');
};

// Kiosco POS: el módulo vivía 100% en memoria del navegador (sin backend detrás),
// por lo que turnos, fiados y ventas se perdían al recargar o cerrar sesión.
// Estas tablas le dan persistencia real: catálogo de productos, turnos de caja
// (apertura/cierre con firma), ventas línea a línea (base real de la analítica,
// sin los números de muestra que traía el mock del frontend), cuentas pendientes
// con su historial de cargos/pagos, y egresos ligados a cada turno.
const ensureKioscoTables = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS kiosco_productos (
      id SERIAL PRIMARY KEY,
      nombre VARCHAR(255) NOT NULL,
      emoji VARCHAR(10) DEFAULT '📦',
      categoria VARCHAR(100) DEFAULT 'General',
      costo NUMERIC(10,2) DEFAULT 0,
      precio NUMERIC(10,2) NOT NULL DEFAULT 0,
      stock INTEGER NOT NULL DEFAULT 0,
      activo BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await pool.query(`ALTER TABLE kiosco_productos ADD COLUMN IF NOT EXISTS talla VARCHAR(10)`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS kiosco_turnos (
      id SERIAL PRIMARY KEY,
      responsable VARCHAR(255) NOT NULL,
      dia DATE NOT NULL,
      monto_inicial NUMERIC(10,2) NOT NULL DEFAULT 0,
      estado VARCHAR(20) NOT NULL DEFAULT 'abierto',
      fecha_apertura TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      fecha_cierre TIMESTAMP,
      ticket_final INTEGER DEFAULT 0,
      total_efectivo_ventas NUMERIC(10,2) DEFAULT 0,
      total_transferencia_ventas NUMERIC(10,2) DEFAULT 0,
      total_egresos NUMERIC(10,2) DEFAULT 0,
      total_pendientes NUMERIC(10,2) DEFAULT 0,
      caja_neta_final NUMERIC(10,2) DEFAULT 0,
      firma_base64 TEXT,
      cerrado_por VARCHAR(255),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS kiosco_ventas (
      id SERIAL PRIMARY KEY,
      turno_id INTEGER REFERENCES kiosco_turnos(id) ON DELETE SET NULL,
      ticket_numero INTEGER,
      producto_id INTEGER,
      producto_nombre VARCHAR(255) NOT NULL,
      cantidad INTEGER NOT NULL,
      precio_unitario NUMERIC(10,2) NOT NULL,
      subtotal NUMERIC(10,2) NOT NULL,
      metodo_pago VARCHAR(20) NOT NULL,
      fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS kiosco_fiados (
      id SERIAL PRIMARY KEY,
      nombre VARCHAR(255) NOT NULL,
      detalle TEXT,
      monto_total NUMERIC(10,2) NOT NULL DEFAULT 0,
      estado VARCHAR(20) NOT NULL DEFAULT 'abierto',
      fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      fecha_ultimo_movimiento TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS kiosco_fiados_movimientos (
      id SERIAL PRIMARY KEY,
      fiado_id INTEGER NOT NULL REFERENCES kiosco_fiados(id) ON DELETE CASCADE,
      tipo VARCHAR(20) NOT NULL,
      monto NUMERIC(10,2) NOT NULL,
      metodo_pago VARCHAR(20),
      turno_id INTEGER REFERENCES kiosco_turnos(id) ON DELETE SET NULL,
      ticket_numero INTEGER,
      detalle TEXT,
      fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS kiosco_egresos (
      id SERIAL PRIMARY KEY,
      turno_id INTEGER REFERENCES kiosco_turnos(id) ON DELETE SET NULL,
      descripcion VARCHAR(255) NOT NULL,
      monto NUMERIC(10,2) NOT NULL,
      nombre_receptor VARCHAR(120),
      apellido_receptor VARCHAR(120),
      rut_receptor VARCHAR(20),
      firma_receptor TEXT,
      fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await pool.query(`ALTER TABLE kiosco_egresos ADD COLUMN IF NOT EXISTS nombre_receptor VARCHAR(120)`);
  await pool.query(`ALTER TABLE kiosco_egresos ADD COLUMN IF NOT EXISTS apellido_receptor VARCHAR(120)`);
  await pool.query(`ALTER TABLE kiosco_egresos ADD COLUMN IF NOT EXISTS rut_receptor VARCHAR(20)`);
  await pool.query(`ALTER TABLE kiosco_egresos ADD COLUMN IF NOT EXISTS firma_receptor TEXT`);

  console.log('🛒 Tablas de kiosco POS verificadas');
};

// Arriendo de cancha: una sola tabla (reserva + cobro en la misma fila,
// mismo criterio simple que kiosco_ventas) porque el club administra un
// único recurso físico — no hace falta modelar un catálogo de canchas.
// serie_id agrupa las filas generadas juntas por una serie recurrente
// (diaria/semanal/mensual); NULL significa reserva única.
const ensureArriendosCanchaTable = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS arriendos_cancha (
      id_arriendo SERIAL PRIMARY KEY,
      nombre_arrendatario VARCHAR(255) NOT NULL,
      telefono_contacto VARCHAR(50),
      email_contacto VARCHAR(255),
      fecha DATE NOT NULL,
      hora_inicio TIME NOT NULL,
      hora_fin TIME NOT NULL,
      valor_arriendo NUMERIC(10,2) NOT NULL DEFAULT 0,
      estado_pago VARCHAR(20) NOT NULL DEFAULT 'pendiente',
      metodo_pago VARCHAR(50),
      observaciones TEXT,
      serie_id VARCHAR(40),
      serie_tipo VARCHAR(20),
      registrado_por VARCHAR(255),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await pool.query(`ALTER TABLE arriendos_cancha ADD COLUMN IF NOT EXISTS monto_pagado NUMERIC(10,2) NOT NULL DEFAULT 0`);
  console.log('📅 Tabla arriendos_cancha verificada');
};

// Horario recurrente de entrenamientos: una fila = un patrón de recurrencia
// (rama + categoría + hora) que puede repetirse en uno o varios días de la
// semana ('semanal', dias_semana ej. [2,4] = martes y jueves) o en uno o
// varios días fijos del mes ('mensual', dias_mes ej. [1,15] = dos veces al
// mes). fecha_inicio/fecha_fin acotan opcionalmente la vigencia (temporada);
// NULL = indefinido. dia_semana (columna vieja, escalar) se deja en la tabla
// sin usar por compatibilidad de datos históricos, no se lee más.
// No es la tabla vieja "entrenamientos" (esa es puntual, una fila por sesión
// con fecha exacta, y quedó huérfana — no se toca ni se reutiliza).
const ensureHorariosEntrenamientoTable = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS horarios_entrenamiento (
      id_horario SERIAL PRIMARY KEY,
      rama VARCHAR(50) NOT NULL,
      categoria VARCHAR(50) NOT NULL,
      dia_semana SMALLINT,
      hora_inicio TIME NOT NULL,
      hora_fin TIME NOT NULL,
      lugar VARCHAR(255),
      entrenador_a_cargo VARCHAR(255),
      activo BOOLEAN NOT NULL DEFAULT true,
      registrado_por VARCHAR(255),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await pool.query(`ALTER TABLE horarios_entrenamiento ALTER COLUMN dia_semana DROP NOT NULL`);
  await pool.query(`ALTER TABLE horarios_entrenamiento ADD COLUMN IF NOT EXISTS tipo_recurrencia VARCHAR(20) NOT NULL DEFAULT 'semanal'`);
  await pool.query(`ALTER TABLE horarios_entrenamiento ADD COLUMN IF NOT EXISTS dias_semana SMALLINT[]`);
  await pool.query(`ALTER TABLE horarios_entrenamiento ADD COLUMN IF NOT EXISTS dias_mes SMALLINT[]`);
  await pool.query(`ALTER TABLE horarios_entrenamiento ADD COLUMN IF NOT EXISTS fecha_inicio DATE`);
  await pool.query(`ALTER TABLE horarios_entrenamiento ADD COLUMN IF NOT EXISTS fecha_fin DATE`);
  // Migra filas viejas (dia_semana escalar, previas a este cambio) al nuevo arreglo dias_semana.
  await pool.query(`UPDATE horarios_entrenamiento SET dias_semana = ARRAY[dia_semana]::SMALLINT[] WHERE dias_semana IS NULL AND dia_semana IS NOT NULL`);

  // categoria/entrenador_a_cargo (escalares) → categorias/entrenadores (arreglos):
  // un horario puede aplicar a varias categorías a la vez (ej. SUB-13 y SUB-15
  // entrenan juntas) y puede tener uno o varios entrenadores a cargo. Las
  // columnas viejas quedan en la tabla sin usar (igual que dia_semana) por
  // compatibilidad de datos históricos — no se leen más tras este cambio.
  await pool.query(`ALTER TABLE horarios_entrenamiento ALTER COLUMN categoria DROP NOT NULL`);
  await pool.query(`ALTER TABLE horarios_entrenamiento ADD COLUMN IF NOT EXISTS categorias VARCHAR(50)[]`);
  await pool.query(`ALTER TABLE horarios_entrenamiento ADD COLUMN IF NOT EXISTS entrenadores VARCHAR(255)[]`);
  await pool.query(`UPDATE horarios_entrenamiento SET categorias = ARRAY[categoria] WHERE categorias IS NULL AND categoria IS NOT NULL`);
  await pool.query(`UPDATE horarios_entrenamiento SET entrenadores = ARRAY[entrenador_a_cargo] WHERE entrenadores IS NULL AND entrenador_a_cargo IS NOT NULL AND entrenador_a_cargo != ''`);
  console.log('🗓️ Tabla horarios_entrenamiento verificada');
};

// Personal del club (entrenadores, kinesiólogos, etc.) — se usa para el
// selector de "entrenador a cargo" en horarios de entrenamiento. La tabla ya
// existía solo en backend/migrations/init.js (script de un solo uso); se
// agrega acá con el patrón idempotente estándar para que /api/staff no falle
// en un entorno donde ese script nunca se corrió.
const ensureStaffTable = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS staff (
      id_staff SERIAL PRIMARY KEY,
      rut_staff VARCHAR(20) UNIQUE,
      nombres VARCHAR(255),
      apellido_paterno VARCHAR(255),
      apellido_materno VARCHAR(255),
      cargo VARCHAR(100),
      rama VARCHAR(50),
      especialidad VARCHAR(100),
      email VARCHAR(255),
      telefono VARCHAR(20),
      fecha_ingreso DATE,
      activo BOOLEAN DEFAULT true,
      salario DECIMAL(10,2),
      contrato_url VARCHAR(255),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  console.log('👥 Tabla staff verificada');
};

// Excepción puntual a un horario base, para UNA fecha específica: cancelar
// esa sesión (tipo='cancelado') o reprogramarla (tipo='reprogramado', con
// override de hora/lugar solo esa fecha — el horario base no cambia).
const ensureHorariosEntrenamientoExcepcionesTable = async () => {
  await ensureHorariosEntrenamientoTable();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS horarios_entrenamiento_excepciones (
      id_excepcion SERIAL PRIMARY KEY,
      id_horario INT NOT NULL REFERENCES horarios_entrenamiento(id_horario) ON DELETE CASCADE,
      fecha DATE NOT NULL,
      tipo VARCHAR(20) NOT NULL DEFAULT 'cancelado',
      hora_inicio_nueva TIME,
      hora_fin_nueva TIME,
      lugar_nuevo VARCHAR(255),
      motivo TEXT,
      registrado_por VARCHAR(255),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(id_horario, fecha)
    )
  `);
  console.log('🚫 Tabla horarios_entrenamiento_excepciones verificada');
};

// Citaciones: el flujo vivía 100% en memoria del navegador (nominaCita en
// App.jsx), por lo que las convocatorias y las respuestas de los apoderados
// se perdían al recargar. Estas tablas le dan persistencia real: la citación
// en sí y, por cada convocado, su fila propia con el estado de respuesta.
const ensureCitacionesTables = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS citaciones (
      id SERIAL PRIMARY KEY,
      tipo_competencia VARCHAR(50),
      competencia_nombre VARCHAR(255) NOT NULL,
      competencia_logo_url VARCHAR(255),
      dia_citacion DATE,
      hora_citacion TIME,
      hora_presentacion TIME,
      rival_nombre VARCHAR(255) NOT NULL,
      rival_logo_url VARCHAR(255),
      rama VARCHAR(50),
      categoria_base VARCHAR(50),
      categorias_apoyo JSONB DEFAULT '[]'::jsonb,
      responsable_nombre VARCHAR(255),
      responsable_rut VARCHAR(20),
      responsable_correo VARCHAR(255),
      responsable_rol VARCHAR(50),
      estado VARCHAR(20) NOT NULL DEFAULT 'activa',
      creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS citacion_convocados (
      id SERIAL PRIMARY KEY,
      citacion_id INTEGER NOT NULL REFERENCES citaciones(id) ON DELETE CASCADE,
      rut_jugador VARCHAR(20) NOT NULL,
      nombre VARCHAR(255),
      rama VARCHAR(50),
      categoria VARCHAR(50),
      correo_apoderado VARCHAR(255),
      respuesta VARCHAR(20) NOT NULL DEFAULT 'pendiente',
      justificacion TEXT,
      mensaje_profesor TEXT,
      requiere_excepcion_morosidad BOOLEAN DEFAULT false,
      excepcion_solicitada BOOLEAN DEFAULT false,
      estado_excepcion VARCHAR(20) DEFAULT 'no_requiere',
      actualizado_en TIMESTAMP,
      creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(citacion_id, rut_jugador)
    )
  `);

  // hora_maxima_confirmacion: fecha+hora libre (no necesariamente el mismo
  // dia_citacion, ej. "10pm del día anterior") a partir de la cual un
  // convocado 'pendiente' se marca 'no' automáticamente (ver barrerCitacionesVencidas).
  await pool.query(`ALTER TABLE citaciones ADD COLUMN IF NOT EXISTS hora_maxima_confirmacion TIMESTAMP`);
  // Distingue un rechazo real del apoderado (siempre con justificación) de
  // uno generado por el barrido de vencimiento (sin justificación), para el
  // desglose "confirmó / rechazó justificando / rechazó por no responder".
  await pool.query(`ALTER TABLE citacion_convocados ADD COLUMN IF NOT EXISTS respondido_automaticamente BOOLEAN NOT NULL DEFAULT false`);
  // Asistencia real el día del torneo (vía escaneo de QR), independiente del
  // RSVP previo en "respuesta" — alguien puede confirmar y no llegar, o
  // llegar sin haber confirmado.
  await pool.query(`ALTER TABLE citacion_convocados ADD COLUMN IF NOT EXISTS asistio_evento BOOLEAN`);
  await pool.query(`ALTER TABLE citacion_convocados ADD COLUMN IF NOT EXISTS hora_asistencia_marcada TIMESTAMP`);

  console.log('📋 Tablas de citaciones verificadas');
};

// Notificaciones in-app reales, dirigidas por RUT (cuentas y jugadores comparten
// el mismo espacio de RUT), para reemplazar el aviso puramente en memoria que
// solo se veía en la pestaña donde se creó la citación.
const ensureNotificacionesAppTable = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS notificaciones_app (
      id SERIAL PRIMARY KEY,
      rut_destinatario VARCHAR(20) NOT NULL,
      tipo VARCHAR(50) NOT NULL,
      titulo VARCHAR(255),
      cuerpo TEXT,
      referencia_tipo VARCHAR(50),
      referencia_id INTEGER,
      leida BOOLEAN DEFAULT false,
      creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_notificaciones_app_rut ON notificaciones_app (rut_destinatario, creado_en DESC)`);

  console.log('🔔 Tabla notificaciones_app verificada');
};

const ensureCodigosAccesoTable = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS codigos_acceso (
      id SERIAL PRIMARY KEY,
      cuenta_id INTEGER NOT NULL,
      codigo_hash TEXT NOT NULL,
      expira_en TIMESTAMPTZ NOT NULL,
      intentos INTEGER NOT NULL DEFAULT 0,
      usado_en TIMESTAMPTZ,
      creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  // proposito: 'acceso' (crear/restablecer clave) o 'verificar_correo'
  // (correo_destino = dirección que se está verificando). creado_por: id
  // del admin que generó un código de activación entregado por WhatsApp.
  await pool.query("ALTER TABLE codigos_acceso ADD COLUMN IF NOT EXISTS proposito VARCHAR(30) NOT NULL DEFAULT 'acceso'");
  await pool.query('ALTER TABLE codigos_acceso ADD COLUMN IF NOT EXISTS correo_destino TEXT');
  await pool.query('ALTER TABLE codigos_acceso ADD COLUMN IF NOT EXISTS creado_por INTEGER');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_codigos_acceso_cuenta ON codigos_acceso (cuenta_id, creado_en DESC)');
  // Limpieza: códigos vencidos hace más de un día ya no sirven para nada.
  await pool.query("DELETE FROM codigos_acceso WHERE expira_en < NOW() - INTERVAL '1 day'");
};

// ==========================================
// CONSENTIMIENTO DE DATOS PERSONALES (Ley 19.628 / Ley 21.719)
// ==========================================
// Cada cuenta debe aceptar el aviso de privacidad vigente (versión en
// src/legal/avisoPrivacidad.js). Se guarda la versión aceptada en cuentas
// y cada aceptación queda registrada con fecha, IP y navegador como
// respaldo (consentimientos_datos), sin borrarse.
const ensureConsentimientoDatos = async () => {
  await pool.query('ALTER TABLE cuentas ADD COLUMN IF NOT EXISTS consentimiento_version VARCHAR(40)');
  await pool.query('ALTER TABLE cuentas ADD COLUMN IF NOT EXISTS consentimiento_aceptado_en TIMESTAMPTZ');
  await pool.query(`
    CREATE TABLE IF NOT EXISTS consentimientos_datos (
      id SERIAL PRIMARY KEY,
      cuenta_id INTEGER NOT NULL,
      version VARCHAR(40) NOT NULL,
      acepta_tratamiento BOOLEAN NOT NULL,
      acepta_datos_salud BOOLEAN NOT NULL,
      autoriza_imagen BOOLEAN NOT NULL DEFAULT false,
      ip VARCHAR(64),
      user_agent TEXT,
      aceptado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  // tipo_registro: 'consentimiento' | 'consentimiento_14_15' | 'lectura_menor_14'
  // (art. 16 quáter); edad_titular al momento de aceptar.
  await pool.query("ALTER TABLE consentimientos_datos ADD COLUMN IF NOT EXISTS tipo_registro VARCHAR(30) NOT NULL DEFAULT 'consentimiento'");
  await pool.query('ALTER TABLE consentimientos_datos ADD COLUMN IF NOT EXISTS edad_titular INTEGER');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_consentimientos_cuenta ON consentimientos_datos (cuenta_id, aceptado_en DESC)');
  columnasTablaCache.delete('cuentas');
};

// Historial persistente de UTM POR MES DE COBRO — sin esto, "cuánto debía
// junio" no se podía responder nunca en agosto: obtenerUTMVigente() solo
// sabe el valor de "el mes pasado relativo a HOY", pisado cada vez que
// cambia el mes calendario. La cuota socio (0,3 UTM) varía mes a mes (ver
// obtenerUTMParaMes), así que un socio con 3 meses impagos debe la SUMA de
// 3 cuotas distintas, no 3 veces la cuota de hoy. Una vez guardado acá, el
// valor de un mes de cobro ya cerrado nunca se vuelve a tocar (es historia).
const ensureUtmMensualTable = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS utm_mensual (
      id SERIAL PRIMARY KEY,
      anio INT NOT NULL,
      mes INT NOT NULL,
      valor NUMERIC(12,2) NOT NULL,
      fecha_corte DATE,
      fuente VARCHAR(30) DEFAULT 'mindicador.cl',
      creado_en TIMESTAMP DEFAULT NOW(),
      UNIQUE(anio, mes)
    )
  `);
  console.log('📅 Tabla utm_mensual verificada');
};

module.exports = {
  ensureSuperAdminAccount,
  ensureJugadoresExtendedColumns,
  ensureBecaHistorialTable,
  ensureJugadoresBecaNumerica,
  limpiarAuditoriaSensible,
  hashearClavesEnTextoPlano,
  ensureBecaRevisionesTable,
  ensureCuentasExtendedColumns,
  ensureComunicacionesExtendedColumns,
  ensureAsistenciaExtendedColumns,
  ensurePartidosLiveLogos,
  ensurePartidosLiveCoreColumns,
  ensurePartidosLiveMesaColumns,
  ensureTorneosTable,
  ensureTorneoEquiposTable,
  ensurePartidosLiveTorneoEquiposColumns,
  ensureClubesLogoColumn,
  ensureCuentasMesInicioCobroColumn,
  ensurePagosMensualidadesColumns,
  ensureLogoAssetsTable,
  ensureAcademiaVideosTable,
  ensureAcademiaPizarrasTable,
  ensureQuizExtendedColumns,
  ensureEvaluacionesTable,
  ensureTarjetasColeccionadasTable,
  ensureAusenciasJugadorTable,
  ensureGamificacionPuntosTable,
  ensureQuizRespuestasTable,
  ensureAcademiaInteraccionesTable,
  ensureKioscoTables,
  ensureArriendosCanchaTable,
  ensureHorariosEntrenamientoTable,
  ensureStaffTable,
  ensureHorariosEntrenamientoExcepcionesTable,
  ensureCitacionesTables,
  ensureNotificacionesAppTable,
  ensureCodigosAccesoTable,
  ensureConsentimientoDatos,
  ensureUtmMensualTable,
};
