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

const formatearRut = (rut = '') => {
  const limpio = normalizarRut(rut);
  if (limpio.length < 2) return limpio;
  return `${limpio.slice(0, -1)}-${limpio.slice(-1)}`;
};

const calcularDvRut = (numeroBase) => {
  const cuerpo = String(numeroBase).replace(/\D/g, '');
  let suma = 0;
  let multiplo = 2;

  for (let i = cuerpo.length - 1; i >= 0; i -= 1) {
    suma += Number(cuerpo[i]) * multiplo;
    multiplo = multiplo === 7 ? 2 : multiplo + 1;
  }

  const resto = 11 - (suma % 11);
  return resto === 11 ? '0' : resto === 10 ? 'K' : String(resto);
};

const generarRut = (numeroBase) => {
  const base = String(numeroBase).replace(/\D/g, '').padStart(8, '0');
  return formatearRut(`${base}${calcularDvRut(base)}`);
};

const cuentasDemo = [
  {
    correo: 'admin@ccf.local',
    rut: generarRut(10000001),
    password: 'AdminCCF2026!',
    nombres: 'Maria',
    apellido_paterno: 'Tesorera',
    rol: 'admin',
  },
  {
    correo: 'staff@ccf.local',
    rut: generarRut(20000002),
    password: 'StaffCCF2026!',
    nombres: 'Juan',
    apellido_paterno: 'Entrenador',
    rol: 'staff',
  },
  {
    correo: 'mesa@ccf.local',
    rut: generarRut(30000003),
    password: 'MesaCCF2026!',
    nombres: 'Carlos',
    apellido_paterno: 'Mesa',
    rol: 'mesa',
  },
  {
    correo: 'jugador@ccf.local',
    rut: '12345678-1',
    password: 'JugadorCCF2026!',
    nombres: 'Diego',
    apellido_paterno: 'León',
    rol: 'jugador',
  },
  {
    correo: 'visita@ccf.local',
    rut: generarRut(50000005),
    password: 'VisitaCCF2026!',
    nombres: 'Invitado',
    apellido_paterno: 'Club',
    rol: 'visita',
  },
];

async function run() {
  try {
    for (const cuenta of cuentasDemo) {
      await pool.query(
        `INSERT INTO cuentas (
          correo, rut, password, nombres, apellido_paterno, rol, estado,
          es_socio, forzar_clave, autorizacion_imagen
        ) VALUES ($1,$2,$3,$4,$5,$6,'activo',false,false,true)
        ON CONFLICT (correo)
        DO UPDATE SET
          rut = EXCLUDED.rut,
          password = EXCLUDED.password,
          nombres = EXCLUDED.nombres,
          apellido_paterno = EXCLUDED.apellido_paterno,
          rol = EXCLUDED.rol,
          estado = 'activo',
          updated_at = NOW()`,
        [
          cuenta.correo,
          cuenta.rut,
          cuenta.password,
          cuenta.nombres,
          cuenta.apellido_paterno,
          cuenta.rol,
        ]
      );
    }

    console.log('Cuentas demo creadas o actualizadas:');
    cuentasDemo.forEach((cuenta) => {
      console.log(`- ${cuenta.rol}: ${cuenta.correo} | RUT ${cuenta.rut} | Password ${cuenta.password}`);
    });
  } catch (error) {
    console.error('Error creando cuentas demo:', error.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

run();
