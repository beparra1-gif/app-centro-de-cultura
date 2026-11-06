// Punto de entrada del backend: carga variables de entorno, levanta la app
// Express (backend/app.js) y, una vez escuchando, corre las tareas de
// arranque (migraciones ensure* en orden) y programa los backups automáticos.
//
// Estructura:
//   app.js            middlewares globales, montaje de routers, manejador de errores
//   routes/*.js       un express.Router por dominio (rutas con su path completo)
//   lib/*.js          helpers compartidos (pool, auditoría, RUT, UTM, backups, esquema...)
//   security/*.js     autenticación y permisos
require('dotenv').config();

const app = require('./app');
const { ejecutarTareasDeArranque } = require('./lib/arranque');
const { scheduleAutomaticBackups } = require('./lib/backup');

// ==========================================
// START SERVER
// ==========================================

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`\n🚀 Servidor corriendo en puerto ${PORT}`);
  console.log(`📍 URL: http://localhost:${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
  console.log(`🗄️  Base de datos: ${process.env.DATABASE_URL ? 'Conectada ✓' : 'No configurada ✗'}\n`);

  // Antes cada ensure* se disparaba en paralelo; ahora van en secuencia y en
  // el mismo orden. No se espera a que terminen para aceptar requests (igual
  // que antes).
  ejecutarTareasDeArranque();

  scheduleAutomaticBackups();
});

module.exports = app;
