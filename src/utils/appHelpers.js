export function getUTMLastDayPreviousMonth(fallbackUtm = 71506) {
  const utmPorMes = {
    enero: 68900,
    febrero: 69300,
    marzo: 69800,
    abril: 70100,
    mayo: 70800,
    junio: 71506,
    julio: 71506,
    agosto: 72000,
    septiembre: 72500,
    octubre: 73000,
    noviembre: 73500,
    diciembre: 74000,
  };

  const today = new Date(2026, 6, 9);
  const ultimoDiaMesAnterior = new Date(today.getFullYear(), today.getMonth(), 0);
  const mesAnterior = ultimoDiaMesAnterior
    .toLocaleString('es-ES', { month: 'long' })
    .replace('de ', '')
    .toLowerCase();

  return utmPorMes[mesAnterior] || fallbackUtm;
}

export function getColorUrgencia(urgencia) {
  const colores = {
    Baja: '#34C759',
    Media: '#FF9500',
    Alta: '#FF3B30',
    Critica: '#8B0000',
    'Cr\u00edtica': '#8B0000',
  };
  return colores[urgencia] || '#007AFF';
}

export function getColorPorCategoria(categoria) {
  if (categoria === 'Bebida') return { border: '#4DD0E1', bg: '#E0F7FA', text: '#006064' };
  if (categoria === 'Comida') return { border: '#FFB74D', bg: '#FFF3E0', text: '#E65100' };
  if (categoria === 'Entradas') return { border: '#BA68C8', bg: '#F3E5F5', text: '#4A148C' };
  return { border: 'rgba(0,0,0,0.05)', bg: 'var(--blanco-tarjeta)', text: 'var(--texto-principal)' };
}

export function colorTipo(tipo) {
  if (tipo === 'socio') return { bg: 'rgba(0,122,255,0.1)', color: 'var(--azul-electrico)' };
  if (tipo === 'apoderado') return { bg: 'rgba(255,149,0,0.12)', color: '#b36200' };
  return { bg: 'rgba(110,50,200,0.12)', color: '#6E32C8' };
}

export function calcularEff(jugador) {
  return (jugador.pts + jugador.reb + jugador.ast + jugador.stl + jugador.blk) - jugador.to;
}
