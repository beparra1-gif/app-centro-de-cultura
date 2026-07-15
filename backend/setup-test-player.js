const { Pool } = require('pg');
require('dotenv').config();
const { hashPassword } = require('./security/auth');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function insertTestPlayerAndAccount() {
  try {
    const checkCuenta = await pool.query("SELECT * FROM cuentas WHERE rut = '22222222-2'");
    if (checkCuenta.rows.length === 0) {
      const passwordHash = await hashPassword('123456');
      await pool.query(
        `INSERT INTO cuentas (correo, rut, password, nombres, rol, estado)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (correo) DO NOTHING`,
        ['apoderado@test.local', '22222222-2', passwordHash, 'Test Apoderado', 'socio', 'activo']
      );
      console.log('Test apoderado account created: apoderado@test.local / 123456');
    } else {
      console.log('Test apoderado account already exists');
    }

    const checkJugador = await pool.query("SELECT * FROM jugadores WHERE rut_jugador = '33333333-3'");
    if (checkJugador.rows.length === 0) {
      await pool.query(
        `INSERT INTO jugadores (rut_jugador, nombres, apellido_paterno, apellido_materno, rama, categoria, correo_apoderado, estado)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        ['33333333-3', 'Test', 'Jugador', 'Playwright', 'masculina', 'U15', 'apoderado@test.local', 'activo']
      );
      console.log('Test jugador created: Test Jugador Playwright (rut 33333333-3)');
    } else {
      console.log('Test jugador already exists');
    }

    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

insertTestPlayerAndAccount();
