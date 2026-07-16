import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowRightLeft, Download, Expand, FileText, Filter, History, Shield, Tv, Users } from 'lucide-react';
import { nextId } from '../utils/runtimeId';
import { calcularEff } from '../utils/appHelpers';
import { showToast } from '../utils/toast';
import { confirmAction } from '../utils/confirmDialog';
import * as api from '../api/client';
import LogoAvatar from './LogoAvatar';
import LogoPicker from './LogoPicker';
import { normalizarSlugLogo } from '../utils/logoResolver';

const LIMITE_JUGADORES_POR_EQUIPO = 12;
const MESA_SESSION_KEY = 'mesa_live_session_v2';

// Cuando "activo", renderiza el contenido directo en document.body en vez del
// arbol normal: .ios-main tiene una transform permanente (clase screen-ready,
// para su animacion de entrada) que lo convierte en containing block de los
// descendientes position:fixed, atrapando el overlay de pantalla completa de
// Mesa por debajo del header de la app en vez de cubrirlo. El portal evita
// ese problema por completo sin tocar la animacion global de .ios-main.
//
// Mantenemos la clase fiba-container en este nodo aunque quede fuera del
// <div className="fiba-container"> original: casi todos los ajustes de
// layout de Mesa (grillas de tablet, tarjeta de control, etc.) usan
// selectores ".fiba-container ..." que exigen ese ancestro. Sin la clase
// aca, el portal los deja de matchear por completo y el contenido cae a los
// estilos base sin adaptarse a pantalla completa.
function LiveWrapPortal({ activo, innerRef, children }) {
  const contenido = (
    <div ref={innerRef} className={`fiba-container mesa-live-wrap ${activo ? 'mesa-live-wrap-activo' : ''}`}>
      {children}
    </div>
  );
  if (!activo || typeof document === 'undefined') return contenido;
  return createPortal(contenido, document.body);
}

const numero = (valor) => Number(valor || 0);
const limitar = (valor, min, max) => Math.max(min, Math.min(max, valor));

const relojASegundos = (reloj = '10:00') => {
  const match = String(reloj || '10:00').match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return 600;
  const minutos = Number(match[1]);
  const segundos = Number(match[2]);
  if (!Number.isFinite(minutos) || !Number.isFinite(segundos)) return 600;
  return Math.max(0, (minutos * 60) + segundos);
};

const segundosAReloj = (total = 0) => {
  const seguros = Math.max(0, Number(total || 0));
  const minutos = Math.floor(seguros / 60);
  const segundos = seguros % 60;
  return `${String(minutos).padStart(2, '0')}:${String(segundos).padStart(2, '0')}`;
};

const etiquetaPeriodo = (periodo = 1) => {
   const p = Math.max(1, Number(periodo || 1));
   if (p <= 4) return `Q${p}`;
   return `OT${p - 4}`;
 };

 const relojInicialPeriodo = (periodo = 1) => (Number(periodo || 1) > 4 ? '05:00' : '10:00');

const duracionPeriodoSegundos = (periodo = 1) => (Number(periodo || 1) > 4 ? 300 : 600);

const instantePartidoSegundos = (periodo = 1, reloj = '') => {
  const p = Math.max(1, Number(periodo || 1));
  const relojInicial = relojInicialPeriodo(p);
  const segundosRestantes = relojASegundos(reloj || relojInicial);
  let acumulado = 0;
  for (let i = 1; i < p; i += 1) acumulado += duracionPeriodoSegundos(i);
  return acumulado + (duracionPeriodoSegundos(p) - segundosRestantes);
};

const formatoPct = (convertidos = 0, intentos = 0) => {
  const att = Number(intentos || 0);
  const made = Number(convertidos || 0);
  if (!att) return '0.0%';
  return `${((made / att) * 100).toFixed(1)}%`;
};

const normalizarTexto = (valor = '') => String(valor || '').trim();
const normalizarClaveFiltro = (valor = '') => normalizarSlugLogo(valor);
const coincideFiltro = (valorA, valorB) => normalizarClaveFiltro(valorA) === normalizarClaveFiltro(valorB);
const esNuestroClub = (valor = '') => {
  const slug = normalizarSlugLogo(valor);
  return [
    'centro-de-cultura-fisica',
    'club-centro-de-cultura-fisica',
    'ccf',
    'club-cultura-fisica',
    'cultura-fisica',
  ].some((alias) => slug === alias || slug.includes(alias));
};

const canonizarNombreEquipo = (valor = '') => {
  if (esNuestroClub(valor)) return 'centro-de-cultura-fisica';
  return normalizarSlugLogo(valor);
};

const obtenerSubCategoriaNumero = (valor = '') => {
  const texto = String(valor || '').toUpperCase();
  const match = texto.match(/(?:SUB|U)\s*-?\s*(\d{1,2})/);
  if (!match) return null;
  const numero = Number(match[1]);
  return Number.isFinite(numero) ? numero : null;
};

const obtenerSubCategorias = (valor = '') => {
  const texto = String(valor || '').toUpperCase();
  const matches = Array.from(texto.matchAll(/(?:SUB|U)\s*-?\s*(\d{1,2})/g));
  return Array.from(new Set(matches
    .map((match) => Number(match[1]))
    .filter((num) => Number.isFinite(num))));
};

const coincideCategoriaFiltro = (valorA = '', valorB = '') => {
  if (coincideFiltro(valorA, valorB)) return true;
  const catsA = obtenerSubCategorias(valorA);
  const catsB = obtenerSubCategorias(valorB);
  if (catsA.length > 0 && catsB.length > 0) {
    return catsA.some((cat) => catsB.includes(cat));
  }
  const normA = normalizarClaveFiltro(valorA);
  const normB = normalizarClaveFiltro(valorB);
  return Boolean(normA && normB && (normA.includes(normB) || normB.includes(normA)));
};

const esCategoriaInferiorDentroDeRango = (categoriaJugador = '', categoriaBase = '', niveles = 0) => {
  const subJugador = obtenerSubCategoriaNumero(categoriaJugador);
  const subBase = obtenerSubCategoriaNumero(categoriaBase);
  if (subJugador == null || subBase == null) return false;
  if (subJugador > subBase) return false;
  const margenPermitido = Math.max(0, Number(niveles || 0)) * 2;
  return (subBase - subJugador) <= margenPermitido;
};

const inferirRamaDesdeTexto = (valor = '') => {
  const slug = normalizarSlugLogo(valor);
  if (slug.includes('femen')) return 'Femenina';
  if (slug.includes('mascul')) return 'Masculina';
  return '';
};

const inferirCategoriaDesdeTexto = (valor = '') => {
  const sub = obtenerSubCategoriaNumero(valor);
  if (sub == null) return '';
  return `SUB-${sub}`;
};

const construirOpcionesFiltro = (valores = []) => {
  const map = new Map();
  valores.forEach((valor) => {
    const limpio = normalizarTexto(valor);
    if (!limpio) return;
    const clave = normalizarClaveFiltro(limpio);
    if (!clave || map.has(clave)) return;
    map.set(clave, limpio);
  });
  return ['Todas', ...Array.from(map.values())];
};

const construirEquipoKey = (nombre = '', logoUrl = '') => {
  const nombreKey = canonizarNombreEquipo(nombre) || 'equipo';
  return nombreKey || normalizarTexto(logoUrl) || 'equipo';
};

