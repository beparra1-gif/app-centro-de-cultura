const { Client } = require('pg');

const client = new Client({
  user: 'postgres',
  password: 'Inayami.2028',
  host: 'localhost',
  port: 5432,
  database: 'postgres'
});

client.connect()
  .then(() => {
    console.log('✅ Conectado a PostgreSQL');
    return client.query('DROP DATABASE IF EXISTS ccf_db');
  })
  .then(() => {
    console.log('✅ BD ccf_db eliminada');
    return client.query('CREATE DATABASE ccf_db');
  })
  .then(() => {
    console.log('✅ BD ccf_db creada (nueva)');
    return client.end();
  })
  .catch(err => {
    console.error('❌ Error:', err.message);
    client.end();
  });
