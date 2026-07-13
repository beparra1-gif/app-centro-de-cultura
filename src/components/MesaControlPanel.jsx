import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRightLeft, Expand, FileText, Filter, Shield, Tv, Users } from 'lucide-react';
import { nextId } from '../utils/runtimeId';
import { calcularEff } from '../utils/appHelpers';
import * as api from '../api/client';
import LogoAvatar from './LogoAvatar';
import LogoPicker from './LogoPicker';
import { normalizarSlugLogo } from '../utils/logoResolver';

const LIMITE_JUGADORES_POR_EQUIPO = 12;

const numero = (valor) => Number(valor || 0);

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

const esCategoriaMenorOIgual = (categoriaJugador = '', categoriaBase = '') => {
  const subJugador = obtenerSubCategoriaNumero(categoriaJugador);
  const subBase = obtenerSubCategoriaNumero(categoriaBase);
  if (subJugador == null || subBase == null) return false;
  return subJugador <= subBase;
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
  const [filtroRama, setFiltroRama] = useState('Todas');
  const [filtroCategoria, setFiltroCategoria] = useState('Todas');
  const [competenciaNombre, setCompetenciaNombre] = useState('');
  const [competenciaLogoUrl, setCompetenciaLogoUrl] = useState('');
  const [canchaSede, setCanchaSede] = useState('');
  const [incluirCategoriasMenores, setIncluirCategoriasMenores] = useState(false);
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
  const [nuevoNombreLocal, setNuevoNombreLocal] = useState('');
  const [nuevoDorsalLocal, setNuevoDorsalLocal] = useState('');
  const [nuevoNombreVisita, setNuevoNombreVisita] = useState('');
  const [nuevoDorsalVisita, setNuevoDorsalVisita] = useState('');
  const [capitanLocalId, setCapitanLocalId] = useState('');
  const [capitanVisitaId, setCapitanVisitaId] = useState('');
  const [colorLocal, setColorLocal] = useState('#0a84ff');
  const [colorVisita, setColorVisita] = useState('#ff3b30');
  const [staffLocal, setStaffLocal] = useState({ entrenador: '', asistente: '', delegado: '' });
  const [staffVisita, setStaffVisita] = useState({ entrenador: '', asistente: '', delegado: '' });
  const [cambioSalidaId, setCambioSalidaId] = useState('');
  const [cambioIngresoId, setCambioIngresoId] = useState('');
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

  const equipoLocal = equiposDisponibles.find((e) => e.key === equipoLocalKey) || equiposDisponibles[0] || null;
  const equipoVisita = equiposDisponibles.find((e) => e.key === equipoVisitaKey) || equiposDisponibles[1] || equiposDisponibles[0] || null;

  useEffect(() => {
    try {
      const guardados = JSON.parse(window.localStorage.getItem('mesa_partidos_guardados') || '[]');
      setHistorialPartidosMesa(Array.isArray(guardados) ? guardados : []);
    } catch {
      setHistorialPartidosMesa([]);
    }
  }, []);

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
      || coincideFiltro(j._categoria, filtroCategoria)
      || (incluirCategoriasMenores && esCategoriaMenorOIgual(j._categoria, filtroCategoria));
    const okCompeticion = !filtroCompeticionActiva || coincideFiltro(j._competicion, filtroCompeticionActiva);
    return okRama && okCategoria && okCompeticion;
  }), [
    rosterNormalizado,
    filtroRama,
    filtroCategoria,
    incluirCategoriasMenores,
    filtroCompeticionActiva,
  ]);

  const rosterLocalCompleto = useMemo(
    () => rosterFiltrado.filter((j) => sonEquiposCompatibles(j, equipoLocal)),
    [rosterFiltrado, equipoLocal]
  );

  const rosterLocal = useMemo(
    () => rosterLocalCompleto.slice(0, LIMITE_JUGADORES_POR_EQUIPO),
    [rosterLocalCompleto]
  );

  const rosterVisitaCompleto = useMemo(
    () => rosterFiltrado.filter((j) => sonEquiposCompatibles(j, equipoVisita)),
    [rosterFiltrado, equipoVisita]
  );

  const rosterVisita = useMemo(
    () => rosterVisitaCompleto.slice(0, LIMITE_JUGADORES_POR_EQUIPO),
    [rosterVisitaCompleto]
  );

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
    () => detectarDorsalesDuplicados(rosterLocalCompleto),
    [rosterLocalCompleto]
  );

  const dorsalesDuplicadosVisita = useMemo(
    () => detectarDorsalesDuplicados(rosterVisitaCompleto),
    [rosterVisitaCompleto]
  );

  useEffect(() => {
    const habilitados = rosterLocalCompleto.filter((j) => !j._bloqueado && j.flt < 5).map((j) => j.id);
    setQuintetoLocalIds((prev) => {
      const vigente = prev.filter((id) => habilitados.includes(id));
      const faltan = 5 - vigente.length;
      if (faltan <= 0) return vigente.slice(0, 5);
      const extras = habilitados.filter((id) => !vigente.includes(id)).slice(0, faltan);
      return [...vigente, ...extras].slice(0, 5);
    });
  }, [rosterLocalCompleto]);

  useEffect(() => {
    const habilitados = rosterVisitaCompleto.filter((j) => !j._bloqueado && j.flt < 5).map((j) => j.id);
    setQuintetoVisitaIds((prev) => {
      const vigente = prev.filter((id) => habilitados.includes(id));
      const faltan = 5 - vigente.length;
      if (faltan <= 0) return vigente.slice(0, 5);
      const extras = habilitados.filter((id) => !vigente.includes(id)).slice(0, faltan);
      return [...vigente, ...extras].slice(0, 5);
    });
  }, [rosterVisitaCompleto]);

  const alternarTitular = ({ tipo, jugadorId }) => {
    const esLocal = tipo === 'local';
    const rosterBase = esLocal ? rosterLocalCompleto : rosterVisitaCompleto;
    const jugador = rosterBase.find((j) => j.id === jugadorId);
    if (!jugador || jugador._bloqueado || jugador.flt >= 5) return;

    const setter = esLocal ? setQuintetoLocalIds : setQuintetoVisitaIds;
    setter((prev) => {
      if (prev.includes(jugadorId)) return prev.filter((id) => id !== jugadorId);
      if (prev.length >= 5) return prev;
      return [...prev, jugadorId];
    });
  };

  const validacionLocal = useMemo(() => {
    const total = rosterLocalCompleto.length;
    return {
      total,
      minimoOk: total >= 5,
      maximoOk: total <= LIMITE_JUGADORES_POR_EQUIPO,
      dorsalesOk: dorsalesDuplicadosLocal.length === 0,
      quintetoOk: quintetoLocalIds.length === 5,
    };
  }, [rosterLocalCompleto, dorsalesDuplicadosLocal, quintetoLocalIds]);

  const validacionVisita = useMemo(() => {
    const total = rosterVisitaCompleto.length;
    if (modoAnalisis !== 'dos') {
      return { total, minimoOk: true, maximoOk: true, dorsalesOk: true, quintetoOk: true };
    }
    return {
      total,
      minimoOk: total >= 5,
      maximoOk: total <= LIMITE_JUGADORES_POR_EQUIPO,
      dorsalesOk: dorsalesDuplicadosVisita.length === 0,
      quintetoOk: quintetoVisitaIds.length === 5,
    };
  }, [modoAnalisis, rosterVisitaCompleto, dorsalesDuplicadosVisita, quintetoVisitaIds]);

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
    if (!prepartidoValido && partidoIniciado) {
      setPartidoIniciado(false);
    }
  }, [prepartidoValido, partidoIniciado]);

  useEffect(() => {
    if (!jugadorSeleccionadoLive) return;
    if (!rosterLocal.some((j) => j.id === jugadorSeleccionadoLive)) {
      setJugadorSeleccionadoLive(null);
    }
  }, [jugadorSeleccionadoLive, rosterLocal, setJugadorSeleccionadoLive]);

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
    };
    setEventosPartido((prev) => [evento, ...prev].slice(0, 400));
  };

  const ejecutarCambioJugadorLocal = () => {
    if (!partidoIniciado || !prepartidoValido) return;
    const salida = rosterLocalCompleto.find((j) => String(j.id) === String(cambioSalidaId));
    const ingreso = rosterLocalCompleto.find((j) => String(j.id) === String(cambioIngresoId));
    if (!salida || !ingreso) return;
    if (!quintetoLocalIds.includes(salida.id)) return alert('La jugadora/o de salida debe estar en cancha.');
    if (quintetoLocalIds.includes(ingreso.id)) return alert('La jugadora/o de ingreso ya está en cancha.');
    if (ingreso._bloqueado || ingreso.flt >= 5) return alert('La jugadora/o de ingreso está bloqueada/o.');

    setQuintetoLocalIds((prev) => prev.filter((id) => id !== salida.id).concat(ingreso.id).slice(0, 5));
    const detalle = `Cambio Local: sale #${salida.dorsal} ${salida.nombre}, entra #${ingreso.dorsal} ${ingreso.nombre}`;
    setPlayByPlay((prev) => [{ id: nextId(), tiempo: liveScore.reloj, texto: `🔁 ${detalle}` }, ...prev]);
    registrarEventoJuego({ tipo: 'CAMBIO', detalle, equipo: 'local', jugadorId: ingreso.id, valor: 0 });
    setCambioSalidaId('');
    setCambioIngresoId('');
  };

  const cambiarVistaLivePantallaCompleta = async () => {
    const node = liveFullScreenRef.current;
    if (!node || !document?.fullscreenEnabled) return;
    if (document.fullscreenElement) {
      await document.exitFullscreen();
      return;
    }
    await node.requestFullscreen();
  };

  const ejecutarAccionFIBA = (tipo, puntos = 0) => {
    if (!partidoIniciado || !prepartidoValido) return alert('Valida y comienza el partido antes de capturar eventos.');
    if (!jugadorSeleccionadoLive) return alert('Selecciona un jugador del Roster primero.');
    if (!quintetoLocalIds.includes(jugadorSeleccionadoLive)) {
      return alert('La accion solo se permite para jugadoras/es titulares en cancha.');
    }
    let nombreJugador = '';
    let expulsionNombre = '';

    setRosterEquipo((prev) => prev.map((j) => {
      if (j.id === jugadorSeleccionadoLive) {
        nombreJugador = `#${j.dorsal} ${j.nombre}`;
        const nuevoFlt = tipo === 'FALTA' ? numero(j.flt) + 1 : numero(j.flt);
        const expulsado = nuevoFlt >= 5;
        if (expulsado) expulsionNombre = `${nombreJugador}`;
        return {
          ...j,
          pts: numero(j.pts) + puntos,
          reb: tipo === 'REB' ? numero(j.reb) + 1 : numero(j.reb),
          ast: tipo === 'AST' ? numero(j.ast) + 1 : numero(j.ast),
          stl: tipo === 'ROBO' ? numero(j.stl) + 1 : numero(j.stl),
          flt: nuevoFlt,
          to: tipo === 'PERDIDA' ? numero(j.to) + 1 : numero(j.to),
          expulsado,
          _expulsado: expulsado,
        };
      }
      return j;
    }));

    if (puntos > 0) setLiveScore((prev) => ({ ...prev, ptsLocal: prev.ptsLocal + puntos }));
    if (tipo === 'FALTA') setLiveScore((prev) => ({ ...prev, faltasLocal: prev.faltasLocal + 1 }));

    const logTexto = puntos > 0 ? `${nombreJugador} anota ${puntos} pts` : `${nombreJugador} registra ${tipo}`;
    setPlayByPlay((prev) => [{ id: nextId(), tiempo: liveScore.reloj, texto: logTexto }, ...prev]);
    registrarEventoJuego({ tipo, detalle: logTexto, equipo: 'local', jugadorId: jugadorSeleccionadoLive, valor: puntos });
    if (expulsionNombre) {
      setPlayByPlay((prev) => [{ id: nextId(), tiempo: liveScore.reloj, texto: `⚠ ${expulsionNombre} llega a 5 faltas y debe salir.` }, ...prev]);
      setQuintetoLocalIds((prev) => prev.filter((id) => id !== jugadorSeleccionadoLive));
    }
    setJugadorSeleccionadoLive(null);
  };

  const agregarJugadorManual = ({ tipo }) => {
    const esLocal = tipo === 'local';
    const equipoTarget = esLocal ? equipoLocal : equipoVisita;
    const nombre = normalizarTexto(esLocal ? nuevoNombreLocal : nuevoNombreVisita);
    const dorsalTexto = normalizarTexto(esLocal ? nuevoDorsalLocal : nuevoDorsalVisita);
    const dorsal = Number(dorsalTexto);

    if (!equipoTarget?.key) return;
    if (!nombre) return alert('Ingresa el nombre del jugador.');
    if (!Number.isFinite(dorsal) || dorsal <= 0) return alert('Ingresa un dorsal valido.');

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
        alert(`El equipo ${equipoTarget.nombre} ya tiene ${LIMITE_JUGADORES_POR_EQUIPO} jugadores en mesa.`);
        return prev;
      }

      const maxId = normalizadoPrev.reduce((acc, j) => Math.max(acc, Number(j.id || 0)), 0);
      const nuevo = {
        id: maxId + 1,
        rut_jugador: `manual-${nextId()}`,
        nombre,
        dorsal,
        rama: filtroRama === 'Todas' ? (esLocal ? (equipoTarget.ramas?.[0] || 'General') : 'General') : filtroRama,
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
      return [...prev, nuevo];
    });

    if (esLocal) {
      setNuevoNombreLocal('');
      setNuevoDorsalLocal('');
    } else {
      setNuevoNombreVisita('');
      setNuevoDorsalVisita('');
    }
  };

  const registrarPuntosVisita = (puntos = 1) => {
    if (!partidoIniciado || !prepartidoValido) return;
    if (modoAnalisis !== 'dos') return;
    const nombreEquipo = equipoVisita?.nombre || liveScore.equipoVisitaNombre || 'Visita';
    setLiveScore((prev) => ({ ...prev, ptsVisita: prev.ptsVisita + puntos }));
    const detalle = `${nombreEquipo} anota ${puntos} pts`;
    setPlayByPlay((prev) => [{ id: nextId(), tiempo: liveScore.reloj, texto: detalle }, ...prev]);
    registrarEventoJuego({ tipo: 'PUNTO', detalle, equipo: 'visita', valor: puntos });
  };

  const registrarFaltaVisita = () => {
    if (!partidoIniciado || !prepartidoValido) return;
    if (modoAnalisis !== 'dos') return;
    const nombreEquipo = equipoVisita?.nombre || liveScore.equipoVisitaNombre || 'Visita';
    setLiveScore((prev) => ({ ...prev, faltasVisita: prev.faltasVisita + 1 }));
    const detalle = `${nombreEquipo} registra FALTA`;
    setPlayByPlay((prev) => [{ id: nextId(), tiempo: liveScore.reloj, texto: detalle }, ...prev]);
    registrarEventoJuego({ tipo: 'FALTA', detalle, equipo: 'visita' });
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

  const registrarEventoPlantilla = ({ tipo, detalle, equipo = 'local' }) => {
    if (!partidoIniciado || !prepartidoValido) return;
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
    };
    setEventosPartido((prev) => [evento, ...prev].slice(0, 300));
    setPlayByPlay((prev) => [{ id: nextId(), tiempo: liveScore.reloj, texto: `${tipo}: ${detalle} · ${operadorNombre}` }, ...prev]);
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

  const guardarEstadisticaPartido = async () => {
    const payload = {
      id: nextId(),
      finalizadoAt: new Date().toISOString(),
      operadores: operadoresMesa,
      operadorActivo: rolOperadorActivo,
      equipos: {
        local: {
          nombre: liveScore.equipoLocalNombre || equipoLocal?.nombre || 'Local',
          logoUrl: liveScore.equipoLocalLogoUrl || equipoLocal?.logoUrl || '',
          roster: rosterLocalCompleto,
          resumen: crearResumenEquipo(rosterLocalCompleto),
        },
        visita: {
          nombre: liveScore.equipoVisitaNombre || equipoVisita?.nombre || 'Visita',
          logoUrl: liveScore.equipoVisitaLogoUrl || equipoVisita?.logoUrl || '',
          roster: rosterVisitaCompleto,
          resumen: crearResumenEquipo(rosterVisitaCompleto),
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
      if (partidoPersistidoId) {
        await api.partidosLiveAPI.finalizarMesa(partidoPersistidoId, {
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
      }
      return true;
    } catch {
      return false;
    }
  };

  const confirmarInicioPartido = async () => {
    if (partidoIniciado) return;
    if (!prepartidoValido) {
      alert('Corrige las validaciones prepartido antes de iniciar.');
      return;
    }
    if (!window.confirm('¿Confirmas iniciar el partido?')) return;
    const creadoId = await crearPartidoPersistido();
    if (creadoId) setPartidoPersistidoId(creadoId);
    setPartidoIniciado(true);
    const operadorNombre = normalizarTexto(operadoresMesa[rolOperadorActivo]) || 'Operador';
    setPlayByPlay((prev) => [{ id: nextId(), tiempo: liveScore.reloj || '10:00', texto: `▶ Partido iniciado · ${operadorNombre}` }, ...prev]);
  };

  const confirmarFinalizacionPartido = async () => {
    if (!partidoIniciado) return;
    if (!window.confirm('¿Finalizar partido y guardar estadística?')) return;

    const guardado = await guardarEstadisticaPartido();
    setPartidoIniciado(false);
    setPartidoPersistidoId(null);
    setPlayByPlay((prev) => [{ id: nextId(), tiempo: liveScore.reloj || '00:00', texto: guardado ? '■ Partido finalizado y estadística guardada' : '■ Partido finalizado (falló guardado local)' }, ...prev]);
    if (!guardado) {
      alert('Partido finalizado, pero no se pudo guardar la estadística en este dispositivo.');
    }
  };

  if (modoChromaKey) {
    return (
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: '#00FF00', zIndex: 99999, display: 'flex', alignItems: 'flex-end', padding: '50px' }}>
        <div style={{ background: '#1C1C1E', border: '3px solid #333', borderRadius: '15px', padding: '20px 40px', display: 'flex', gap: '40px', alignItems: 'center', boxShadow: '0 20px 50px rgba(0,0,0,0.5)' }}>
          <div className="text-center"><span style={{ color: '#aaa', fontSize: '14px', fontWeight: 'bold' }}>LOCAL {liveScore.flecha === 'LOCAL' && '◀'}</span><h1 style={{ color: 'white', margin: 0, fontSize: '60px', fontFamily: 'Orbitron' }}>{liveScore.ptsLocal}</h1><span style={{ color: '#FF3B30', fontSize: '12px', fontWeight: 'bold' }}>FALTAS: {liveScore.faltasLocal}</span></div>
          <div className="text-center"><span style={{ background: '#333', color: '#00FF00', padding: '10px 20px', borderRadius: '10px', fontSize: '24px', fontWeight: '900', fontFamily: 'Orbitron' }}>{liveScore.reloj}</span><h3 style={{ color: 'white', margin: '10px 0 0 0' }}>Q{liveScore.periodo}</h3></div>
          <div className="text-center"><span style={{ color: '#aaa', fontSize: '14px', fontWeight: 'bold' }}>{liveScore.flecha === 'VISITA' && '▶'} VISITA</span><h1 style={{ color: 'white', margin: 0, fontSize: '60px', fontFamily: 'Orbitron' }}>{liveScore.ptsVisita}</h1><span style={{ color: '#FF3B30', fontSize: '12px', fontWeight: 'bold' }}>FALTAS: {liveScore.faltasVisita}</span></div>
          <button style={{ position: 'absolute', top: '10px', right: '10px', background: 'black', color: 'white', border: 'none', padding: '10px', borderRadius: '999px', cursor: 'pointer', opacity: 0.2 }} onClick={() => setModoChromaKey(false)}>Cerrar Modo TV</button>
        </div>
      </div>
    );
  }

  return (
    <div className="fiba-container fade-in">
      <div className="mesa-lab-header card mb-15">
        <div className="mesa-lab-title-wrap">
          <h3 className="form-subtitle" style={{ margin: 0 }}><Users size={18} color="#6B7280" strokeWidth={1.5} /> Mesa Insights</h3>
          <span className="mesa-lab-subtitle">Analiza uno o dos equipos con filtros competitivos y control live.</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div className="mesa-lab-mode-switch" role="tablist" aria-label="Modo de análisis">
            <button className={`mesa-mode-btn ${modoAnalisis === 'uno' ? 'active' : ''}`} onClick={() => setModoAnalisis('uno')}>1 Equipo</button>
            <button className={`mesa-mode-btn ${modoAnalisis === 'dos' ? 'active' : ''}`} onClick={() => setModoAnalisis('dos')}>2 Equipos</button>
          </div>
          <div className="mesa-lab-mode-switch" style={{ gridTemplateColumns: '1fr 1fr 1fr' }} role="tablist" aria-label="Módulo de mesa">
            <button className={`mesa-mode-btn ${moduloMesa === 'prepartido' ? 'active' : ''}`} onClick={() => setModuloMesa('prepartido')}>1. Datos partido</button>
            <button className={`mesa-mode-btn ${moduloMesa === 'live' ? 'active' : ''}`} onClick={() => setModuloMesa('live')}>2. Juego en vivo</button>
            <button className={`mesa-mode-btn ${moduloMesa === 'analitica' ? 'active' : ''}`} onClick={() => setModuloMesa('analitica')}>3. Estadística</button>
          </div>
        </div>
      </div>

      {moduloMesa === 'prepartido' && (
        <>

      <div className="mesa-filtros-grid card mb-15">
        <label className="mesa-filter-item">
          <span><Filter size={14} color="#6B7280" strokeWidth={1.5} /> Rama</span>
          <select className="form-input" value={filtroRama} onChange={(e) => setFiltroRama(e.target.value)}>
            {opcionesRama.map((op) => <option key={op} value={op}>{op}</option>)}
          </select>
        </label>

        <label className="mesa-filter-item">
          <span><Filter size={14} color="#6B7280" strokeWidth={1.5} /> Categoría</span>
          <select className="form-input" value={filtroCategoria} onChange={(e) => setFiltroCategoria(e.target.value)}>
            {opcionesCategoria.map((op) => <option key={op} value={op}>{op}</option>)}
          </select>
        </label>

        <div className="mesa-filter-item">
          <span><Shield size={14} color="#6B7280" strokeWidth={1.5} /> Competencia / Torneo</span>
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

        <div className="mesa-filter-item">
          <span><Users size={14} color="#6B7280" strokeWidth={1.5} /> Club Local</span>
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

        {modoAnalisis === 'dos' && (
          <div className="mesa-filter-item">
            <span><Users size={14} color="#6B7280" strokeWidth={1.5} /> Club Visita</span>
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
        )}

        <label className="mesa-filter-item">
          <span><FileText size={14} color="#6B7280" strokeWidth={1.5} /> Cancha / Sede</span>
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

        {filtroCategoria !== 'Todas' && (
          <label className="mesa-filter-item" style={{ justifyContent: 'center' }}>
            <span><Shield size={14} color="#6B7280" strokeWidth={1.5} /> Incluir categorías menores</span>
            <input
              type="checkbox"
              checked={incluirCategoriasMenores}
              onChange={(e) => setIncluirCategoriasMenores(e.target.checked)}
              style={{ width: '18px', height: '18px' }}
            />
          </label>
        )}
      </div>

      <div className={`card mb-15 mesa-prepartido-card ${partidoIniciado ? 'mesa-prepartido-live' : ''}`}>
        <div className="mesa-prepartido-header">
          <h4 className="form-subtitle" style={{ margin: 0 }}><Shield size={16} color="#6B7280" strokeWidth={1.5} /> Validacion Prepartido</h4>
          <div className="mesa-prepartido-actions">
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

        <div className="mesa-validation-grid">
          <div className="mesa-validation-box">
            <h6>Local</h6>
            <p>Jugadoras/es: {validacionLocal.total} (min 5 / max 12)</p>
            <p>Quinteto activo: {quintetoLocalIds.length}/5</p>
            {!validacionLocal.dorsalesOk && <p className="mesa-validation-error">Dorsales duplicados: {dorsalesDuplicadosLocal.join(', ')}</p>}
          </div>
          {modoAnalisis === 'dos' && (
            <div className="mesa-validation-box">
              <h6>Visita</h6>
              <p>Jugadoras/es: {validacionVisita.total} (min 5 / max 12)</p>
              <p>Quinteto activo: {quintetoVisitaIds.length}/5</p>
              {!validacionVisita.dorsalesOk && <p className="mesa-validation-error">Dorsales duplicados: {dorsalesDuplicadosVisita.join(', ')}</p>}
            </div>
          )}
        </div>

        <div className="mesa-quintetos-grid">
          <div className="mesa-quinteto-box">
            <h6>Quinteto Local</h6>
            <div className="mesa-quinteto-list">
              {rosterLocalCompleto.map((j) => (
                <button
                  key={j.id}
                  className={`mesa-quinteto-pill ${quintetoLocalIds.includes(j.id) ? 'active' : ''} ${j._bloqueado || j.flt >= 5 ? 'locked' : ''}`}
                  onClick={() => alternarTitular({ tipo: 'local', jugadorId: j.id })}
                  disabled={j._bloqueado || j.flt >= 5}
                  type="button"
                >
                  #{j.dorsal} {j.nombre}
                </button>
              ))}
            </div>
          </div>

          {modoAnalisis === 'dos' && (
            <div className="mesa-quinteto-box">
              <h6>Quinteto Visita</h6>
              <div className="mesa-quinteto-list">
                {rosterVisitaCompleto.map((j) => (
                  <button
                    key={j.id}
                    className={`mesa-quinteto-pill ${quintetoVisitaIds.includes(j.id) ? 'active' : ''} ${j._bloqueado || j.flt >= 5 ? 'locked' : ''}`}
                    onClick={() => alternarTitular({ tipo: 'visita', jugadorId: j.id })}
                    disabled={j._bloqueado || j.flt >= 5}
                    type="button"
                  >
                    #{j.dorsal} {j.nombre}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {ultimoGuardadoAt && (
          <p className="mesa-save-info">Ultima estadistica guardada: {ultimoGuardadoAt}</p>
        )}
      </div>

      <div className="card mb-15" style={{ borderRadius: '18px' }}>
        <h4 className="form-subtitle" style={{ marginTop: 0 }}><Users size={16} color="#6B7280" strokeWidth={1.5} /> Operadores de Mesa (Trazabilidad)</h4>
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

        <div className="mesa-eventos-template-grid">
          <button className="btn-secondary" disabled={!partidoIniciado} onClick={() => registrarEventoPlantilla({ tipo: 'SISTEMA', detalle: 'Timeout local solicitado', equipo: 'local' })}>Timeout Local</button>
          <button className="btn-secondary" disabled={!partidoIniciado} onClick={() => registrarEventoPlantilla({ tipo: 'SISTEMA', detalle: 'Timeout visita solicitado', equipo: 'visita' })}>Timeout Visita</button>
          <button className="btn-secondary" disabled={!partidoIniciado} onClick={() => registrarEventoPlantilla({ tipo: 'SUSTITUCION', detalle: 'Cambio de quinteto local', equipo: 'local' })}>Sustitución Local</button>
          <button className="btn-secondary" disabled={!partidoIniciado} onClick={() => registrarEventoPlantilla({ tipo: 'SUSTITUCION', detalle: 'Cambio de quinteto visita', equipo: 'visita' })}>Sustitución Visita</button>
          <button className="btn-secondary" disabled={!partidoIniciado} onClick={() => registrarEventoPlantilla({ tipo: 'LANZAMIENTO', detalle: 'Tiro fallado local', equipo: 'local' })}>Tiro Fallado Local</button>
          <button className="btn-secondary" disabled={!partidoIniciado} onClick={() => registrarEventoPlantilla({ tipo: 'LANZAMIENTO', detalle: 'Tiro fallado visita', equipo: 'visita' })}>Tiro Fallado Visita</button>
          <button className="btn-secondary" disabled={!partidoIniciado} onClick={() => registrarEventoPlantilla({ tipo: 'DEFENSA', detalle: 'Recuperación defensiva local', equipo: 'local' })}>Recuperación Local</button>
          <button className="btn-secondary" disabled={!partidoIniciado} onClick={() => registrarEventoPlantilla({ tipo: 'DEFENSA', detalle: 'Recuperación defensiva visita', equipo: 'visita' })}>Recuperación Visita</button>
        </div>
      </div>

      <div className="card mb-15" style={{ borderRadius: '18px' }}>
        <h4 className="form-subtitle" style={{ marginTop: 0 }}><Shield size={16} color="#6B7280" strokeWidth={1.5} /> Datos de Partido y Staff</h4>
        <div className="mesa-filtros-grid">
          <label className="mesa-filter-item">
            <span>Color equipo local</span>
            <input type="color" className="form-input" value={colorLocal} onChange={(e) => setColorLocal(e.target.value)} />
          </label>
          <label className="mesa-filter-item">
            <span>Color equipo visita</span>
            <input type="color" className="form-input" value={colorVisita} onChange={(e) => setColorVisita(e.target.value)} />
          </label>
          <label className="mesa-filter-item">
            <span>Capitán/a local</span>
            <select className="form-input" value={capitanLocalId} onChange={(e) => setCapitanLocalId(e.target.value)}>
              <option value="">Seleccionar</option>
              {rosterLocalCompleto.map((j) => <option key={j.id} value={j.id}>#{j.dorsal} {j.nombre}</option>)}
            </select>
          </label>
          {modoAnalisis === 'dos' && (
            <label className="mesa-filter-item">
              <span>Capitán/a visita</span>
              <select className="form-input" value={capitanVisitaId} onChange={(e) => setCapitanVisitaId(e.target.value)}>
                <option value="">Seleccionar</option>
                {rosterVisitaCompleto.map((j) => <option key={j.id} value={j.id}>#{j.dorsal} {j.nombre}</option>)}
              </select>
            </label>
          )}
          <label className="mesa-filter-item"><span>DT Local</span><input className="form-input" value={staffLocal.entrenador} onChange={(e) => setStaffLocal((prev) => ({ ...prev, entrenador: e.target.value }))} placeholder="Opcional" /></label>
          <label className="mesa-filter-item"><span>Asistente Local</span><input className="form-input" value={staffLocal.asistente} onChange={(e) => setStaffLocal((prev) => ({ ...prev, asistente: e.target.value }))} placeholder="Opcional" /></label>
          <label className="mesa-filter-item"><span>Delegado Local</span><input className="form-input" value={staffLocal.delegado} onChange={(e) => setStaffLocal((prev) => ({ ...prev, delegado: e.target.value }))} placeholder="Opcional" /></label>
          {modoAnalisis === 'dos' && <label className="mesa-filter-item"><span>DT Visita</span><input className="form-input" value={staffVisita.entrenador} onChange={(e) => setStaffVisita((prev) => ({ ...prev, entrenador: e.target.value }))} placeholder="Opcional" /></label>}
          {modoAnalisis === 'dos' && <label className="mesa-filter-item"><span>Asistente Visita</span><input className="form-input" value={staffVisita.asistente} onChange={(e) => setStaffVisita((prev) => ({ ...prev, asistente: e.target.value }))} placeholder="Opcional" /></label>}
          {modoAnalisis === 'dos' && <label className="mesa-filter-item"><span>Delegado Visita</span><input className="form-input" value={staffVisita.delegado} onChange={(e) => setStaffVisita((prev) => ({ ...prev, delegado: e.target.value }))} placeholder="Opcional" /></label>}
        </div>
      </div>
        </>
      )}

      {moduloMesa === 'live' && (
        <div ref={liveFullScreenRef} className="mesa-live-wrap">
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '10px', gap: '8px' }}>
            <button className="btn-secondary" style={{ width: 'auto', padding: '10px 15px', fontSize: '11px', gap: '5px', borderRadius: '999px' }} onClick={cambiarVistaLivePantallaCompleta}><Expand size={14} color="#6B7280" strokeWidth={1.5} /> Pantalla Completa Live</button>
            <button className="btn-secondary" style={{ width: 'auto', padding: '10px 15px', fontSize: '11px', gap: '5px', borderRadius: '999px' }} onClick={() => setModoChromaKey(true)}><Tv size={14} color="#6B7280" strokeWidth={1.5} /> Modo Transmisión (OBS)</button>
          </div>

      <div className="checkout-total-box mb-15" style={{ background: 'linear-gradient(180deg, #1C1C1E 0%, #101114 100%)', border: '2px solid rgba(0,122,255,0.2)', display: 'flex', flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', padding: '20px 10px', borderRadius: '24px', boxShadow: '0 16px 34px rgba(15,23,42,0.12)' }}>
        <div className="text-center" style={{ flex: 1 }}>
          <span style={{ fontSize: '12px', color: colorLocal, fontWeight: '800' }}>LOCAL {liveScore.flecha === 'LOCAL' && '◀'}</span>
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: '8px', marginBottom: '4px' }}>
            <LogoAvatar nombre={liveScore.equipoLocalNombre || 'Centro de Cultura Física'} logoUrl={liveScore.equipoLocalLogoUrl} size={46} borderRadius="16px" />
          </div>
          <h1 style={{ fontSize: '52px', margin: 0, color: 'white', fontFamily: 'Orbitron' }}>{liveScore.ptsLocal}</h1>
          <span style={{ fontSize: '11px', color: '#FF3B30', fontWeight: '800', display: 'block' }}>FALTAS: {liveScore.faltasLocal}</span>
          <div style={{ display: 'flex', gap: '5px', justifyContent: 'center', marginTop: '8px' }}>
            {[...Array(3)].map((_, i) => <div key={i} style={{ width: '10px', height: '10px', borderRadius: '50%', background: i < liveScore.timeoutsLocal ? '#FFD700' : '#333' }}></div>)}
          </div>
        </div>

        <div className="text-center" style={{ flex: 1 }}>
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
          <h4 style={{ margin: '10px 0 0 0', color: 'white', fontSize: '18px' }}>Q{liveScore.periodo}</h4>
          {normalizarTexto(canchaSede) && (
            <span style={{ display: 'block', marginTop: '8px', fontSize: '11px', color: 'var(--texto-secundario)', fontWeight: '800' }}>
              {canchaSede}
            </span>
          )}
        </div>

        <div className="text-center" style={{ flex: 1 }}>
          <span style={{ fontSize: '12px', color: colorVisita, fontWeight: '800' }}>{liveScore.flecha === 'VISITA' && '▶'} VISITA</span>
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: '8px', marginBottom: '4px' }}>
            <LogoAvatar nombre={liveScore.equipoVisitaNombre || 'Visitante'} logoUrl={liveScore.equipoVisitaLogoUrl} size={46} borderRadius="16px" />
          </div>
          <h1 style={{ fontSize: '52px', margin: 0, color: 'white', fontFamily: 'Orbitron' }}>{modoAnalisis === 'dos' ? liveScore.ptsVisita : '-'}</h1>
          <span style={{ fontSize: '11px', color: '#FF3B30', fontWeight: '800', display: 'block' }}>FALTAS: {liveScore.faltasVisita}</span>
          <div style={{ display: 'flex', gap: '5px', justifyContent: 'center', marginTop: '8px' }}>
            {[...Array(3)].map((_, i) => <div key={i} style={{ width: '10px', height: '10px', borderRadius: '50%', background: i < liveScore.timeoutsVisita ? '#FFD700' : '#333' }}></div>)}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
        <button className="btn-secondary" style={{ padding: '12px', fontSize: '12px', fontWeight: '800' }} onClick={() => setLiveScore({ ...liveScore, timeoutsLocal: Math.max(0, liveScore.timeoutsLocal - 1) })}>TM Local</button>
        <button className="btn-secondary" style={{ padding: '12px', fontSize: '12px', background: 'var(--azul-marino)', color: 'white' }} onClick={() => setLiveScore({ ...liveScore, flecha: liveScore.flecha === 'LOCAL' ? 'VISITA' : 'LOCAL' })}><ArrowRightLeft size={16} color="#6B7280" strokeWidth={1.5} /></button>
        <button className="btn-secondary" style={{ padding: '12px', fontSize: '12px', fontWeight: '800' }} onClick={() => setLiveScore({ ...liveScore, timeoutsVisita: Math.max(0, liveScore.timeoutsVisita - 1) })}>TM Visita</button>
      </div>

      <div className="caja-doble-grid landscape-mode">
        <div className="card" style={{ padding: '15px', borderRadius: '24px' }}>
          <h5 className="sub-caja-title">Roster Local ({rosterLocal.length}/{LIMITE_JUGADORES_POR_EQUIPO})</h5>
          <div className="roster-fiba-list">
            {rosterLocal.map((j) => (
              <div
                key={j.id}
                onClick={() => {
                  if (j._bloqueado || j.flt >= 5) return;
                  setJugadorSeleccionadoLive(j.id);
                }}
                className={`roster-fiba-item ${jugadorSeleccionadoLive === j.id ? 'seleccionado' : ''} ${j._bloqueado || j.flt >= 5 ? 'bloqueado' : ''}`}
              >
                <div className="fiba-dorsal">#{j.dorsal}</div>
                <div className="fiba-info">
                  <strong>{j.nombre}</strong>
                  <span>{j.pts}pts | {j.flt}F | EFF: {calcularEff(j)}</span>
                </div>
              </div>
            ))}
            {rosterLocal.length === 0 && <p className="text-muted text-center" style={{ margin: '15px 0' }}>No hay jugadores para los filtros actuales.</p>}
          </div>
          <div className="mesa-add-player mt-10">
            <input className="form-input" placeholder="Nombre jugadora/or" value={nuevoNombreLocal} onChange={(e) => setNuevoNombreLocal(e.target.value)} />
            <input className="form-input" placeholder="Dorsal" value={nuevoDorsalLocal} onChange={(e) => setNuevoDorsalLocal(e.target.value)} />
            <button className="btn-secondary" onClick={() => agregarJugadorManual({ tipo: 'local' })}>Añadir Local</button>
          </div>
        </div>

        <div className="card" style={{ padding: '20px', borderRadius: '24px' }}>
          <h5 className="sub-caja-title text-center" style={{ color: jugadorSeleccionadoLive ? 'var(--verde-victoria)' : '#FF3B30' }}>
            {jugadorSeleccionadoLive ? 'Control de Acciones' : 'Seleccione Jugador'}
          </h5>

          <div className="fiba-botones-grid">
            <button className="btn-fiba pt" disabled={!jugadorSeleccionadoLive} onClick={() => ejecutarAccionFIBA('PUNTO', 1)}>+1 TL</button>
            <button className="btn-fiba pt" disabled={!jugadorSeleccionadoLive || !partidoIniciado || !prepartidoValido} onClick={() => ejecutarAccionFIBA('PUNTO', 2)}>+2 PTS</button>
            <button className="btn-fiba pt" disabled={!jugadorSeleccionadoLive || !partidoIniciado || !prepartidoValido} onClick={() => ejecutarAccionFIBA('PUNTO', 3)}>+3 PTS</button>
            <button className="btn-fiba st" disabled={!jugadorSeleccionadoLive || !partidoIniciado || !prepartidoValido} onClick={() => ejecutarAccionFIBA('REB')}>REB</button>
            <button className="btn-fiba st" disabled={!jugadorSeleccionadoLive || !partidoIniciado || !prepartidoValido} onClick={() => ejecutarAccionFIBA('AST')}>AST</button>
            <button className="btn-fiba st" disabled={!jugadorSeleccionadoLive || !partidoIniciado || !prepartidoValido} onClick={() => ejecutarAccionFIBA('ROBO')}>ROBO</button>
            <button className="btn-fiba err" disabled={!jugadorSeleccionadoLive || !partidoIniciado || !prepartidoValido} onClick={() => ejecutarAccionFIBA('PERDIDA')}>PÉRDIDA</button>
            <button className="btn-fiba err" disabled={!jugadorSeleccionadoLive || !partidoIniciado || !prepartidoValido} onClick={() => ejecutarAccionFIBA('FALTA')}>FALTA</button>
          </div>

          <div className="mesa-visitor-actions">
            <h6>Cambio de Jugador Local</h6>
            <div className="mesa-visitor-actions-grid" style={{ gridTemplateColumns: '1fr 1fr 120px' }}>
              <select className="form-input" value={cambioSalidaId} onChange={(e) => setCambioSalidaId(e.target.value)}>
                <option value="">Sale...</option>
                {rosterLocalCompleto.filter((j) => quintetoLocalIds.includes(j.id)).map((j) => <option key={j.id} value={j.id}>#{j.dorsal} {j.nombre}</option>)}
              </select>
              <select className="form-input" value={cambioIngresoId} onChange={(e) => setCambioIngresoId(e.target.value)}>
                <option value="">Entra...</option>
                {rosterLocalCompleto.filter((j) => !quintetoLocalIds.includes(j.id)).map((j) => <option key={j.id} value={j.id}>#{j.dorsal} {j.nombre}</option>)}
              </select>
              <button className="btn-secondary" disabled={!partidoIniciado || !prepartidoValido || !cambioSalidaId || !cambioIngresoId} onClick={ejecutarCambioJugadorLocal}>Cambiar</button>
            </div>
          </div>

          {modoAnalisis === 'dos' && (
            <div className="mesa-visitor-actions">
              <h6>Acciones Rápidas Visita</h6>
              <div className="mesa-visitor-actions-grid">
                <button className="btn-secondary" disabled={!partidoIniciado || !prepartidoValido} onClick={() => registrarPuntosVisita(1)}>Visita +1</button>
                <button className="btn-secondary" disabled={!partidoIniciado || !prepartidoValido} onClick={() => registrarPuntosVisita(2)}>Visita +2</button>
                <button className="btn-secondary" disabled={!partidoIniciado || !prepartidoValido} onClick={() => registrarPuntosVisita(3)}>Visita +3</button>
                <button className="btn-secondary" disabled={!partidoIniciado || !prepartidoValido} onClick={registrarFaltaVisita}>Falta Visita</button>
              </div>
            </div>
          )}
        </div>

        {modoAnalisis === 'dos' && (
          <div className="card" style={{ padding: '15px', borderRadius: '24px' }}>
            <h5 className="sub-caja-title">Roster Visita ({rosterVisita.length}/{LIMITE_JUGADORES_POR_EQUIPO})</h5>
            <div className="roster-fiba-list">
              {rosterVisita.map((j) => (
                <div key={j.id} className="roster-fiba-item">
                  <div className="fiba-dorsal">#{j.dorsal}</div>
                  <div className="fiba-info">
                    <strong>{j.nombre}</strong>
                    <span>{j.pts}pts | {j.flt}F | EFF: {calcularEff(j)}</span>
                  </div>
                </div>
              ))}
              {rosterVisita.length === 0 && <p className="text-muted text-center" style={{ margin: '15px 0' }}>Sin jugadores de visita para este filtro.</p>}
            </div>
            <div className="mesa-add-player mt-10">
              <input className="form-input" placeholder="Nombre jugadora/or" value={nuevoNombreVisita} onChange={(e) => setNuevoNombreVisita(e.target.value)} />
              <input className="form-input" placeholder="Dorsal" value={nuevoDorsalVisita} onChange={(e) => setNuevoDorsalVisita(e.target.value)} />
              <button className="btn-secondary" onClick={() => agregarJugadorManual({ tipo: 'visita' })}>Añadir Visita</button>
            </div>
          </div>
        )}
      </div>
        </div>
      )}

      {moduloMesa === 'analitica' && (
      <>
      <div className="card mt-20" style={{ borderRadius: '24px' }}>
        <h4 className="form-subtitle" style={{ fontWeight: '900' }}><Shield size={16} color="#6B7280" strokeWidth={1.5} /> Seguimiento Estadístico (Eficiencia)</h4>
        <div className="mesa-stats-grid">
          <div className="mesa-stats-box">
            <h6>{equipoLocal?.nombre || 'Local'}</h6>
            <p>EFF Equipo: <strong>{resumenLocal.effTotal}</strong> | Promedio: <strong>{resumenLocal.jugadores ? (resumenLocal.effTotal / resumenLocal.jugadores).toFixed(1) : '0.0'}</strong></p>
            <p>PTS: {resumenLocal.pts} | REB: {resumenLocal.reb} | AST: {resumenLocal.ast} | STL: {resumenLocal.stl}</p>
          </div>
          {modoAnalisis === 'dos' && (
            <div className="mesa-stats-box">
              <h6>{equipoVisita?.nombre || 'Visita'}</h6>
              <p>EFF Equipo: <strong>{resumenVisita.effTotal}</strong> | Promedio: <strong>{resumenVisita.jugadores ? (resumenVisita.effTotal / resumenVisita.jugadores).toFixed(1) : '0.0'}</strong></p>
              <p>PTS: {resumenVisita.pts} | REB: {resumenVisita.reb} | AST: {resumenVisita.ast} | STL: {resumenVisita.stl}</p>
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
      </div>

      <div className="card mt-20 mesa-historial-card" style={{ borderRadius: '24px' }}>
        <h4 className="form-subtitle" style={{ fontWeight: '900' }}><FileText size={16} color="#6B7280" strokeWidth={1.5} /> Historial de Partidos Guardados</h4>
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
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card mt-20" style={{ borderRadius: '24px' }}>
        <h4 className="form-subtitle" style={{ fontWeight: '900' }}><Shield size={16} color="#6B7280" strokeWidth={1.5} /> Analítica Histórica Comparativa</h4>
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
                    <strong>{Number(j.pts || 0)} PTS · {Number(j.reb || 0)} REB · {Number(j.ast || 0)} AST</strong>
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
                    <strong>{Number(j.pts || 0)} PTS · {Number(j.reb || 0)} REB · {Number(j.ast || 0)} AST</strong>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      </>
      )}

      {moduloMesa === 'live' && (
      <div className="card mt-20" style={{ borderRadius: '24px' }}>
        <h4 className="form-subtitle" style={{ fontWeight: '900' }}><FileText size={16} color="#6B7280" strokeWidth={1.5} /> Línea de Tiempo (Play-by-Play)</h4>
        <div style={{ display: 'flex', gap: '10px' }} className="mb-15"><input type="text" className="form-input" placeholder="Nota táctica o scouting..." value={notaScouting} onChange={(e) => setNotaScouting(e.target.value)} /><button className="btn-electric" style={{ width: 'auto', padding: '0 20px' }} onClick={() => { if (!notaScouting) return; setPlayByPlay((prev) => [{ id: nextId(), tiempo: 'DT', texto: `📝 ${notaScouting}` }, ...prev]); setNotaScouting(''); }}>Log</button></div>
        <div className="play-by-play-box">{playByPlay.length === 0 ? <p className="text-center text-muted" style={{ fontSize: '13px', fontStyle: 'italic', margin: '20px 0' }}>Inicio de transmisión.</p> : playByPlay.map(play => (<div key={play.id} className="play-row"><span className="play-tiempo">{play.tiempo}</span><span className="play-texto">{play.texto}</span></div>))}</div>
      </div>
      )}
    </div>
  );
}

export default MesaControlPanel;
