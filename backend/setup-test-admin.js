const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function insertTestAdmin() {
  try {
    // Check if already exists
    const check = await pool.query("SELECT * FROM cuentas WHERE rut = '11111111-1'");
    if (check.rows.length > 0) {
      console.log('✓ Test admin already exists');
      process.exit(0);
    }
    
    const result = await pool.query(
      \INSERT INTO cuentas (correo, rut, password, nombres, rol, estado) 
       VALUES (\, \, \, \, \, \)
       ON CONFLICT (correo) DO NOTHING
       RETURNING id, correo, rol\,
      [
        'admin@test.local',
        '11111111-1', 
        '123456',
        'Test Admin',
        'super_admin',
        'activo'
      ]
    );
    
    if (result.rows.length > 0) {
      console.log('✓ Test admin created:', result.rows[0]);
    } else {
      console.log('✓ Test admin already exists');
    }
    process.exit(0);
  } catch (err) {
    console.error('✗ Error:', err.message);
    process.exit(1);
  }
}

insertTestAdmin();
