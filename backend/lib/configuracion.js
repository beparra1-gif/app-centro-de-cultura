// Tabla configuracion_sistema: creación perezosa y lectura de tarifas del club.
// Extraído de server.js sin cambios de comportamiento.
const { pool } = require('./db');

// Configuración persistente (tabla clave/valor; ver migrations/init.js).
let tablaConfiguracionLista = null;
const asegurarTablaConfiguracion = () => {
  tablaConfiguracionLista = tablaConfiguracionLista || pool.query(
    `CREATE TABLE IF NOT EXISTS configuracion_sistema (
       clave VARCHAR(100) PRIMARY KEY,
       valor JSONB NOT NULL DEFAULT '{}'::jsonb,
       actualizado_por VARCHAR(50),
       updated_at TIMESTAMP DEFAULT NOW()
     )`
  ).catch((e) => { tablaConfiguracionLista = null; throw e; });
  return tablaConfiguracionLista;
};
const leerConfigTarifas = async () => {
  await asegurarTablaConfiguracion();
  const r = await pool.query("SELECT valor, actualizado_por, updated_at FROM configuracion_sistema WHERE clave = 'tarifas_mensualidad'");
  return r.rows[0] ? { ...r.rows[0].valor, actualizadoPor: r.rows[0].actualizado_por, actualizado: r.rows[0].updated_at } : { historial: null };
};

module.exports = {
  asegurarTablaConfiguracion,
  leerConfigTarifas,
};
