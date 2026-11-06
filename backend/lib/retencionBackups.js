// Política de retención de backups en Spaces (función pura, sin S3): ver
// aplicarRetencionSpaces en server.js.
// objetos: [{ Key, LastModified, Size }] → { conservar, borrar } (puro, testeable).
const clasificarBackupsPorRetencion = (objetos, { diarios, semanales, mensuales }, ahora = new Date()) => {
  const DIA = 24 * 60 * 60 * 1000;
  const ordenados = [...objetos].sort((a, b) => new Date(b.LastModified) - new Date(a.LastModified));
  const conservar = new Set();
  const semanaVista = new Set();
  const mesVisto = new Set();
  ordenados.forEach((obj) => {
    const fecha = new Date(obj.LastModified);
    const edadDias = (ahora - fecha) / DIA;
    if (edadDias <= diarios) { conservar.add(obj.Key); return; }
    const claveSemana = `${fecha.getUTCFullYear()}-${Math.floor((fecha - Date.UTC(fecha.getUTCFullYear(), 0, 1)) / (7 * DIA))}`;
    if (edadDias <= semanales * 7) {
      // Dentro de la ventana semanal decide solo esta regla: el más reciente de cada semana.
      if (!semanaVista.has(claveSemana)) {
        semanaVista.add(claveSemana);
        conservar.add(obj.Key);
      }
      return;
    }
    const claveMes = `${fecha.getUTCFullYear()}-${fecha.getUTCMonth()}`;
    if (edadDias <= mensuales * 31 && !mesVisto.has(claveMes)) {
      mesVisto.add(claveMes);
      conservar.add(obj.Key);
    }
  });
  // Nunca borrar el más reciente, pase lo que pase con la política.
  if (ordenados[0]) conservar.add(ordenados[0].Key);
  return {
    conservar: ordenados.filter((o) => conservar.has(o.Key)),
    borrar: ordenados.filter((o) => !conservar.has(o.Key)),
  };
};

module.exports = { clasificarBackupsPorRetencion };
