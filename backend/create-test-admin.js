const { Pool } = require('pg');
require('dotenv').config();
const { hashPassword } = require('./security/auth');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

(async () => {
  try {
    const passwordHash = await hashPassword('123456');
    const result = await pool.query(
      'INSERT INTO cuentas (correo, rut, password, nombres, rol, estado) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT DO NOTHING RETURNING id',
      ['admin@test.local', '11111111-1', passwordHash, 'Admin Prueba', 'super_admin', 'activo']
    );
    
    if (result.rows.length > 0) {
      console.log('✓ Test admin created');
    } else {
      console.log('✓ Test admin already exists');
    }
    
    // Also verify by querying
    const verify = await pool.query(
      'SELECT id, correo, rut, rol FROM cuentas WHERE rut = $1',
      ['11111111-1']
    );
    
    if (verify.rows.length > 0) {
      console.log('✓ Verified:', verify.rows[0]);
    }
    
    process.exit(0);
  } catch (err) {
    console.error('✗ Error:', err.message);
    process.exit(1);
  }
})();
