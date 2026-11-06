// Helpers de cuentas: búsqueda por RUT, provisión de cuenta de jugador, columnas de tabla y campos faltantes.
// Extraído de server.js sin cambios de comportamiento.
const { hashPassword } = require('../security/auth');
const { pool } = require('./db');
const { formatearRut, validarRutChileno } = require('./rut');

const omitPassword = (cuenta = {}) => {
  const resto = { ...cuenta };
  delete resto.password;
  return resto;
};

const construirCorreoPlaceholderDesdeRut = (rutNormalizado = '') => {
  const limpio = String(rutNormalizado || '').trim().toLowerCase();
  return `${limpio || 'sin-rut'}@actualizar.local`;
};

const obtenerCuentaPorRutNormalizado = async (rutNormalizado) => {
  const columnasCuentas = await obtenerColumnasTabla('cuentas');
  const col = (nombre, castSql = 'text') => (
    columnasCuentas.has(nombre)
      ? nombre
      : `NULL::${castSql} AS ${nombre}`
  );

  const result = await pool.query(
    `SELECT
      ${col('id', 'int')},
      ${col('correo')},
      ${col('rut')},
      ${col('password')},
      ${col('nombres')},
      ${col('apellido_paterno')},
      ${col('rol')},
      ${col('perfil_principal')},
      ${col('estado')},
      ${col('forzar_clave', 'boolean')},
      ${col('foto_perfil_url')},
      ${col('requiere_foto_perfil', 'boolean')},
      ${col('consentimiento_version')}
     FROM cuentas
     WHERE UPPER(REPLACE(REPLACE(COALESCE(rut, ''), '.', ''), '-', '')) = $1
     LIMIT 1`,
    [rutNormalizado]
  );

  return result.rows[0] || null;
};

const provisionarCuentaJugadorSiCorresponde = async ({ rutNormalizado, password }) => {
  if (String(password || '') !== '12345') return null;
  const passwordHashDefault = await hashPassword('12345');

  const jugadorRes = await pool.query(
    `SELECT rut_jugador, nombres, apellido_paterno, estado
     FROM jugadores
     WHERE UPPER(REPLACE(REPLACE(COALESCE(rut_jugador, ''), '.', ''), '-', '')) = $1
     LIMIT 1`,
    [rutNormalizado]
  );

  if (jugadorRes.rows.length === 0) return null;

  const jugador = jugadorRes.rows[0];
  const estadoJugador = String(jugador.estado || 'ACTIVO').toUpperCase();
  if (estadoJugador === 'BAJA') return null;

  const rutFormateado = formatearRut(jugador.rut_jugador || rutNormalizado);
  const correoPlaceholder = construirCorreoPlaceholderDesdeRut(rutNormalizado);

  const columnasCuentas = await obtenerColumnasTabla('cuentas');
  const requiereFotoExiste = columnasCuentas.has('requiere_foto_perfil');

  const existente = await obtenerCuentaPorRutNormalizado(rutNormalizado);
  if (existente?.id) {
    await pool.query(
      `UPDATE cuentas
       SET nombres = COALESCE(NULLIF(nombres, ''), $1),
           apellido_paterno = COALESCE(NULLIF(apellido_paterno, ''), $2),
           rol = COALESCE(rol, 'jugador'),
           perfil_principal = COALESCE(perfil_principal, 'jugador'),
           estado = COALESCE(estado, 'activo'),
           password = CASE WHEN COALESCE(NULLIF(password, ''), '') = '' THEN $4 ELSE password END,
           forzar_clave = CASE WHEN COALESCE(NULLIF(password, ''), '') = '' THEN true ELSE COALESCE(forzar_clave, false) END,
           updated_at = NOW()
       WHERE id = $3`,
      [jugador.nombres || null, jugador.apellido_paterno || null, existente.id, passwordHashDefault]
    );
    return await obtenerCuentaPorRutNormalizado(rutNormalizado);
  }

  if (requiereFotoExiste) {
    await pool.query(
      `INSERT INTO cuentas (
        correo, rut, password, nombres, apellido_paterno, rol, perfil_principal, estado, forzar_clave, requiere_foto_perfil
      ) VALUES (
        $1, $2, $3, $4, $5, 'jugador', 'jugador', 'activo', true, false
      )`,
      [correoPlaceholder, rutFormateado, passwordHashDefault, jugador.nombres || null, jugador.apellido_paterno || null]
    );
  } else {
    await pool.query(
      `INSERT INTO cuentas (
        correo, rut, password, nombres, apellido_paterno, rol, perfil_principal, estado, forzar_clave
      ) VALUES (
        $1, $2, $3, $4, $5, 'jugador', 'jugador', 'activo', true
      )`,
      [correoPlaceholder, rutFormateado, passwordHashDefault, jugador.nombres || null, jugador.apellido_paterno || null]
    );
  }

  return await obtenerCuentaPorRutNormalizado(rutNormalizado);
};

const columnasTablaCache = new Map();

const obtenerColumnasTabla = async (tabla) => {
  if (columnasTablaCache.has(tabla)) {
    return columnasTablaCache.get(tabla);
  }

  const resultado = await pool.query(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = $1`,
    [tabla]
  );

  const columnas = new Set(resultado.rows.map((fila) => fila.column_name));
  columnasTablaCache.set(tabla, columnas);
  return columnas;
};

const camposObligatoriosCuenta = [
  'correo',
  'rut',
  'nombres',
  'apellido_paterno',
  'telefono',
  'direccion',
  'comuna',
  'rol'
];

const detectarCamposFaltantesCuenta = (cuenta) => {
  const faltantes = [];
  for (const campo of camposObligatoriosCuenta) {
    const valor = cuenta[campo];
    if (valor == null || String(valor).trim() === '') {
      faltantes.push(campo);
    }
  }

  const correo = String(cuenta.correo || '').toLowerCase();
  if (correo.endsWith('@actualizar.local')) {
    faltantes.push('correo');
  }

  const rut = String(cuenta.rut || '').toUpperCase();
  if (rut.startsWith('PENDIENTE-RUT-')) {
    faltantes.push('rut');
  }

  if (cuenta.rut && !validarRutChileno(cuenta.rut)) {
    faltantes.push('rut_valido');
  }

  return faltantes;
};

module.exports = {
  detectarCamposFaltantesCuenta,
  obtenerCuentaPorRutNormalizado,
  provisionarCuentaJugadorSiCorresponde,
  columnasTablaCache,
  omitPassword,
  obtenerColumnasTabla,
  construirCorreoPlaceholderDesdeRut,
};