const colorConAlpha = (hex = '#0a84ff', alpha = '22') => {
  const limpio = String(hex || '').trim();
  if (/^#[0-9A-Fa-f]{6}$/.test(limpio)) return `${limpio}${alpha}`;
  return '#0a84ff22';
};

const colorTextoContraste = (hex = '#0a84ff') => {
  const limpio = String(hex || '').replace('#', '').trim();
  if (!/^[0-9A-Fa-f]{6}$/.test(limpio)) return '#FFFFFF';
  const r = parseInt(limpio.slice(0, 2), 16);
  const g = parseInt(limpio.slice(2, 4), 16);
  const b = parseInt(limpio.slice(4, 6), 16);
  const luminancia = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return luminancia > 0.58 ? '#111111' : '#FFFFFF';
};

const listasIguales = (a = [], b = []) => (
  a.length === b.length && a.every((valor, idx) => String(valor) === String(b[idx]))
);

const construirCsv = (filas = []) => {
  if (!Array.isArray(filas) || filas.length === 0) return '';
  const headers = Object.keys(filas[0]);
  const escapeCsv = (valor) => {
    const texto = String(valor ?? '');
    if (texto.includes(',') || texto.includes('"') || texto.includes('\n')) {
      return `"${texto.replace(/"/g, '""')}"`;
    }
    return texto;
  };
  const body = filas.map((fila) => headers.map((h) => escapeCsv(fila[h])).join(','));
  return [headers.join(','), ...body].join('\n');
};

const descargarTexto = (nombreArchivo, contenido, tipo = 'text/plain;charset=utf-8') => {
  const blob = new Blob([contenido], { type: tipo });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = nombreArchivo;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
};

const escapeHtml = (valor = '') => String(valor ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const construirHtmlPlanillaFiba = (partido = null) => {
  const local = partido?.equipos?.local || {};
  const visita = partido?.equipos?.visita || {};
  const rosterLocal = Array.isArray(local.roster) ? local.roster : [];
  const rosterVisita = Array.isArray(visita.roster) ? visita.roster : [];
  const marcador = partido?.marcador || {};
  const fecha = partido?.finalizadoAt ? new Date(partido.finalizadoAt) : null;

  const filasRoster = (roster = []) => roster.map((j) => `
    <tr>
      <td>${escapeHtml(j.dorsal ?? '')}</td>
      <td>${escapeHtml(j.nombre || '')}</td>
      <td>${Number(j.pts || 0)}</td>
      <td>${Number(j.reb || 0)}</td>
      <td>${Number(j.ast || 0)}</td>
      <td>${Number(j.flt || 0)}</td>
      <td>${Number(j.ftm || 0)}/${Number(j.fta || 0)}</td>
      <td>${formatoPct(Number(j.ftm || 0), Number(j.fta || 0))}</td>
    </tr>
  `).join('');

  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <title>Planilla FIBA - ${escapeHtml(local.nombre || 'Local')} vs ${escapeHtml(visita.nombre || 'Visita')}</title>
  <style>
    :root {
      --fiba-blue: #0c2340;
      --fiba-orange: #f58220;
      --line: #d1d5db;
      --text: #111827;
    }
    @page { size: A4 portrait; margin: 10mm; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: Arial, Helvetica, sans-serif;
      color: var(--text);
      background: #fff;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .sheet {
      border: 2px solid var(--fiba-blue);
      padding: 10px;
    }
    .header {
      border: 2px solid var(--fiba-blue);
      background: var(--fiba-blue);
      color: #fff;
      padding: 8px 10px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-weight: 900;
      letter-spacing: .02em;
      text-transform: uppercase;
    }
    .brand {
      display: inline-flex;
      align-items: center;
      gap: 8px;
    }
    .badge {
      background: var(--fiba-orange);
      color: #111;
      border-radius: 999px;
      padding: 2px 8px;
      font-size: 11px;
      font-weight: 900;
    }
    .meta {
      margin-top: 8px;
      border: 1px solid var(--line);
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
    }
    .meta div {
      border-right: 1px solid var(--line);
      border-bottom: 1px solid var(--line);
      padding: 6px;
      font-size: 12px;
    }
    .meta div:nth-child(4n) { border-right: none; }
    .score {
      margin-top: 8px;
      border: 2px solid var(--fiba-blue);
      display: grid;
      grid-template-columns: 1fr auto 1fr;
      align-items: center;
      text-align: center;
      font-weight: 900;
    }
    .score .team {
      padding: 8px;
      font-size: 13px;
    }
    .score .pts {
      padding: 8px 14px;
      border-left: 2px solid var(--fiba-blue);
      border-right: 2px solid var(--fiba-blue);
      font-size: 22px;
      background: #f8fafc;
    }
    .section {
      margin-top: 10px;
      border: 1px solid var(--line);
    }
    .section h3 {
      margin: 0;
      background: #f3f4f6;
      border-bottom: 1px solid var(--line);
      padding: 6px 8px;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: .02em;
      color: var(--fiba-blue);
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 11px;
    }
    th, td {
      border: 1px solid var(--line);
      padding: 4px 5px;
      text-align: center;
    }
    th {
      background: #eef2ff;
      color: var(--fiba-blue);
      font-weight: 900;
    }
    td:nth-child(2), th:nth-child(2) { text-align: left; }
    .signatures {
      margin-top: 12px;
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 10px;
    }
    .sig {
      border-top: 1px solid #111;
      padding-top: 4px;
      font-size: 11px;
      text-align: center;
      min-height: 34px;
    }
  </style>
</head>
<body>
  <div class="sheet">
    <div class="header">
      <div class="brand">Planilla Oficial de Juego <span class="badge">FIBA Style</span></div>
      <div>${escapeHtml(partido?.filtros?.competicion || 'Competencia')}</div>
    </div>

    <div class="meta">
      <div><strong>Fecha:</strong> ${escapeHtml(fecha ? fecha.toLocaleDateString('es-CL') : '')}</div>
      <div><strong>Hora:</strong> ${escapeHtml(fecha ? fecha.toLocaleTimeString('es-CL') : '')}</div>
      <div><strong>Rama:</strong> ${escapeHtml(partido?.filtros?.rama || '')}</div>
      <div><strong>Categoría:</strong> ${escapeHtml(partido?.filtros?.categoria || '')}</div>
      <div><strong>Sede:</strong> ${escapeHtml(partido?.canchaSede || '')}</div>
      <div><strong>Período final:</strong> ${escapeHtml(etiquetaPeriodo(marcador.periodo || 1))}</div>
      <div><strong>Planillero:</strong> ${escapeHtml(partido?.operadores?.planillero || '')}</div>
      <div><strong>Estadístico:</strong> ${escapeHtml(partido?.operadores?.estadistico || '')}</div>
    </div>

    <div class="score">
      <div class="team">${escapeHtml(local.nombre || 'Local')}</div>
      <div class="pts">${Number(marcador.ptsLocal || 0)} - ${Number(marcador.ptsVisita || 0)}</div>
      <div class="team">${escapeHtml(visita.nombre || 'Visita')}</div>
    </div>

    <div class="section">
      <h3>Ficha Técnica Local</h3>
      <table>
        <thead>
          <tr><th>#</th><th>Jugador/a</th><th>PTS</th><th>REB</th><th>AST</th><th>F</th><th>TL</th><th>TL%</th></tr>
        </thead>
        <tbody>${filasRoster(rosterLocal) || '<tr><td colspan="8">Sin datos</td></tr>'}</tbody>
      </table>
    </div>

    <div class="section">
      <h3>Ficha Técnica Visita</h3>
      <table>
        <thead>
          <tr><th>#</th><th>Jugador/a</th><th>PTS</th><th>REB</th><th>AST</th><th>F</th><th>TL</th><th>TL%</th></tr>
        </thead>
        <tbody>${filasRoster(rosterVisita) || '<tr><td colspan="8">Sin datos</td></tr>'}</tbody>
      </table>
    </div>

    <div class="signatures">
      <div class="sig">Firma Planillero/a</div>
      <div class="sig">Firma Estadístico/a</div>
      <div class="sig">Firma Supervisor/a</div>
    </div>
  </div>
</body>
</html>`;
};

const sonEquiposCompatibles = (jugador = {}, equipo = null) => {
  if (!equipo) return false;
  if (jugador._equipoKey && equipo.key && jugador._equipoKey === equipo.key) return true;

  const canonJugador = jugador._equipoCanon || canonizarNombreEquipo(jugador._equipoNombre || '');
  const canonEquipo = equipo._canon || canonizarNombreEquipo(equipo.nombre || '');
  if (canonJugador && canonEquipo && canonJugador === canonEquipo) return true;

  if (esNuestroClub(jugador._equipoNombre || '') && esNuestroClub(equipo.nombre || '')) return true;

  const nombreJugador = normalizarClaveFiltro(jugador._equipoNombre || '');
  const nombreEquipo = normalizarClaveFiltro(equipo.nombre || '');
  if (!nombreJugador || !nombreEquipo) return false;
  return nombreJugador.includes(nombreEquipo) || nombreEquipo.includes(nombreJugador);
};

const resolverEquipoSeleccionado = ({ equipos = [], key = '', nombre = '', logoUrl = '', evitarKey = '' }) => {
  if (!Array.isArray(equipos) || equipos.length === 0) return null;

  const keyNormalizada = normalizarTexto(key);
  if (keyNormalizada) {
    const porKey = equipos.find((equipo) => equipo.key === keyNormalizada);
    if (porKey) return porKey;
  }

  const keyConstruida = construirEquipoKey(nombre, logoUrl);
  if (normalizarTexto(nombre)) {
    const porKeyConstruida = equipos.find((equipo) => equipo.key === keyConstruida);
    if (porKeyConstruida) return porKeyConstruida;

    const canonNombre = canonizarNombreEquipo(nombre);
    const porCanon = equipos.find((equipo) => (equipo._canon || canonizarNombreEquipo(equipo.nombre || '')) === canonNombre);
    if (porCanon) return porCanon;

    const nombreNormalizado = normalizarClaveFiltro(nombre);
    const porNombre = equipos.find((equipo) => {
      const candidato = normalizarClaveFiltro(equipo.nombre || '');
      return candidato && nombreNormalizado && (candidato.includes(nombreNormalizado) || nombreNormalizado.includes(candidato));
    });
    if (porNombre) return porNombre;
  }

  const alternativa = equipos.find((equipo) => !evitarKey || equipo.key !== evitarKey);
  return alternativa || equipos[0] || null;
};

const crearResumenEquipo = (jugadores = []) => {
  const base = {
    jugadores: jugadores.length,
    pts: 0,
    reb: 0,
    ast: 0,
    stl: 0,
    blk: 0,
    flt: 0,
    to: 0,
    effTotal: 0,
    ftm: 0,
    fta: 0,
    fg2m: 0,
    fg2a: 0,
    fg3m: 0,
    fg3a: 0,
  };

  return jugadores.reduce((acc, j) => {
    const eff = calcularEff({
      pts: numero(j.pts),
      reb: numero(j.reb),
      ast: numero(j.ast),
      stl: numero(j.stl),
      blk: numero(j.blk),
      to: numero(j.to),
    });
    return {
      ...acc,
      pts: acc.pts + numero(j.pts),
      reb: acc.reb + numero(j.reb),
      ast: acc.ast + numero(j.ast),
      stl: acc.stl + numero(j.stl),
      blk: acc.blk + numero(j.blk),
      flt: acc.flt + numero(j.flt),
      to: acc.to + numero(j.to),
      effTotal: acc.effTotal + eff,
      ftm: acc.ftm + numero(j.ftm),
      fta: acc.fta + numero(j.fta),
      fg2m: acc.fg2m + numero(j.fg2m),
      fg2a: acc.fg2a + numero(j.fg2a),
      fg3m: acc.fg3m + numero(j.fg3m),
      fg3a: acc.fg3a + numero(j.fg3a),
    };
  }, base);
};

function MesaControlPanel({
  jugadorSeleccionadoLive,
  setJugadorSeleccionadoLive,
  rosterEquipo,
  setRosterEquipo,
  liveScore,
  setLiveScore,
  playByPlay,
  setPlayByPlay,
  notaScouting,
  setNotaScouting,
  modoChromaKey,
  setModoChromaKey,
  partidos = [],
}) {
  const [modoAnalisis, setModoAnalisis] = useState('dos');
  const [moduloMesa, setModuloMesa] = useState('prepartido');
  const [historialFiltroTexto, setHistorialFiltroTexto] = useState('');
  const [historialFiltroRama, setHistorialFiltroRama] = useState('Todas');
  const [historialFiltroCategoria, setHistorialFiltroCategoria] = useState('Todas');
  const [tipoFichaTecnicaExport, setTipoFichaTecnicaExport] = useState('planilla_resumen_oficial');
  const [sesionRecuperada, setSesionRecuperada] = useState(false);
  const [filtroRama, setFiltroRama] = useState('Todas');
  const [filtroCategoria, setFiltroCategoria] = useState('Todas');
  const [competenciaNombre, setCompetenciaNombre] = useState('');
  const [competenciaLogoUrl, setCompetenciaLogoUrl] = useState('');
  const [canchaSede, setCanchaSede] = useState('');
  const [incluirCategoriasMenores, setIncluirCategoriasMenores] = useState(false);
  const [nivelesCategoriasInferiores, setNivelesCategoriasInferiores] = useState(2);
  const [equipoLocalKey, setEquipoLocalKey] = useState('LOCAL_DEFAULT');
  const [equipoVisitaKey, setEquipoVisitaKey] = useState('VISITA_DEFAULT');
  const [clubLocalNombre, setClubLocalNombre] = useState('Centro de Cultura Física');
  const [clubLocalLogoUrl, setClubLocalLogoUrl] = useState('/logos/club-logo.png');
  const [clubVisitaNombre, setClubVisitaNombre] = useState('Visitante');
  const [clubVisitaLogoUrl, setClubVisitaLogoUrl] = useState('');
  const [partidoIniciado, setPartidoIniciado] = useState(false);
  const [partidoPersistidoId, setPartidoPersistidoId] = useState(null);
  const [ultimoGuardadoAt, setUltimoGuardadoAt] = useState('');
  const [historialPartidosMesa, setHistorialPartidosMesa] = useState([]);
  const [historialRemotoMesa, setHistorialRemotoMesa] = useState([]);
  const [partidoAnalisisId, setPartidoAnalisisId] = useState(null);
  const [eventosPartido, setEventosPartido] = useState([]);
  const [rolOperadorActivo, setRolOperadorActivo] = useState('planillero');
  const [operadoresMesa, setOperadoresMesa] = useState({
    planillero: '',
    estadistico: '',
    supervisor: '',
  });
  const [quintetoLocalIds, setQuintetoLocalIds] = useState([]);
  const [quintetoVisitaIds, setQuintetoVisitaIds] = useState([]);
  const [nuevoNombreVisita, setNuevoNombreVisita] = useState('');
  const [nuevoDorsalVisita, setNuevoDorsalVisita] = useState('');
  const [capitanLocalId, setCapitanLocalId] = useState('');
  const [capitanVisitaId, setCapitanVisitaId] = useState('');
  const [colorLocal, setColorLocal] = useState('#0a84ff');
  const [colorVisita, setColorVisita] = useState('#ff3b30');
  const [colorLocalDraft, setColorLocalDraft] = useState('#0a84ff');
  const [colorVisitaDraft, setColorVisitaDraft] = useState('#ff3b30');
  const [selectorColorAbierto, setSelectorColorAbierto] = useState({ local: false, visita: false });
  const [staffLocal, setStaffLocal] = useState({ entrenador: '', asistente: '', delegado: '' });
  const [staffVisita, setStaffVisita] = useState({ entrenador: '', asistente: '', delegado: '' });
  const [cambioSalidaId, setCambioSalidaId] = useState('');
  const [cambioIngresoId, setCambioIngresoId] = useState('');
  const [nominaLocalIds, setNominaLocalIds] = useState([]);
  const [nominaVisitaIds, setNominaVisitaIds] = useState([]);
  const [quintetoLocalValidado, setQuintetoLocalValidado] = useState(false);
  const [quintetoVisitaValidado, setQuintetoVisitaValidado] = useState(false);
  const [busquedaInclusionLocal, setBusquedaInclusionLocal] = useState('');
  const [busquedaNominaLocal, setBusquedaNominaLocal] = useState('');
  const [busquedaNominaVisita, setBusquedaNominaVisita] = useState('');
  const [selectorNominaLocalId, setSelectorNominaLocalId] = useState('');
  const [selectorNominaVisitaId, setSelectorNominaVisitaId] = useState('');
  const [forzarPantallaCompletaLive, setForzarPantallaCompletaLive] = useState(true);
  const [cronometroActivo, setCronometroActivo] = useState(false);
  const [cambioObligatorioJugadorId, setCambioObligatorioJugadorId] = useState(null);
  const [cambioObligatorioEquipo, setCambioObligatorioEquipo] = useState('local');
  const [cambioObligatorioIngresoId, setCambioObligatorioIngresoId] = useState('');
  const [mostrarModalCambioObligatorio, setMostrarModalCambioObligatorio] = useState(false);
  const [mostrarSelectorTipoFalta, setMostrarSelectorTipoFalta] = useState(false);
  const [cambioSalidaVisitaId, setCambioSalidaVisitaId] = useState('');
  const [cambioIngresoVisitaId, setCambioIngresoVisitaId] = useState('');
  const [jugadorVisitaSeleccionadoId, setJugadorVisitaSeleccionadoId] = useState('');
  const [equipoAccionActivo, setEquipoAccionActivo] = useState('local');
  const [mostrarOpcionesTL, setMostrarOpcionesTL] = useState(false);
  const [mostrarOpcionesTLVisita, setMostrarOpcionesTLVisita] = useState(false);
  const [jugadorAnalisisId, setJugadorAnalisisId] = useState('');
  const liveFullScreenRef = useRef(null);

  const equiposDesdePartidos = useMemo(() => {
    const map = new Map();
    const upsert = ({ nombre, logoUrl, rama, categoria, competicion }) => {
      const nombreLimpio = normalizarTexto(nombre);
      if (!nombreLimpio) return;
      const key = construirEquipoKey(nombreLimpio, logoUrl);
      const existente = map.get(key);
      const ramas = new Set(existente?.ramas || []);
      const categorias = new Set(existente?.categorias || []);
      const competiciones = new Set(existente?.competiciones || []);

      if (normalizarTexto(rama)) ramas.add(normalizarTexto(rama));
      if (normalizarTexto(categoria)) categorias.add(normalizarTexto(categoria));
      if (normalizarTexto(competicion)) competiciones.add(normalizarTexto(competicion));

      map.set(key, {
        key,
        nombre: nombreLimpio,
        logoUrl: normalizarTexto(logoUrl) || (existente?.logoUrl || ''),
        ramas: Array.from(ramas),
        categorias: Array.from(categorias),
        competiciones: Array.from(competiciones),
      });
    };

    (Array.isArray(partidos) ? partidos : []).forEach((p) => {
      const rama = normalizarTexto(p.rama || 'General');
      const categoria = normalizarTexto(p.categoria || p.categoriaRama || 'General');
      const competicion = normalizarTexto(p.torneo || p.competicion || p.competencia || 'Sin competencia');

      upsert({
        nombre: p.equipoLocalNombre || 'Centro de Cultura Física',
        logoUrl: p.equipoLocalLogoUrl || '/logos/club-logo.png',
        rama,
        categoria,
        competicion,
      });
      upsert({
        nombre: p.nombreRival || p.equipoVisitanteNombre || p.equipoVisitaNombre || 'Visitante',
        logoUrl: p.rivalLogoUrl || p.equipoVisitaLogoUrl || p.equipoVisitanteLogoUrl || '',
        rama,
        categoria,
        competicion,
      });
    });

    return Array.from(map.values());
  }, [partidos]);

  const rosterNormalizado = useMemo(
    () => (Array.isArray(rosterEquipo) ? rosterEquipo : []).map((j, idx) => {
      const equipoNombre = normalizarTexto(
        j.equipo_nombre || j.equipo || j.club_nombre || j.club || j.team_name || liveScore.equipoLocalNombre || 'Centro de Cultura Física'
      );
      const equipoLogoUrl = normalizarTexto(
        j.equipo_logo_url || j.logo_equipo_url || j.club_logo_url || j.logo_url || ''
      );
      const competicion = normalizarTexto(j.competicion || j.competencia || j.torneo || 'Sin competencia');
      const ramaInferida = inferirRamaDesdeTexto(j.rama || j.categoria || equipoNombre);
      const categoriaInferida = inferirCategoriaDesdeTexto(j.categoria || equipoNombre);

      return {
        ...j,
        id: j.id != null ? j.id : idx + 1,
        pts: numero(j.pts),
        reb: numero(j.reb),
        ast: numero(j.ast),
        stl: numero(j.stl),
        blk: numero(j.blk),
        flt: numero(j.flt),
        to: numero(j.to),
        _rama: normalizarTexto(j.rama || ramaInferida || 'General'),
        _categoria: normalizarTexto(j.categoria || categoriaInferida || 'General'),
        _competicion: competicion,
        _equipoKey: construirEquipoKey(equipoNombre, equipoLogoUrl),
        _equipoCanon: canonizarNombreEquipo(equipoNombre),
        _equipoNombre: equipoNombre,
        _equipoLogoUrl: equipoLogoUrl,
        _bloqueado: Boolean(j.sancionado || j.bloqueado || j.expulsado || j._expulsado),
      };
    }),
    [rosterEquipo, liveScore.equipoLocalNombre]
  );

  const opcionesCompeticionPartidos = useMemo(
    () => (Array.isArray(partidos) ? partidos : [])
      .map((p) => normalizarTexto(p.torneo || p.competicion || p.competencia || ''))
      .filter(Boolean),
    [partidos]
  );

  const opcionesRama = useMemo(() => {
    const valores = [
      ...rosterNormalizado.map((j) => j._rama).filter(Boolean),
      ...equiposDesdePartidos.flatMap((e) => e.ramas || []),
    ];
    return construirOpcionesFiltro(valores);
  }, [rosterNormalizado, equiposDesdePartidos]);

  const opcionesCategoria = useMemo(() => {
    const valores = [
      ...rosterNormalizado.map((j) => j._categoria).filter(Boolean),
      ...equiposDesdePartidos.flatMap((e) => e.categorias || []),
    ];
    return construirOpcionesFiltro(valores);
  }, [rosterNormalizado, equiposDesdePartidos]);

  const opcionesCompeticion = useMemo(() => {
    const valores = [
      ...rosterNormalizado.map((j) => j._competicion).filter(Boolean),
      ...opcionesCompeticionPartidos,
      ...equiposDesdePartidos.flatMap((e) => e.competiciones || []),
    ];
    return construirOpcionesFiltro(valores);
  }, [rosterNormalizado, opcionesCompeticionPartidos, equiposDesdePartidos]);

  const filtroCompeticionActiva = normalizarTexto(competenciaNombre);

  const opcionesLogosMesa = useMemo(() => {
    const map = new Map();
    const incluir = (nombre = '', logoUrl = '') => {
      const nombreLimpio = normalizarTexto(nombre);
      if (!nombreLimpio) return;
      const key = normalizarSlugLogo(nombreLimpio);
      const actual = map.get(key);
      if (!actual || (!actual.logoUrl && normalizarTexto(logoUrl))) {
        map.set(key, {
          nombre: nombreLimpio,
          logoUrl: normalizarTexto(logoUrl),
        });
      }
    };

    (Array.isArray(partidos) ? partidos : []).forEach((p) => {
      incluir(p.equipoLocalNombre, p.equipoLocalLogoUrl);
      incluir(p.nombreRival || p.equipoVisitanteNombre || p.equipoVisitaNombre, p.rivalLogoUrl || p.equipoVisitaLogoUrl || p.equipoVisitanteLogoUrl);
      incluir(p.torneo || p.competicion || p.competencia, p.torneoLogoUrl || p.logoCompeticionUrl || '');
    });

    return Array.from(map.values());
  }, [partidos]);

  const canchasDisponibles = useMemo(() => {
    const set = new Set();
    (Array.isArray(partidos) ? partidos : []).forEach((p) => {
      const cancha = normalizarTexto(p.ubicacion || p.cancha_sede || p.cancha || p.sede || '');
      if (cancha) set.add(cancha);
    });
    return Array.from(set);
  }, [partidos]);

  const equiposDesdeClubPicker = useMemo(() => {
    const equipos = [];
    if (normalizarTexto(clubLocalNombre)) {
      equipos.push({
        key: construirEquipoKey(clubLocalNombre, clubLocalLogoUrl),
        nombre: normalizarTexto(clubLocalNombre),
        logoUrl: normalizarTexto(clubLocalLogoUrl),
        ramas: [],
        categorias: [],
        competiciones: [],
      });
    }
    if (normalizarTexto(clubVisitaNombre)) {
      equipos.push({
        key: construirEquipoKey(clubVisitaNombre, clubVisitaLogoUrl),
        nombre: normalizarTexto(clubVisitaNombre),
        logoUrl: normalizarTexto(clubVisitaLogoUrl),
        ramas: [],
        categorias: [],
        competiciones: [],
      });
    }
    return equipos;
  }, [clubLocalNombre, clubLocalLogoUrl, clubVisitaNombre, clubVisitaLogoUrl]);

  const equiposDisponibles = useMemo(() => {
    const map = new Map();
    const upsert = ({ key, nombre, logoUrl, ramas = [], categorias = [], competiciones = [] }) => {
      const nombreLimpio = normalizarTexto(nombre);
      if (!nombreLimpio) return;
      const finalKey = key || construirEquipoKey(nombreLimpio, logoUrl);
      const existente = map.get(finalKey);

      const ramasSet = new Set(existente?.ramas || []);
      const categoriasSet = new Set(existente?.categorias || []);
      const competicionesSet = new Set(existente?.competiciones || []);
      ramas.forEach((r) => normalizarTexto(r) && ramasSet.add(normalizarTexto(r)));
      categorias.forEach((c) => normalizarTexto(c) && categoriasSet.add(normalizarTexto(c)));
      competiciones.forEach((c) => normalizarTexto(c) && competicionesSet.add(normalizarTexto(c)));

      map.set(finalKey, {
        key: finalKey,
        nombre: nombreLimpio,
        _canon: canonizarNombreEquipo(nombreLimpio),
        logoUrl: normalizarTexto(logoUrl) || (existente?.logoUrl || ''),
        ramas: Array.from(ramasSet),
        categorias: Array.from(categoriasSet),
        competiciones: Array.from(competicionesSet),
      });
    };

    equiposDesdeClubPicker.forEach((e) => upsert(e));
    equiposDesdePartidos.forEach((e) => upsert(e));

    rosterNormalizado.forEach((j) => {
      upsert({
        key: j._equipoKey,
        nombre: j._equipoNombre,
        logoUrl: j._equipoLogoUrl,
        ramas: [j._rama],
        categorias: [j._categoria],
        competiciones: [j._competicion],
      });
    });

    if (map.size === 0) {
      const localDefault = {
        key: 'LOCAL_DEFAULT',
        nombre: liveScore.equipoLocalNombre || 'Centro de Cultura Física',
        logoUrl: liveScore.equipoLocalLogoUrl || '/logos/club-logo.png',
        ramas: [],
        categorias: [],
        competiciones: [],
      };
      const visitaDefault = {
        key: 'VISITA_DEFAULT',
        nombre: liveScore.equipoVisitaNombre || 'Visitante',
        logoUrl: liveScore.equipoVisitaLogoUrl || '',
        ramas: [],
        categorias: [],
        competiciones: [],
      };
      map.set(localDefault.key, localDefault);
      map.set(visitaDefault.key, visitaDefault);
    }

    return Array.from(map.values());
  }, [equiposDesdePartidos, equiposDesdeClubPicker, rosterNormalizado, liveScore.equipoLocalNombre, liveScore.equipoLocalLogoUrl, liveScore.equipoVisitaNombre, liveScore.equipoVisitaLogoUrl]);

  useEffect(() => {
    const localKey = construirEquipoKey(clubLocalNombre, clubLocalLogoUrl);
    if (normalizarTexto(clubLocalNombre) && localKey !== equipoLocalKey) {
      setEquipoLocalKey(localKey);
    }
  }, [clubLocalNombre, clubLocalLogoUrl, equipoLocalKey]);

  useEffect(() => {
    if (modoAnalisis !== 'dos') return;
    const visitaKey = construirEquipoKey(clubVisitaNombre, clubVisitaLogoUrl);
    if (normalizarTexto(clubVisitaNombre) && visitaKey !== equipoVisitaKey) {
      setEquipoVisitaKey(visitaKey);
    }
  }, [clubVisitaNombre, clubVisitaLogoUrl, equipoVisitaKey, modoAnalisis]);

  const equipoLocal = resolverEquipoSeleccionado({
    equipos: equiposDisponibles,
    key: equipoLocalKey,
    nombre: clubLocalNombre,
    logoUrl: clubLocalLogoUrl,
  });
  const equipoVisita = resolverEquipoSeleccionado({
    equipos: equiposDisponibles,
    key: equipoVisitaKey,
    nombre: clubVisitaNombre,
    logoUrl: clubVisitaLogoUrl,
    evitarKey: equipoLocal?.key || '',
  });
  const visitaEsNuestroClub = useMemo(() => esNuestroClub(clubVisitaNombre), [clubVisitaNombre]);

  useEffect(() => {
    if (!equipoLocal?.key || equipoLocal.key === equipoLocalKey) return;
    setEquipoLocalKey(equipoLocal.key);
  }, [equipoLocal, equipoLocalKey]);

  useEffect(() => {
    if (modoAnalisis !== 'dos') return;
    if (!equipoVisita?.key || equipoVisita.key === equipoVisitaKey) return;
    setEquipoVisitaKey(equipoVisita.key);
  }, [equipoVisita, equipoVisitaKey, modoAnalisis]);

  useEffect(() => {
    try {
      const guardados = JSON.parse(window.localStorage.getItem('mesa_partidos_guardados') || '[]');
      setHistorialPartidosMesa(Array.isArray(guardados) ? guardados : []);
    } catch {
      setHistorialPartidosMesa([]);
    }
  }, []);

  useEffect(() => {
    try {
      const guardada = JSON.parse(window.localStorage.getItem(MESA_SESSION_KEY) || 'null');
      if (!guardada || typeof guardada !== 'object') return;

      if (guardada.modoAnalisis) setModoAnalisis(guardada.modoAnalisis);
      if (guardada.moduloMesa) setModuloMesa(guardada.moduloMesa);
      if (guardada.filtroRama) setFiltroRama(guardada.filtroRama);
      if (guardada.filtroCategoria) setFiltroCategoria(guardada.filtroCategoria);
      if (typeof guardada.historialFiltroTexto === 'string') setHistorialFiltroTexto(guardada.historialFiltroTexto);
      if (guardada.historialFiltroRama) setHistorialFiltroRama(guardada.historialFiltroRama);
      if (guardada.historialFiltroCategoria) setHistorialFiltroCategoria(guardada.historialFiltroCategoria);
      setCompetenciaNombre(guardada.competenciaNombre || '');
      setCompetenciaLogoUrl(guardada.competenciaLogoUrl || '');
      setCanchaSede(guardada.canchaSede || '');
      setIncluirCategoriasMenores(Boolean(guardada.incluirCategoriasMenores));
      setNivelesCategoriasInferiores(Number(guardada.nivelesCategoriasInferiores || 2));
      setEquipoLocalKey(guardada.equipoLocalKey || 'LOCAL_DEFAULT');
      setEquipoVisitaKey(guardada.equipoVisitaKey || 'VISITA_DEFAULT');
      setClubLocalNombre(guardada.clubLocalNombre || 'Centro de Cultura Física');
      setClubLocalLogoUrl(guardada.clubLocalLogoUrl || '/logos/club-logo.png');
      setClubVisitaNombre(guardada.clubVisitaNombre || 'Visitante');
      setClubVisitaLogoUrl(guardada.clubVisitaLogoUrl || '');
      setPartidoIniciado(Boolean(guardada.partidoIniciado));
      setPartidoPersistidoId(guardada.partidoPersistidoId || null);
      setUltimoGuardadoAt(guardada.ultimoGuardadoAt || '');
      setPartidoAnalisisId(guardada.partidoAnalisisId || null);
      setEventosPartido(Array.isArray(guardada.eventosPartido) ? guardada.eventosPartido : []);
      setRolOperadorActivo(guardada.rolOperadorActivo || 'planillero');
      setOperadoresMesa(guardada.operadoresMesa || { planillero: '', estadistico: '', supervisor: '' });
      setQuintetoLocalIds(Array.isArray(guardada.quintetoLocalIds) ? guardada.quintetoLocalIds : []);
      setQuintetoVisitaIds(Array.isArray(guardada.quintetoVisitaIds) ? guardada.quintetoVisitaIds : []);
      setNominaLocalIds(Array.isArray(guardada.nominaLocalIds) ? guardada.nominaLocalIds : []);
      setNominaVisitaIds(Array.isArray(guardada.nominaVisitaIds) ? guardada.nominaVisitaIds : []);
      setQuintetoLocalValidado(Boolean(guardada.quintetoLocalValidado));
      setQuintetoVisitaValidado(Boolean(guardada.quintetoVisitaValidado));
      setCapitanLocalId(guardada.capitanLocalId || '');
      setCapitanVisitaId(guardada.capitanVisitaId || '');
      setColorLocal(guardada.colorLocal || '#0a84ff');
      setColorVisita(guardada.colorVisita || '#ff3b30');
      setColorLocalDraft(guardada.colorLocalDraft || guardada.colorLocal || '#0a84ff');
      setColorVisitaDraft(guardada.colorVisitaDraft || guardada.colorVisita || '#ff3b30');
      setStaffLocal(guardada.staffLocal || { entrenador: '', asistente: '', delegado: '' });
      setStaffVisita(guardada.staffVisita || { entrenador: '', asistente: '', delegado: '' });
      setForzarPantallaCompletaLive(guardada.forzarPantallaCompletaLive !== false);
      setCronometroActivo(Boolean(guardada.cronometroActivo));
      setCambioObligatorioJugadorId(guardada.cambioObligatorioJugadorId || null);

      if (Array.isArray(guardada.rosterEquipo)) setRosterEquipo(guardada.rosterEquipo);
      if (guardada.liveScore && typeof guardada.liveScore === 'object') {
        setLiveScore((prev) => ({ ...prev, ...guardada.liveScore }));
      }
      if (Array.isArray(guardada.playByPlay)) setPlayByPlay(guardada.playByPlay);
      if (typeof guardada.notaScouting === 'string') setNotaScouting(guardada.notaScouting);
      if (guardada.jugadorSeleccionadoLive != null) setJugadorSeleccionadoLive(guardada.jugadorSeleccionadoLive);

      setSesionRecuperada(true);
    } catch {
      // no-op: if persistence is corrupted we start from clean defaults
    }
  }, [setJugadorSeleccionadoLive, setLiveScore, setNotaScouting, setPlayByPlay, setRosterEquipo]);

  useEffect(() => {
    const payload = {
      modoAnalisis,
      moduloMesa,
      filtroRama,
      filtroCategoria,
      historialFiltroTexto,
      historialFiltroRama,
      historialFiltroCategoria,
      competenciaNombre,
      competenciaLogoUrl,
      canchaSede,
      incluirCategoriasMenores,
      nivelesCategoriasInferiores,
      equipoLocalKey,
      equipoVisitaKey,
      clubLocalNombre,
      clubLocalLogoUrl,
      clubVisitaNombre,
      clubVisitaLogoUrl,
      partidoIniciado,
      partidoPersistidoId,
      ultimoGuardadoAt,
      partidoAnalisisId,
      eventosPartido,
      rolOperadorActivo,
      operadoresMesa,
      quintetoLocalIds,
      quintetoVisitaIds,
      nominaLocalIds,
      nominaVisitaIds,
      quintetoLocalValidado,
      quintetoVisitaValidado,
      capitanLocalId,
      capitanVisitaId,
      colorLocal,
      colorVisita,
      colorLocalDraft,
      colorVisitaDraft,
      staffLocal,
      staffVisita,
      forzarPantallaCompletaLive,
      cronometroActivo,
      cambioObligatorioJugadorId,
      rosterEquipo,
      liveScore,
      playByPlay,
      notaScouting,
      jugadorSeleccionadoLive,
    };
    try {
      window.localStorage.setItem(MESA_SESSION_KEY, JSON.stringify(payload));
    } catch {
      // ignore storage quota failures
    }
  }, [
    modoAnalisis,
    moduloMesa,
    filtroRama,
    filtroCategoria,
    historialFiltroTexto,
    historialFiltroRama,
    historialFiltroCategoria,
    competenciaNombre,
    competenciaLogoUrl,
    canchaSede,
    incluirCategoriasMenores,
    nivelesCategoriasInferiores,
    equipoLocalKey,
    equipoVisitaKey,
    clubLocalNombre,
    clubLocalLogoUrl,
    clubVisitaNombre,
    clubVisitaLogoUrl,
    partidoIniciado,
    partidoPersistidoId,
    ultimoGuardadoAt,
    partidoAnalisisId,
    eventosPartido,
    rolOperadorActivo,
    operadoresMesa,
    quintetoLocalIds,
    quintetoVisitaIds,
    nominaLocalIds,
    nominaVisitaIds,
    quintetoLocalValidado,
    quintetoVisitaValidado,
    capitanLocalId,
    capitanVisitaId,
    colorLocal,
    colorVisita,
    colorLocalDraft,
    colorVisitaDraft,
    staffLocal,
    staffVisita,
    forzarPantallaCompletaLive,
    cronometroActivo,
    cambioObligatorioJugadorId,
    rosterEquipo,
    liveScore,
    playByPlay,
    notaScouting,
    jugadorSeleccionadoLive,
  ]);

  useEffect(() => {
    if (!equipoLocal) return;
    setClubLocalNombre(equipoLocal.nombre || 'Centro de Cultura Física');
    setClubLocalLogoUrl(equipoLocal.logoUrl || '/logos/club-logo.png');
    if (modoAnalisis === 'dos' && equipoVisita) {
      setClubVisitaNombre(equipoVisita.nombre || 'Visitante');
      setClubVisitaLogoUrl(equipoVisita.logoUrl || '');
    }
    setLiveScore((prev) => ({
      ...prev,
      equipoLocalNombre: equipoLocal.nombre || prev.equipoLocalNombre,
      equipoLocalLogoUrl: equipoLocal.logoUrl || prev.equipoLocalLogoUrl,
      equipoVisitaNombre: modoAnalisis === 'dos' ? (equipoVisita?.nombre || prev.equipoVisitaNombre) : 'N/A',
      equipoVisitaLogoUrl: modoAnalisis === 'dos' ? (equipoVisita?.logoUrl || prev.equipoVisitaLogoUrl) : '',
      competenciaNombre: filtroCompeticionActiva || prev.competenciaNombre || '',
      competenciaLogoUrl: normalizarTexto(competenciaLogoUrl) || prev.competenciaLogoUrl || '',
      canchaSede: normalizarTexto(canchaSede) || prev.canchaSede || '',
    }));
  }, [
    equipoLocal,
    equipoVisita,
    modoAnalisis,
    setLiveScore,
    filtroCompeticionActiva,
    competenciaLogoUrl,
    canchaSede,
  ]);

  const rosterFiltrado = useMemo(() => rosterNormalizado.filter((j) => {
    const okRama = filtroRama === 'Todas' || coincideFiltro(j._rama, filtroRama);
    const okCategoria = filtroCategoria === 'Todas'
      || coincideCategoriaFiltro(j._categoria, filtroCategoria)
      || (incluirCategoriasMenores && esCategoriaInferiorDentroDeRango(j._categoria, filtroCategoria, nivelesCategoriasInferiores));
    const okCompeticion = !filtroCompeticionActiva || coincideFiltro(j._competicion, filtroCompeticionActiva);
    return okRama && okCategoria && okCompeticion;
  }), [
    rosterNormalizado,
    filtroRama,
    filtroCategoria,
    incluirCategoriasMenores,
    nivelesCategoriasInferiores,
    filtroCompeticionActiva,
  ]);

  const rosterLocalCompleto = useMemo(
    () => rosterFiltrado.filter((j) => sonEquiposCompatibles(j, equipoLocal)),
    [rosterFiltrado, equipoLocal]
  );

  const rosterLocal = useMemo(
    () => rosterLocalCompleto.filter((j) => nominaLocalIds.includes(j.id)).slice(0, LIMITE_JUGADORES_POR_EQUIPO),
    [rosterLocalCompleto, nominaLocalIds]
  );

  const rosterVisitaCompleto = useMemo(
    () => rosterFiltrado.filter((j) => sonEquiposCompatibles(j, equipoVisita)),
    [rosterFiltrado, equipoVisita]
  );

  const rosterVisita = useMemo(
    () => rosterVisitaCompleto.filter((j) => nominaVisitaIds.includes(j.id)).slice(0, LIMITE_JUGADORES_POR_EQUIPO),
    [rosterVisitaCompleto, nominaVisitaIds]
  );

  const disponiblesNominaLocal = useMemo(
    () => rosterLocalCompleto.filter((j) => !nominaLocalIds.includes(j.id)),
    [rosterLocalCompleto, nominaLocalIds]
  );

  const disponiblesNominaVisita = useMemo(
    () => rosterVisitaCompleto.filter((j) => !nominaVisitaIds.includes(j.id)),
    [rosterVisitaCompleto, nominaVisitaIds]
  );

  const rosterLocalVisible = useMemo(() => {
    const q = normalizarTexto(busquedaNominaLocal).toLowerCase();
    if (!q) return rosterLocal;
    return rosterLocal.filter((j) => normalizarTexto(j.nombre).toLowerCase().includes(q) || String(j.dorsal || '').includes(q));
  }, [rosterLocal, busquedaNominaLocal]);

  const rosterVisitaVisible = useMemo(() => {
    const q = normalizarTexto(busquedaNominaVisita).toLowerCase();
    if (!q) return rosterVisita;
    return rosterVisita.filter((j) => normalizarTexto(j.nombre).toLowerCase().includes(q) || String(j.dorsal || '').includes(q));
  }, [rosterVisita, busquedaNominaVisita]);

  const candidatasInferioresLocal = useMemo(() => {
    if (!incluirCategoriasMenores || filtroCategoria === 'Todas') return [];
    const q = normalizarTexto(busquedaInclusionLocal).toLowerCase();
    return rosterNormalizado
      .filter((j) => sonEquiposCompatibles(j, equipoLocal))
      .filter((j) => {
        const okRama = filtroRama === 'Todas' || coincideFiltro(j._rama, filtroRama);
        const okComp = !filtroCompeticionActiva || coincideFiltro(j._competicion, filtroCompeticionActiva);
        const okCat = esCategoriaInferiorDentroDeRango(j._categoria, filtroCategoria, nivelesCategoriasInferiores)
          && !coincideCategoriaFiltro(j._categoria, filtroCategoria);
        const okBusqueda = !q || normalizarTexto(j.nombre).toLowerCase().includes(q) || String(j.dorsal || '').includes(q);
        return okRama && okComp && okCat && okBusqueda;
      })
      .filter((j) => !nominaLocalIds.includes(j.id))
      .slice(0, 24);
  }, [
    incluirCategoriasMenores,
    filtroCategoria,
    busquedaInclusionLocal,
    rosterNormalizado,
    equipoLocal,
    filtroRama,
    filtroCompeticionActiva,
    nivelesCategoriasInferiores,
    nominaLocalIds,
  ]);

  const detectarDorsalesDuplicados = (roster = []) => {
    const cuenta = new Map();
    roster.forEach((j) => {
      const dorsal = String(j.dorsal || '').trim();
      if (!dorsal) return;
      cuenta.set(dorsal, (cuenta.get(dorsal) || 0) + 1);
    });
    return Array.from(cuenta.entries())
      .filter(([, total]) => total > 1)
      .map(([dorsal]) => dorsal);
  };

  const dorsalesDuplicadosLocal = useMemo(
    () => detectarDorsalesDuplicados(rosterLocal),
    [rosterLocal]
  );

  const dorsalesDuplicadosVisita = useMemo(
    () => detectarDorsalesDuplicados(rosterVisita),
    [rosterVisita]
  );

  const restaurarFiltrosMesa = () => {
    setFiltroRama('Todas');
    setFiltroCategoria('Todas');
    setCompetenciaNombre('');
    setCompetenciaLogoUrl('');
    setCanchaSede('');
    setIncluirCategoriasMenores(false);
    setNivelesCategoriasInferiores(2);
    setBusquedaInclusionLocal('');
  };

  useEffect(() => {
    const disponibles = rosterLocalCompleto.map((j) => j.id);
    setNominaLocalIds((prev) => {
      const vigente = prev.filter((id) => disponibles.includes(id));
      const siguiente = vigente.length > 0
        ? vigente.slice(0, LIMITE_JUGADORES_POR_EQUIPO)
        : disponibles.slice(0, LIMITE_JUGADORES_POR_EQUIPO);
      return listasIguales(prev, siguiente) ? prev : siguiente;
    });
  }, [rosterLocalCompleto]);

  useEffect(() => {
    const disponibles = rosterVisitaCompleto.map((j) => j.id);
    setNominaVisitaIds((prev) => {
      const vigente = prev.filter((id) => disponibles.includes(id));
      const siguiente = vigente.length > 0
        ? vigente.slice(0, LIMITE_JUGADORES_POR_EQUIPO)
        : disponibles.slice(0, LIMITE_JUGADORES_POR_EQUIPO);
      return listasIguales(prev, siguiente) ? prev : siguiente;
    });
  }, [rosterVisitaCompleto]);

  useEffect(() => {
    if (partidoIniciado) return;
    const habilitados = rosterLocal.filter((j) => !j._bloqueado && j.flt < 5).map((j) => j.id);
    setQuintetoLocalIds((prev) => {
      const vigente = prev.filter((id) => habilitados.includes(id));
      const faltan = 5 - vigente.length;
      if (faltan <= 0) return vigente.slice(0, 5);
      const extras = habilitados.filter((id) => !vigente.includes(id)).slice(0, faltan);
      return [...vigente, ...extras].slice(0, 5);
    });
  }, [rosterLocal, partidoIniciado]);

  useEffect(() => {
    if (partidoIniciado) return;
    const habilitados = rosterVisita.filter((j) => !j._bloqueado && j.flt < 5).map((j) => j.id);
    setQuintetoVisitaIds((prev) => {
      const vigente = prev.filter((id) => habilitados.includes(id));
      const faltan = 5 - vigente.length;
      if (faltan <= 0) return vigente.slice(0, 5);
      const extras = habilitados.filter((id) => !vigente.includes(id)).slice(0, faltan);
      return [...vigente, ...extras].slice(0, 5);
    });
  }, [rosterVisita, partidoIniciado]);

  const alternarTitular = ({ tipo, jugadorId }) => {
    const esLocal = tipo === 'local';
    const rosterBase = esLocal ? rosterLocal : rosterVisita;
    const jugador = rosterBase.find((j) => j.id === jugadorId);
    if (!jugador || jugador._bloqueado || jugador.flt >= 5) return;

    const setter = esLocal ? setQuintetoLocalIds : setQuintetoVisitaIds;
    setter((prev) => {
      if (prev.includes(jugadorId)) return prev.filter((id) => id !== jugadorId);
      if (prev.length >= 5) return prev;
      return [...prev, jugadorId];
    });
  };

  const alternarNomina = ({ tipo, jugadorId }) => {
    const esLocal = tipo === 'local';
    const setter = esLocal ? setNominaLocalIds : setNominaVisitaIds;
    setter((prev) => {
      if (prev.includes(jugadorId)) return prev.filter((id) => id !== jugadorId);
      if (prev.length >= LIMITE_JUGADORES_POR_EQUIPO) return prev;
      return [...prev, jugadorId];
    });
  };

  const agregarNominaDesdeSelector = ({ tipo }) => {
    const esLocal = tipo === 'local';
    const seleccionadoId = esLocal ? selectorNominaLocalId : selectorNominaVisitaId;
    if (!seleccionadoId) return;
    alternarNomina({ tipo, jugadorId: Number(seleccionadoId) });
    if (esLocal) setSelectorNominaLocalId('');
    else setSelectorNominaVisitaId('');
  };

  const incluirDesdeCategoriasInferioresLocal = (jugadorId) => {
    if (nominaLocalIds.includes(jugadorId)) return;
    if (nominaLocalIds.length >= LIMITE_JUGADORES_POR_EQUIPO) {
      showToast({ message: `La nomina local ya tiene ${LIMITE_JUGADORES_POR_EQUIPO} jugadoras/es.`, type: 'error' });
      return;
    }
    setNominaLocalIds((prev) => [...prev, jugadorId]);
  };

  const validarQuinteto = ({ tipo }) => {
    if (tipo === 'local') {
      if (quintetoLocalIds.length !== 5) { showToast({ message: 'El quinteto local debe tener 5 jugadoras/es.', type: 'error' }); return; }
      setQuintetoLocalValidado(true);
      return;
    }
    if (modoAnalisis !== 'dos') return;
    if (quintetoVisitaIds.length !== 5) { showToast({ message: 'El quinteto visita debe tener 5 jugadoras/es.', type: 'error' }); return; }
    setQuintetoVisitaValidado(true);
  };

  useEffect(() => {
    if (!partidoIniciado) setQuintetoLocalValidado(false);
  }, [quintetoLocalIds, nominaLocalIds, partidoIniciado]);

  useEffect(() => {
    if (!partidoIniciado) setQuintetoVisitaValidado(false);
  }, [quintetoVisitaIds, nominaVisitaIds, partidoIniciado]);

  const salirPantallaCompletaManual = async () => {
    setForzarPantallaCompletaLive(false);
    setCronometroActivo(false);
    if (document.fullscreenElement) {
      await document.exitFullscreen();
    }
  };

  // No llama a requestFullscreen() directamente aca: el nodo puede migrar
  // dentro/fuera de un portal (ver LiveWrapPortal) cuando cambia este estado,
  // y usar la ref de inmediato despues de setState apunta al nodo viejo a
  // punto de desconectarse. El efecto de mas abajo (dependiente de
  // forzarPantallaCompletaLive) reintenta con la ref ya actualizada tras el
  // commit.
  const activarPantallaCompletaForzada = () => {
    setForzarPantallaCompletaLive(true);
  };

  useEffect(() => {
    const node = liveFullScreenRef.current;
    if (!node || !document?.fullscreenEnabled) return undefined;

    const intentarEntrar = () => {
      if (moduloMesa === 'live' && partidoIniciado && forzarPantallaCompletaLive && !document.fullscreenElement) {
        node.requestFullscreen().catch(() => {});
      }
    };

    const onFullscreenChange = () => {
      if (!document.fullscreenElement) {
        intentarEntrar();
      }
    };

    const onVisibility = () => {
      if (!document.hidden) {
        intentarEntrar();
      }
    };

    intentarEntrar();
    document.addEventListener('fullscreenchange', onFullscreenChange);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      document.removeEventListener('fullscreenchange', onFullscreenChange);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [moduloMesa, partidoIniciado, forzarPantallaCompletaLive]);

  useEffect(() => {
    if (!partidoIniciado || !cronometroActivo) return undefined;
    const timer = window.setInterval(() => {
      setLiveScore((prev) => {
        const total = relojASegundos(prev.reloj || '10:00');
        if (total <= 0) return prev;
        const siguiente = total - 1;
        return { ...prev, reloj: segundosAReloj(siguiente) };
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [partidoIniciado, cronometroActivo, setLiveScore]);

  useEffect(() => {
    if (relojASegundos(liveScore.reloj || '00:00') > 0) return;
    if (!cronometroActivo) return;
    setCronometroActivo(false);
    setPlayByPlay((prev) => [{ id: nextId(), tiempo: '00:00', texto: '⏱ Fin de periodo por reloj.' }, ...prev]);
  }, [liveScore.reloj, cronometroActivo, setPlayByPlay]);

  const cambiarModuloProtegido = (destino) => {
    if (forzarPantallaCompletaLive && moduloMesa === 'live' && destino !== 'live') {
      showToast({ message: 'Debes usar "Salir Pantalla Completa" para abandonar el modo forzado.', type: 'error' });
      return;
    }
    setModuloMesa(destino);
  };

  const validacionLocal = useMemo(() => {
    const total = rosterLocal.length;
    return {
      total,
      minimoOk: total >= 5,
      maximoOk: total <= LIMITE_JUGADORES_POR_EQUIPO,
      dorsalesOk: dorsalesDuplicadosLocal.length === 0,
      quintetoOk: quintetoLocalIds.length === 5 && quintetoLocalValidado,
    };
  }, [rosterLocal, dorsalesDuplicadosLocal, quintetoLocalIds, quintetoLocalValidado]);

  const validacionVisita = useMemo(() => {
    const total = rosterVisita.length;
    if (modoAnalisis !== 'dos') {
      return { total, minimoOk: true, maximoOk: true, dorsalesOk: true, quintetoOk: true };
    }
    return {
      total,
      minimoOk: total >= 5,
      maximoOk: total <= LIMITE_JUGADORES_POR_EQUIPO,
      dorsalesOk: dorsalesDuplicadosVisita.length === 0,
      quintetoOk: quintetoVisitaIds.length === 5 && quintetoVisitaValidado,
    };
  }, [modoAnalisis, rosterVisita, dorsalesDuplicadosVisita, quintetoVisitaIds, quintetoVisitaValidado]);

  const prepartidoValido = useMemo(
    () => validacionLocal.minimoOk
      && validacionLocal.maximoOk
      && validacionLocal.dorsalesOk
      && validacionLocal.quintetoOk
      && validacionVisita.minimoOk
      && validacionVisita.maximoOk
      && validacionVisita.dorsalesOk
      && validacionVisita.quintetoOk,
    [validacionLocal, validacionVisita]
  );

  useEffect(() => {
    if (!jugadorSeleccionadoLive) return;
    if (!rosterLocal.some((j) => j.id === jugadorSeleccionadoLive) || !quintetoLocalIds.includes(jugadorSeleccionadoLive)) {
      setJugadorSeleccionadoLive(null);
    }
  }, [jugadorSeleccionadoLive, quintetoLocalIds, rosterLocal, setJugadorSeleccionadoLive]);

  useEffect(() => {
    if (!jugadorVisitaSeleccionadoId) return;
    if (!rosterVisita.some((j) => String(j.id) === String(jugadorVisitaSeleccionadoId))) {
      setJugadorVisitaSeleccionadoId('');
    }
  }, [jugadorVisitaSeleccionadoId, rosterVisita]);

  useEffect(() => {
    if (modoAnalisis === 'dos') return;
    setEquipoAccionActivo('local');
    setMostrarOpcionesTLVisita(false);
  }, [modoAnalisis]);

  const quintetoLocalEnCancha = useMemo(() => {
    const mapa = new Map(rosterLocal.map((j) => [String(j.id), j]));
    return quintetoLocalIds
      .map((id) => mapa.get(String(id)))
      .filter(Boolean);
  }, [rosterLocal, quintetoLocalIds]);

  const bancoLocal = useMemo(
    () => rosterLocal.filter((j) => !quintetoLocalIds.includes(j.id)),
    [rosterLocal, quintetoLocalIds]
  );

  const quintetoVisitaEnCancha = useMemo(() => {
    const mapa = new Map(rosterVisita.map((j) => [String(j.id), j]));
    return quintetoVisitaIds
      .map((id) => mapa.get(String(id)))
      .filter(Boolean);
  }, [rosterVisita, quintetoVisitaIds]);

  const bancoVisita = useMemo(
    () => rosterVisita.filter((j) => !quintetoVisitaIds.includes(j.id)),
    [rosterVisita, quintetoVisitaIds]
  );

  const jugadorCambioObligatorio = useMemo(() => {
    const roster = cambioObligatorioEquipo === 'visita' ? rosterVisitaCompleto : rosterLocalCompleto;
    return roster.find((j) => String(j.id) === String(cambioObligatorioJugadorId)) || null;
  }, [rosterLocalCompleto, rosterVisitaCompleto, cambioObligatorioEquipo, cambioObligatorioJugadorId]);

  const bancoParaCambioObligatorio = useMemo(() => {
    const banco = cambioObligatorioEquipo === 'visita' ? bancoVisita : bancoLocal;
    return banco.filter((j) => !j._bloqueado && numero(j.flt) < 5 && !j.expulsado);
  }, [cambioObligatorioEquipo, bancoLocal, bancoVisita]);

  const registrarEventoJuego = ({ tipo, detalle, equipo = 'local', jugadorId = null, valor = 0 }) => {
    const operadorNombre = normalizarTexto(operadoresMesa[rolOperadorActivo]) || 'Operador sin nombre';
    const rosterBase = equipo === 'visita' ? rosterVisitaCompleto : rosterLocalCompleto;
    const jugador = rosterBase.find((j) => String(j.id) === String(jugadorId));
    const evento = {
      id: nextId(),
      tipo,
      detalle,
      equipo,
      jugadorId: jugador?.id || null,
      jugadorNombre: jugador ? `#${jugador.dorsal} ${jugador.nombre}` : '',
      valor,
      periodo: liveScore.periodo,
      reloj: liveScore.reloj,
      operadorRol: rolOperadorActivo,
      operadorNombre,
      createdAt: new Date().toISOString(),
      quintetoLocalSnapshot: [...quintetoLocalIds],
    };
    setEventosPartido((prev) => [evento, ...prev].slice(0, 400));
  };

  const ejecutarCambioJugador = (equipo, salidaIdManual, ingresoIdManual) => {
    if (!partidoIniciado) return;
    const esVisita = equipo === 'visita';
    const rosterCompleto = esVisita ? rosterVisitaCompleto : rosterLocalCompleto;
    const quintetoIds = esVisita ? quintetoVisitaIds : quintetoLocalIds;
    const setQuintetoIds = esVisita ? setQuintetoVisitaIds : setQuintetoLocalIds;
    const salidaState = esVisita ? cambioSalidaVisitaId : cambioSalidaId;
    const ingresoState = esVisita ? cambioIngresoVisitaId : cambioIngresoId;

    const salidaIdObjetivo = String(salidaIdManual ?? salidaState ?? '');
    const ingresoIdObjetivo = String(ingresoIdManual ?? ingresoState ?? '');
    const salida = rosterCompleto.find((j) => String(j.id) === salidaIdObjetivo);
    const ingreso = rosterCompleto.find((j) => String(j.id) === ingresoIdObjetivo);
    if (!salida || !ingreso) return;
    if (!quintetoIds.map((id) => String(id)).includes(String(salida.id))) { showToast({ message: 'La jugadora/o de salida debe estar en cancha.', type: 'error' }); return; }
    if (cambioObligatorioJugadorId && cambioObligatorioEquipo === equipo && String(cambioObligatorioJugadorId) !== String(salida.id)) {
      showToast({ message: 'Debes sacar primero a la jugadora/o expulsada.', type: 'error' });
      return;
    }
    if (quintetoIds.map((id) => String(id)).includes(String(ingreso.id))) { showToast({ message: 'La jugadora/o de ingreso ya está en cancha.', type: 'error' }); return; }
    if (ingreso._bloqueado || numero(ingreso.flt) >= 5 || ingreso.expulsado) { showToast({ message: 'La jugadora/o de ingreso está bloqueada/o.', type: 'error' }); return; }

    setQuintetoIds((prev) => prev.filter((id) => String(id) !== String(salida.id)).concat(esVisita ? ingreso.id : ingreso.id).slice(0, 5));
    const detalle = `Cambio ${esVisita ? 'Visita' : 'Local'}: sale #${salida.dorsal} ${salida.nombre}, entra #${ingreso.dorsal} ${ingreso.nombre}`;
    setPlayByPlay((prev) => [{ id: nextId(), tiempo: liveScore.reloj, texto: `🔁 ${detalle}` }, ...prev]);
    registrarEventoJuego({ tipo: 'CAMBIO', detalle, equipo, jugadorId: ingreso.id, valor: 0 });
    if (cambioObligatorioJugadorId && cambioObligatorioEquipo === equipo && String(cambioObligatorioJugadorId) === String(salida.id)) {
      setCambioObligatorioJugadorId(null);
      setCambioObligatorioIngresoId('');
    }
    if (esVisita) {
      setCambioSalidaVisitaId('');
      setCambioIngresoVisitaId('');
    } else {
      setCambioSalidaId('');
      setCambioIngresoId('');
    }
  };

  const confirmarCambioObligatorio = () => {
    if (!cambioObligatorioJugadorId || !cambioObligatorioIngresoId) {
      showToast({ message: 'Selecciona quién entra para confirmar el cambio obligatorio.', type: 'error' });
      return;
    }
    ejecutarCambioJugador(cambioObligatorioEquipo, cambioObligatorioJugadorId, cambioObligatorioIngresoId);
    setMostrarModalCambioObligatorio(false);
  };

  useEffect(() => {
    if (cambioObligatorioJugadorId) return;
    if (!mostrarModalCambioObligatorio) return;
    setMostrarModalCambioObligatorio(false);
  }, [cambioObligatorioJugadorId, mostrarModalCambioObligatorio]);

  useEffect(() => {
    if (!cambioObligatorioJugadorId) return;
    setMostrarModalCambioObligatorio(true);
  }, [cambioObligatorioJugadorId]);

  const alternarCronometro = () => {
    if (!partidoIniciado) return;
    const siguiente = !cronometroActivo;
    setCronometroActivo(siguiente);
    const detalle = siguiente ? '⏱ Reloj iniciado' : '⏸ Reloj pausado';
    setPlayByPlay((prev) => [{ id: nextId(), tiempo: liveScore.reloj, texto: detalle }, ...prev]);
    registrarEventoJuego({ tipo: 'RELOJ', detalle, equipo: 'local' });
  };

  const ajustarRelojLive = (deltaSegundos = 0) => {
    if (!partidoIniciado) return;
    let relojFinal = liveScore.reloj || '10:00';
    setLiveScore((prev) => {
      const actual = relojASegundos(prev.reloj || '10:00');
      const siguiente = limitar(actual + Number(deltaSegundos || 0), 0, 60 * 20);
      relojFinal = segundosAReloj(siguiente);
      return { ...prev, reloj: relojFinal };
    });
    const detalle = `⏱ Ajuste de reloj ${deltaSegundos > 0 ? '+' : ''}${deltaSegundos}s → ${relojFinal}`;
    setPlayByPlay((prev) => [{ id: nextId(), tiempo: liveScore.reloj, texto: detalle }, ...prev]);
    registrarEventoJuego({ tipo: 'RELOJ', detalle, equipo: 'local' });
  };

  const cambiarPeriodoLive = (delta = 1) => {
    if (!partidoIniciado) return;
    let periodoFinal = Number(liveScore.periodo || 1);
    setLiveScore((prev) => {
      periodoFinal = Math.max(1, Number(prev.periodo || 1) + Number(delta || 0));
      return { ...prev, periodo: periodoFinal, reloj: relojInicialPeriodo(periodoFinal) };
    });
    const detalle = `🧭 Cambio de periodo → ${etiquetaPeriodo(periodoFinal)}`;
    setPlayByPlay((prev) => [{ id: nextId(), tiempo: liveScore.reloj, texto: detalle }, ...prev]);
    registrarEventoJuego({ tipo: 'PERIODO', detalle, equipo: 'local' });
  };

  // Reglas FIBA de expulsión: 5 faltas personales, 2 faltas técnicas, 2 faltas
  // antideportivas, o 1 falta descalificante obligan a la jugadora/or a salir
  // de cancha. Las técnicas y antideportivas también suman al total de faltas
  // personales (afectan el bono de tiros libres del equipo).
  const TIPOS_FALTA = { PERSONAL: 'personal', TECNICA: 'tecnica', ANTIDEPORTIVA: 'antideportiva', DESCALIFICANTE: 'descalificante' };

  const calcularEstadoFalta = (jugador, tipoFalta) => {
    const flt = numero(jugador.flt);
    const tecnicas = numero(jugador.tecnicas);
    const antideportivas = numero(jugador.antideportivas);

    if (tipoFalta === TIPOS_FALTA.DESCALIFICANTE) {
      return { flt, tecnicas, antideportivas, expulsado: true, motivo: 'falta descalificante' };
    }
    const nuevoFlt = flt + 1;
    const nuevasTecnicas = tipoFalta === TIPOS_FALTA.TECNICA ? tecnicas + 1 : tecnicas;
    const nuevasAntideportivas = tipoFalta === TIPOS_FALTA.ANTIDEPORTIVA ? antideportivas + 1 : antideportivas;

    let motivo = '';
    if (nuevasTecnicas >= 2) motivo = '2 faltas técnicas';
    else if (nuevasAntideportivas >= 2) motivo = '2 faltas antideportivas';
    else if (nuevoFlt >= 5) motivo = '5 faltas';

    return {
      flt: nuevoFlt,
      tecnicas: nuevasTecnicas,
      antideportivas: nuevasAntideportivas,
      expulsado: Boolean(motivo),
      motivo,
    };
  };

  const etiquetaTipoFalta = (tipoFalta) => {
    if (tipoFalta === TIPOS_FALTA.TECNICA) return 'FALTA TÉCNICA';
    if (tipoFalta === TIPOS_FALTA.ANTIDEPORTIVA) return 'FALTA ANTIDEPORTIVA';
    if (tipoFalta === TIPOS_FALTA.DESCALIFICANTE) return 'FALTA DESCALIFICANTE';
    return 'FALTA';
  };

  const ejecutarAccionFIBA = (tipo, payload = {}) => {
    if (!partidoIniciado) { showToast({ message: 'Valida y comienza el partido antes de capturar eventos.', type: 'error' }); return; }
    if (!jugadorSeleccionadoLive) { showToast({ message: 'Selecciona un jugador del Roster primero.', type: 'error' }); return; }
    if (cambioObligatorioJugadorId && cambioObligatorioEquipo === 'local' && String(cambioObligatorioJugadorId) !== String(jugadorSeleccionadoLive)) {
      showToast({ message: 'Hay un cambio obligatorio pendiente por expulsión. Debes resolverlo antes de continuar.', type: 'error' });
      return;
    }
    if (!quintetoLocalIds.includes(jugadorSeleccionadoLive)) {
      showToast({ message: 'La accion solo se permite para jugadoras/es titulares en cancha.', type: 'error' });
      return;
    }
    let nombreJugador = '';
    let expulsionNombre = '';
    let expulsionMotivo = '';
    let puntosAnotados = 0;
    let detalleAccion;

    const tipoFalta = tipo === 'FALTA' ? (payload.tipoFalta || TIPOS_FALTA.PERSONAL) : null;
    const tirosLibresIntentados = limitar(Number(payload.tirosLibresIntentados || 0), 0, 3);
    const tirosLibresConvertidos = limitar(Number(payload.tirosLibresConvertidos || 0), 0, tirosLibresIntentados);
    const es2Pts = tipo === 'PUNTO' && Number(payload.puntos || 0) === 2;
    const es3Pts = tipo === 'PUNTO' && Number(payload.puntos || 0) === 3;
    const puntosBase = tipo === 'PUNTO' ? Number(payload.puntos || 0) : 0;
    puntosAnotados = puntosBase + tirosLibresConvertidos;

    setRosterEquipo((prev) => prev.map((j) => {
      if (j.id === jugadorSeleccionadoLive) {
        nombreJugador = `#${j.dorsal} ${j.nombre}`;
        const estadoFalta = tipo === 'FALTA' ? calcularEstadoFalta(j, tipoFalta) : null;
        if (estadoFalta?.expulsado) {
          expulsionNombre = nombreJugador;
          expulsionMotivo = estadoFalta.motivo;
        }

        const ftmActual = numero(j.ftm);
        const ftaActual = numero(j.fta);
        const fg2mActual = numero(j.fg2m);
        const fg2aActual = numero(j.fg2a);
        const fg3mActual = numero(j.fg3m);
        const fg3aActual = numero(j.fg3a);

        return {
          ...j,
          pts: numero(j.pts) + puntosAnotados,
          reb: tipo === 'REB' ? numero(j.reb) + 1 : numero(j.reb),
          ast: tipo === 'AST' ? numero(j.ast) + 1 : numero(j.ast),
          stl: tipo === 'ROBO' ? numero(j.stl) + 1 : numero(j.stl),
          flt: estadoFalta ? estadoFalta.flt : numero(j.flt),
          tecnicas: estadoFalta ? estadoFalta.tecnicas : numero(j.tecnicas),
          antideportivas: estadoFalta ? estadoFalta.antideportivas : numero(j.antideportivas),
          to: tipo === 'PERDIDA' ? numero(j.to) + 1 : numero(j.to),
          ftm: ftmActual + tirosLibresConvertidos,
          fta: ftaActual + tirosLibresIntentados,
          fg2m: fg2mActual + (es2Pts ? 1 : 0),
          fg2a: fg2aActual + (es2Pts ? 1 : 0),
          fg3m: fg3mActual + (es3Pts ? 1 : 0),
          fg3a: fg3aActual + (es3Pts ? 1 : 0),
          expulsado: estadoFalta ? estadoFalta.expulsado || j.expulsado : j.expulsado,
          _expulsado: estadoFalta ? estadoFalta.expulsado || j._expulsado : j._expulsado,
        };
      }
      return j;
    }));

    if (puntosAnotados > 0) setLiveScore((prev) => ({ ...prev, ptsLocal: prev.ptsLocal + puntosAnotados }));
    if (tipo === 'FALTA') setLiveScore((prev) => ({ ...prev, faltasLocal: prev.faltasLocal + 1 }));

    if (tipo === 'PUNTO') {
      if (puntosBase === 1) {
        detalleAccion = `${nombreJugador} TL ${tirosLibresConvertidos}/${Math.max(1, tirosLibresIntentados || 1)}`;
      } else if (puntosBase === 0 && tirosLibresIntentados > 0) {
        detalleAccion = `${nombreJugador} tiros libres ${tirosLibresConvertidos}/${tirosLibresIntentados}`;
      } else if (tirosLibresIntentados > 0) {
        detalleAccion = `${nombreJugador} anota ${puntosBase} pts + TL ${tirosLibresConvertidos}/${tirosLibresIntentados}`;
      } else {
        detalleAccion = `${nombreJugador} anota ${puntosBase} pts`;
      }
    } else if (tipo === 'FALTA') {
      detalleAccion = `${nombreJugador} comete ${etiquetaTipoFalta(tipoFalta)}`;
    } else {
      detalleAccion = `${nombreJugador} registra ${tipo}`;
    }

    const logTexto = detalleAccion;
    setPlayByPlay((prev) => [{ id: nextId(), tiempo: liveScore.reloj, texto: logTexto }, ...prev]);
    registrarEventoJuego({ tipo, detalle: logTexto, equipo: 'local', jugadorId: jugadorSeleccionadoLive, valor: puntosAnotados });
    if (expulsionNombre) {
      setPlayByPlay((prev) => [{ id: nextId(), tiempo: liveScore.reloj, texto: `⚠ ${expulsionNombre} queda fuera del partido (${expulsionMotivo}).` }, ...prev]);
      setCambioObligatorioEquipo('local');
      setCambioObligatorioJugadorId(jugadorSeleccionadoLive);
      setCambioObligatorioIngresoId('');
      setMostrarModalCambioObligatorio(true);
      showToast({ message: `${expulsionNombre} queda fuera del partido (${expulsionMotivo}). Elige quién entra.`, type: 'warning' });
    }
    if (!expulsionNombre) setJugadorSeleccionadoLive(null);
  };

  // Solo para el equipo visita: si el rival no es nuestro club, sus jugadoras/es
  // no existen en la base de jugadores del club y no hay de dónde seleccionarlos,
  // asi que se cargan a mano al armar los equipos (prepartido). El equipo local
  // siempre sale de la nómina real, y durante el partido en vivo no se agregan
  // jugadoras/es nuevas/os (eso solo pasa al armar los equipos).
  const agregarJugadorVisitaManual = () => {
    const equipoTarget = equipoVisita;
    const nombre = normalizarTexto(nuevoNombreVisita);
    const dorsalTexto = normalizarTexto(nuevoDorsalVisita);
    const dorsal = Number(dorsalTexto);

    if (!equipoTarget?.key) return;
    if (!nombre) { showToast({ message: 'Ingresa el nombre del jugador.', type: 'error' }); return; }
    if (!Number.isFinite(dorsal) || dorsal <= 0) { showToast({ message: 'Ingresa un dorsal valido.', type: 'error' }); return; }

    let nuevoIdCreado = null;

    setRosterEquipo((prev) => {
      const normalizadoPrev = (Array.isArray(prev) ? prev : []).map((j, idx) => ({
        ...j,
        id: j.id != null ? j.id : idx + 1,
        _equipoKey: construirEquipoKey(
          j.equipo_nombre || j.equipo || j.club_nombre || j.club || j.team_name || liveScore.equipoLocalNombre || 'Centro de Cultura Física',
          j.equipo_logo_url || j.logo_equipo_url || j.club_logo_url || j.logo_url || ''
        ),
      }));

      const cantidadEquipo = normalizadoPrev.filter((j) => j._equipoKey === equipoTarget.key).length;
      if (cantidadEquipo >= LIMITE_JUGADORES_POR_EQUIPO) {
        showToast({ message: `El equipo ${equipoTarget.nombre} ya tiene ${LIMITE_JUGADORES_POR_EQUIPO} jugadores en mesa.`, type: 'error' });
        return prev;
      }

      const maxId = normalizadoPrev.reduce((acc, j) => Math.max(acc, Number(j.id || 0)), 0);
      const nuevo = {
        id: maxId + 1,
        rut_jugador: `manual-${nextId()}`,
        nombre,
        dorsal,
        rama: filtroRama === 'Todas' ? 'General' : filtroRama,
        categoria: filtroCategoria === 'Todas' ? (equipoTarget.categorias?.[0] || 'General') : filtroCategoria,
        competicion: filtroCompeticionActiva || (equipoTarget.competiciones?.[0] || 'Sin competencia'),
        equipo: equipoTarget.nombre,
        equipo_nombre: equipoTarget.nombre,
        logo_equipo_url: equipoTarget.logoUrl || '',
        pts: 0,
        reb: 0,
        ast: 0,
        stl: 0,
        blk: 0,
        flt: 0,
        to: 0,
      };
      nuevoIdCreado = nuevo.id;
      return [...prev, nuevo];
    });

    if (nuevoIdCreado != null) {
      setNominaVisitaIds((prev) => (prev.length >= LIMITE_JUGADORES_POR_EQUIPO ? prev : [...prev, nuevoIdCreado]));
    }

    setNuevoNombreVisita('');
    setNuevoDorsalVisita('');
  };

  const ejecutarAccionFIBAVisita = (tipo, payload = {}) => {
    if (!partidoIniciado) { showToast({ message: 'Valida y comienza el partido antes de capturar eventos.', type: 'error' }); return; }
    if (modoAnalisis !== 'dos') return;
    if (!jugadorVisitaSeleccionadoId) { showToast({ message: 'Selecciona una jugadora/o visita primero.', type: 'error' }); return; }
    if (cambioObligatorioJugadorId && cambioObligatorioEquipo === 'visita' && String(cambioObligatorioJugadorId) !== String(jugadorVisitaSeleccionadoId)) {
      showToast({ message: 'Hay un cambio obligatorio pendiente por expulsión. Debes resolverlo antes de continuar.', type: 'error' });
      return;
    }
    if (!quintetoVisitaIds.map((id) => String(id)).includes(String(jugadorVisitaSeleccionadoId))) {
      showToast({ message: 'La accion visita solo se permite para jugadoras/es titulares en cancha.', type: 'error' });
      return;
    }

    let nombreJugador = '';
    let expulsionNombre = '';
    let expulsionMotivo = '';
    let puntosAnotados = 0;
    let detalleAccion;

    const tipoFalta = tipo === 'FALTA' ? (payload.tipoFalta || TIPOS_FALTA.PERSONAL) : null;
    const tirosLibresIntentados = limitar(Number(payload.tirosLibresIntentados || 0), 0, 3);
    const tirosLibresConvertidos = limitar(Number(payload.tirosLibresConvertidos || 0), 0, tirosLibresIntentados);
    const es2Pts = tipo === 'PUNTO' && Number(payload.puntos || 0) === 2;
    const es3Pts = tipo === 'PUNTO' && Number(payload.puntos || 0) === 3;
    const puntosBase = tipo === 'PUNTO' ? Number(payload.puntos || 0) : 0;
    puntosAnotados = puntosBase + tirosLibresConvertidos;

    const idSeleccionado = Number(jugadorVisitaSeleccionadoId);
    setRosterEquipo((prev) => prev.map((j) => {
      if (Number(j.id) !== idSeleccionado) return j;
      nombreJugador = `#${j.dorsal} ${j.nombre}`;
      const estadoFalta = tipo === 'FALTA' ? calcularEstadoFalta(j, tipoFalta) : null;
      if (estadoFalta?.expulsado) {
        expulsionNombre = nombreJugador;
        expulsionMotivo = estadoFalta.motivo;
      }

      const ftmActual = numero(j.ftm);
      const ftaActual = numero(j.fta);
      const fg2mActual = numero(j.fg2m);
      const fg2aActual = numero(j.fg2a);
      const fg3mActual = numero(j.fg3m);
      const fg3aActual = numero(j.fg3a);

      return {
        ...j,
        pts: numero(j.pts) + puntosAnotados,
        reb: tipo === 'REB' ? numero(j.reb) + 1 : numero(j.reb),
        ast: tipo === 'AST' ? numero(j.ast) + 1 : numero(j.ast),
        stl: tipo === 'ROBO' ? numero(j.stl) + 1 : numero(j.stl),
        flt: estadoFalta ? estadoFalta.flt : numero(j.flt),
        tecnicas: estadoFalta ? estadoFalta.tecnicas : numero(j.tecnicas),
        antideportivas: estadoFalta ? estadoFalta.antideportivas : numero(j.antideportivas),
        to: tipo === 'PERDIDA' ? numero(j.to) + 1 : numero(j.to),
        ftm: ftmActual + tirosLibresConvertidos,
        fta: ftaActual + tirosLibresIntentados,
        fg2m: fg2mActual + (es2Pts ? 1 : 0),
        fg2a: fg2aActual + (es2Pts ? 1 : 0),
        fg3m: fg3mActual + (es3Pts ? 1 : 0),
        fg3a: fg3aActual + (es3Pts ? 1 : 0),
        expulsado: estadoFalta ? estadoFalta.expulsado || j.expulsado : j.expulsado,
        _expulsado: estadoFalta ? estadoFalta.expulsado || j._expulsado : j._expulsado,
      };
    }));

    if (puntosAnotados > 0) setLiveScore((prev) => ({ ...prev, ptsVisita: prev.ptsVisita + puntosAnotados }));
    if (tipo === 'FALTA') setLiveScore((prev) => ({ ...prev, faltasVisita: prev.faltasVisita + 1 }));

    if (tipo === 'PUNTO') {
      if (puntosBase === 1) {
        detalleAccion = `${nombreJugador} TL ${tirosLibresConvertidos}/${Math.max(1, tirosLibresIntentados || 1)} (Visita)`;
      } else if (puntosBase === 0 && tirosLibresIntentados > 0) {
        detalleAccion = `${nombreJugador} tiros libres ${tirosLibresConvertidos}/${tirosLibresIntentados} (Visita)`;
      } else if (tirosLibresIntentados > 0) {
        detalleAccion = `${nombreJugador} anota ${puntosBase} pts + TL ${tirosLibresConvertidos}/${tirosLibresIntentados} (Visita)`;
      } else {
        detalleAccion = `${nombreJugador} anota ${puntosBase} pts (Visita)`;
      }
    } else if (tipo === 'FALTA') {
      detalleAccion = `${nombreJugador} comete ${etiquetaTipoFalta(tipoFalta)} (Visita)`;
    } else {
      detalleAccion = `${nombreJugador} registra ${tipo} (Visita)`;
    }

    setPlayByPlay((prev) => [{ id: nextId(), tiempo: liveScore.reloj, texto: detalleAccion }, ...prev]);
    registrarEventoJuego({ tipo, detalle: detalleAccion, equipo: 'visita', jugadorId: idSeleccionado, valor: puntosAnotados });
    if (expulsionNombre) {
      setPlayByPlay((prev) => [{ id: nextId(), tiempo: liveScore.reloj, texto: `⚠ ${expulsionNombre} (Visita) queda fuera del partido (${expulsionMotivo}).` }, ...prev]);
      setCambioObligatorioEquipo('visita');
      setCambioObligatorioJugadorId(jugadorVisitaSeleccionadoId);
      setCambioObligatorioIngresoId('');
      setMostrarModalCambioObligatorio(true);
      showToast({ message: `${expulsionNombre} (Visita) queda fuera del partido (${expulsionMotivo}). Elige quién entra.`, type: 'warning' });
    }
    if (!expulsionNombre) setJugadorVisitaSeleccionadoId('');
  };

  const accionEquipoEsVisita = modoAnalisis === 'dos' && equipoAccionActivo === 'visita';
  const jugadorAccionSeleccionadoValido = accionEquipoEsVisita
    ? Boolean(jugadorVisitaSeleccionadoId) && quintetoVisitaIds.map((id) => String(id)).includes(String(jugadorVisitaSeleccionadoId))
    : Boolean(jugadorSeleccionadoLive) && quintetoLocalIds.includes(jugadorSeleccionadoLive);

  const ejecutarAccionEquipoActivo = (tipo, payload = {}) => {
    if (accionEquipoEsVisita) {
      ejecutarAccionFIBAVisita(tipo, payload);
      return;
    }
    ejecutarAccionFIBA(tipo, payload);
  };

  const topEficienciaLocal = useMemo(
    () => [...rosterLocal].sort((a, b) => calcularEff(b) - calcularEff(a)),
    [rosterLocal]
  );

  const topEficienciaVisita = useMemo(
    () => [...rosterVisita].sort((a, b) => calcularEff(b) - calcularEff(a)),
    [rosterVisita]
  );

  const resumenLocal = useMemo(() => crearResumenEquipo(rosterLocal), [rosterLocal]);
  const resumenVisita = useMemo(() => crearResumenEquipo(rosterVisita), [rosterVisita]);

  const analisisPorPeriodo = useMemo(() => {
    const mapa = new Map();
    eventosPartido.forEach((evento) => {
      const q = Number(evento.periodo || 1);
      const actual = mapa.get(q) || { periodo: q, ptsLocal: 0, ptsVisita: 0, faltasLocal: 0, faltasVisita: 0, eventos: 0 };
      actual.eventos += 1;
      if (evento.tipo === 'PUNTO') {
        if (evento.equipo === 'visita') actual.ptsVisita += Number(evento.valor || 0);
        else actual.ptsLocal += Number(evento.valor || 0);
      }
      if (evento.tipo === 'FALTA') {
        if (evento.equipo === 'visita') actual.faltasVisita += 1;
        else actual.faltasLocal += 1;
      }
      mapa.set(q, actual);
    });
    return Array.from(mapa.values()).sort((a, b) => a.periodo - b.periodo);
  }, [eventosPartido]);

  const analisisClutch = useMemo(() => {
    const clutch = eventosPartido.filter((evento) => Number(evento.periodo || 0) >= 4 && relojASegundos(evento.reloj || '10:00') <= 120);
    const localPts = clutch.filter((e) => e.tipo === 'PUNTO' && e.equipo !== 'visita').reduce((acc, e) => acc + Number(e.valor || 0), 0);
    const visitaPts = clutch.filter((e) => e.tipo === 'PUNTO' && e.equipo === 'visita').reduce((acc, e) => acc + Number(e.valor || 0), 0);
    const faltasLocalClutch = clutch.filter((e) => e.tipo === 'FALTA' && e.equipo !== 'visita').length;
    const faltasVisitaClutch = clutch.filter((e) => e.tipo === 'FALTA' && e.equipo === 'visita').length;
    return {
      eventos: clutch.length,
      localPts,
      visitaPts,
      diferencial: localPts - visitaPts,
      faltasLocalClutch,
      faltasVisitaClutch,
    };
  }, [eventosPartido]);

  const impactoQuintetos = useMemo(() => {
    const mapa = new Map();
    eventosPartido.forEach((evento) => {
      if (!Array.isArray(evento.quintetoLocalSnapshot) || evento.quintetoLocalSnapshot.length === 0) return;
      const key = evento.quintetoLocalSnapshot.map((id) => String(id)).sort().join('|');
      const actual = mapa.get(key) || {
        key,
        eventos: 0,
        puntos: 0,
        faltas: 0,
        puntosContra: 0,
        posesionesFor: 0,
        posesionesAgainst: 0,
      };
      actual.eventos += 1;
      if (evento.tipo === 'PUNTO' && evento.equipo !== 'visita') {
        actual.puntos += Number(evento.valor || 0);
        actual.posesionesFor += 1;
      }
      if (evento.tipo === 'PUNTO' && evento.equipo === 'visita') {
        actual.puntosContra += Number(evento.valor || 0);
        actual.posesionesAgainst += 1;
      }
      if (evento.tipo === 'FALTA' && evento.equipo !== 'visita') actual.faltas += 1;
      if (evento.tipo === 'PERDIDA' && evento.equipo !== 'visita') actual.posesionesFor += 1;
      if (evento.tipo === 'PERDIDA' && evento.equipo === 'visita') actual.posesionesAgainst += 1;
      mapa.set(key, actual);
    });
    return Array.from(mapa.values())
      .map((item) => {
        const ortg = item.posesionesFor > 0 ? ((item.puntos / item.posesionesFor) * 100) : 0;
        const drtg = item.posesionesAgainst > 0 ? ((item.puntosContra / item.posesionesAgainst) * 100) : 0;
        return {
          ...item,
          ortg,
          drtg,
          netRating: ortg - drtg,
        };
      })
      .sort((a, b) => b.netRating - a.netRating)
      .slice(0, 5);
  }, [eventosPartido]);

  const alertasRiesgoLive = useMemo(() => {
    if (!partidoIniciado) return [];
    const ahora = instantePartidoSegundos(liveScore.periodo || 1, liveScore.reloj || relojInicialPeriodo(liveScore.periodo || 1));
    const ventanaInicio = Math.max(0, ahora - 120);
    const eventosRecientes = eventosPartido.filter((evento) => {
      if (!evento?.jugadorId || evento.equipo === 'visita') return false;
      const instante = instantePartidoSegundos(evento.periodo || 1, evento.reloj || relojInicialPeriodo(evento.periodo || 1));
      return instante >= ventanaInicio && instante <= ahora;
    });

    const cargaRecientePorJugador = new Map();
    eventosRecientes.forEach((evento) => {
      const key = String(evento.jugadorId);
      cargaRecientePorJugador.set(key, (cargaRecientePorJugador.get(key) || 0) + 1);
    });

    const alertas = [];
    rosterLocal.forEach((jugador) => {
      const cargaReciente = cargaRecientePorJugador.get(String(jugador.id)) || 0;
      if (numero(jugador.flt) >= 4) {
        alertas.push({
          tipo: 'faltas',
          severidad: numero(jugador.flt) >= 5 ? 'critica' : 'alta',
          texto: `⚠ #${jugador.dorsal} ${jugador.nombre} con ${numero(jugador.flt)} faltas.`,
        });
      }
      if (quintetoLocalIds.includes(jugador.id) && cargaReciente >= 4) {
        alertas.push({
          tipo: 'fatiga',
          severidad: 'media',
          texto: `⏱ Alta carga reciente: #${jugador.dorsal} ${jugador.nombre} (${cargaReciente} acciones en 2:00).`,
        });
      }
    });
    return alertas;
  }, [partidoIniciado, liveScore.periodo, liveScore.reloj, eventosPartido, rosterLocal, quintetoLocalIds]);

  const jugadoresAnaliticaLocal = useMemo(
    () => [...rosterLocal].sort((a, b) => calcularEff(b) - calcularEff(a)),
    [rosterLocal]
  );

  const jugadorAnalisisSeleccionado = useMemo(() => {
    if (!jugadorAnalisisId) return jugadoresAnaliticaLocal[0] || null;
    return jugadoresAnaliticaLocal.find((j) => String(j.id) === String(jugadorAnalisisId)) || jugadoresAnaliticaLocal[0] || null;
  }, [jugadorAnalisisId, jugadoresAnaliticaLocal]);

  const registrarEventoPlantilla = ({ tipo, detalle, equipo = 'local' }) => {
    if (!partidoIniciado) return;
    const operadorNombre = normalizarTexto(operadoresMesa[rolOperadorActivo]) || 'Operador sin nombre';
    const evento = {
      id: nextId(),
      tipo,
      detalle,
      equipo,
      periodo: liveScore.periodo,
      reloj: liveScore.reloj,
      operadorRol: rolOperadorActivo,
      operadorNombre,
      createdAt: new Date().toISOString(),
      quintetoLocalSnapshot: [...quintetoLocalIds],
    };
    setEventosPartido((prev) => [evento, ...prev].slice(0, 300));
    setPlayByPlay((prev) => [{ id: nextId(), tiempo: liveScore.reloj, texto: `${tipo}: ${detalle} · ${operadorNombre}` }, ...prev]);
  };

  const confirmarColorEquipo = async ({ tipo, color }) => {
    const valor = String(color || '').trim();
    if (!/^#[0-9A-Fa-f]{6}$/.test(valor)) return;
    const nombreEquipo = tipo === 'local' ? 'Local' : 'Visita';
    if (!(await confirmAction({ title: 'Confirmar color', message: `¿Confirmar color ${valor} para equipo ${nombreEquipo}?` }))) return;
    if (tipo === 'local') {
      setColorLocal(valor);
      setColorLocalDraft(valor);
      setSelectorColorAbierto((prev) => ({ ...prev, local: false }));
      return;
    }
    setColorVisita(valor);
    setColorVisitaDraft(valor);
    setSelectorColorAbierto((prev) => ({ ...prev, visita: false }));
  };

  const editarDorsalJugador = ({ tipo, jugadorId }) => {
    const rosterBase = tipo === 'local' ? rosterLocal : rosterVisita;
    const jugador = rosterBase.find((j) => String(j.id) === String(jugadorId));
    if (!jugador) return;
    const respuesta = window.prompt(`Editar dorsal para ${jugador.nombre}`, String(jugador.dorsal || ''));
    if (respuesta == null) return;
    const dorsal = Number(String(respuesta).trim());
    if (!Number.isFinite(dorsal) || dorsal <= 0) {
      showToast({ message: 'Ingresa un dorsal válido mayor que 0.', type: 'error' });
      return;
    }
    setRosterEquipo((prev) => prev.map((j) => (String(j.id) === String(jugador.id) ? { ...j, dorsal } : j)));
  };

  const crearPartidoPersistido = async () => {
    try {
      const creado = await api.partidosLiveAPI.create({
        fecha_hora: new Date().toISOString(),
        cancha_sede: normalizarTexto(canchaSede) || null,
        rama: filtroRama === 'Todas' ? 'Mixta' : filtroRama,
        categoria: filtroCategoria === 'Todas' ? 'General' : filtroCategoria,
        equipo_local: normalizarTexto(clubLocalNombre) || liveScore.equipoLocalNombre || 'Centro de Cultura Física',
        equipo_visitante: modoAnalisis === 'dos' ? (normalizarTexto(clubVisitaNombre) || liveScore.equipoVisitaNombre || 'Visitante') : 'N/A',
        logo_local_url: normalizarTexto(clubLocalLogoUrl) || liveScore.equipoLocalLogoUrl || '',
        logo_visitante_url: modoAnalisis === 'dos' ? (normalizarTexto(clubVisitaLogoUrl) || liveScore.equipoVisitaLogoUrl || '') : '',
        torneo_nombre: normalizarTexto(competenciaNombre) || null,
        torneo_logo_url: normalizarTexto(competenciaLogoUrl) || null,
        estado_juego: 'en_curso',
        pts_local: liveScore.ptsLocal,
        pts_visitante: liveScore.ptsVisita,
      });
      return creado?.id_partido || null;
    } catch {
      return null;
    }
  };

  const recargarHistorialRemoto = async () => {
    try {
      const rows = await api.partidosLiveAPI.getMesaHistorial({
        rival: modoAnalisis === 'dos' ? normalizarTexto(clubVisitaNombre) : '',
        torneo: normalizarTexto(competenciaNombre),
        rama: filtroRama === 'Todas' ? '' : filtroRama,
        categoria: filtroCategoria === 'Todas' ? '' : filtroCategoria,
        limit: 60,
      });
      setHistorialRemotoMesa(Array.isArray(rows) ? rows : []);
    } catch {
      setHistorialRemotoMesa([]);
    }
  };

  useEffect(() => {
    recargarHistorialRemoto();
  }, [filtroRama, filtroCategoria, competenciaNombre, clubVisitaNombre, modoAnalisis]);

  const historialCombinado = useMemo(() => {
    const local = (historialPartidosMesa || []).map((item) => ({ ...item, _origen: 'local' }));
    const remoto = (historialRemotoMesa || []).map((item) => ({
      id: item.id_partido || item.id,
      finalizadoAt: item.finalizado_at || item.finalizadoAt,
      equipos: {
        local: {
          nombre: item.equipo_local,
          logoUrl: item.logo_local_url,
          resumen: item.mesa_payload?.equipos?.local?.resumen || {},
          roster: item.mesa_payload?.equipos?.local?.roster || [],
        },
        visita: {
          nombre: item.equipo_visitante,
          logoUrl: item.logo_visitante_url,
          resumen: item.mesa_payload?.equipos?.visita?.resumen || {},
          roster: item.mesa_payload?.equipos?.visita?.roster || [],
        },
      },
      marcador: {
        ptsLocal: item.pts_local,
        ptsVisita: item.pts_visitante,
      },
      filtros: {
        rama: item.rama,
        categoria: item.categoria,
        competicion: item.competencia_nombre || item.torneo_nombre,
      },
      canchaSede: item.cancha_sede,
      operadores: item.operadores_json || {},
      playByPlay: item.play_by_play_json || [],
      eventos: item.eventos_json || [],
      _origen: 'remoto',
    }));

    const map = new Map();
    [...remoto, ...local].forEach((p) => {
      if (!p?.id) return;
      if (!map.has(p.id)) map.set(p.id, p);
    });
    return Array.from(map.values()).sort((a, b) => new Date(b.finalizadoAt || 0) - new Date(a.finalizadoAt || 0));
  }, [historialPartidosMesa, historialRemotoMesa]);

  const resumenHistoricoComparativo = useMemo(() => {
    if (historialCombinado.length === 0) {
      return { partidos: 0, victorias: 0, derrotas: 0, promedioFavor: 0, promedioContra: 0, rivalTop: '' };
    }

    const victorias = historialCombinado.filter((p) => Number(p.marcador?.ptsLocal || 0) > Number(p.marcador?.ptsVisita || 0)).length;
    const derrotas = historialCombinado.filter((p) => Number(p.marcador?.ptsLocal || 0) < Number(p.marcador?.ptsVisita || 0)).length;
    const promedioFavor = historialCombinado.reduce((acc, p) => acc + Number(p.marcador?.ptsLocal || 0), 0) / historialCombinado.length;
    const promedioContra = historialCombinado.reduce((acc, p) => acc + Number(p.marcador?.ptsVisita || 0), 0) / historialCombinado.length;

    const rivals = new Map();
    historialCombinado.forEach((p) => {
      const rival = normalizarTexto(p.equipos?.visita?.nombre || 'Rival');
      rivals.set(rival, (rivals.get(rival) || 0) + 1);
    });
    const rivalTop = Array.from(rivals.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || '';

    return {
      partidos: historialCombinado.length,
      victorias,
      derrotas,
      promedioFavor,
      promedioContra,
      rivalTop,
    };
  }, [historialCombinado]);

  const partidoAnalisisSeleccionado = useMemo(
    () => historialCombinado.find((p) => String(p.id) === String(partidoAnalisisId)) || historialCombinado[0] || null,
    [historialCombinado, partidoAnalisisId]
  );

  const historialFiltrado = useMemo(() => {
    const q = normalizarTexto(historialFiltroTexto).toLowerCase();
    return historialCombinado.filter((p) => {
      const okRama = historialFiltroRama === 'Todas' || coincideFiltro(p.filtros?.rama, historialFiltroRama);
      const okCategoria = historialFiltroCategoria === 'Todas' || coincideFiltro(p.filtros?.categoria, historialFiltroCategoria);
      const texto = `${p.equipos?.local?.nombre || ''} ${p.equipos?.visita?.nombre || ''} ${p.filtros?.competicion || ''}`.toLowerCase();
      const okTexto = !q || texto.includes(q);
      return okRama && okCategoria && okTexto;
    });
  }, [historialCombinado, historialFiltroTexto, historialFiltroRama, historialFiltroCategoria]);

  const acumuladoEquipos = useMemo(() => {
    const pj = historialFiltrado.length;
    const victorias = historialFiltrado.filter((p) => Number(p.marcador?.ptsLocal || 0) > Number(p.marcador?.ptsVisita || 0)).length;
    const derrotas = historialFiltrado.filter((p) => Number(p.marcador?.ptsLocal || 0) < Number(p.marcador?.ptsVisita || 0)).length;
    const pf = historialFiltrado.reduce((acc, p) => acc + Number(p.marcador?.ptsLocal || 0), 0);
    const pc = historialFiltrado.reduce((acc, p) => acc + Number(p.marcador?.ptsVisita || 0), 0);
    const effLocal = historialFiltrado.reduce((acc, p) => acc + Number(p.equipos?.local?.resumen?.effTotal || 0), 0);
    return {
      pj,
      victorias,
      derrotas,
      pf,
      pc,
      promedioPf: pj ? (pf / pj) : 0,
      promedioPc: pj ? (pc / pj) : 0,
      effLocal,
    };
  }, [historialFiltrado]);

  const acumuladoJugadores = useMemo(() => {
    const mapa = new Map();
    historialFiltrado.forEach((p) => {
      (p.equipos?.local?.roster || []).forEach((j) => {
        const clave = `${normalizarTexto(j.nombre)}-${j.dorsal || ''}`;
        const actual = mapa.get(clave) || {
          nombre: normalizarTexto(j.nombre) || 'Jugador/a',
          dorsal: j.dorsal || '-',
          partidos: 0,
          pts: 0,
          reb: 0,
          ast: 0,
          flt: 0,
          eff: 0,
        };
        actual.partidos += 1;
        actual.pts += Number(j.pts || 0);
        actual.reb += Number(j.reb || 0);
        actual.ast += Number(j.ast || 0);
        actual.flt += Number(j.flt || 0);
        actual.eff += calcularEff(j);
        mapa.set(clave, actual);
      });
    });
    return Array.from(mapa.values()).sort((a, b) => b.eff - a.eff);
  }, [historialFiltrado]);

  const actualizarHistorialLocal = (transform = (items) => items) => {
    const clave = 'mesa_partidos_guardados';
    const actual = JSON.parse(window.localStorage.getItem(clave) || '[]');
    const siguiente = transform(Array.isArray(actual) ? actual : []);
    window.localStorage.setItem(clave, JSON.stringify(siguiente));
    setHistorialPartidosMesa(siguiente);
    return siguiente;
  };

  const exportarHistorialCsv = () => {
    const filas = historialFiltrado.map((p) => ({
      fecha: p.finalizadoAt ? new Date(p.finalizadoAt).toLocaleString('es-CL') : '',
      local: p.equipos?.local?.nombre || 'Local',
      visita: p.equipos?.visita?.nombre || 'Visita',
      marcador: `${p.marcador?.ptsLocal ?? 0}-${p.marcador?.ptsVisita ?? 0}`,
      rama: p.filtros?.rama || '',
      categoria: p.filtros?.categoria || '',
      competencia: p.filtros?.competicion || '',
      sede: p.canchaSede || '',
    }));
    const csv = construirCsv(filas);
    if (!csv) return;
    descargarTexto(`historial-mesa-${Date.now()}.csv`, csv, 'text/csv;charset=utf-8');
  };

  const exportarPlanillaReglamentaria = () => {
    const partidoBase = partidoAnalisisSeleccionado || historialFiltrado[0] || null;
    let filas = [];
    let nombreArchivo = `planilla-reglamentaria-${Date.now()}.csv`;

    if (tipoFichaTecnicaExport === 'planilla_resumen_oficial') {
      filas = historialFiltrado.map((p) => ({
        Fecha: p.finalizadoAt ? new Date(p.finalizadoAt).toLocaleDateString('es-CL') : '',
        Hora: p.finalizadoAt ? new Date(p.finalizadoAt).toLocaleTimeString('es-CL') : '',
        Competencia: p.filtros?.competicion || '',
        Rama: p.filtros?.rama || '',
        Categoria: p.filtros?.categoria || '',
        Local: p.equipos?.local?.nombre || '',
        Visita: p.equipos?.visita?.nombre || '',
        PtsLocal: Number(p.marcador?.ptsLocal || 0),
        PtsVisita: Number(p.marcador?.ptsVisita || 0),
        FaltasLocal: Number(p.marcador?.faltasLocal || 0),
        FaltasVisita: Number(p.marcador?.faltasVisita || 0),
        Sede: p.canchaSede || '',
        Planillero: p.operadores?.planillero || '',
        Estadistico: p.operadores?.estadistico || '',
        Supervisor: p.operadores?.supervisor || '',
      }));
      nombreArchivo = `planilla-oficial-resumen-${Date.now()}.csv`;
    }

    if (tipoFichaTecnicaExport === 'ficha_tecnica_partido') {
      if (!partidoBase) {
        showToast({ message: 'Selecciona un partido en el historial para exportar la ficha técnica del partido.', type: 'error' });
        return;
      }
      filas = [
        { Campo: 'Fecha', Valor: partidoBase.finalizadoAt ? new Date(partidoBase.finalizadoAt).toLocaleDateString('es-CL') : '' },
        { Campo: 'Hora', Valor: partidoBase.finalizadoAt ? new Date(partidoBase.finalizadoAt).toLocaleTimeString('es-CL') : '' },
        { Campo: 'Competencia', Valor: partidoBase.filtros?.competicion || '' },
        { Campo: 'Rama', Valor: partidoBase.filtros?.rama || '' },
        { Campo: 'Categoria', Valor: partidoBase.filtros?.categoria || '' },
        { Campo: 'Sede', Valor: partidoBase.canchaSede || '' },
        { Campo: 'Equipo Local', Valor: partidoBase.equipos?.local?.nombre || 'Local' },
        { Campo: 'Equipo Visita', Valor: partidoBase.equipos?.visita?.nombre || 'Visita' },
        { Campo: 'Marcador', Valor: `${partidoBase.marcador?.ptsLocal ?? 0}-${partidoBase.marcador?.ptsVisita ?? 0}` },
        { Campo: 'Faltas Local', Valor: Number(partidoBase.marcador?.faltasLocal || 0) },
        { Campo: 'Faltas Visita', Valor: Number(partidoBase.marcador?.faltasVisita || 0) },
        { Campo: 'Periodo Final', Valor: etiquetaPeriodo(partidoBase.marcador?.periodo || 1) },
        { Campo: 'Planillero', Valor: partidoBase.operadores?.planillero || '' },
        { Campo: 'Estadistico', Valor: partidoBase.operadores?.estadistico || '' },
        { Campo: 'Supervisor', Valor: partidoBase.operadores?.supervisor || '' },
        { Campo: 'Eventos Registrados', Valor: Array.isArray(partidoBase.eventos) ? partidoBase.eventos.length : 0 },
      ];
      nombreArchivo = `ficha-tecnica-partido-${Date.now()}.csv`;
    }

    if (tipoFichaTecnicaExport === 'ficha_tecnica_local' || tipoFichaTecnicaExport === 'ficha_tecnica_visita') {
      if (!partidoBase) {
        showToast({ message: 'Selecciona un partido en el historial para exportar la ficha técnica individual.', type: 'error' });
        return;
      }
      const esLocal = tipoFichaTecnicaExport === 'ficha_tecnica_local';
      const roster = esLocal ? (partidoBase.equipos?.local?.roster || []) : (partidoBase.equipos?.visita?.roster || []);
      const nombreEquipo = esLocal ? (partidoBase.equipos?.local?.nombre || 'Local') : (partidoBase.equipos?.visita?.nombre || 'Visita');
      const rival = esLocal ? (partidoBase.equipos?.visita?.nombre || 'Visita') : (partidoBase.equipos?.local?.nombre || 'Local');

      filas = roster.map((j) => ({
        Fecha: partidoBase.finalizadoAt ? new Date(partidoBase.finalizadoAt).toLocaleDateString('es-CL') : '',
        Competencia: partidoBase.filtros?.competicion || '',
        Rama: partidoBase.filtros?.rama || '',
        Categoria: partidoBase.filtros?.categoria || '',
        Equipo: nombreEquipo,
        Rival: rival,
        Dorsal: j.dorsal ?? '',
        Jugador: j.nombre || '',
        PTS: Number(j.pts || 0),
        REB: Number(j.reb || 0),
        AST: Number(j.ast || 0),
        STL: Number(j.stl || 0),
        TO: Number(j.to || 0),
        FLT: Number(j.flt || 0),
        FTM: Number(j.ftm || 0),
        FTA: Number(j.fta || 0),
        'FT%': formatoPct(Number(j.ftm || 0), Number(j.fta || 0)),
        FG2M: Number(j.fg2m || 0),
        FG2A: Number(j.fg2a || 0),
        'FG2%': formatoPct(Number(j.fg2m || 0), Number(j.fg2a || 0)),
        FG3M: Number(j.fg3m || 0),
        FG3A: Number(j.fg3a || 0),
        'FG3%': formatoPct(Number(j.fg3m || 0), Number(j.fg3a || 0)),
        EFF: calcularEff(j),
      }));
      nombreArchivo = `${esLocal ? 'ficha-tecnica-local' : 'ficha-tecnica-visita'}-${Date.now()}.csv`;
    }

    if (tipoFichaTecnicaExport === 'planilla_fiba_impresion') {
      if (!partidoBase) {
        showToast({ message: 'Selecciona un partido en el historial para imprimir la planilla FIBA.', type: 'error' });
        return;
      }
      const html = construirHtmlPlanillaFiba(partidoBase);
      const popup = window.open('', '_blank');
      if (!popup) {
        descargarTexto(`planilla-fiba-impresion-${Date.now()}.html`, html, 'text/html;charset=utf-8');
        showToast({ message: 'No se pudo abrir la ventana de impresión. Se descargó el archivo HTML para imprimir.', type: 'warning' });
        return;
      }
      popup.document.open();
      popup.document.write(html);
      popup.document.close();
      popup.focus();
      setTimeout(() => popup.print(), 350);
      return;
    }

    const csv = construirCsv(filas);
    if (!csv) return;
    descargarTexto(nombreArchivo, csv, 'text/csv;charset=utf-8');
  };

  const eliminarPartidoHistorial = async (partido) => {
    if (!partido?.id) return;
    if (!(await confirmAction({ title: 'Eliminar del historial', message: '¿Eliminar este juego del historial?', danger: true }))) return;

    if (partido._origen === 'remoto') {
      try {
        await api.partidosLiveAPI.delete(partido.id);
      } catch (error) {
        showToast({ message: error.message || 'No se pudo eliminar el partido en backend.', type: 'error' });
        return;
      }
      await recargarHistorialRemoto();
    }

    actualizarHistorialLocal((actual) => actual.filter((item) => String(item.id) !== String(partido.id)));
    setPartidoAnalisisId((prev) => (String(prev || '') === String(partido.id) ? null : prev));
  };

  const editarPartidoHistorial = async (partido) => {
    if (!partido?.id) return;

    const ptsLocal = Number(window.prompt('PTS Local', String(partido?.marcador?.ptsLocal ?? 0)));
    if (!Number.isFinite(ptsLocal) || ptsLocal < 0) { showToast({ message: 'PTS Local invalido.', type: 'error' }); return; }
    const ptsVisita = Number(window.prompt('PTS Visita', String(partido?.marcador?.ptsVisita ?? 0)));
    if (!Number.isFinite(ptsVisita) || ptsVisita < 0) { showToast({ message: 'PTS Visita invalido.', type: 'error' }); return; }
    const rama = normalizarTexto(window.prompt('Rama', partido?.filtros?.rama || 'Mixta')) || 'Mixta';
    const categoria = normalizarTexto(window.prompt('Categoria', partido?.filtros?.categoria || 'General')) || 'General';
    const competencia = normalizarTexto(window.prompt('Competencia', partido?.filtros?.competicion || ''));
    const sede = normalizarTexto(window.prompt('Sede', partido?.canchaSede || ''));

    if (partido._origen === 'remoto') {
      try {
        await api.partidosLiveAPI.update(partido.id, {
          pts_local: ptsLocal,
          pts_visitante: ptsVisita,
          rama,
          categoria,
          competencia_nombre: competencia,
          cancha_sede: sede,
        });
      } catch (error) {
        showToast({ message: error.message || 'No se pudo editar el partido remoto.', type: 'error' });
        return;
      }
      await recargarHistorialRemoto();
    }

    actualizarHistorialLocal((actual) => actual.map((item) => {
      if (String(item.id) !== String(partido.id)) return item;
      return {
        ...item,
        marcador: {
          ...(item.marcador || {}),
          ptsLocal,
          ptsVisita,
        },
        filtros: {
          ...(item.filtros || {}),
          rama,
          categoria,
          competicion: competencia,
        },
        canchaSede: sede,
      };
    }));
  };

  // Guarda el resultado final y el box score por jugador en sus tablas propias
  // (resultados/estadisticas), ademas del payload JSON que ya queda en
  // partidos_live. Es un extra sobre el guardado principal: si algo falla aca
  // no debe bloquear la finalizacion del partido, que ya quedo persistida.
  const persistirResultadoYEstadisticas = async (idPartido) => {
    const operadorNombre = normalizarTexto(operadoresMesa[rolOperadorActivo]) || 'Mesa';
    const nombreLocal = liveScore.equipoLocalNombre || equipoLocal?.nombre || 'Local';
    const nombreVisita = liveScore.equipoVisitaNombre || equipoVisita?.nombre || 'Visita';
    const equipoGanador = liveScore.ptsLocal === liveScore.ptsVisita
      ? 'Empate'
      : (liveScore.ptsLocal > liveScore.ptsVisita ? nombreLocal : nombreVisita);

    try {
      await api.resultadosAPI.create({
        id_partido: idPartido,
        equipo_ganador: equipoGanador,
        puntos_local: liveScore.ptsLocal,
        puntos_visitante: liveScore.ptsVisita,
        validado_por: operadorNombre,
      });
    } catch {
      // No bloquea: el resultado ya quedo en partidos_live via finalizarMesa.
    }

    // Jugadoras/es agregadas manualmente (visita sin roster propio en el club)
    // usan un rut sintetico "manual-*" que no existe en la tabla jugadores;
    // estadisticas.rut_jugador tiene FK a jugadores, asi que se excluyen.
    const jugadoresConEstadistica = [...rosterLocal, ...rosterVisita].filter(
      (j) => !String(j.rut_jugador || j.rut || '').startsWith('manual-')
    );

    await Promise.all(jugadoresConEstadistica.map((j) => {
      const eff = calcularEff({
        pts: numero(j.pts),
        reb: numero(j.reb),
        ast: numero(j.ast),
        stl: numero(j.stl),
        blk: numero(j.blk),
        to: numero(j.to),
      });
      return api.estadisticasAPI.create({
        id_partido: idPartido,
        rut_jugador: j.rut_jugador || j.rut,
        puntos: numero(j.pts),
        rebotes: numero(j.reb),
        asistencias: numero(j.ast),
        robos: numero(j.stl),
        tapones: numero(j.blk),
        faltas_cometidas: numero(j.flt),
        porcentaje_efectividad: eff,
      }).catch(() => {
        // Un jugador con error no debe tumbar el resto del box score.
      });
    }));
  };

  const guardarEstadisticaPartido = async ({ guardarEnBaseHistorica = true } = {}) => {
    const payload = {
      id: nextId(),
      finalizadoAt: new Date().toISOString(),
      operadores: operadoresMesa,
      operadorActivo: rolOperadorActivo,
      equipos: {
        local: {
          nombre: liveScore.equipoLocalNombre || equipoLocal?.nombre || 'Local',
          logoUrl: liveScore.equipoLocalLogoUrl || equipoLocal?.logoUrl || '',
          roster: rosterLocal,
          resumen: crearResumenEquipo(rosterLocal),
        },
        visita: {
          nombre: liveScore.equipoVisitaNombre || equipoVisita?.nombre || 'Visita',
          logoUrl: liveScore.equipoVisitaLogoUrl || equipoVisita?.logoUrl || '',
          roster: rosterVisita,
          resumen: crearResumenEquipo(rosterVisita),
        },
      },
      marcador: {
        ptsLocal: liveScore.ptsLocal,
        ptsVisita: liveScore.ptsVisita,
        faltasLocal: liveScore.faltasLocal,
        faltasVisita: liveScore.faltasVisita,
        periodo: liveScore.periodo,
        reloj: liveScore.reloj,
      },
      filtros: {
        rama: filtroRama,
        categoria: filtroCategoria,
        competicion: filtroCompeticionActiva || 'Todas',
        incluirCategoriasMenores,
        canchaSede: normalizarTexto(canchaSede),
      },
      competencia: {
        nombre: filtroCompeticionActiva,
        logoUrl: normalizarTexto(competenciaLogoUrl),
      },
      configuracionPartido: {
        colorLocal,
        colorVisita,
        capitanLocalId,
        capitanVisitaId,
        staffLocal,
        staffVisita,
      },
      canchaSede: normalizarTexto(canchaSede),
      playByPlay,
      eventos: eventosPartido,
      analisis: resumenHistoricoComparativo,
    };

    try {
      const clave = 'mesa_partidos_guardados';
      const actual = JSON.parse(window.localStorage.getItem(clave) || '[]');
      const siguiente = [...actual, payload].slice(-30);
      window.localStorage.setItem(clave, JSON.stringify(siguiente));
      setHistorialPartidosMesa(siguiente);
      setUltimoGuardadoAt(new Date().toLocaleString('es-CL'));
      if (guardarEnBaseHistorica) {
        let idPersistido = partidoPersistidoId;
        if (!idPersistido) {
          idPersistido = await crearPartidoPersistido();
          if (idPersistido) setPartidoPersistidoId(idPersistido);
        }
        if (idPersistido) {
          await api.partidosLiveAPI.finalizarMesa(idPersistido, {
          mesa_payload: payload,
          play_by_play_json: playByPlay,
          eventos_json: eventosPartido,
          operadores_json: operadoresMesa,
          analisis_json: {
            resumenHistoricoComparativo,
            topEficienciaLocal,
            topEficienciaVisita,
          },
          competencia_nombre: filtroCompeticionActiva || null,
          competencia_logo_url: normalizarTexto(competenciaLogoUrl) || null,
          cancha_sede: normalizarTexto(canchaSede) || null,
          pts_local: liveScore.ptsLocal,
          pts_visitante: liveScore.ptsVisita,
          });
          await recargarHistorialRemoto();
          await persistirResultadoYEstadisticas(idPersistido);
        }
      }
      return true;
    } catch {
      return false;
    }
  };

  const claseSeveridadPlay = (play = {}) => {
    const texto = String(play?.texto || '').toUpperCase();
    if (texto.includes('⚠') || texto.includes('FALTA') || texto.includes('PERDIDA') || texto.includes('PÉRDIDA')) return 'play-row-alerta';
    if (texto.includes('TL') || texto.includes('2+1') || texto.includes('ANOTA') || texto.includes('PUNTO') || texto.includes('+')) return 'play-row-puntos';
    if (texto.includes('REB') || texto.includes('ROBO') || texto.includes('AST') || texto.includes('CAMBIO') || texto.includes('🔁')) return 'play-row-defensa';
    if (texto.includes('PERIODO') || texto.includes('RELOJ') || texto.includes('⏱') || texto.includes('🧭')) return 'play-row-control';
    return 'play-row-neutral';
  };

  const confirmarInicioPartido = async () => {
    if (partidoIniciado) return;
    if (!prepartidoValido) {
      showToast({ message: 'Corrige las validaciones prepartido antes de iniciar.', type: 'error' });
      return;
    }
    if (!(await confirmAction({ title: 'Iniciar partido', message: '¿Confirmas iniciar el partido?' }))) return;
    setPartidoIniciado(true);
    setModuloMesa('live');
    setForzarPantallaCompletaLive(true);
    setTimeout(() => {
      const node = liveFullScreenRef.current;
      if (node && document?.fullscreenEnabled && !document.fullscreenElement) {
        node.requestFullscreen().catch(() => {});
      }
    }, 60);
    const operadorNombre = normalizarTexto(operadoresMesa[rolOperadorActivo]) || 'Operador';
    setPlayByPlay((prev) => [{ id: nextId(), tiempo: liveScore.reloj || '10:00', texto: `▶ Partido iniciado · ${operadorNombre}` }, ...prev]);
  };

  const confirmarFinalizacionPartido = async () => {
    if (!partidoIniciado) return;
    if (!(await confirmAction({ title: 'Finalizar partido', message: '¿Finalizar partido y guardar estadística?' }))) return;
    const guardarHistorico = await confirmAction({ title: 'Guardar en histórico', message: '¿Quieres guardar este partido en la base histórica?' });

    const guardado = await guardarEstadisticaPartido({ guardarEnBaseHistorica: guardarHistorico });
    setPartidoIniciado(false);
    if (forzarPantallaCompletaLive) {
      showToast({ message: 'Partido finalizado. Usa "Salir Pantalla Completa" para cambiar de módulo.', type: 'info' });
    } else {
      setModuloMesa('analitica');
    }
    setPartidoPersistidoId(null);
    setPlayByPlay((prev) => [{ id: nextId(), tiempo: liveScore.reloj || '00:00', texto: guardado ? `■ Partido finalizado y ${guardarHistorico ? 'guardado en histórico' : 'guardado localmente'}` : '■ Partido finalizado (falló guardado local)' }, ...prev]);
    if (!guardado) {
      showToast({ message: 'Partido finalizado, pero no se pudo guardar la estadística en este dispositivo.', type: 'warning' });
    }
  };

  if (modoChromaKey) {
    return (
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: '#00FF00', zIndex: 99999, display: 'flex', alignItems: 'flex-end', padding: '50px' }}>
        <div style={{ background: '#1C1C1E', border: '3px solid #333', borderRadius: '15px', padding: '20px 40px', display: 'flex', gap: '40px', alignItems: 'center', boxShadow: '0 20px 50px rgba(0,0,0,0.5)' }}>
          <div className="text-center"><span style={{ color: '#aaa', fontSize: '14px', fontWeight: 'bold' }}>LOCAL {liveScore.flecha === 'LOCAL' && '◀'}</span><h1 style={{ color: 'white', margin: 0, fontSize: '60px', fontFamily: 'Orbitron' }}>{liveScore.ptsLocal}</h1><span style={{ color: 'var(--rojo-alerta)', fontSize: '12px', fontWeight: 'bold' }}>FALTAS: {liveScore.faltasLocal}</span></div>
          <div className="text-center"><span style={{ background: '#333', color: '#00FF00', padding: '10px 20px', borderRadius: '10px', fontSize: '24px', fontWeight: '900', fontFamily: 'Orbitron' }}>{liveScore.reloj}</span><h3 style={{ color: 'white', margin: '10px 0 0 0' }}>{etiquetaPeriodo(liveScore.periodo)}</h3></div>
          <div className="text-center"><span style={{ color: '#aaa', fontSize: '14px', fontWeight: 'bold' }}>{liveScore.flecha === 'VISITA' && '▶'} VISITA</span><h1 style={{ color: 'white', margin: 0, fontSize: '60px', fontFamily: 'Orbitron' }}>{liveScore.ptsVisita}</h1><span style={{ color: 'var(--rojo-alerta)', fontSize: '12px', fontWeight: 'bold' }}>FALTAS: {liveScore.faltasVisita}</span></div>
          <button style={{ position: 'absolute', top: '10px', right: '10px', background: 'black', color: 'white', border: 'none', padding: '10px', borderRadius: '999px', cursor: 'pointer', opacity: 0.2 }} onClick={() => setModoChromaKey(false)}>Cerrar Modo TV</button>
        </div>
      </div>
    );
  }

  return (
    <div className="fiba-container fade-in">
      <div className="mesa-lab-header card mb-15">
        <div className="mesa-lab-title-wrap">
          <h3 className="form-subtitle" style={{ margin: 0 }}><Users size={18} color="var(--gris-secundario)" strokeWidth={1.5} /> Mesa Insights</h3>
          <span className="mesa-lab-subtitle">Analiza uno o dos equipos con filtros competitivos y control live.</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div className="mesa-lab-mode-switch" role="tablist" aria-label="Modo de análisis">
            <button className={`mesa-mode-btn ${modoAnalisis === 'uno' ? 'active' : ''}`} onClick={() => setModoAnalisis('uno')}>1 Equipo</button>
            <button className={`mesa-mode-btn ${modoAnalisis === 'dos' ? 'active' : ''}`} onClick={() => setModoAnalisis('dos')}>2 Equipos</button>
          </div>
          <div className="mesa-lab-mode-switch" style={{ gridTemplateColumns: '1fr 1fr 1fr 1fr' }} role="tablist" aria-label="Módulo de mesa">
            <button className={`mesa-mode-btn ${moduloMesa === 'prepartido' ? 'active' : ''}`} onClick={() => cambiarModuloProtegido('prepartido')}>1. Datos partido</button>
            <button className={`mesa-mode-btn ${moduloMesa === 'live' ? 'active' : ''}`} onClick={() => cambiarModuloProtegido('live')} disabled={!partidoIniciado}>2. Juego en vivo</button>
            <button className={`mesa-mode-btn ${moduloMesa === 'analitica' ? 'active' : ''}`} onClick={() => cambiarModuloProtegido('analitica')}>3. Estadística</button>
            <button className={`mesa-mode-btn ${moduloMesa === 'historia' ? 'active' : ''}`} onClick={() => cambiarModuloProtegido('historia')}><History size={12} color="var(--gris-secundario)" strokeWidth={1.5} /> 4. Historia</button>
          </div>
        </div>
      </div>

      {sesionRecuperada && (
        <div className="card mb-15" style={{ borderRadius: '16px', border: '1px solid rgba(52,199,89,0.4)', background: 'rgba(52,199,89,0.1)' }}>
          <strong>Sesión restaurada automáticamente.</strong>
          <p style={{ margin: '6px 0 0 0', color: 'var(--texto-secundario)' }}>Los datos de Mesa se mantuvieron después del refresco.</p>
        </div>
      )}

      {moduloMesa === 'prepartido' && (
        <>

      <div className="card mb-15" style={{ borderRadius: '18px' }}>
        <h4 className="form-subtitle" style={{ marginTop: 0 }}><Users size={16} color="var(--gris-secundario)" strokeWidth={1.5} /> Operadores de Mesa (Trazabilidad)</h4>
        <div className="mesa-filtros-grid" style={{ marginBottom: '10px' }}>
          <label className="mesa-filter-item">
            <span>Planillero/a</span>
            <input className="form-input" value={operadoresMesa.planillero} onChange={(e) => setOperadoresMesa((prev) => ({ ...prev, planillero: e.target.value }))} placeholder="Nombre planillero" />
          </label>
          <label className="mesa-filter-item">
            <span>Estadístico/a</span>
            <input className="form-input" value={operadoresMesa.estadistico} onChange={(e) => setOperadoresMesa((prev) => ({ ...prev, estadistico: e.target.value }))} placeholder="Nombre estadístico" />
          </label>
          <label className="mesa-filter-item">
            <span>Supervisor/a</span>
            <input className="form-input" value={operadoresMesa.supervisor} onChange={(e) => setOperadoresMesa((prev) => ({ ...prev, supervisor: e.target.value }))} placeholder="Nombre supervisor" />
          </label>
          <label className="mesa-filter-item">
            <span>Rol activo para registrar</span>
            <select className="form-input" value={rolOperadorActivo} onChange={(e) => setRolOperadorActivo(e.target.value)}>
              <option value="planillero">Planillero/a</option>
              <option value="estadistico">Estadístico/a</option>
              <option value="supervisor">Supervisor/a</option>
            </select>
          </label>
        </div>

        {partidoIniciado && (
          <div className="mesa-eventos-template-grid">
            <button className="btn-secondary" onClick={() => registrarEventoPlantilla({ tipo: 'SISTEMA', detalle: 'Timeout local solicitado', equipo: 'local' })}>Timeout Local</button>
            <button className="btn-secondary" onClick={() => registrarEventoPlantilla({ tipo: 'SISTEMA', detalle: 'Timeout visita solicitado', equipo: 'visita' })}>Timeout Visita</button>
            <button className="btn-secondary" onClick={() => registrarEventoPlantilla({ tipo: 'SUSTITUCION', detalle: 'Cambio de quinteto local', equipo: 'local' })}>Sustitución Local</button>
            <button className="btn-secondary" onClick={() => registrarEventoPlantilla({ tipo: 'SUSTITUCION', detalle: 'Cambio de quinteto visita', equipo: 'visita' })}>Sustitución Visita</button>
            <button className="btn-secondary" onClick={() => registrarEventoPlantilla({ tipo: 'LANZAMIENTO', detalle: 'Tiro fallado local', equipo: 'local' })}>Tiro Fallado Local</button>
            <button className="btn-secondary" onClick={() => registrarEventoPlantilla({ tipo: 'LANZAMIENTO', detalle: 'Tiro fallado visita', equipo: 'visita' })}>Tiro Fallado Visita</button>
            <button className="btn-secondary" onClick={() => registrarEventoPlantilla({ tipo: 'DEFENSA', detalle: 'Recuperación defensiva local', equipo: 'local' })}>Recuperación Local</button>
            <button className="btn-secondary" onClick={() => registrarEventoPlantilla({ tipo: 'DEFENSA', detalle: 'Recuperación defensiva visita', equipo: 'visita' })}>Recuperación Visita</button>
          </div>
        )}

        <div className="mesa-prepartido-actions" style={{ marginTop: '10px' }}>
          <button
            className={`btn-secondary ${partidoIniciado ? 'mesa-btn-live' : ''}`}
            style={{ width: 'auto', padding: '8px 14px', borderRadius: '999px' }}
            onClick={confirmarInicioPartido}
            disabled={partidoIniciado || !prepartidoValido}
          >
            {partidoIniciado ? 'Partido en Curso' : 'Iniciar Partido'}
          </button>
          <button
            className="btn-secondary"
            style={{ width: 'auto', padding: '8px 14px', borderRadius: '999px' }}
            onClick={confirmarFinalizacionPartido}
            disabled={!partidoIniciado}
          >
            Finalizar Partido
          </button>
        </div>
      </div>

      <div className="card mb-15" style={{ borderRadius: '18px' }}>
        <h4 className="form-subtitle" style={{ marginTop: 0 }}><Shield size={16} color="var(--gris-secundario)" strokeWidth={1.5} /> Configuración de Equipos y Staff</h4>
        <div className={`mesa-team-config-grid ${modoAnalisis === 'dos' ? 'dos-equipos' : 'uno-equipo'}`}>
          <div className="mesa-team-config-card" style={{ borderColor: colorConAlpha(colorLocal, '99'), background: `linear-gradient(180deg, ${colorConAlpha(colorLocal, '22')} 0%, rgba(255,255,255,0.02) 65%)` }}>
            <div className="mesa-team-config-header">
              <strong>Equipo Local</strong>
              <button className="mesa-color-chip" type="button" style={{ background: colorLocal, color: colorTextoContraste(colorLocal) }} onClick={() => setSelectorColorAbierto((prev) => ({ ...prev, local: !prev.local }))}>
                {colorLocal}
              </button>
            </div>
            {selectorColorAbierto.local && (
              <div className="mesa-color-picker-pop">
                <input type="color" className="form-input" value={colorLocalDraft} onChange={(e) => setColorLocalDraft(e.target.value)} />
                <button className="btn-secondary" style={{ width: 'auto' }} onClick={() => confirmarColorEquipo({ tipo: 'local', color: colorLocalDraft })}>Confirmar color</button>
                <button className="btn-secondary" style={{ width: 'auto' }} onClick={() => setSelectorColorAbierto((prev) => ({ ...prev, local: false }))}>Cancelar</button>
              </div>
            )}
            <div className="mesa-filter-item">
              <span><Users size={14} color="var(--gris-secundario)" strokeWidth={1.5} /> Club Local</span>
              <LogoPicker
                nombre={clubLocalNombre}
                onNombre={setClubLocalNombre}
                logoUrl={clubLocalLogoUrl}
                onLogoUrl={setClubLocalLogoUrl}
                tipo="club"
                placeholder="Buscar club local"
                logoSize={30}
                extraOptions={opcionesLogosMesa}
              />
            </div>
            <div className="mesa-filtros-grid" style={{ padding: 0, marginTop: '8px' }}>
              <label className="mesa-filter-item"><span>DT Local</span><input className="form-input" value={staffLocal.entrenador} onChange={(e) => setStaffLocal((prev) => ({ ...prev, entrenador: e.target.value }))} placeholder="Opcional" /></label>
              <label className="mesa-filter-item"><span>Asistente Local</span><input className="form-input" value={staffLocal.asistente} onChange={(e) => setStaffLocal((prev) => ({ ...prev, asistente: e.target.value }))} placeholder="Opcional" /></label>
              <label className="mesa-filter-item"><span>Delegado Local</span><input className="form-input" value={staffLocal.delegado} onChange={(e) => setStaffLocal((prev) => ({ ...prev, delegado: e.target.value }))} placeholder="Opcional" /></label>
            </div>
          </div>

          {modoAnalisis === 'dos' && (
            <div className="mesa-team-config-card" style={{ borderColor: colorConAlpha(colorVisita, '99'), background: `linear-gradient(180deg, ${colorConAlpha(colorVisita, '22')} 0%, rgba(255,255,255,0.02) 65%)` }}>
              <div className="mesa-team-config-header">
                <strong>Equipo Visita</strong>
                <button className="mesa-color-chip" type="button" style={{ background: colorVisita, color: colorTextoContraste(colorVisita) }} onClick={() => setSelectorColorAbierto((prev) => ({ ...prev, visita: !prev.visita }))}>
                  {colorVisita}
                </button>
              </div>
              {selectorColorAbierto.visita && (
                <div className="mesa-color-picker-pop">
                  <input type="color" className="form-input" value={colorVisitaDraft} onChange={(e) => setColorVisitaDraft(e.target.value)} />
                  <button className="btn-secondary" style={{ width: 'auto' }} onClick={() => confirmarColorEquipo({ tipo: 'visita', color: colorVisitaDraft })}>Confirmar color</button>
                  <button className="btn-secondary" style={{ width: 'auto' }} onClick={() => setSelectorColorAbierto((prev) => ({ ...prev, visita: false }))}>Cancelar</button>
                </div>
              )}
              <div className="mesa-filter-item">
                <span><Users size={14} color="var(--gris-secundario)" strokeWidth={1.5} /> Club Visita</span>
                <LogoPicker
                  nombre={clubVisitaNombre}
                  onNombre={setClubVisitaNombre}
                  logoUrl={clubVisitaLogoUrl}
                  onLogoUrl={setClubVisitaLogoUrl}
                  tipo="club"
                  placeholder="Buscar club visita"
                  logoSize={30}
                  extraOptions={opcionesLogosMesa}
                />
              </div>
              <div className="mesa-filtros-grid" style={{ padding: 0, marginTop: '8px' }}>
                <label className="mesa-filter-item"><span>DT Visita</span><input className="form-input" value={staffVisita.entrenador} onChange={(e) => setStaffVisita((prev) => ({ ...prev, entrenador: e.target.value }))} placeholder="Opcional" /></label>
                <label className="mesa-filter-item"><span>Asistente Visita</span><input className="form-input" value={staffVisita.asistente} onChange={(e) => setStaffVisita((prev) => ({ ...prev, asistente: e.target.value }))} placeholder="Opcional" /></label>
                <label className="mesa-filter-item"><span>Delegado Visita</span><input className="form-input" value={staffVisita.delegado} onChange={(e) => setStaffVisita((prev) => ({ ...prev, delegado: e.target.value }))} placeholder="Opcional" /></label>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="mesa-filtros-grid card mb-15">
        <label className="mesa-filter-item">
          <span><Filter size={14} color="var(--gris-secundario)" strokeWidth={1.5} /> Rama</span>
          <select className="form-input" value={filtroRama} onChange={(e) => setFiltroRama(e.target.value)}>
            {opcionesRama.map((op) => <option key={op} value={op}>{op}</option>)}
          </select>
        </label>

        <label className="mesa-filter-item">
          <span><Filter size={14} color="var(--gris-secundario)" strokeWidth={1.5} /> Categoría</span>
          <select className="form-input" value={filtroCategoria} onChange={(e) => setFiltroCategoria(e.target.value)}>
            {opcionesCategoria.map((op) => <option key={op} value={op}>{op}</option>)}
          </select>
        </label>

        <div className="mesa-filter-item">
          <span><Shield size={14} color="var(--gris-secundario)" strokeWidth={1.5} /> Competencia / Torneo</span>
          <LogoPicker
            nombre={competenciaNombre}
            onNombre={setCompetenciaNombre}
            logoUrl={competenciaLogoUrl}
            onLogoUrl={setCompetenciaLogoUrl}
            tipo="torneo"
            placeholder="Buscar competencia o torneo"
            logoSize={30}
            extraOptions={[
              ...opcionesLogosMesa,
              ...opcionesCompeticion
                .filter((op) => op !== 'Todas')
                .map((op) => ({ nombre: op, logoUrl: '' })),
            ]}
          />
        </div>

        <label className="mesa-filter-item">
          <span><FileText size={14} color="var(--gris-secundario)" strokeWidth={1.5} /> Cancha / Sede</span>
          <input
            className="form-input"
            list="mesa-canchas-sugeridas"
            value={canchaSede}
            onChange={(e) => setCanchaSede(e.target.value)}
            placeholder="Ej: Gimnasio CCF"
          />
          <datalist id="mesa-canchas-sugeridas">
            {canchasDisponibles.map((cancha) => (
              <option key={cancha} value={cancha} />
            ))}
          </datalist>
        </label>

        <div className="mesa-filter-item" style={{ justifyContent: 'flex-end' }}>
          <span>Acciones de filtro</span>
          <button className="btn-secondary" type="button" onClick={restaurarFiltrosMesa}>Restaurar filtros</button>
        </div>

        {filtroCategoria !== 'Todas' && (
          <>
            <label className="mesa-filter-item" style={{ justifyContent: 'center' }}>
              <span><Shield size={14} color="var(--gris-secundario)" strokeWidth={1.5} /> Incluir categorías menores</span>
              <input
                type="checkbox"
                checked={incluirCategoriasMenores}
                onChange={(e) => setIncluirCategoriasMenores(e.target.checked)}
                style={{ width: '18px', height: '18px' }}
              />
            </label>
            {incluirCategoriasMenores && (
              <label className="mesa-filter-item">
                <span>Desde {filtroCategoria}: bajar hasta</span>
                <select className="form-input" value={nivelesCategoriasInferiores} onChange={(e) => setNivelesCategoriasInferiores(Number(e.target.value))}>
                  <option value={1}>1 categoría inferior</option>
                  <option value={2}>2 categorías inferiores</option>
                </select>
              </label>
            )}
          </>
        )}
      </div>

      {incluirCategoriasMenores && filtroCategoria !== 'Todas' && (
        <div className="card mb-15" style={{ borderRadius: '18px' }}>
          <h4 className="form-subtitle" style={{ marginTop: 0 }}><Users size={16} color="var(--gris-secundario)" strokeWidth={1.5} /> Incluir jugadoras/es desde categorías inferiores</h4>
          <input className="form-input mb-15" placeholder="Buscar por nombre o dorsal" value={busquedaInclusionLocal} onChange={(e) => setBusquedaInclusionLocal(e.target.value)} />
          <div className="mesa-historial-list">
            {candidatasInferioresLocal.length === 0 && <p className="text-muted">No hay candidatas/os para el rango seleccionado.</p>}
            {candidatasInferioresLocal.map((j) => (
              <div key={`cand-${j.id}`} className="mesa-historial-item">
                <div>
                  <strong>#{j.dorsal} {j.nombre}</strong>
                  <span>{j._categoria} · {j._rama}</span>
                </div>
                <button className="btn-secondary" style={{ width: 'auto' }} onClick={() => incluirDesdeCategoriasInferioresLocal(j.id)}>Incluir a nómina</button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className={`card mb-15 mesa-prepartido-card ${partidoIniciado ? 'mesa-prepartido-live' : ''}`}>
        <div className="mesa-prepartido-header">
          <h4 className="form-subtitle" style={{ margin: 0 }}><Shield size={16} color="var(--gris-secundario)" strokeWidth={1.5} /> Validacion Prepartido</h4>
        </div>

        <div className="mesa-validation-grid">
          <div className="mesa-validation-box">
            <h6>Local</h6>
            <p>Citadas/os: {validacionLocal.total} (max 12)</p>
            <p>Quinteto inicial: {quintetoLocalIds.length}/5 {quintetoLocalValidado ? '· Validado' : ''}</p>
            {!validacionLocal.dorsalesOk && <p className="mesa-validation-error">Dorsales duplicados: {dorsalesDuplicadosLocal.join(', ')}</p>}
            <label className="mesa-filter-item" style={{ marginTop: '8px' }}>
              <span>Capitán/a local</span>
              <select className="form-input" value={capitanLocalId} onChange={(e) => setCapitanLocalId(e.target.value)}>
                <option value="">Seleccionar</option>
                {rosterLocal.map((j) => <option key={j.id} value={j.id}>#{j.dorsal} {j.nombre}</option>)}
              </select>
            </label>
            <p style={{ marginTop: '8px', fontWeight: 800 }}>1) Selecciona nómina citada (hasta 12)</p>
            <div className="mesa-add-player" style={{ marginTop: '8px' }}>
              <select className="form-input" value={selectorNominaLocalId} onChange={(e) => setSelectorNominaLocalId(e.target.value)}>
                <option value="">Agregar desde lista...</option>
                {disponiblesNominaLocal.map((j) => <option key={`dloc-${j.id}`} value={j.id}>#{j.dorsal} {j.nombre} ({j._categoria})</option>)}
              </select>
              <input className="form-input" placeholder="Buscar citada/o" value={busquedaNominaLocal} onChange={(e) => setBusquedaNominaLocal(e.target.value)} />
              <button className="btn-secondary" onClick={() => agregarNominaDesdeSelector({ tipo: 'local' })}>Agregar</button>
            </div>
            <div className="mesa-quinteto-list" style={{ marginTop: '8px' }}>
              {rosterLocalVisible.map((j) => (
                <div key={`row-local-${j.id}`} className="mesa-historial-item mesa-nomina-row" style={{ background: quintetoLocalIds.includes(j.id) ? colorConAlpha(colorLocal, '22') : undefined, borderColor: quintetoLocalIds.includes(j.id) ? colorConAlpha(colorLocal, '99') : undefined }}>
                  <div>
                    <strong>#{j.dorsal} {j.nombre}</strong>
                    <span>{j._categoria} · {j._rama}</span>
                  </div>
                  <div className="mesa-nomina-actions">
                      <button className="btn-secondary" style={{ width: 'auto' }} onClick={() => editarDorsalJugador({ tipo: 'local', jugadorId: j.id })}>Editar dorsal</button>
                    <button className="btn-secondary" style={{ width: 'auto' }} onClick={() => alternarNomina({ tipo: 'local', jugadorId: j.id })}>Quitar</button>
                    <button className={`btn-secondary ${quintetoLocalIds.includes(j.id) ? 'mesa-btn-live' : ''}`} style={{ width: 'auto' }} onClick={() => alternarTitular({ tipo: 'local', jugadorId: j.id })}>Quinteto inicial</button>
                  </div>
                </div>
              ))}
            </div>
            <button className="btn-secondary" style={{ width: 'auto', marginTop: '10px' }} onClick={() => validarQuinteto({ tipo: 'local' })}>Validar quinteto local</button>
          </div>
          {modoAnalisis === 'dos' && (
            <div className="mesa-validation-box">
              <h6>Visita</h6>
              <p>Citadas/os: {validacionVisita.total} (max 12)</p>
              <p>Quinteto inicial: {quintetoVisitaIds.length}/5 {quintetoVisitaValidado ? '· Validado' : ''}</p>
              {!validacionVisita.dorsalesOk && <p className="mesa-validation-error">Dorsales duplicados: {dorsalesDuplicadosVisita.join(', ')}</p>}
              <label className="mesa-filter-item" style={{ marginTop: '8px' }}>
                <span>Capitán/a visita</span>
                <select className="form-input" value={capitanVisitaId} onChange={(e) => setCapitanVisitaId(e.target.value)}>
                  <option value="">Seleccionar</option>
                  {rosterVisita.map((j) => <option key={j.id} value={j.id}>#{j.dorsal} {j.nombre}</option>)}
                </select>
              </label>
              <p style={{ marginTop: '8px', fontWeight: 800 }}>1) Selecciona nómina citada (hasta 12)</p>
              <div className="mesa-add-player" style={{ marginTop: '8px' }}>
                <select className="form-input" value={selectorNominaVisitaId} onChange={(e) => setSelectorNominaVisitaId(e.target.value)}>
                  <option value="">Agregar desde lista...</option>
                  {disponiblesNominaVisita.map((j) => <option key={`dvis-${j.id}`} value={j.id}>#{j.dorsal} {j.nombre} ({j._categoria})</option>)}
                </select>
                <input className="form-input" placeholder="Buscar citada/o" value={busquedaNominaVisita} onChange={(e) => setBusquedaNominaVisita(e.target.value)} />
                <button className="btn-secondary" onClick={() => agregarNominaDesdeSelector({ tipo: 'visita' })}>Agregar</button>
              </div>
              {!visitaEsNuestroClub && (
                <div className="mesa-add-player mt-10">
                  <input className="form-input" placeholder="Nombre jugadora/or visita" value={nuevoNombreVisita} onChange={(e) => setNuevoNombreVisita(e.target.value)} />
                  <input className="form-input" placeholder="Dorsal" value={nuevoDorsalVisita} onChange={(e) => setNuevoDorsalVisita(e.target.value)} />
                  <button className="btn-secondary" onClick={agregarJugadorVisitaManual}>Agregar a nómina visita</button>
                </div>
              )}
              <div className="mesa-quinteto-list" style={{ marginTop: '8px' }}>
                {rosterVisitaVisible.map((j) => (
                  <div key={`row-vis-${j.id}`} className="mesa-historial-item mesa-nomina-row" style={{ background: quintetoVisitaIds.includes(j.id) ? colorConAlpha(colorVisita, '22') : undefined, borderColor: quintetoVisitaIds.includes(j.id) ? colorConAlpha(colorVisita, '99') : undefined }}>
                    <div>
                      <strong>#{j.dorsal} {j.nombre}</strong>
                      <span>{j._categoria} · {j._rama}</span>
                    </div>
                    <div className="mesa-nomina-actions">
                      <button className="btn-secondary" style={{ width: 'auto' }} onClick={() => editarDorsalJugador({ tipo: 'visita', jugadorId: j.id })}>Editar dorsal</button>
                      <button className="btn-secondary" style={{ width: 'auto' }} onClick={() => alternarNomina({ tipo: 'visita', jugadorId: j.id })}>Quitar</button>
                      <button className={`btn-secondary ${quintetoVisitaIds.includes(j.id) ? 'mesa-btn-live' : ''}`} style={{ width: 'auto' }} onClick={() => alternarTitular({ tipo: 'visita', jugadorId: j.id })}>Quinteto inicial</button>
                    </div>
                  </div>
                ))}
              </div>
              <button className="btn-secondary" style={{ width: 'auto', marginTop: '10px' }} onClick={() => validarQuinteto({ tipo: 'visita' })}>Validar quinteto visita</button>
            </div>
          )}
        </div>

        {ultimoGuardadoAt && (
          <p className="mesa-save-info">Ultima estadistica guardada: {ultimoGuardadoAt}</p>
        )}
      </div>

        </>
      )}

      {moduloMesa === 'live' && (
        <LiveWrapPortal activo={partidoIniciado && forzarPantallaCompletaLive} innerRef={liveFullScreenRef}>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '10px', gap: '8px' }}>
            <button className="btn-secondary" style={{ width: 'auto', padding: '10px 15px', fontSize: '11px', gap: '5px', borderRadius: '999px' }} onClick={activarPantallaCompletaForzada}><Expand size={14} color="var(--gris-secundario)" strokeWidth={1.5} /> Forzar Pantalla Completa</button>
            <button className="btn-secondary" style={{ width: 'auto', padding: '10px 15px', fontSize: '11px', gap: '5px', borderRadius: '999px' }} onClick={salirPantallaCompletaManual}>Salir Pantalla Completa</button>
            <button className="btn-secondary" style={{ width: 'auto', padding: '10px 15px', fontSize: '11px', gap: '5px', borderRadius: '999px' }} onClick={() => setModoChromaKey(true)}><Tv size={14} color="var(--gris-secundario)" strokeWidth={1.5} /> Modo Transmisión (OBS)</button>
          </div>

      {!partidoIniciado && (
        <div className="card mb-15" style={{ borderRadius: '16px', border: '1px solid rgba(255, 159, 10, 0.45)', background: 'rgba(255, 159, 10, 0.08)' }}>
          <strong>Juego en vivo bloqueado.</strong>
          <p style={{ margin: '6px 0 0 0', color: 'var(--texto-secundario)' }}>Debes iniciar partido desde Operadores de Mesa en el módulo de Datos partido.</p>
        </div>
      )}

      <div className="checkout-total-box mb-15" style={{ background: 'linear-gradient(180deg, #1C1C1E 0%, #101114 100%)', border: '2px solid rgba(0,122,255,0.2)', display: 'flex', flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', padding: '20px 10px', borderRadius: '24px', boxShadow: '0 16px 34px rgba(15,23,42,0.12)', opacity: partidoIniciado ? 1 : 0.65 }}>
        <div className="text-center" style={{ flex: 1, border: `1px solid ${colorConAlpha(colorLocal, '88')}`, borderRadius: '14px', padding: '10px', background: colorConAlpha(colorLocal, '14') }}>
          <span style={{ fontSize: '12px', color: colorLocal, fontWeight: '800' }}>LOCAL {liveScore.flecha === 'LOCAL' && '◀'}</span>
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px', marginTop: '8px', marginBottom: '4px' }}>
            {!!normalizarTexto(liveScore.equipoLocalLogoUrl) && <img src={liveScore.equipoLocalLogoUrl} alt={liveScore.equipoLocalNombre || 'Local'} style={{ width: '62px', height: '62px', objectFit: 'contain' }} />}
            <div style={{ textAlign: 'left' }}>
              <div style={{ color: '#d1d5db', fontSize: '12px', fontWeight: 800 }}>{liveScore.equipoLocalNombre || 'Centro de Cultura Física'}</div>
              <h1 style={{ fontSize: '52px', margin: 0, color: 'white', fontFamily: 'Orbitron' }}>{liveScore.ptsLocal}</h1>
            </div>
          </div>
          <span style={{ fontSize: '11px', color: 'var(--rojo-alerta)', fontWeight: '800', display: 'block' }}>FALTAS: {liveScore.faltasLocal}</span>
          <div style={{ display: 'flex', gap: '5px', justifyContent: 'center', marginTop: '8px' }}>
            {[...Array(3)].map((_, i) => <div key={i} style={{ width: '10px', height: '10px', borderRadius: '50%', background: i < liveScore.timeoutsLocal ? '#FFD700' : '#333' }}></div>)}
          </div>
        </div>

        <div className="text-center" style={{ flex: 1, border: `1px solid ${colorConAlpha(colorVisita, '88')}`, borderRadius: '14px', padding: '10px', background: colorConAlpha(colorVisita, '14') }}>
          <span className="mesa-competicion-chip">{filtroCompeticionActiva || 'Competición abierta'}</span>
          {!!normalizarTexto(competenciaLogoUrl) && (
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '6px' }}>
              <LogoAvatar
                nombre={filtroCompeticionActiva || 'Competencia'}
                logoUrl={competenciaLogoUrl}
                size={28}
                borderRadius="999px"
              />
            </div>
          )}
          <span style={{ fontSize: '16px', color: 'var(--verde-victoria)', fontWeight: '900', background: 'rgba(52,199,89,0.1)', padding: '8px 20px', borderRadius: '12px', border: '1px solid var(--verde-victoria)' }}>{liveScore.reloj}</span>
          <h4 style={{ margin: '10px 0 0 0', color: 'white', fontSize: '18px' }}>{etiquetaPeriodo(liveScore.periodo)}</h4>
          {normalizarTexto(canchaSede) && (
            <span style={{ display: 'block', marginTop: '8px', fontSize: '11px', color: 'var(--texto-secundario)', fontWeight: '800' }}>
              {canchaSede}
            </span>
          )}
        </div>

        <div className="text-center" style={{ flex: 1 }}>
          <span style={{ fontSize: '12px', color: colorVisita, fontWeight: '800' }}>{liveScore.flecha === 'VISITA' && '▶'} VISITA</span>
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px', marginTop: '8px', marginBottom: '4px' }}>
            {!!normalizarTexto(liveScore.equipoVisitaLogoUrl) && <img src={liveScore.equipoVisitaLogoUrl} alt={liveScore.equipoVisitaNombre || 'Visita'} style={{ width: '62px', height: '62px', objectFit: 'contain' }} />}
            <div style={{ textAlign: 'left' }}>
              <div style={{ color: '#d1d5db', fontSize: '12px', fontWeight: 800 }}>{liveScore.equipoVisitaNombre || 'Visitante'}</div>
              <h1 style={{ fontSize: '52px', margin: 0, color: 'white', fontFamily: 'Orbitron' }}>{modoAnalisis === 'dos' ? liveScore.ptsVisita : '-'}</h1>
            </div>
          </div>
          <span style={{ fontSize: '11px', color: 'var(--rojo-alerta)', fontWeight: '800', display: 'block' }}>FALTAS: {liveScore.faltasVisita}</span>
          <div style={{ display: 'flex', gap: '5px', justifyContent: 'center', marginTop: '8px' }}>
            {[...Array(3)].map((_, i) => <div key={i} style={{ width: '10px', height: '10px', borderRadius: '50%', background: i < liveScore.timeoutsVisita ? '#FFD700' : '#333' }}></div>)}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
        <button disabled={!partidoIniciado} className="btn-secondary" style={{ padding: '12px', fontSize: '12px', fontWeight: '800' }} onClick={() => setLiveScore({ ...liveScore, timeoutsLocal: Math.max(0, liveScore.timeoutsLocal - 1) })}>TM Local</button>
        <button disabled={!partidoIniciado} className="btn-secondary" style={{ padding: '12px', fontSize: '12px', background: 'var(--azul-marino)', color: 'white' }} onClick={() => setLiveScore({ ...liveScore, flecha: liveScore.flecha === 'LOCAL' ? 'VISITA' : 'LOCAL' })}><ArrowRightLeft size={16} color="var(--gris-secundario)" strokeWidth={1.5} /></button>
        <button disabled={!partidoIniciado} className="btn-secondary" style={{ padding: '12px', fontSize: '12px', fontWeight: '800' }} onClick={() => setLiveScore({ ...liveScore, timeoutsVisita: Math.max(0, liveScore.timeoutsVisita - 1) })}>TM Visita</button>
      </div>

      {cambioObligatorioJugadorId && (
        <div className="card mb-15" style={{ borderRadius: '14px', border: '1px solid rgba(255,59,48,0.5)', background: 'rgba(255,59,48,0.09)' }}>
          <strong>⚠ Cambio obligatorio pendiente por 5 faltas.</strong>
          <p style={{ margin: '6px 0 0 0', color: 'var(--texto-secundario)' }}>Selecciona la jugadora/o de salida (5 faltas) y una de banca, luego presiona Cambiar.</p>
        </div>
      )}

      {alertasRiesgoLive.length > 0 && (
        <div className="card mb-15" style={{ borderRadius: '14px', border: '1px solid rgba(255,149,0,0.5)', background: 'rgba(255,149,0,0.08)' }}>
          <strong>Alertas automáticas en vivo</strong>
          {alertasRiesgoLive.slice(0, 5).map((alerta, idx) => (
            <p key={`alerta-live-${idx}`} style={{ margin: '6px 0 0 0', color: 'var(--texto-secundario)' }}>{alerta.texto}</p>
          ))}
        </div>
      )}

      {mostrarModalCambioObligatorio && jugadorCambioObligatorio && (
        <div className="mesa-cambio-obligatorio-overlay">
          <div className="mesa-cambio-obligatorio-card">
            <h5 style={{ margin: 0, color: 'var(--rojo-alerta)' }}>Cambio Obligatorio ({cambioObligatorioEquipo === 'visita' ? 'Visita' : 'Local'})</h5>
            <p style={{ margin: '8px 0 0 0' }}>
              #{jugadorCambioObligatorio.dorsal} {jugadorCambioObligatorio.nombre} debe salir de cancha. Toca a la jugadora/or de banca que entra:
            </p>
            <div className="mesa-cambio-obligatorio-banco-grid mt-10">
              {bancoParaCambioObligatorio.map((j) => (
                <button
                  type="button"
                  key={`reemplazo-${j.id}`}
                  className={`mesa-banco-btn ${String(cambioObligatorioIngresoId) === String(j.id) ? 'selected' : ''}`}
                  onClick={() => setCambioObligatorioIngresoId(j.id)}
                  style={{
                    borderColor: cambioObligatorioEquipo === 'visita' ? colorVisita : colorLocal,
                    background: cambioObligatorioEquipo === 'visita' ? colorVisita : colorLocal,
                    color: colorTextoContraste(cambioObligatorioEquipo === 'visita' ? colorVisita : colorLocal),
                  }}
                >
                  <span className="mesa-banco-dorsal mesa-banco-dorsal-flat" style={{ color: colorTextoContraste(cambioObligatorioEquipo === 'visita' ? colorVisita : colorLocal) }}>#{j.dorsal}</span>
                  <span style={{ fontSize: '11px', fontWeight: '700' }}>{j.nombre}</span>
                </button>
              ))}
              {bancoParaCambioObligatorio.length === 0 && <p className="text-muted" style={{ margin: 0 }}>Sin jugadoras/es disponibles en banca.</p>}
            </div>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '10px' }}>
              <button className="btn-secondary" style={{ width: 'auto' }} disabled={!cambioObligatorioIngresoId} onClick={confirmarCambioObligatorio}>Confirmar cambio</button>
            </div>
          </div>
        </div>
      )}

      <div className="caja-doble-grid landscape-mode mesa-live-layout-grid">
        <div className="card mesa-team-card mesa-live-zone-local" style={{ padding: '15px', borderRadius: '24px' }}>
          <h5 className="sub-caja-title">Roster Local ({rosterLocal.length}/{LIMITE_JUGADORES_POR_EQUIPO})</h5>
          <div className="mesa-team-split-grid">
            <div className="mesa-team-col mesa-team-col-interior">
              <h6 className="sub-caja-title" style={{ marginTop: 0, fontSize: '12px' }}>En Cancha (5) · Local</h6>
              <div className="mesa-oncourt-grid mesa-oncourt-grid-two-cols">
                {quintetoLocalEnCancha.map((j) => (
                  <button
                    key={`cancha-${j.id}`}
                    type="button"
                    title={`#${j.dorsal} ${j.nombre}`}
                    onClick={() => {
                      if (j._bloqueado || j.expulsado || numero(j.flt) >= 5) return;
                      setJugadorSeleccionadoLive(j.id);
                      setEquipoAccionActivo('local');
                      setCambioSalidaId(j.id);
                    }}
                    className={`mesa-oncourt-btn mesa-oncourt-main-btn ${jugadorSeleccionadoLive === j.id ? 'selected' : ''} ${j._bloqueado || j.expulsado || numero(j.flt) >= 5 ? 'bloqueado' : ''}`}
                    style={{
                      borderColor: colorLocal,
                      background: colorLocal,
                      color: colorTextoContraste(colorLocal),
                    }}
                  >
                    <span className="mesa-oncourt-dorsal mesa-oncourt-dorsal-flat" style={{ color: colorTextoContraste(colorLocal) }}>#{j.dorsal}</span>
                  </button>
                ))}
                {Array.from({ length: Math.max(0, 5 - quintetoLocalEnCancha.length) }).map((_, idx) => (
                  <div key={`vacante-${idx}`} className="mesa-oncourt-btn mesa-oncourt-empty" style={{ borderColor: colorConAlpha(colorLocal, '88'), background: colorConAlpha(colorLocal, '22') }}>
                    <span className="mesa-oncourt-dorsal mesa-oncourt-dorsal-flat" style={{ color: 'var(--texto-secundario)' }}>--</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="mesa-team-col mesa-team-col-exterior">
              <h6 className="sub-caja-title" style={{ marginTop: 0, fontSize: '12px' }}>Banco Local ({bancoLocal.length})</h6>
              <div className="mesa-banco-grid">
                {bancoLocal.map((j) => {
                  const bloqueada = j._bloqueado || j.expulsado || numero(j.flt) >= 5;
                  return (
                    <button
                      key={`banca-${j.id}`}
                      type="button"
                      disabled={bloqueada}
                      className={`mesa-banco-btn ${cambioIngresoId === j.id ? 'selected' : ''} ${bloqueada ? 'bloqueado' : ''}`}
                      onClick={() => { if (!bloqueada) setCambioIngresoId(j.id); }}
                      title={bloqueada ? 'No disponible (expulsada/o o bloqueada/o)' : 'Seleccionar para ingreso'}
                      style={{ borderColor: colorLocal, background: colorLocal, color: colorTextoContraste(colorLocal) }}
                    >
                      <span className="mesa-banco-dorsal mesa-banco-dorsal-flat" style={{ color: colorTextoContraste(colorLocal) }}>#{j.dorsal}</span>
                    </button>
                  );
                })}
                {bancoLocal.length === 0 && <p className="text-muted" style={{ margin: 0 }}>Sin jugadoras/es de banca.</p>}
              </div>
            </div>
          </div>
          <div className="mesa-visitor-actions mesa-cambio-sutil mt-10">
            <h6>Cambio Local (en cancha ↔ banco)</h6>
            <select className="form-input" value={cambioSalidaId} onChange={(e) => setCambioSalidaId(e.target.value)}>
              <option value="">Selecciona quién sale...</option>
              {quintetoLocalEnCancha.map((j) => (
                <option key={`sale-local-${j.id}`} value={j.id}>#{j.dorsal} {j.nombre}</option>
              ))}
            </select>
            <select className="form-input" value={cambioIngresoId} onChange={(e) => setCambioIngresoId(e.target.value)}>
              <option value="">Selecciona quién entra...</option>
              {bancoLocal.filter((j) => !j._bloqueado && !j.expulsado && numero(j.flt) < 5).map((j) => (
                <option key={`entra-local-${j.id}`} value={j.id}>#{j.dorsal} {j.nombre}</option>
              ))}
            </select>
            <button className="btn-cambio-sutil" disabled={!partidoIniciado || !cambioSalidaId || !cambioIngresoId} onClick={() => ejecutarCambioJugador('local', cambioSalidaId, cambioIngresoId)}>Cambiar</button>
          </div>
        </div>

        {modoAnalisis === 'dos' && (
          <div className="card mesa-team-card mesa-live-zone-visit" style={{ padding: '15px', borderRadius: '24px' }}>
            <h5 className="sub-caja-title">Roster Visita ({rosterVisita.length}/{LIMITE_JUGADORES_POR_EQUIPO})</h5>
            <div className="mesa-team-split-grid">
              <div className="mesa-team-col mesa-team-col-interior">
                <h6 className="sub-caja-title" style={{ marginTop: 0, fontSize: '12px' }}>En Cancha (5) · Visita</h6>
                <div className="mesa-oncourt-grid mesa-oncourt-grid-two-cols">
                  {quintetoVisitaEnCancha.map((j) => (
                    <button
                      key={`cancha-visita-${j.id}`}
                      type="button"
                      title={`#${j.dorsal} ${j.nombre}`}
                      className={`mesa-oncourt-btn mesa-oncourt-main-btn ${String(jugadorVisitaSeleccionadoId) === String(j.id) ? 'selected' : ''} ${j._bloqueado || j.expulsado || numero(j.flt) >= 5 ? 'bloqueado' : ''}`}
                      onClick={() => {
                        if (j._bloqueado || j.expulsado || numero(j.flt) >= 5) return;
                        setJugadorVisitaSeleccionadoId(j.id);
                        setEquipoAccionActivo('visita');
                        setCambioSalidaVisitaId(j.id);
                      }}
                      style={{
                        borderColor: colorVisita,
                        background: colorVisita,
                        color: colorTextoContraste(colorVisita),
                      }}
                    >
                      <span className="mesa-oncourt-dorsal mesa-oncourt-dorsal-flat" style={{ color: colorTextoContraste(colorVisita) }}>#{j.dorsal}</span>
                    </button>
                  ))}
                  {Array.from({ length: Math.max(0, 5 - quintetoVisitaEnCancha.length) }).map((_, idx) => (
                    <div key={`vacante-visita-${idx}`} className="mesa-oncourt-btn mesa-oncourt-empty" style={{ borderColor: colorConAlpha(colorVisita, '88'), background: colorConAlpha(colorVisita, '22') }}>
                      <span className="mesa-oncourt-dorsal mesa-oncourt-dorsal-flat" style={{ color: 'var(--texto-secundario)' }}>--</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mesa-team-col mesa-team-col-exterior">
                <h6 className="sub-caja-title" style={{ marginTop: 0, fontSize: '12px' }}>Banco Visita ({bancoVisita.length})</h6>
                <div className="mesa-banco-grid">
                  {bancoVisita.map((j) => {
                    const bloqueada = j._bloqueado || j.expulsado || numero(j.flt) >= 5;
                    return (
                      <button
                        key={`banca-visita-${j.id}`}
                        type="button"
                        disabled={bloqueada}
                        className={`mesa-banco-btn ${cambioIngresoVisitaId === j.id ? 'selected' : ''} ${bloqueada ? 'bloqueado' : ''}`}
                        onClick={() => { if (!bloqueada) setCambioIngresoVisitaId(j.id); }}
                        title={bloqueada ? 'No disponible (expulsada/o o bloqueada/o)' : 'Seleccionar para ingreso'}
                        style={{ borderColor: colorVisita, background: colorVisita, color: colorTextoContraste(colorVisita) }}
                      >
                        <span className="mesa-banco-dorsal mesa-banco-dorsal-flat" style={{ color: colorTextoContraste(colorVisita) }}>#{j.dorsal}</span>
                      </button>
                    );
                  })}
                  {bancoVisita.length === 0 && <p className="text-muted" style={{ margin: 0 }}>Sin jugadoras/es de banca.</p>}
                </div>
              </div>
            </div>
            <div className="mesa-visitor-actions mesa-cambio-sutil mt-10">
              <h6>Cambio Visita (en cancha ↔ banco)</h6>
              <select className="form-input" value={cambioSalidaVisitaId} onChange={(e) => setCambioSalidaVisitaId(e.target.value)}>
                <option value="">Selecciona quién sale...</option>
                {quintetoVisitaEnCancha.map((j) => (
                  <option key={`sale-visita-${j.id}`} value={j.id}>#{j.dorsal} {j.nombre}</option>
                ))}
              </select>
              <select className="form-input" value={cambioIngresoVisitaId} onChange={(e) => setCambioIngresoVisitaId(e.target.value)}>
                <option value="">Selecciona quién entra...</option>
                {bancoVisita.filter((j) => !j._bloqueado && !j.expulsado && numero(j.flt) < 5).map((j) => (
                  <option key={`entra-visita-${j.id}`} value={j.id}>#{j.dorsal} {j.nombre}</option>
                ))}
              </select>
              <button className="btn-cambio-sutil" disabled={!partidoIniciado || !cambioSalidaVisitaId || !cambioIngresoVisitaId} onClick={() => ejecutarCambioJugador('visita', cambioSalidaVisitaId, cambioIngresoVisitaId)}>Cambiar</button>
            </div>
          </div>
        )}

        <div className="card mesa-live-zone-center" style={{ padding: '20px', borderRadius: '24px' }}>
          <div className="mesa-control-tiempo-card">
            <h6>Control de Partido</h6>
            <div className="mesa-control-tiempo-meta">{etiquetaPeriodo(liveScore.periodo)} · {liveScore.reloj}</div>
            <div className="mesa-control-tiempo-grid-central">
              <div className="mesa-control-tiempo-lado">
                <button className="btn-secondary" disabled={!partidoIniciado} onClick={() => ajustarRelojLive(60)}>+1:00</button>
                <button className="btn-secondary" disabled={!partidoIniciado} onClick={() => ajustarRelojLive(-60)}>-1:00</button>
              </div>
              <button className="btn-electric mesa-btn-reloj-principal" disabled={!partidoIniciado} onClick={alternarCronometro}>{cronometroActivo ? '⏸ Pausar' : '▶ Iniciar'}</button>
              <div className="mesa-control-tiempo-lado">
                <button className="btn-secondary" disabled={!partidoIniciado} onClick={() => cambiarPeriodoLive(-1)}>Periodo -</button>
                <button className="btn-secondary" disabled={!partidoIniciado} onClick={() => cambiarPeriodoLive(1)}>Periodo +</button>
              </div>
            </div>
          </div>

          {modoAnalisis === 'dos' && (
            <div className="mesa-actions-segmented">
              <button
                type="button"
                className={`mesa-actions-segment ${equipoAccionActivo === 'local' ? 'active' : ''}`}
                onClick={() => {
                  setEquipoAccionActivo('local');
                  setMostrarOpcionesTLVisita(false);
                }}
              >
                Acciones Local
              </button>
              <button
                type="button"
                className={`mesa-actions-segment ${equipoAccionActivo === 'visita' ? 'active' : ''}`}
                onClick={() => {
                  setEquipoAccionActivo('visita');
                  setMostrarOpcionesTL(false);
                }}
              >
                Acciones Visita
              </button>
            </div>
          )}

          {accionEquipoEsVisita && (
            <select
              className="form-input"
              style={{ marginBottom: '8px' }}
              value={jugadorVisitaSeleccionadoId}
              onChange={(e) => {
                setJugadorVisitaSeleccionadoId(e.target.value);
                setEquipoAccionActivo('visita');
              }}
            >
              <option value="">Seleccionar jugadora/or visita...</option>
              {(quintetoVisitaEnCancha.length > 0 ? quintetoVisitaEnCancha : rosterVisita).map((j) => (
                <option key={`sel-vis-${j.id}`} value={j.id}>#{j.dorsal} {j.nombre}</option>
              ))}
            </select>
          )}

          <h5 className="sub-caja-title text-center" style={{ color: jugadorAccionSeleccionadoValido ? 'var(--verde-victoria)' : 'var(--rojo-alerta)' }}>
            {jugadorAccionSeleccionadoValido ? `Control de Acciones (${accionEquipoEsVisita ? 'Visita' : 'Local'})` : `Seleccione Jugador/a en Cancha (${accionEquipoEsVisita ? 'Visita' : 'Local'})`}
          </h5>

          <div className="fiba-botones-grid">
            <button
              className="btn-fiba pt"
              disabled={!jugadorAccionSeleccionadoValido || !partidoIniciado}
              onClick={() => {
                if (accionEquipoEsVisita) setMostrarOpcionesTLVisita((v) => !v);
                else setMostrarOpcionesTL((v) => !v);
              }}
            >
              Tiro Libre
            </button>
            <button className="btn-fiba pt" disabled={!jugadorAccionSeleccionadoValido || !partidoIniciado} onClick={() => ejecutarAccionEquipoActivo('PUNTO', { puntos: 2 })}>+2 PTS</button>
            <button className="btn-fiba pt" disabled={!jugadorAccionSeleccionadoValido || !partidoIniciado} onClick={() => ejecutarAccionEquipoActivo('PUNTO', { puntos: 3 })}>+3 PTS</button>
            <button className="btn-fiba st" disabled={!jugadorAccionSeleccionadoValido || !partidoIniciado} onClick={() => ejecutarAccionEquipoActivo('REB')}>REB</button>
            <button className="btn-fiba st" disabled={!jugadorAccionSeleccionadoValido || !partidoIniciado} onClick={() => ejecutarAccionEquipoActivo('AST')}>AST</button>
            <button className="btn-fiba st" disabled={!jugadorAccionSeleccionadoValido || !partidoIniciado} onClick={() => ejecutarAccionEquipoActivo('ROBO')}>ROBO</button>
            <button className="btn-fiba err" disabled={!jugadorAccionSeleccionadoValido || !partidoIniciado} onClick={() => ejecutarAccionEquipoActivo('PERDIDA')}>PÉRDIDA</button>
            <button className="btn-fiba err" disabled={!jugadorAccionSeleccionadoValido || !partidoIniciado} onClick={() => setMostrarSelectorTipoFalta((v) => !v)}>FALTA</button>
          </div>

          {mostrarSelectorTipoFalta && (
            <div className="mesa-tipo-falta-panel mt-10">
              <span className="mesa-tipo-falta-titulo">Tipo de falta</span>
              <div className="mesa-tipo-falta-grid">
                <button type="button" className="btn-secondary" onClick={() => { ejecutarAccionEquipoActivo('FALTA', { tipoFalta: TIPOS_FALTA.PERSONAL }); setMostrarSelectorTipoFalta(false); }}>Personal</button>
                <button type="button" className="btn-secondary" onClick={() => { ejecutarAccionEquipoActivo('FALTA', { tipoFalta: TIPOS_FALTA.TECNICA }); setMostrarSelectorTipoFalta(false); }}>Técnica</button>
                <button type="button" className="btn-secondary" onClick={() => { ejecutarAccionEquipoActivo('FALTA', { tipoFalta: TIPOS_FALTA.ANTIDEPORTIVA }); setMostrarSelectorTipoFalta(false); }}>Antideportiva</button>
                <button type="button" className="btn-secondary" style={{ color: 'var(--rojo-alerta)' }} onClick={() => { ejecutarAccionEquipoActivo('FALTA', { tipoFalta: TIPOS_FALTA.DESCALIFICANTE }); setMostrarSelectorTipoFalta(false); }}>Descalificante</button>
              </div>
              <p className="text-muted" style={{ fontSize: '11px', margin: '6px 0 0' }}>Técnica y antideportiva también suman como falta personal. 2 técnicas, 2 antideportivas o 1 descalificante = expulsión.</p>
            </div>
          )}

          {mostrarOpcionesTL && !accionEquipoEsVisita && (
            <div className="mesa-tl-options-panel">
              <h6>Opciones de Tiro Libre</h6>
              <div className="mesa-tl-options-grid">
                <button className="btn-secondary" onClick={() => { ejecutarAccionEquipoActivo('PUNTO', { puntos: 0, tirosLibresIntentados: 2, tirosLibresConvertidos: 0 }); setMostrarOpcionesTL(false); }}>2 TL (0/2)</button>
                <button className="btn-secondary" onClick={() => { ejecutarAccionEquipoActivo('PUNTO', { puntos: 0, tirosLibresIntentados: 2, tirosLibresConvertidos: 1 }); setMostrarOpcionesTL(false); }}>2 TL (1/2)</button>
                <button className="btn-secondary" onClick={() => { ejecutarAccionEquipoActivo('PUNTO', { puntos: 0, tirosLibresIntentados: 2, tirosLibresConvertidos: 2 }); setMostrarOpcionesTL(false); }}>2 TL (2/2)</button>
                <button className="btn-secondary" onClick={() => { ejecutarAccionEquipoActivo('PUNTO', { puntos: 2, tirosLibresIntentados: 1, tirosLibresConvertidos: 0 }); setMostrarOpcionesTL(false); }}>2+1 (TL fallado)</button>
                <button className="btn-secondary" onClick={() => { ejecutarAccionEquipoActivo('PUNTO', { puntos: 2, tirosLibresIntentados: 1, tirosLibresConvertidos: 1 }); setMostrarOpcionesTL(false); }}>2+1 (TL convertido)</button>
                <button className="btn-secondary" onClick={() => { ejecutarAccionEquipoActivo('PUNTO', { puntos: 3, tirosLibresIntentados: 1, tirosLibresConvertidos: 1 }); setMostrarOpcionesTL(false); }}>3+1 (TL convertido)</button>
                <button className="btn-secondary" onClick={() => { ejecutarAccionEquipoActivo('PUNTO', { puntos: 0, tirosLibresIntentados: 3, tirosLibresConvertidos: 0 }); setMostrarOpcionesTL(false); }}>3 TL (0/3)</button>
                <button className="btn-secondary" onClick={() => { ejecutarAccionEquipoActivo('PUNTO', { puntos: 0, tirosLibresIntentados: 3, tirosLibresConvertidos: 1 }); setMostrarOpcionesTL(false); }}>3 TL (1/3)</button>
                <button className="btn-secondary" onClick={() => { ejecutarAccionEquipoActivo('PUNTO', { puntos: 0, tirosLibresIntentados: 3, tirosLibresConvertidos: 2 }); setMostrarOpcionesTL(false); }}>3 TL (2/3)</button>
                <button className="btn-secondary" onClick={() => { ejecutarAccionEquipoActivo('PUNTO', { puntos: 0, tirosLibresIntentados: 3, tirosLibresConvertidos: 3 }); setMostrarOpcionesTL(false); }}>3 TL (3/3)</button>
              </div>
            </div>
          )}

          {mostrarOpcionesTLVisita && accionEquipoEsVisita && (
            <div className="mesa-tl-options-panel">
              <h6>Opciones TL Visita</h6>
              <div className="mesa-tl-options-grid">
                <button className="btn-secondary" onClick={() => { ejecutarAccionEquipoActivo('PUNTO', { puntos: 0, tirosLibresIntentados: 2, tirosLibresConvertidos: 0 }); setMostrarOpcionesTLVisita(false); }}>2 TL (0/2)</button>
                <button className="btn-secondary" onClick={() => { ejecutarAccionEquipoActivo('PUNTO', { puntos: 0, tirosLibresIntentados: 2, tirosLibresConvertidos: 1 }); setMostrarOpcionesTLVisita(false); }}>2 TL (1/2)</button>
                <button className="btn-secondary" onClick={() => { ejecutarAccionEquipoActivo('PUNTO', { puntos: 0, tirosLibresIntentados: 2, tirosLibresConvertidos: 2 }); setMostrarOpcionesTLVisita(false); }}>2 TL (2/2)</button>
                <button className="btn-secondary" onClick={() => { ejecutarAccionEquipoActivo('PUNTO', { puntos: 2, tirosLibresIntentados: 1, tirosLibresConvertidos: 0 }); setMostrarOpcionesTLVisita(false); }}>2+1 (TL fallado)</button>
                <button className="btn-secondary" onClick={() => { ejecutarAccionEquipoActivo('PUNTO', { puntos: 2, tirosLibresIntentados: 1, tirosLibresConvertidos: 1 }); setMostrarOpcionesTLVisita(false); }}>2+1 (TL convertido)</button>
                <button className="btn-secondary" onClick={() => { ejecutarAccionEquipoActivo('PUNTO', { puntos: 3, tirosLibresIntentados: 1, tirosLibresConvertidos: 1 }); setMostrarOpcionesTLVisita(false); }}>3+1 (TL convertido)</button>
                <button className="btn-secondary" onClick={() => { ejecutarAccionEquipoActivo('PUNTO', { puntos: 0, tirosLibresIntentados: 3, tirosLibresConvertidos: 0 }); setMostrarOpcionesTLVisita(false); }}>3 TL (0/3)</button>
                <button className="btn-secondary" onClick={() => { ejecutarAccionEquipoActivo('PUNTO', { puntos: 0, tirosLibresIntentados: 3, tirosLibresConvertidos: 1 }); setMostrarOpcionesTLVisita(false); }}>3 TL (1/3)</button>
                <button className="btn-secondary" onClick={() => { ejecutarAccionEquipoActivo('PUNTO', { puntos: 0, tirosLibresIntentados: 3, tirosLibresConvertidos: 2 }); setMostrarOpcionesTLVisita(false); }}>3 TL (2/3)</button>
                <button className="btn-secondary" onClick={() => { ejecutarAccionEquipoActivo('PUNTO', { puntos: 0, tirosLibresIntentados: 3, tirosLibresConvertidos: 3 }); setMostrarOpcionesTLVisita(false); }}>3 TL (3/3)</button>
              </div>
            </div>
          )}
        </div>

      </div>
        </LiveWrapPortal>
      )}

      {moduloMesa === 'analitica' && (
      <>
      <div className="card mt-20" style={{ borderRadius: '24px' }}>
        <h4 className="form-subtitle" style={{ fontWeight: '900' }}><Shield size={16} color="var(--gris-secundario)" strokeWidth={1.5} /> Seguimiento Estadístico (Eficiencia)</h4>
        <div className="mesa-stats-grid">
          <div className="mesa-stats-box">
            <h6>{equipoLocal?.nombre || 'Local'}</h6>
            <p>EFF Equipo: <strong>{resumenLocal.effTotal}</strong> | Promedio: <strong>{resumenLocal.jugadores ? (resumenLocal.effTotal / resumenLocal.jugadores).toFixed(1) : '0.0'}</strong></p>
            <p>PTS: {resumenLocal.pts} | REB: {resumenLocal.reb} | AST: {resumenLocal.ast} | STL: {resumenLocal.stl}</p>
            <p>TL: {resumenLocal.ftm}/{resumenLocal.fta} ({formatoPct(resumenLocal.ftm, resumenLocal.fta)})</p>
            <p>T2: {resumenLocal.fg2m}/{resumenLocal.fg2a} ({formatoPct(resumenLocal.fg2m, resumenLocal.fg2a)}) · T3: {resumenLocal.fg3m}/{resumenLocal.fg3a} ({formatoPct(resumenLocal.fg3m, resumenLocal.fg3a)})</p>
          </div>
          {modoAnalisis === 'dos' && (
            <div className="mesa-stats-box">
              <h6>{equipoVisita?.nombre || 'Visita'}</h6>
              <p>EFF Equipo: <strong>{resumenVisita.effTotal}</strong> | Promedio: <strong>{resumenVisita.jugadores ? (resumenVisita.effTotal / resumenVisita.jugadores).toFixed(1) : '0.0'}</strong></p>
              <p>PTS: {resumenVisita.pts} | REB: {resumenVisita.reb} | AST: {resumenVisita.ast} | STL: {resumenVisita.stl}</p>
              <p>TL: {resumenVisita.ftm}/{resumenVisita.fta} ({formatoPct(resumenVisita.ftm, resumenVisita.fta)})</p>
              <p>T2: {resumenVisita.fg2m}/{resumenVisita.fg2a} ({formatoPct(resumenVisita.fg2m, resumenVisita.fg2a)}) · T3: {resumenVisita.fg3m}/{resumenVisita.fg3a} ({formatoPct(resumenVisita.fg3m, resumenVisita.fg3a)})</p>
            </div>
          )}
        </div>

        <div className="mesa-stats-tables">
          <div className="mesa-stats-table">
            <h6>Ranking Local</h6>
            {topEficienciaLocal.length === 0 ? (
              <p className="text-muted">Sin datos locales.</p>
            ) : (
              topEficienciaLocal.map((j, idx) => (
                <div key={j.id} className="mesa-stats-row">
                  <span>#{idx + 1} #{j.dorsal} {j.nombre}</span>
                  <strong>EFF {calcularEff(j)}</strong>
                </div>
              ))
            )}
          </div>

          {modoAnalisis === 'dos' && (
            <div className="mesa-stats-table">
              <h6>Ranking Visita</h6>
              {topEficienciaVisita.length === 0 ? (
                <p className="text-muted">Sin datos de visita.</p>
              ) : (
                topEficienciaVisita.map((j, idx) => (
                  <div key={j.id} className="mesa-stats-row">
                    <span>#{idx + 1} #{j.dorsal} {j.nombre}</span>
                    <strong>EFF {calcularEff(j)}</strong>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        <div className="mesa-stats-tables" style={{ marginTop: '10px' }}>
          <div className="mesa-stats-table">
            <h6>Vista Individual Detallada (Local)</h6>
            <label className="mesa-filter-item" style={{ marginBottom: '10px' }}>
              <span>Seleccionar jugadora/or</span>
              <select className="form-input" value={jugadorAnalisisId} onChange={(e) => setJugadorAnalisisId(e.target.value)}>
                {jugadoresAnaliticaLocal.map((j) => <option key={`ana-j-${j.id}`} value={j.id}>#{j.dorsal} {j.nombre}</option>)}
              </select>
            </label>
            {jugadorAnalisisSeleccionado ? (
              <>
                <div className="mesa-stats-row"><span>EFF</span><strong>{calcularEff(jugadorAnalisisSeleccionado)}</strong></div>
                <div className="mesa-stats-row"><span>PTS / REB / AST / STL / TO</span><strong>{Number(jugadorAnalisisSeleccionado.pts || 0)} / {Number(jugadorAnalisisSeleccionado.reb || 0)} / {Number(jugadorAnalisisSeleccionado.ast || 0)} / {Number(jugadorAnalisisSeleccionado.stl || 0)} / {Number(jugadorAnalisisSeleccionado.to || 0)}</strong></div>
                <div className="mesa-stats-row"><span>TL</span><strong>{Number(jugadorAnalisisSeleccionado.ftm || 0)}/{Number(jugadorAnalisisSeleccionado.fta || 0)} ({formatoPct(Number(jugadorAnalisisSeleccionado.ftm || 0), Number(jugadorAnalisisSeleccionado.fta || 0))})</strong></div>
                <div className="mesa-stats-row"><span>T2</span><strong>{Number(jugadorAnalisisSeleccionado.fg2m || 0)}/{Number(jugadorAnalisisSeleccionado.fg2a || 0)} ({formatoPct(Number(jugadorAnalisisSeleccionado.fg2m || 0), Number(jugadorAnalisisSeleccionado.fg2a || 0))})</strong></div>
                <div className="mesa-stats-row"><span>T3</span><strong>{Number(jugadorAnalisisSeleccionado.fg3m || 0)}/{Number(jugadorAnalisisSeleccionado.fg3a || 0)} ({formatoPct(Number(jugadorAnalisisSeleccionado.fg3m || 0), Number(jugadorAnalisisSeleccionado.fg3a || 0))})</strong></div>
              </>
            ) : (
              <p className="text-muted">Sin jugadoras/es locales en análisis.</p>
            )}
          </div>

          <div className="mesa-stats-table">
            <h6>Tendencia por Período (actual)</h6>
            {analisisPorPeriodo.length === 0 ? (
              <p className="text-muted">Aún no hay eventos por período.</p>
            ) : (
              analisisPorPeriodo.map((q) => (
                <div key={`periodo-${q.periodo}`} className="mesa-stats-row">
                  <span>{etiquetaPeriodo(q.periodo)} · Ev {q.eventos} · Faltas {q.faltasLocal}/{q.faltasVisita}</span>
                  <strong>{q.ptsLocal} - {q.ptsVisita}</strong>
                </div>
              ))
            )}
          </div>

          <div className="mesa-stats-table">
            <h6>Clutch (Q4+, últimos 2:00)</h6>
            <div className="mesa-stats-row"><span>Eventos clutch</span><strong>{analisisClutch.eventos}</strong></div>
            <div className="mesa-stats-row"><span>Puntos Local / Visita</span><strong>{analisisClutch.localPts} / {analisisClutch.visitaPts}</strong></div>
            <div className="mesa-stats-row"><span>Diferencial clutch</span><strong>{analisisClutch.diferencial > 0 ? '+' : ''}{analisisClutch.diferencial}</strong></div>
            <div className="mesa-stats-row"><span>Faltas clutch L/V</span><strong>{analisisClutch.faltasLocalClutch} / {analisisClutch.faltasVisitaClutch}</strong></div>
          </div>

          <div className="mesa-stats-table">
            <h6>Impacto de Quintetos (top)</h6>
            {impactoQuintetos.length === 0 ? (
              <p className="text-muted">Aún no hay datos de quintetos.</p>
            ) : (
              impactoQuintetos.map((item, idx) => (
                <div key={`lineup-${item.key}-${idx}`} className="mesa-stats-row">
                  <span>#{idx + 1} · Ev {item.eventos} · F {item.faltas} · PF/PC {item.puntos}/{item.puntosContra}</span>
                  <strong>ORtg {item.ortg.toFixed(1)} · DRtg {item.drtg.toFixed(1)} · Net {item.netRating > 0 ? '+' : ''}{item.netRating.toFixed(1)}</strong>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="card mt-20 mesa-historial-card" style={{ borderRadius: '24px' }}>
        <h4 className="form-subtitle" style={{ fontWeight: '900' }}><FileText size={16} color="var(--gris-secundario)" strokeWidth={1.5} /> Historial de Partidos Guardados</h4>
        {historialCombinado.length === 0 ? (
          <p className="text-muted" style={{ marginBottom: 0 }}>Aun no hay partidos guardados en historial local o backend.</p>
        ) : (
          <div className="mesa-historial-list">
            {historialCombinado.slice(0, 8).map((partido) => (
              <div
                key={partido.id}
                className={`mesa-historial-item ${String(partidoAnalisisId || partidoAnalisisSeleccionado?.id || '') === String(partido.id) ? 'active' : ''}`}
                onClick={() => setPartidoAnalisisId(partido.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter') setPartidoAnalisisId(partido.id); }}
              >
                <div>
                  <strong>{partido.equipos?.local?.nombre || 'Local'} vs {partido.equipos?.visita?.nombre || 'Visita'}</strong>
                  <span>{partido.finalizadoAt ? new Date(partido.finalizadoAt).toLocaleString('es-CL') : 'Sin fecha'} · {partido.filtros?.rama || 'Rama'} · {partido.filtros?.categoria || 'Categoria'} · {partido._origen === 'remoto' ? 'Backend' : 'Local'}</span>
                </div>
                <div className="mesa-historial-score">
                  <strong>{partido.marcador?.ptsLocal ?? 0} - {partido.marcador?.ptsVisita ?? 0}</strong>
                  <span>{partido.equipos?.local?.resumen?.effTotal ?? 0} EFF / {partido.equipos?.visita?.resumen?.effTotal ?? 0} EFF</span>
                </div>
                <div className="mesa-historial-actions">
                  <button className="btn-secondary" style={{ width: 'auto' }} onClick={(e) => { e.stopPropagation(); editarPartidoHistorial(partido); }}>Editar</button>
                  <button className="btn-secondary" style={{ width: 'auto' }} onClick={(e) => { e.stopPropagation(); eliminarPartidoHistorial(partido); }}>Eliminar</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card mt-20" style={{ borderRadius: '24px' }}>
        <h4 className="form-subtitle" style={{ fontWeight: '900' }}><Shield size={16} color="var(--gris-secundario)" strokeWidth={1.5} /> Analítica Histórica Comparativa</h4>
        <div className="mesa-stats-grid">
          <div className="mesa-stats-box">
            <h6>Rendimiento Global</h6>
            <p>Partidos: <strong>{resumenHistoricoComparativo.partidos}</strong></p>
            <p>Victorias: <strong>{resumenHistoricoComparativo.victorias}</strong> · Derrotas: <strong>{resumenHistoricoComparativo.derrotas}</strong></p>
            <p>PF/PC: <strong>{resumenHistoricoComparativo.promedioFavor.toFixed(1)}</strong> / <strong>{resumenHistoricoComparativo.promedioContra.toFixed(1)}</strong></p>
          </div>
          <div className="mesa-stats-box">
            <h6>Rival Frecuente</h6>
            <p><strong>{resumenHistoricoComparativo.rivalTop || 'Sin datos'}</strong></p>
            <p>Competencia activa: <strong>{filtroCompeticionActiva || 'Todas'}</strong></p>
            <p>Cancha/Sede: <strong>{canchaSede || 'No definida'}</strong></p>
          </div>
        </div>

        {partidoAnalisisSeleccionado && (
          <div className="mesa-stats-tables">
            <div className="mesa-stats-table">
              <h6>Detalle Partido Seleccionado</h6>
              <div className="mesa-stats-row"><span>Encuentro</span><strong>{partidoAnalisisSeleccionado.equipos?.local?.nombre || 'Local'} vs {partidoAnalisisSeleccionado.equipos?.visita?.nombre || 'Visita'}</strong></div>
              <div className="mesa-stats-row"><span>Marcador</span><strong>{partidoAnalisisSeleccionado.marcador?.ptsLocal ?? 0} - {partidoAnalisisSeleccionado.marcador?.ptsVisita ?? 0}</strong></div>
              <div className="mesa-stats-row"><span>Rama/Categoría</span><strong>{partidoAnalisisSeleccionado.filtros?.rama || 'Rama'} · {partidoAnalisisSeleccionado.filtros?.categoria || 'Categoría'}</strong></div>
              <div className="mesa-stats-row"><span>Sede</span><strong>{partidoAnalisisSeleccionado.canchaSede || 'No registrada'}</strong></div>
            </div>
            <div className="mesa-stats-table">
              <h6>Trazabilidad Operadores</h6>
              <div className="mesa-stats-row"><span>Planillero/a</span><strong>{partidoAnalisisSeleccionado.operadores?.planillero || 'Sin registro'}</strong></div>
              <div className="mesa-stats-row"><span>Estadístico/a</span><strong>{partidoAnalisisSeleccionado.operadores?.estadistico || 'Sin registro'}</strong></div>
              <div className="mesa-stats-row"><span>Supervisor/a</span><strong>{partidoAnalisisSeleccionado.operadores?.supervisor || 'Sin registro'}</strong></div>
              <div className="mesa-stats-row"><span>Eventos registrados</span><strong>{(partidoAnalisisSeleccionado.eventos || []).length}</strong></div>
            </div>

            <div className="mesa-stats-table">
              <h6>Jugadoras/es Local</h6>
              {(partidoAnalisisSeleccionado.equipos?.local?.roster || []).length === 0 ? (
                <p className="text-muted">Sin detalle individual local.</p>
              ) : (
                (partidoAnalisisSeleccionado.equipos?.local?.roster || []).slice(0, 12).map((j) => (
                  <div key={`local-${partidoAnalisisSeleccionado.id}-${j.id || j.dorsal || j.nombre}`} className="mesa-stats-row">
                    <span>#{j.dorsal || '-'} {j.nombre || 'Jugador/a'}</span>
                    <strong>{Number(j.pts || 0)} PTS · {Number(j.reb || 0)} REB · {Number(j.ast || 0)} AST · TL {Number(j.ftm || 0)}/{Number(j.fta || 0)} ({formatoPct(Number(j.ftm || 0), Number(j.fta || 0))})</strong>
                  </div>
                ))
              )}
            </div>

            <div className="mesa-stats-table">
              <h6>Jugadoras/es Visita</h6>
              {(partidoAnalisisSeleccionado.equipos?.visita?.roster || []).length === 0 ? (
                <p className="text-muted">Sin detalle individual visita.</p>
              ) : (
                (partidoAnalisisSeleccionado.equipos?.visita?.roster || []).slice(0, 12).map((j) => (
                  <div key={`visita-${partidoAnalisisSeleccionado.id}-${j.id || j.dorsal || j.nombre}`} className="mesa-stats-row">
                    <span>#{j.dorsal || '-'} {j.nombre || 'Jugador/a'}</span>
                    <strong>{Number(j.pts || 0)} PTS · {Number(j.reb || 0)} REB · {Number(j.ast || 0)} AST · TL {Number(j.ftm || 0)}/{Number(j.fta || 0)} ({formatoPct(Number(j.ftm || 0), Number(j.fta || 0))})</strong>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      </>
      )}

      {moduloMesa === 'historia' && (
      <>
      <div className="card mt-20" style={{ borderRadius: '24px' }}>
        <h4 className="form-subtitle" style={{ fontWeight: '900' }}><History size={16} color="var(--gris-secundario)" strokeWidth={1.5} /> Historia de Partidos</h4>
        <div className="mesa-filtros-grid">
          <label className="mesa-filter-item">
            <span>Buscar</span>
            <input className="form-input" placeholder="Equipo, rival o competencia" value={historialFiltroTexto} onChange={(e) => setHistorialFiltroTexto(e.target.value)} />
          </label>
          <label className="mesa-filter-item">
            <span>Rama</span>
            <select className="form-input" value={historialFiltroRama} onChange={(e) => setHistorialFiltroRama(e.target.value)}>
              {opcionesRama.map((op) => <option key={`hr-${op}`} value={op}>{op}</option>)}
            </select>
          </label>
          <label className="mesa-filter-item">
            <span>Categoría</span>
            <select className="form-input" value={historialFiltroCategoria} onChange={(e) => setHistorialFiltroCategoria(e.target.value)}>
              {opcionesCategoria.map((op) => <option key={`hc-${op}`} value={op}>{op}</option>)}
            </select>
          </label>
        </div>
        <div className="mesa-filtros-grid" style={{ marginTop: '10px' }}>
          <label className="mesa-filter-item">
            <span>Tipo de ficha técnica oficial</span>
            <select className="form-input" value={tipoFichaTecnicaExport} onChange={(e) => setTipoFichaTecnicaExport(e.target.value)}>
              <option value="planilla_resumen_oficial">Planilla oficial resumen (lote)</option>
              <option value="ficha_tecnica_partido">Ficha técnica oficial del partido seleccionado</option>
              <option value="ficha_tecnica_local">Ficha técnica individual Local (partido seleccionado)</option>
              <option value="ficha_tecnica_visita">Ficha técnica individual Visita (partido seleccionado)</option>
              <option value="planilla_fiba_impresion">Planilla FIBA imprimible (partido seleccionado)</option>
            </select>
          </label>
        </div>
        <div style={{ display: 'flex', gap: '8px', marginTop: '10px', flexWrap: 'wrap' }}>
          <button className="btn-secondary" style={{ width: 'auto' }} onClick={exportarHistorialCsv}><Download size={14} color="var(--gris-secundario)" strokeWidth={1.5} /> Exportar Historial CSV</button>
          <button className="btn-secondary" style={{ width: 'auto' }} onClick={exportarPlanillaReglamentaria}><Download size={14} color="var(--gris-secundario)" strokeWidth={1.5} /> Exportar Planilla/Ficha Oficial</button>
        </div>
      </div>

      <div className="card mt-20 mesa-historial-card" style={{ borderRadius: '24px' }}>
        <h4 className="form-subtitle" style={{ fontWeight: '900' }}><FileText size={16} color="var(--gris-secundario)" strokeWidth={1.5} /> Partidos Realizados</h4>
        {historialFiltrado.length === 0 ? (
          <p className="text-muted" style={{ marginBottom: 0 }}>No hay partidos para los filtros actuales.</p>
        ) : (
          <div className="mesa-historial-list">
            {historialFiltrado.map((partido) => (
              <div
                key={`hist-${partido.id}`}
                className="mesa-historial-item"
                onClick={() => setPartidoAnalisisId(partido.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter') setPartidoAnalisisId(partido.id); }}
              >
                <div>
                  <strong>{partido.equipos?.local?.nombre || 'Local'} vs {partido.equipos?.visita?.nombre || 'Visita'}</strong>
                  <span>{partido.finalizadoAt ? new Date(partido.finalizadoAt).toLocaleString('es-CL') : 'Sin fecha'} · {partido.filtros?.rama || 'Rama'} · {partido.filtros?.categoria || 'Categoria'}</span>
                </div>
                <div className="mesa-historial-score">
                  <strong>{partido.marcador?.ptsLocal ?? 0} - {partido.marcador?.ptsVisita ?? 0}</strong>
                  <span>{partido._origen === 'remoto' ? 'Base histórica' : 'Local'}</span>
                </div>
                <div className="mesa-historial-actions">
                  <button className="btn-secondary" style={{ width: 'auto' }} onClick={(e) => { e.stopPropagation(); editarPartidoHistorial(partido); }}>Editar</button>
                  <button className="btn-secondary" style={{ width: 'auto' }} onClick={(e) => { e.stopPropagation(); eliminarPartidoHistorial(partido); }}>Eliminar</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card mt-20" style={{ borderRadius: '24px' }}>
        <h4 className="form-subtitle" style={{ fontWeight: '900' }}><Shield size={16} color="var(--gris-secundario)" strokeWidth={1.5} /> Acumulado por Equipo</h4>
        <div className="mesa-stats-grid">
          <div className="mesa-stats-box">
            <p>PJ: <strong>{acumuladoEquipos.pj}</strong></p>
            <p>PG/PP: <strong>{acumuladoEquipos.victorias}</strong> / <strong>{acumuladoEquipos.derrotas}</strong></p>
            <p>PF/PC: <strong>{acumuladoEquipos.pf}</strong> / <strong>{acumuladoEquipos.pc}</strong></p>
            <p>Promedio PF/PC: <strong>{acumuladoEquipos.promedioPf.toFixed(1)}</strong> / <strong>{acumuladoEquipos.promedioPc.toFixed(1)}</strong></p>
            <p>EFF total local: <strong>{acumuladoEquipos.effLocal}</strong></p>
          </div>
        </div>
      </div>

      <div className="card mt-20" style={{ borderRadius: '24px' }}>
        <h4 className="form-subtitle" style={{ fontWeight: '900' }}><Users size={16} color="var(--gris-secundario)" strokeWidth={1.5} /> Acumulado por Jugador/a</h4>
        <div className="mesa-stats-table">
          {acumuladoJugadores.length === 0 ? (
            <p className="text-muted">Sin datos acumulados de jugadores.</p>
          ) : (
            acumuladoJugadores.slice(0, 30).map((j) => (
              <div key={`agg-${j.nombre}-${j.dorsal}`} className="mesa-stats-row">
                <span>#{j.dorsal} {j.nombre} · PJ {j.partidos}</span>
                <strong>{j.pts} PTS · {j.reb} REB · {j.ast} AST · EFF {j.eff}</strong>
              </div>
            ))
          )}
        </div>
      </div>
      </>
      )}

      {moduloMesa === 'live' && (
      <div className="card mt-20" style={{ borderRadius: '24px' }}>
        <h4 className="form-subtitle" style={{ fontWeight: '900' }}><FileText size={16} color="var(--gris-secundario)" strokeWidth={1.5} /> Línea de Tiempo (Play-by-Play)</h4>
        <div style={{ display: 'flex', gap: '10px' }} className="mb-15"><input type="text" className="form-input" placeholder="Nota táctica o scouting..." value={notaScouting} onChange={(e) => setNotaScouting(e.target.value)} /><button className="btn-electric" style={{ width: 'auto', padding: '0 20px' }} onClick={() => { if (!notaScouting) return; setPlayByPlay((prev) => [{ id: nextId(), tiempo: 'DT', texto: `📝 ${notaScouting}` }, ...prev]); setNotaScouting(''); }}>Log</button></div>
        <div className="play-by-play-box">{playByPlay.length === 0 ? <p className="text-center text-muted" style={{ fontSize: '13px', fontStyle: 'italic', margin: '20px 0' }}>Inicio de transmisión.</p> : playByPlay.map(play => (<div key={play.id} className={`play-row ${claseSeveridadPlay(play)}`}><span className="play-tiempo">{play.tiempo}</span><span className="play-texto">{play.texto}</span></div>))}</div>
      </div>
      )}
    </div>
  );
}

export default MesaControlPanel;
