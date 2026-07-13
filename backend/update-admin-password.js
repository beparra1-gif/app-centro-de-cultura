const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

(async () => {
  try {
    const result = await pool.query(
      'UPDATE cuentas SET password = $1 WHERE rut = $2 RETURNING id, correo, rol',
      ['123456', '11111111-1']
    );
    
    if (result.rows.length > 0) {
      console.log('✓ Password updated:', result.rows[0]);
    } else {
      console.log('✗ User not found');
    }
    
    process.exit(0);
  } catch (err) {
    console.error('✗ Error:', err.message);
    process.exit(1);
  }
})();
