// Firma de URLs de archivos de Academia.
// Extraído de server.js sin cambios de comportamiento.
const crypto = require('crypto');
const { pool } = require('./db');

// Videos/pizarras de Academia se sirven directo desde <video>/<img src=...>,
// que el navegador no puede acompañar con header Authorization — por eso
// estas dos rutas de archivo no llevan "authenticate". Sin esto, sus IDs
// autoincrementales (1, 2, 3...) quedaban adivinables por cualquiera sin
// sesión. La firma no reemplaza el login: solo evita que alguien enumere
// contenido a ciegas sin haber pasado antes por un endpoint autenticado que
// la entregue (la subida del video, o el listado de pizarras). Sin fecha de
// expiración a propósito: la URL del video queda guardada tal cual en
// comunicaciones.cuerpo_texto al subirlo (no se reconstruye después), así
// que una firma que expirara rompería videos ya publicados sin forma de
// refrescarla.
const firmarArchivoAcademia = (tipo, id) => crypto
  .createHmac('sha256', String(process.env.JWT_SECRET || ''))
  .update(`${tipo}:${id}`)
  .digest('hex')
  .slice(0, 24);

// Corre una vez al arrancar: cualquier video subido ANTES de que
// firmarArchivoAcademia empezara a exigirse (cuerpo_texto guardado sin
// "?sig=") se re-firma en el momento, para no dejar videos ya publicados
// rotos por el nuevo candado. Idempotente — si ya tiene "?sig=" no la toca.
const refirmarUrlsAcademiaVideo = async () => {
  const filas = await pool.query(
    `SELECT id, academia_video_id, cuerpo_texto FROM comunicaciones
     WHERE cuerpo_texto LIKE 'academia-videos/file/%' AND cuerpo_texto NOT LIKE '%?sig=%'`
  );
  for (const fila of filas.rows) {
    const idVideo = fila.academia_video_id || fila.cuerpo_texto.replace('academia-videos/file/', '').split('?')[0];
    if (!idVideo) continue;
    const urlFirmada = `academia-videos/file/${idVideo}?sig=${firmarArchivoAcademia('video', idVideo)}`;
    await pool.query('UPDATE comunicaciones SET cuerpo_texto = $1 WHERE id = $2', [urlFirmada, fila.id]);
  }
  if (filas.rows.length > 0) {
    console.log(`🔏 Re-firmadas ${filas.rows.length} URL(s) de video de Academia ya publicadas.`);
  }
};

module.exports = {
  firmarArchivoAcademia,
  refirmarUrlsAcademiaVideo,
};
