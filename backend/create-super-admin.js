const { Pool } = require('pg');
require('dotenv').config();

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
  ssl: shouldUseSsl ? { rejectUnauthorized: false } : false,
});

const normalizarRut = (rut = '') => String(rut).replace(/\./g, '').replace(/-/g, '').trim().toUpperCase();

const validarRutChileno = (rut = '') => {
  const limpio = normalizarRut(rut);
  if (!/^\d{7,8}[0-9K]$/.test(limpio)) return false;

  const cuerpo = limpio.slice(0, -1);
  const dv = limpio.slice(-1);
  let suma = 0;
  let multiplo = 2;

  for (let i = cuerpo.length - 1; i >= 0; i -= 1) {
    suma += Number(cuerpo[i]) * multiplo;
    multiplo = multiplo === 7 ? 2 : multiplo + 1;
  }

  const resto = 11 - (suma % 11);
  const esperado = resto === 11 ? '0' : resto === 10 ? 'K' : String(resto);
  return dv === esperado;
};

const formatearRut = (rut = '') => {
  const limpio = normalizarRut(rut);
  if (limpio.length < 2) return limpio;
  return `${limpio.slice(0, -1)}-${limpio.slice(-1)}`;
};

async function run() {
  const SUPER_ADMIN_EMAIL = process.env.SUPER_ADMIN_EMAIL || 'superadmin@ccf.local';
  const SUPER_ADMIN_RUT = process.env.SUPER_ADMIN_RUT || '11111111-1';
  const SUPER_ADMIN_PASSWORD = process.env.SUPER_ADMIN_PASSWORD || 'AdminCCF2026!';
  const SUPER_ADMIN_NOMBRES = process.env.SUPER_ADMIN_NOMBRES || 'Super';
  const SUPER_ADMIN_APELLIDO = process.env.SUPER_ADMIN_APELLIDO || 'Admin';

  if (!validarRutChileno(SUPER_ADMIN_RUT)) {
    console.error('RUT de super admin inválido. Configura SUPER_ADMIN_RUT válido en .env');
    process.exit(1);
  }

  const rutFmt = formatearRut(SUPER_ADMIN_RUT);

  const query = `
    INSERT INTO cuentas (
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
      updated_at = NOW()
    RETURNING id, correo, rut, nombres, apellido_paterno, rol, estado
  `;

  try {
    const result = await pool.query(query, [
      SUPER_ADMIN_EMAIL,
      rutFmt,
      SUPER_ADMIN_PASSWORD,
      SUPER_ADMIN_NOMBRES,
      SUPER_ADMIN_APELLIDO,
    ]);

    const row = result.rows[0];
    console.log('Super admin listo:');
    console.log(`- id: ${row.id}`);
    console.log(`- correo: ${row.correo}`);
    console.log(`- rut: ${row.rut}`);
    console.log(`- rol: ${row.rol}`);
    console.log('Credenciales por defecto (cambiar apenas entres):');
    console.log(`- RUT: ${rutFmt}`);
    console.log(`- Password: ${SUPER_ADMIN_PASSWORD}`);
  } catch (error) {
    console.error('Error creando super admin:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

run();
