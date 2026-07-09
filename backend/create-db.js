const { Client } = require('pg');

const client = new Client({
  user: 'postgres',
  password: 'Inayami.2028',
  host: 'localhost',
  port: 5432,
  database: 'postgres' // Conectar a la BD default primero
});

client.connect()
  .then(() => {
    console.log('✅ Conectado a PostgreSQL');
    return client.query('CREATE DATABASE ccf_db');
  })
  .then(() => {
    console.log('✅ Base de datos ccf_db creada exitosamente');
    return client.end();
  })
  .catch(err => {
    if (err.message.includes('already exists')) {
      console.log('✅ Base de datos ccf_db ya existe');
    } else {
      console.error('❌ Error:', err.message);
    }
    client.end();
  });
