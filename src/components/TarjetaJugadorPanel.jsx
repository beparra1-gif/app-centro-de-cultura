import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { BadgeCheck, Camera, Download, ClipboardEdit, Loader2, Mars, QrCode, ScanLine, ShieldCheck, Shirt, Sparkles, Trophy, User, Users, Venus, X } from 'lucide-react';
import html2canvas from 'html2canvas';
import { QRCodeSVG } from 'qrcode.react';
import { PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart } from 'recharts';
import PupiloSelector from './PupiloSelector';
import BuscadorJugadorAdmin from './BuscadorJugadorAdmin';
import EditarJugadorModal from './EditarJugadorModal';
import QrScanner from './QrScanner';
import * as api from '../api/client';
import { showToast } from '../utils/toast';

// Los 5 marcos (public/tarjetas-marcos/) son ahora PNG sin fondo (transparente
// fuera y dentro del marco, 2800x4968 los 5 por igual), así que se usa la
// proporción real de esa imagen — ya no hace falta el recorte 106%/-3% que
// se usaba antes para tapar un borde negro de mármol del recorte viejo.
const EXPORT_WIDTH = 750;
const EXPORT_HEIGHT = Math.round(EXPORT_WIDTH * (4968 / 2800)); // 1330

// Marco real (PNG que mandó el usuario) en vez de un marco dibujado en CSS —
// el usuario pidió que el diseño sea exacto al que mandó, no una imitación.
// foto: bordes del hueco transparente real DENTRO de cada PNG. escudo: el
// círculo metálico ya dibujado en el marco (arriba a la izquierda), donde va
// el logo del club. Ambos medidos por pixel-scan automático (canal alfa) por
// tier, porque aunque comparten tamaño no comparten exactamente el mismo
// diseño de marco.
const MARCO_POR_RAREZA = {
  // foto: margen medido por pixel-scan MENOS ~1pt de "sangrado" extra hacia
  // afuera en los 4 lados, para que la ventana quede bien metida debajo del
  // bisel del marco (que va encima) y no quede una línea delgada de
  // antialiasing del PNG asomando entre la foto y el metal.
  BRONCE: { src: '/tarjetas-marcos/bronce.png', foto: { left: 8.29, right: 7.68, top: 4.01, bottom: 3.53 }, escudo: { left: 10.04, top: 5.97, diametro: 27.45 } },
  PLATA: { src: '/tarjetas-marcos/plata.png', foto: { left: 8.32, right: 7.93, top: 3.87, bottom: 3.71 }, escudo: { left: 9.73, top: 5.91, diametro: 27.92 } },
  ORO: { src: '/tarjetas-marcos/oro.png', foto: { left: 7.82, right: 8.25, top: 4.03, bottom: 3.55 }, escudo: { left: 9.44, top: 6.02, diametro: 28.03 } },
  PLATINO: { src: '/tarjetas-marcos/platino.png', foto: { left: 8.89, right: 8.61, top: 4.64, bottom: 4.05 }, escudo: { left: 8.93, top: 5.31, diametro: 29.36 } },
  DIAMANTE: { src: '/tarjetas-marcos/diamante.png', foto: { left: 8.86, right: 8.61, top: 4.54, bottom: 4.03 }, escudo: { left: 9.20, top: 5.34, diametro: 29.06 } },
  VISITA: { src: '/tarjetas-marcos/plata.png', foto: { left: 8.32, right: 7.93, top: 3.87, bottom: 3.71 }, escudo: { left: 9.73, top: 5.91, diametro: 27.92 } },
};

// Rutas que el backend devuelve como /api/logo-assets/file/... (guardado
// BYTEA en DB) necesitan resolverse contra el origen del backend, no del
// frontend: en dev corren en puertos distintos (Vite no proxya /api).
const resolverUrlFoto = (foto = '') => {
  if (!foto || !foto.startsWith('/api/')) return foto;
  const origen = String(api.API_BASE_URL_CONFIG || '').replace(/\/api\/?$/, '');
  return `${origen}${foto}`;
};

const cargarImagenDesdeBlob = (blob) => new Promise((resolve, reject) => {
  const url = URL.createObjectURL(blob);
  const img = new Image();
  img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
  img.onerror = (err) => { URL.revokeObjectURL(url); reject(err); };
  img.src = url;
});

const DISENOS_MARCO = {
  clasico: { etiqueta: 'Clásico', extraBorder: null, extraShadow: null, extraFilter: null },
  neon: { etiqueta: 'Neón', extraBorder: '2px solid #39FF88', extraShadow: '0 0 4px 1px rgba(57,255,136,0.55), 0 0 26px 6px rgba(57,255,136,0.35)', extraFilter: null },
  vintage: { etiqueta: 'Vintage', extraBorder: '2px solid #C9A66B', extraShadow: '0 0 0 4px rgba(201,166,107,0.2)', extraFilter: 'sepia(0.3) saturate(1.1)' },
  holografico: { etiqueta: 'Holográfico', extraBorder: '2px solid rgba(255,255,255,0.65)', extraShadow: '0 0 6px 2px rgba(255,105,180,0.45), 0 0 18px 6px rgba(120,190,255,0.4), 0 0 30px 10px rgba(255,230,120,0.3)', extraFilter: null },
};

// 5 niveles de rareza (Bronce/Plata/Oro/Platino/Diamante), inspirados en las
// referencias de tarjetas metálicas que trajo el usuario. Extraído como
// función pura (no depende de props/estado del componente) para poder
// aplicar el mismo marco tanto a la tarjeta propia como a cada mini-tarjeta
// del álbum de colección (cada compañera tiene su propio nivel).
const obtenerEstiloRarezaPorNivel = (nivel) => {
  const nivelNumero = Number(nivel) || 0;

  if (nivelNumero > 40) {
    return {
      texto: 'DIAMANTE',
      estilo: {
        background: 'linear-gradient(145deg, #0C4A6E 0%, #66D9FF 45%, #F2FDFF 100%)',
        accent: '#F2FDFF',
        border: 'rgba(255,255,255,0.55)',
        glow: '0 0 0 2px rgba(255,255,255,0.55), 0 0 22px 4px rgba(150,220,255,0.4), 0 0 34px 10px rgba(255,190,250,0.22)',
        pattern: 'repeating-linear-gradient(115deg, rgba(255,255,255,0.18) 0px, rgba(255,255,255,0.18) 2px, transparent 2px, transparent 10px), repeating-linear-gradient(25deg, rgba(180,240,255,0.16) 0px, rgba(180,240,255,0.16) 1px, transparent 1px, transparent 16px)',
        sparkle: true,
      },
    };
  }
  if (nivelNumero > 30) {
    return {
      texto: 'PLATINO',
      estilo: {
        background: 'linear-gradient(145deg, #4A5560 0%, #B9C6D1 45%, #F4F9FC 100%)',
        accent: '#EAF6FF',
        border: 'rgba(230,245,255,0.5)',
        glow: '0 0 0 1px rgba(230,245,255,0.4), 0 0 14px 2px rgba(210,235,255,0.3)',
        pattern: 'repeating-linear-gradient(115deg, rgba(255,255,255,0.12) 0px, rgba(255,255,255,0.12) 2px, transparent 2px, transparent 13px)',
      },
    };
  }
  if (nivelNumero > 20) {
    return {
      texto: 'ORO',
      estilo: {
        background: 'linear-gradient(145deg, #5C3D00 0%, #C9910B 45%, #FFD873 100%)',
        accent: '#FFEFC2',
        border: 'rgba(255,241,199,0.45)',
        glow: '0 0 0 1px rgba(255,241,199,0.3), 0 0 12px 2px rgba(255,201,77,0.25)',
        pattern: 'repeating-linear-gradient(115deg, rgba(255,255,255,0.12) 0px, rgba(255,255,255,0.12) 2px, transparent 2px, transparent 12px), repeating-linear-gradient(25deg, rgba(255,241,199,0.10) 0px, rgba(255,241,199,0.10) 1px, transparent 1px, transparent 18px)',
      },
    };
  }
  if (nivelNumero > 10) {
    return {
      texto: 'PLATA',
      estilo: {
        background: 'linear-gradient(145deg, #3E4750 0%, #8E97A0 45%, #E7ECEF 100%)',
        accent: '#F5F8FA',
        border: 'rgba(255,255,255,0.35)',
        glow: '0 0 0 1px rgba(255,255,255,0.25)',
        pattern: 'repeating-linear-gradient(115deg, rgba(255,255,255,0.09) 0px, rgba(255,255,255,0.09) 2px, transparent 2px, transparent 14px)',
      },
    };
  }
  return {
    texto: 'BRONCE',
    estilo: {
      background: 'linear-gradient(145deg, #3D2413 0%, #8B5A2B 45%, #C9793F 100%)',
      accent: '#F0C199',
      border: 'rgba(255,214,170,0.4)',
      glow: '0 0 0 1px rgba(255,214,170,0.25)',
      pattern: 'repeating-linear-gradient(115deg, rgba(255,255,255,0.06) 0px, rgba(255,255,255,0.06) 2px, transparent 2px, transparent 14px)',
    },
  };
};

function TarjetaJugadorPanel({
  pupiloActivo,
  setPupiloActivo,
  pupilosDisponibles,
  rolUsuario,
}) {
  const cardRef = useRef(null);
  const cardFrontExportRef = useRef(null);
  const [mostrarCredencialAsistencia, setMostrarCredencialAsistencia] = useState(false);
  const [mostrarEditarJugador, setMostrarEditarJugador] = useState(false);
  const [detalleJugador, setDetalleJugador] = useState(null);
  const [mostrarSubirFoto, setMostrarSubirFoto] = useState(false);
  const [archivoFoto, setArchivoFoto] = useState(null);
  const [previewFoto, setPreviewFoto] = useState('');
  const [procesandoFoto, setProcesandoFoto] = useState(false);
  // El mismo modal/editor de encuadre sirve para dos fotos DISTINTAS del
  // jugador: 'perfil' (foto_jugador, general, botón de la Tarjeta Oficial)
  // y 'coleccion' (foto_tarjeta_coleccion, botón del panel de la tarjeta
  // coleccionable) — nunca deben pisarse entre sí.
  const [modoFotoObjetivo, setModoFotoObjetivo] = useState('coleccion');
  // Editor de encuadre: el jugador elige qué parte de SU foto (horizontal,
  // vertical, chica, lo que sea) se ve dentro de la ventana de la tarjeta,
  // arrastrando para mover y con el slider para acercar/alejar — en vez de
  // un recorte automático "a ciegas" con objectFit:cover que podía cortar
  // mal fotos horizontales o muy chicas.
  const [fotoNatural, setFotoNatural] = useState({ w: 0, h: 0 });
  const [cropZoom, setCropZoom] = useState(1);
  const [cropOffset, setCropOffset] = useState({ x: 0, y: 0 });
  const cropDragRef = useRef(null);
  const [guardandoDiseno, setGuardandoDiseno] = useState(false);
  const [resumenAsistencia, setResumenAsistencia] = useState(null);
  const [mostrarDetalleAsistencia, setMostrarDetalleAsistencia] = useState(false);
  const [ultimaEvaluacion, setUltimaEvaluacion] = useState(null);
  const [resumenEstadisticas, setResumenEstadisticas] = useState(null);
  const [mostrarMiQRColeccion, setMostrarMiQRColeccion] = useState(false);
  const [mostrarEscanerColeccion, setMostrarEscanerColeccion] = useState(false);
  const [mostrarAlbum, setMostrarAlbum] = useState(false);
  const [album, setAlbum] = useState({ items: [], total_club: 0 });
  const [cargandoAlbum, setCargandoAlbum] = useState(false);

  // pupiloActivo.asistencia nunca existe (no es un campo real de jugadores)
  // — el resumen se calcula en el backend a partir de las listas que ya
  // guarda StaffAsistenciaPanel (tabla asistencia), no de un valor estático.
  useEffect(() => {
    let cancelled = false;

    const cargarResumenAsistencia = async () => {
      const rut = String(pupiloActivo?.rut || '').trim();
      if (!rut || rolUsuario === 'visita') {
        setResumenAsistencia(null);
        return;
      }

      try {
        const resumen = await api.asistenciaAPI.getResumenJugador(rut);
        if (!cancelled) {
          setResumenAsistencia(resumen || null);
        }
      } catch {
        if (!cancelled) {
          setResumenAsistencia(null);
        }
      }
    };

    void cargarResumenAsistencia();
    return () => {
      cancelled = true;
    };
  }, [pupiloActivo?.rut, rolUsuario]);

  // Promedios reales de juego (PTS/REB/AST) para la Tarjeta — sin partidos
  // registrados, "partidos: 0" (el backend nunca inventa un promedio en 0).
  useEffect(() => {
    let cancelled = false;

    const cargarResumenEstadisticas = async () => {
      const rut = String(pupiloActivo?.rut || '').trim();
      if (!rut || rolUsuario === 'visita') {
        setResumenEstadisticas(null);
        return;
      }

      try {
        const resumen = await api.estadisticasAPI.getResumenJugador(rut);
        if (!cancelled) {
          setResumenEstadisticas(resumen || null);
        }
      } catch {
        if (!cancelled) {
          setResumenEstadisticas(null);
        }
      }
    };

    void cargarResumenEstadisticas();
    return () => {
      cancelled = true;
    };
  }, [pupiloActivo?.rut, rolUsuario]);

  // El radar de Físico/Técnica/Táctica leía detalleJugador.fisico_score/
  // tecnica_score/tactica_score, campos que jamás existieron — siempre
  // mostraba 60/58/55 fijos para todos. Se reemplaza por la evaluación real
  // más reciente del staff (tabla evaluaciones, mismo puntaje 0-100 que ya
  // usa el formulario de Radar/Evaluación).
  useEffect(() => {
    let cancelled = false;

    const cargarUltimaEvaluacion = async () => {
      const rut = String(pupiloActivo?.rut || '').trim();
      if (!rut || rolUsuario === 'visita') {
        setUltimaEvaluacion(null);
        return;
      }

      try {
        const evaluaciones = await api.evaluacionesAPI.getByJugador(rut);
        if (!cancelled) {
          setUltimaEvaluacion(Array.isArray(evaluaciones) && evaluaciones.length > 0 ? evaluaciones[0] : null);
        }
      } catch {
        if (!cancelled) {
          setUltimaEvaluacion(null);
        }
      }
    };

    void cargarUltimaEvaluacion();
    return () => {
      cancelled = true;
    };
  }, [pupiloActivo?.rut, rolUsuario]);

  useEffect(() => {
    let cancelled = false;

    const cargarDetalleJugador = async () => {
      const rut = String(pupiloActivo?.rut || '').trim();
      if (!rut || rolUsuario === 'visita') {
        setDetalleJugador(null);
        return;
      }

      try {
        const detalle = await api.jugadoresAPI.getByRut(rut);
        if (!cancelled) {
          setDetalleJugador(detalle || null);
        }
      } catch {
        if (!cancelled) {
          setDetalleJugador(null);
        }
      }
    };

    void cargarDetalleJugador();
    return () => {
      cancelled = true;
    };
  }, [pupiloActivo?.rut, rolUsuario]);

  if (!pupiloActivo) {
    return <div className="player-screen-shell">Cargando tarjeta del jugador...</div>;
  }

  const xpActual = Number(pupiloActivo.xp ?? pupiloActivo.xp_total ?? 0);
  const nivelBase = Number(pupiloActivo.nivel ?? pupiloActivo.nivel_actual ?? 1) || 1;
  const puntosGamificacion = Number(
    pupiloActivo.puntos_gamificacion
    ?? pupiloActivo.puntos
    ?? Math.max(0, Math.round(xpActual / 10))
  );
  const rachaActual = Number(pupiloActivo.racha ?? pupiloActivo.racha_actual ?? Math.max(1, Math.floor(xpActual / 500))) || 1;
  const xpParaSiguienteNivel = Math.max(0, 150 - (xpActual % 150));
  const progresoNivel = Math.min(100, Math.round(((xpActual % 150) / 150) * 100));
  const insignias = Array.isArray(pupiloActivo.insignias) && pupiloActivo.insignias.length > 0
    ? pupiloActivo.insignias
    : [
        nivelBase >= 5 ? 'Constancia' : 'Inicio activo',
        xpActual >= 1000 ? 'Impulso XP' : 'Progreso',
        rachaActual >= 3 ? 'Racha' : 'En desarrollo',
      ];

  let { texto: textoRareza, estilo: estiloRareza } = obtenerEstiloRarezaPorNivel(nivelBase);
  const nivelActual = rolUsuario === 'visita' ? 'MAX' : nivelBase;
  const nivelActualNumero = Number(nivelActual) || 0;
  const rolNormalizado = String(rolUsuario || '').toLowerCase().replace('-', '_');
  const mostrarIndumentaria = ['admin', 'super_admin'].includes(rolNormalizado);
  const esAdminDatosJugador = ['admin', 'super_admin'].includes(rolNormalizado);
  const puedeEditarDatosJugador = rolUsuario !== 'visita';
  const normalizarRut = (rut = '') => String(rut || '').replace(/\./g, '').replace(/-/g, '').trim().toUpperCase();
  const pupiloDesdeListado = Array.isArray(pupilosDisponibles)
    ? pupilosDisponibles.find((item) => normalizarRut(item?.rut) === normalizarRut(pupiloActivo?.rut))
    : null;
  const construirNombreCompleto = (jugador = {}) => {
    const nombres = String(jugador?.nombres || '').trim();
    const paterno = String(jugador?.apellido_paterno || '').trim();
    const materno = String(jugador?.apellido_materno || '').trim();
    const compuesto = [nombres, paterno, materno].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
    if (compuesto) return compuesto;
    return String(jugador?.nombre || '').replace(/\s+/g, ' ').trim();
  };
  const nombreCompletoReal =
    construirNombreCompleto(pupiloActivo)
    || construirNombreCompleto(pupiloDesdeListado)
    || construirNombreCompleto(detalleJugador)
    || String(pupiloActivo?.nombre || '').trim();
  // El invitado escribe su propio nombre al entrar por "Acceso Visitas"
  // (App.jsx, handleLoginSubmit) — antes esto se pisaba siempre con
  // "INVITADO TORNEO"/"Invitado"/"TORNEO" fijos, sin importar qué nombre
  // real trajera pupiloActivo.nombre. Ahora solo se usa el genérico si de
  // verdad no hay ningún nombre (invitado que dejó el campo vacío).
  const nombreCompletoDisplay = nombreCompletoReal || (rolUsuario === 'visita' ? 'INVITADO' : 'JUGADOR');
  const partesNombre = String(nombreCompletoDisplay || '').trim().split(/\s+/).filter(Boolean);
  const nombreDisplay = partesNombre[0] || (rolUsuario === 'visita' ? 'Invitado' : 'Jugador');
  const anioNacimiento = (
    pupiloActivo.anioNacimiento
    || pupiloActivo.anio_nacimiento
    || pupiloActivo.ano_nacimiento
    || pupiloActivo['año_nacimiento']
    || pupiloActivo['a├▒o_nacimiento']
    || pupiloDesdeListado?.anioNacimiento
    || pupiloDesdeListado?.anio_nacimiento
    || pupiloDesdeListado?.ano_nacimiento
    || pupiloDesdeListado?.['año_nacimiento']
    || pupiloDesdeListado?.['a├▒o_nacimiento']
    || detalleJugador?.anioNacimiento
    || detalleJugador?.anio_nacimiento
    || detalleJugador?.ano_nacimiento
    || detalleJugador?.['año_nacimiento']
    || detalleJugador?.['a├▒o_nacimiento']
    || (detalleJugador?.fecha_nacimiento ? new Date(detalleJugador.fecha_nacimiento).getUTCFullYear() : '')
    || ''
  );
  const numeroCamiseta = (() => {
    const raw = (
      pupiloActivo.numeroCamiseta
      ?? pupiloActivo.numero_camiseta
      ?? pupiloActivo.numero
      ?? pupiloActivo.dorsal
      ?? pupiloDesdeListado?.numeroCamiseta
      ?? pupiloDesdeListado?.numero_camiseta
      ?? pupiloDesdeListado?.numero
      ?? pupiloDesdeListado?.dorsal
      ?? detalleJugador?.numeroCamiseta
      ?? detalleJugador?.numero_camiseta
      ?? detalleJugador?.numero
      ?? detalleJugador?.dorsal
      ?? 0
    );
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  })();
  const categoriaDisplay = rolUsuario === 'visita' ? 'Open' : (pupiloActivo.categoria || 'General');
  const categoriaConAnio = anioNacimiento ? `${categoriaDisplay} · ${anioNacimiento}` : categoriaDisplay;

  if (rolUsuario === 'visita') {
    textoRareza = 'VISITA';
    estiloRareza = {
      background: 'linear-gradient(145deg, #123A57 0%, #3BA4D8 100%)',
      accent: '#D7F2FF',
      border: 'rgba(255,255,255,0.22)',
      glow: '0 0 0 1px rgba(255,255,255,0.2)',
      pattern: 'repeating-linear-gradient(115deg, rgba(255,255,255,0.07) 0px, rgba(255,255,255,0.07) 2px, transparent 2px, transparent 14px)',
    };
  }

  const marcoActivo = MARCO_POR_RAREZA[textoRareza] || MARCO_POR_RAREZA.BRONCE;
  // Proporción real (ancho/alto) de la ventana donde se recorta la foto
  // dentro del marco — se usa para que la vista previa al subir la foto
  // muestre el mismo recorte que va a quedar en la tarjeta final, y el
  // jugador pueda elegir/ajustar la foto sabiendo cómo va a calzar.
  const fotoAspecto = (EXPORT_WIDTH * (100 - marcoActivo.foto.left - marcoActivo.foto.right))
    / (EXPORT_HEIGHT * (100 - marcoActivo.foto.top - marcoActivo.foto.bottom));
  // Proporción del recuadro de foto en la Tarjeta Oficial (official-player-
  // photo-frame, width:180 height:214 más abajo) — el editor de encuadre
  // reutiliza la misma caja para las dos fotos, así que necesita saber cuál
  // proporción usar según modoFotoObjetivo.
  const FOTO_ASPECTO_PERFIL = 180 / 214;
  const aspectoActivo = modoFotoObjetivo === 'perfil' ? FOTO_ASPECTO_PERFIL : fotoAspecto;
  // Editor de encuadre: caja de recorte en pantalla (px) con la proporción
  // real de la ventana destino. cropEscalaBase es el zoom mínimo para que la
  // foto cubra toda la caja (equivalente a objectFit:cover en zoom 1);
  // cropZoom (>=1) lo multiplica cuando el jugador acerca.
  const CROP_BOX_ANCHO = 240;
  const CROP_BOX_ALTO = Math.round(CROP_BOX_ANCHO / aspectoActivo);
  const cropEscalaBase = fotoNatural.w > 0
    ? Math.max(CROP_BOX_ANCHO / fotoNatural.w, CROP_BOX_ALTO / fotoNatural.h)
    : 1;
  const cropImgAncho = fotoNatural.w * cropEscalaBase * cropZoom;
  const cropImgAlto = fotoNatural.h * cropEscalaBase * cropZoom;
  const clampCropOffset = (offset, imgAncho = cropImgAncho, imgAlto = cropImgAlto) => ({
    x: Math.min(0, Math.max(CROP_BOX_ANCHO - imgAncho, offset.x)),
    y: Math.min(0, Math.max(CROP_BOX_ALTO - imgAlto, offset.y)),
  });
  const rutValidacion = rolUsuario === 'visita' ? 'VISITA' : (pupiloActivo.rut || 'SIN-RUT');
  const clubNombre = pupiloActivo.club_nombre || pupiloActivo.club_procedencia || (rolUsuario === 'visita' ? 'Club invitado' : 'Centro de Cultura Física');
  const clubLogoUrl = pupiloActivo.club_logo_url || '/logos/club-logo.png';
  // foto_jugador es la foto de perfil GENERAL del deportista (se usa en el
  // avatar del header, Tesorería, la Tarjeta Oficial CCF, etc. — ver App.jsx
  // y PerfilTesoreriaPanel). foto_tarjeta_coleccion es un campo aparte, solo
  // para la tarjeta con marco metálico: el jugador pidió explícitamente que
  // subir una no cambie la otra, ya que antes compartían el mismo campo.
  // Ambas se leen frescas desde detalleJugador (/api/jugadores/:rut), no de
  // pupiloActivo, que puede venir mezclado con el roster de otros paneles.
  const fotoPrincipal = resolverUrlFoto(detalleJugador?.foto_jugador || '');
  const fotoColeccion = resolverUrlFoto(detalleJugador?.foto_tarjeta_coleccion || '');
  const disenoActivo = DISENOS_MARCO[detalleJugador?.diseno_marco || pupiloActivo.diseno_marco || 'clasico'] || DISENOS_MARCO.clasico;
  const descriptorGenero = `${pupiloActivo.genero || ''} ${pupiloActivo.sexo || ''} ${pupiloActivo.rama || ''}`.toLowerCase();
  const esFemenino = descriptorGenero.includes('femen') || descriptorGenero.includes('mujer');
  const clubIniciales = clubNombre
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((parte) => parte[0])
    .join('')
    .toUpperCase() || 'CCF';
  const etiquetaClub = rolUsuario === 'visita' ? 'INVITADO' : 'LOCAL';
  const hashSerial = (String(pupiloActivo.rut || pupiloActivo.nombre || 'ccf')
    .split('')
    .reduce((acc, char) => ((acc * 31) + char.charCodeAt(0)) % 9973, 0) % 500) + 1;
  const serialTexto = `${String(hashSerial).padStart(3, '0')}/500`;
  const qrPayload = JSON.stringify({
    tipo: 'asistencia_ccf',
    rut: rutValidacion,
    nombre: nombreCompletoDisplay,
    categoria: pupiloActivo.categoria || 'General',
  });
  // QR distinto al de asistencia: este es el que una compañera escanea para
  // agregar ESTA tarjeta a su álbum de colección (no marca nada de asistencia).
  const qrColeccionPayload = JSON.stringify({
    tipo: 'coleccion_tarjeta',
    rut: rutValidacion,
    nombre: nombreCompletoDisplay,
  });
  const porcentajeDesdeTexto = (valor = '') => {
    const txt = String(valor || '').trim();
    const match = txt.match(/(\d{1,3})/);
    if (!match) return null;
    const parsed = Number(match[1]);
    if (!Number.isFinite(parsed)) return null;
    return Math.max(0, Math.min(100, parsed));
  };
  // Semáforo: verde ≥80%, amarillo 50-79%, rojo <50%. Sin registros todavía
  // (nadie ha tomado lista aún) se muestra en gris, no rojo — no es lo mismo
  // "no hay datos" que "asistencia mala".
  const colorSemaforoAsistencia = (porcentaje) => {
    if (!Number.isFinite(porcentaje)) return 'rgba(255,255,255,0.6)';
    if (porcentaje >= 80) return 'var(--verde-victoria)';
    if (porcentaje >= 50) return '#FF9500';
    return 'var(--rojo-alerta)';
  };
  const asistenciaRadar = Number.isFinite(resumenAsistencia?.porcentaje)
    ? resumenAsistencia.porcentaje
    : (porcentajeDesdeTexto(pupiloActivo.asistencia) ?? Math.max(20, Math.min(100, rachaActual * 12)));
  const progresoRadar = Math.max(0, Math.min(100, progresoNivel));
  // puntaje_condicion/tecnica/mental ya vienen 0-100 (mismo rango que llena
  // el staff en Radar/Evaluación) — sin evaluación real todavía, se muestra
  // en 0 en vez de un número inventado (ver hayEvaluacionReal más abajo).
  const hayEvaluacionReal = Boolean(ultimaEvaluacion);
  const fisicoRadar = hayEvaluacionReal ? Math.max(0, Math.min(100, Number(ultimaEvaluacion.puntaje_condicion) || 0)) : 0;
  const tecnicaRadar = hayEvaluacionReal ? Math.max(0, Math.min(100, Number(ultimaEvaluacion.puntaje_tecnica) || 0)) : 0;
  const tacticaRadar = hayEvaluacionReal ? Math.max(0, Math.min(100, Number(ultimaEvaluacion.puntaje_mental) || 0)) : 0;
  const radarGamificacionData = [
    { area: 'Fisico', valor: fisicoRadar },
    { area: 'Tecnica', valor: tecnicaRadar },
    { area: 'Tactica', valor: tacticaRadar },
    { area: 'Asistencia', valor: asistenciaRadar },
    { area: 'Progreso', valor: progresoRadar },
  ];

  const canvasABlob = (canvas) => new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('No se pudo generar la imagen.'))), 'image/png');
  });

  const descargarBlob = (blob, nombreArchivo) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = nombreArchivo;
    document.body.appendChild(link);
    link.click();
    link.remove();
    // Revocar después de un tick: algunos navegadores inician la descarga
    // de forma asíncrona y revocar de inmediato la corta a mitad de camino.
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };

  const capturarRefExport = async (targetRef) => {
    if (!targetRef.current) throw new Error('No se pudo preparar la tarjeta para exportar.');
    return html2canvas(targetRef.current, {
      backgroundColor: null,
      scale: 2,
      useCORS: true,
      // Sin width/height fijo: el frente ahora mide el marco real + el
      // recuadro de datos debajo (alto variable), así que se deja que
      // html2canvas mida el alto real en vez de recortarlo a EXPORT_HEIGHT.
      width: targetRef.current.offsetWidth,
      height: targetRef.current.offsetHeight,
    });
  };

  const descargarTarjetaColeccionActual = async () => {
    if (!cardFrontExportRef.current) return;
    try {
      const canvas = await capturarRefExport(cardFrontExportRef);
      const blob = await canvasABlob(canvas);
      const nombreArchivo = `tarjeta-coleccion-${String(nombreDisplay || 'jugador').toLowerCase()}.png`;

      // En móviles con soporte de Web Share (con archivos), compartir es más
      // útil que descargar a una carpeta que el jugador no revisa — permite
      // guardarla en fotos o enviarla directo por WhatsApp, que era parte del
      // pedido original ("descargar y compartir").
      const archivo = new File([blob], nombreArchivo, { type: 'image/png' });
      if (navigator.canShare && navigator.canShare({ files: [archivo] })) {
        try {
          await navigator.share({ files: [archivo], title: 'Mi Tarjeta CCF', text: '¡Mira mi Tarjeta de colección!' });
          return;
        } catch (shareError) {
          if (shareError?.name === 'AbortError') return; // el usuario cerró el share sheet
          // Si share falla por otra razón, seguimos con la descarga normal.
        }
      }

      descargarBlob(blob, nombreArchivo);
    } catch {
      showToast({ message: 'No se pudo descargar la tarjeta en este momento.', type: 'error' });
    }
  };

  const cargarAlbum = async () => {
    const rut = String(pupiloActivo?.rut || '').trim();
    if (!rut) return;
    setCargandoAlbum(true);
    try {
      const data = await api.jugadoresAPI.getColeccion(rut);
      setAlbum({ items: data?.items || [], total_club: data?.total_club || 0 });
    } catch (error) {
      showToast({ message: error.message || 'No se pudo cargar tu álbum.', type: 'error' });
    } finally {
      setCargandoAlbum(false);
    }
  };

  const abrirAlbum = () => {
    setMostrarAlbum(true);
    void cargarAlbum();
  };

  const handleEscaneoColeccion = async (payload) => {
    const rut = String(pupiloActivo?.rut || '').trim();
    if (!rut || !payload?.rut) return;
    try {
      const resultado = await api.jugadoresAPI.agregarAColeccion(rut, payload.rut);
      if (resultado.nueva) {
        showToast({ message: `¡Agregaste la tarjeta de ${resultado.nombre || payload.nombre} a tu álbum!`, type: 'success' });
      } else {
        showToast({ message: `Ya tenías la tarjeta de ${resultado.nombre || payload.nombre}.`, type: 'info' });
      }
      if (mostrarAlbum) void cargarAlbum();
    } catch (error) {
      showToast({ message: error.message || 'No se pudo agregar esa tarjeta.', type: 'error' });
    }
  };

  const cambiarDisenoMarco = async (nuevoValor) => {
    const rut = String(pupiloActivo?.rut || '').trim();
    if (!rut) return;
    setGuardandoDiseno(true);
    try {
      const actualizado = await api.jugadoresAPI.update(rut, { diseno_marco: nuevoValor });
      setDetalleJugador((prev) => ({ ...prev, ...actualizado }));
      showToast({ message: 'Diseño de tarjeta actualizado.', type: 'success' });
    } catch (error) {
      showToast({ message: error.message || 'No se pudo cambiar el diseño.', type: 'error' });
    } finally {
      setGuardandoDiseno(false);
    }
  };

  const cerrarModalFoto = () => {
    setMostrarSubirFoto(false);
    setArchivoFoto(null);
    setPreviewFoto((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return '';
    });
    setFotoNatural({ w: 0, h: 0 });
    setCropZoom(1);
    setCropOffset({ x: 0, y: 0 });
    setModoFotoObjetivo('coleccion');
  };

  const handleSeleccionArchivoFoto = async (file) => {
    if (!file) return;
    setArchivoFoto(file);
    setPreviewFoto((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
    setCropZoom(1);
    try {
      const img = await cargarImagenDesdeBlob(file);
      const natW = img.naturalWidth || img.width;
      const natH = img.naturalHeight || img.height;
      setFotoNatural({ w: natW, h: natH });
      // Centrado por defecto (equivalente al objectFit:cover de antes),
      // el jugador puede arrastrar desde ahí para elegir otro encuadre.
      const baseScale = Math.max(CROP_BOX_ANCHO / natW, CROP_BOX_ALTO / natH);
      setCropOffset({
        x: (CROP_BOX_ANCHO - natW * baseScale) / 2,
        y: (CROP_BOX_ALTO - natH * baseScale) / 2,
      });
    } catch {
      setFotoNatural({ w: 0, h: 0 });
    }
  };

  const handleCropPointerDown = (e) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    cropDragRef.current = { startX: e.clientX, startY: e.clientY, offset: cropOffset };
  };
  const handleCropPointerMove = (e) => {
    if (!cropDragRef.current) return;
    const { startX, startY, offset } = cropDragRef.current;
    setCropOffset(clampCropOffset({
      x: offset.x + (e.clientX - startX),
      y: offset.y + (e.clientY - startY),
    }));
  };
  const handleCropPointerUp = () => { cropDragRef.current = null; };

  const handleCropZoomChange = (nuevoZoom) => {
    const nuevoImgAncho = fotoNatural.w * cropEscalaBase * nuevoZoom;
    const nuevoImgAlto = fotoNatural.h * cropEscalaBase * nuevoZoom;
    setCropZoom(nuevoZoom);
    setCropOffset((prev) => clampCropOffset(prev, nuevoImgAncho, nuevoImgAlto));
  };

  // Dibuja en un canvas exactamente el encuadre que el jugador armó
  // (arrastre + zoom) y lo sube ya recortado a la proporción real de la
  // ventana destino (distinta según modoFotoObjetivo).
  const recortarFotoParaSubir = async () => {
    const img = await cargarImagenDesdeBlob(archivoFoto);
    const TARGET_ANCHO = 700;
    const TARGET_ALTO = Math.round(TARGET_ANCHO / aspectoActivo);
    const factor = TARGET_ANCHO / CROP_BOX_ANCHO;
    const canvas = document.createElement('canvas');
    canvas.width = TARGET_ANCHO;
    canvas.height = TARGET_ALTO;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(
      img,
      cropOffset.x * factor, cropOffset.y * factor,
      cropImgAncho * factor, cropImgAlto * factor,
    );
    return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), 'image/jpeg', 0.92));
  };

  const handleConfirmarFoto = async () => {
    const rut = String(pupiloActivo?.rut || '').trim();
    if (!rut || !archivoFoto) return;
    setProcesandoFoto(true);
    try {
      const blobRecortado = await recortarFotoParaSubir();
      const nombreArchivo = modoFotoObjetivo === 'perfil' ? 'foto-perfil.jpg' : 'foto-tarjeta.jpg';
      const archivoParaSubir = new File([blobRecortado], nombreArchivo, { type: 'image/jpeg' });
      const formData = new FormData();
      formData.append('archivo', archivoParaSubir);
      // Dos campos separados a pedido del usuario: subir la foto de la
      // tarjeta coleccionable NUNCA debe cambiar la foto de perfil general,
      // y viceversa.
      const actualizado = modoFotoObjetivo === 'perfil'
        ? await api.jugadoresAPI.subirFoto(rut, formData)
        : await api.jugadoresAPI.subirFotoTarjeta(rut, formData);
      setDetalleJugador((prev) => ({ ...prev, ...actualizado }));
      showToast({ message: 'Foto actualizada correctamente.', type: 'success' });
      cerrarModalFoto();
    } catch (error) {
      showToast({ message: error.message || 'No se pudo procesar o subir la foto.', type: 'error' });
    } finally {
      setProcesandoFoto(false);
    }
  };

  // Dibuja el frente de la tarjeta (marco real + foto + escudo + nivel/EXP +
  // datos al pie) una sola vez, a cualquier tamaño — la vista chica de "Ver
  // mi tarjeta de colección" y el export que se descarga usan EXACTAMENTE
  // esta misma función, solo con un ancho distinto. Antes eran dos diseños
  // separados que se iban desalineando cada vez que se ajustaba uno solo —
  // el usuario pidió que la vista previa sea idéntica a lo que se descarga.
  const renderFrenteTarjeta = ({ ancho, innerRef, sombra = false }) => {
    const escala = ancho / EXPORT_WIDTH;
    const alto = EXPORT_HEIGHT * escala;
    const s = (v) => `${Math.max(1, v * escala)}px`;
    return (
      <div
        ref={innerRef}
        style={{
          boxSizing: 'border-box',
          width: `${ancho}px`,
          height: `${alto}px`,
          position: 'relative',
          overflow: 'hidden',
          borderRadius: s(24),
          background: 'none',
          boxShadow: sombra ? '0 12px 24px rgba(15,23,42,0.3)' : undefined,
          filter: disenoActivo.extraFilter || undefined,
        }}
      >
        {/* Foto, DETRÁS del marco — así el borde metálico real del marco tapa
            el corte recto de la foto y se ve como una foto insertada de
            verdad, no una pegada encima. */}
        <div style={{
          position: 'absolute',
          left: `${marcoActivo.foto.left}%`, right: `${marcoActivo.foto.right}%`,
          top: `${marcoActivo.foto.top}%`, bottom: `${marcoActivo.foto.bottom}%`,
          overflow: 'hidden', background: '#F4F1EC', zIndex: 0,
        }}>
          {fotoColeccion ? (
            <img src={fotoColeccion} alt={`Foto de ${nombreDisplay}`} style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'contrast(1.08) saturate(1.15)' }} />
          ) : (
            <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: s(8), color: '#9A9186' }}>
              {esFemenino ? <Venus size={Math.max(14, 48 * escala)} /> : <Mars size={Math.max(14, 48 * escala)} />}
              <span style={{ fontSize: s(11), fontWeight: '800' }}>SIN FOTO</span>
            </div>
          )}


          {/* Datos al pie: sin placa de fondo, solo letra grande con sombra
              fuerte para que se lea encima de cualquier foto. Degradado más
              alto y con más escalones para que la transición se note menos
              como un "corte" cuando todavía no hay foto real (placeholder
              liso) — con foto real se nota aún menos. */}
          <div style={{
            position: 'absolute', left: 0, right: 0, bottom: 0, height: '52%',
            padding: `${s(10)} ${s(14)} ${s(52)}`, color: 'white', textAlign: 'center',
            display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
            textShadow: '0 2px 8px rgba(0,0,0,0.95), 0 0 18px rgba(0,0,0,0.8)',
            background: 'linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.12) 20%, rgba(0,0,0,0.32) 45%, rgba(0,0,0,0.55) 70%, rgba(0,0,0,0.72) 100%)',
          }}>
            <h1 style={{ margin: 0, fontFamily: 'Orbitron, Segoe UI, sans-serif', fontSize: nombreCompletoDisplay.length > 20 ? s(40) : s(52), lineHeight: 1.15, letterSpacing: '0.4px', textTransform: 'uppercase' }}>{nombreCompletoDisplay}</h1>
            <div style={{ marginTop: s(22), display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: s(4), fontSize: s(15), fontWeight: '800', textTransform: 'uppercase', opacity: 0.95 }}>
              <div>Nivel<strong style={{ display: 'block', fontSize: s(36), fontWeight: '900' }}>{rolUsuario === 'visita' ? 'MAX' : nivelActualNumero}</strong></div>
              <div>Posición<strong style={{ display: 'block', fontSize: s(36), fontWeight: '900' }}>{rolUsuario === 'visita' ? 'N/A' : (pupiloActivo.posicion || 'N/A')}</strong></div>
              <div>Estatura<strong style={{ display: 'block', fontSize: s(36), fontWeight: '900' }}>{pupiloActivo.estatura || 'N/A'}</strong></div>
              <div>Año<strong style={{ display: 'block', fontSize: s(36), fontWeight: '900' }}>{anioNacimiento || 'N/A'}</strong></div>
            </div>
          </div>
        </div>

        {/* Marco: el PNG real que mandó el usuario (public/tarjetas-marcos/),
            ENCIMA de la foto — su hueco es transparente así que la foto se ve
            igual, pero el borde/bisel real del marco queda por delante,
            tapando cualquier corte imperfecto de la foto. pointerEvents:none
            para que el botón de cambiar foto (debajo) se pueda seguir
            clickeando. */}
        <img
          src={marcoActivo.src}
          alt=""
          style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'fill', zIndex: 1, pointerEvents: 'none' }}
        />

        {/* Escudo del club, calzado dentro del círculo metálico ya dibujado
            en el marco — sin fondo propio. El logo va un poco más chico que
            el disco real (padding) para que se siga viendo el anillo
            metálico del marco alrededor, como una moneda con borde —
            si el logo tapa el disco entero no se nota que es un círculo
            de metal. Ancho y alto en px explícitos (no aspectRatio: html2canvas
            no soporta bien esa propiedad CSS y el círculo salía ovalado solo
            en la descarga, no en la vista previa normal del navegador). */}
        <div style={{
          position: 'absolute', left: `${marcoActivo.escudo.left}%`, top: `${marcoActivo.escudo.top}%`,
          width: `${ancho * (marcoActivo.escudo.diametro / 100)}px`, height: `${ancho * (marcoActivo.escudo.diametro / 100)}px`,
          borderRadius: '50%', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: `${ancho * (marcoActivo.escudo.diametro / 100) * 0.09}px`, boxSizing: 'border-box',
          zIndex: 2,
        }}>
          {clubLogoUrl ? (
            <img src={clubLogoUrl} alt={`Escudo de ${clubNombre}`} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
          ) : (
            <span style={{ fontSize: s(20), fontWeight: '900', color: '#333' }}>{clubIniciales}</span>
          )}
        </div>

        {/* Nivel / EXP / n° de tarjeta — sin placa de fondo, solo letra con
            sombra directamente sobre el marco/foto, como en la referencia
            del usuario: Nivel y Exp en dos columnas lado a lado, serie debajo.
            Bien grande — el usuario lo marcó como "se ve muy pequeño". */}
        <div style={{
          position: 'absolute', top: `${marcoActivo.foto.top + 3}%`, right: `${marcoActivo.foto.right + 6}%`,
          display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: s(5),
          color: 'white', textShadow: '0 2px 6px rgba(0,0,0,0.9), 0 0 10px rgba(0,0,0,0.75)',
          zIndex: 2,
        }}>
          <div style={{ display: 'flex', gap: s(28) }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: s(19), fontWeight: '800', opacity: 0.9, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Nivel</div>
              <div style={{ fontSize: s(50), fontWeight: '900', lineHeight: 1.1 }}>{rolUsuario === 'visita' ? 'MAX' : nivelActualNumero}</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: s(19), fontWeight: '800', opacity: 0.9, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Exp</div>
              <div style={{ fontSize: s(50), fontWeight: '900', lineHeight: 1.1 }}>{rolUsuario === 'visita' ? '—' : xpActual}</div>
            </div>
          </div>
          <div style={{ fontSize: s(26), fontWeight: '900', marginTop: s(2) }}>#{serialTexto}</div>
        </div>
      </div>
    );
  };

  return (
    <div className="player-screen-shell">
      {esAdminDatosJugador ? (
        <BuscadorJugadorAdmin
          jugadores={pupilosDisponibles}
          pupiloActivo={pupiloActivo}
          onSeleccionar={setPupiloActivo}
        />
      ) : (
        <PupiloSelector
          pupilos={pupilosDisponibles}
          pupiloActivo={pupiloActivo}
          rolUsuario={rolUsuario}
          onChangePupilo={setPupiloActivo}
        />
      )}

      {rolUsuario !== 'visita' && (
        <div className="card history-assist-card" style={{ marginTop: '4px', borderRadius: '18px', background: 'linear-gradient(135deg, #101C2E 0%, #142E45 100%)', color: 'white', border: '1px solid rgba(255,255,255,0.12)' }}>
          <div className="history-assist-layout">
            <div className="history-summary-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                <div>
                  <strong style={{ fontSize: '16px', fontWeight: '900' }}>Resumen del jugador</strong>
                </div>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: '900', padding: '6px 10px', borderRadius: '999px', background: 'rgba(255,255,255,0.16)' }}>
                  <Trophy size={14} /> Nivel {nivelActualNumero}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(145px, 1fr))', gap: '8px' }}>
                <div className="stat-box">
                  <span className="stat-label">Asistencia</span>
                  <strong className="stat-value" style={{ color: colorSemaforoAsistencia(resumenAsistencia?.porcentaje) }}>
                    {Number.isFinite(resumenAsistencia?.porcentaje) ? `${resumenAsistencia.porcentaje}%` : 'Sin registros'}
                  </strong>
                  {resumenAsistencia && (
                    <button
                      type="button"
                      onClick={() => setMostrarDetalleAsistencia(true)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginTop: '4px', fontSize: '11px', fontWeight: '800', color: 'rgba(255,255,255,0.85)', textDecoration: 'underline' }}
                    >
                      Ver detalle
                    </button>
                  )}
                </div>
                <div className="stat-box">
                  <span className="stat-label">Estado</span>
                  <strong className="stat-value" style={{ color: '#00C7BE' }}>{pupiloActivo.estadoDeportivo || 'Activo'}</strong>
                </div>
                <div className="stat-box">
                  <span className="stat-label">Validacion</span>
                  <strong style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', marginTop: '4px', fontSize: '13px', color: 'var(--verde-victoria)' }}><ShieldCheck size={14} /> Ficha habilitada</strong>
                </div>
              </div>
            </div>

            <div className="assist-cta-card" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <button className="assist-cta-btn" onClick={() => setMostrarCredencialAsistencia(true)}>
                <QrCode size={16} />
                <span>Valida tu asistencia</span>
              </button>
              {puedeEditarDatosJugador && (
                <button className="assist-cta-btn" onClick={() => setMostrarEditarJugador(true)}>
                  <ClipboardEdit size={16} />
                  <span>{esAdminDatosJugador ? 'Editar datos del jugador' : 'Revisar / completar datos'}</span>
                </button>
              )}
              {puedeEditarDatosJugador && rolUsuario !== 'visita' && (
                <div style={{ marginTop: '4px' }}>
                  <span style={{ fontSize: '11px', fontWeight: '800', opacity: 0.85, display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '6px' }}>
                    <Sparkles size={12} /> Diseño de la tarjeta
                  </span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {Object.entries(DISENOS_MARCO).map(([key, d]) => {
                      const activo = (detalleJugador?.diseno_marco || pupiloActivo.diseno_marco || 'clasico') === key;
                      return (
                        <button
                          key={key}
                          type="button"
                          disabled={guardandoDiseno}
                          onClick={() => cambiarDisenoMarco(key)}
                          style={{
                            padding: '6px 11px', borderRadius: '999px', fontSize: '11px', fontWeight: '800',
                            border: activo ? '1px solid white' : '1px solid rgba(255,255,255,0.35)',
                            background: activo ? 'rgba(255,255,255,0.28)' : 'rgba(255,255,255,0.08)',
                            color: 'white', cursor: guardandoDiseno ? 'default' : 'pointer',
                          }}
                        >
                          {d.etiqueta}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div
        ref={cardRef}
        className="card player-id-card official-player-card"
        style={{
          borderRadius: '24px',
          padding: '22px',
          background: `${estiloRareza.background}, radial-gradient(circle at 20% -10%, rgba(255,255,255,0.28) 0%, rgba(255,255,255,0) 45%)`,
          color: 'white',
          border: disenoActivo.extraBorder || `2px solid ${estiloRareza.border}`,
          boxShadow: [`0 20px 45px rgba(9, 20, 38, 0.32)`, estiloRareza.glow, disenoActivo.extraShadow].filter(Boolean).join(', '),
          filter: disenoActivo.extraFilter || undefined,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <span style={{ fontSize: '11px', fontWeight: '800', letterSpacing: '0.9px', textTransform: 'uppercase', opacity: 0.85 }}>Tarjeta Oficial CCF 2026</span>
          <span
            style={{
              fontSize: '11px',
              fontWeight: '900',
              padding: '6px 10px',
              borderRadius: '999px',
              background: 'rgba(255,255,255,0.16)',
              border: `1px solid ${estiloRareza.border}`
            }}
          >
            {textoRareza}
          </span>
        </div>

        <div className="official-player-main-grid" style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '14px', alignItems: 'center' }}>
          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', marginBottom: '10px', fontSize: '12px', fontWeight: '700', color: 'rgba(255,255,255,0.85)' }}>
              <User size={14} /> Perfil jugador
            </div>
            <h1 className="player-lastname-focus" style={{ margin: '2px 0 8px 0' }}>{nombreCompletoDisplay}</h1>
            <div style={{ fontSize: '13px', opacity: 0.9, fontWeight: '700' }}>
              N° {rolUsuario === 'visita' ? '00' : numeroCamiseta} · {categoriaConAnio}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '14px', padding: '10px 12px', borderRadius: '16px', background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.18)', maxWidth: '320px' }}>
              <div style={{ width: '54px', height: '54px', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
                {clubLogoUrl ? (
                  <img src={clubLogoUrl} alt={`Logo de ${clubNombre}`} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                ) : (
                  <span style={{ fontSize: '16px', fontWeight: '900', color: 'white' }}>{clubIniciales}</span>
                )}
              </div>
              <div style={{ minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: '11px', fontWeight: '800', letterSpacing: '0.7px', textTransform: 'uppercase', opacity: 0.8 }}>Club</span>
                <strong style={{ display: 'block', fontSize: '13px', fontWeight: '900', lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{clubNombre}</strong>
              </div>
            </div>

            <div style={{ marginTop: '12px', display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 10px', borderRadius: '999px', background: 'rgba(255,255,255,0.15)', fontSize: '11px', fontWeight: '900', textTransform: 'uppercase' }}>
              {esFemenino ? <Venus size={14} /> : <Mars size={14} />}
              Rama {pupiloActivo.rama || 'General'}
            </div>
          </div>

          <div className="official-player-photo-wrap" style={{ display: 'grid', gap: '10px', justifyItems: 'center' }}>
            <div style={{ position: 'relative' }}>
              <div className="official-player-photo-frame" style={{
                width: '180px',
                height: '214px',
                borderRadius: '20px',
                background: 'linear-gradient(180deg, rgba(255,255,255,0.24) 0%, rgba(255,255,255,0.12) 100%)',
                border: '1px solid rgba(255,255,255,0.3)',
                padding: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: `0 10px 24px rgba(0,0,0,0.25), inset 0 0 0 2px ${estiloRareza.accent}`
              }}>
                {fotoPrincipal ? (
                  <img src={fotoPrincipal} alt={`Foto de ${nombreDisplay}`} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '14px' }} />
                ) : (
                  <div style={{ width: '100%', height: '100%', borderRadius: '14px', background: 'rgba(255,255,255,0.18)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                    {esFemenino ? <Venus size={30} /> : <Mars size={30} />}
                    <span style={{ fontSize: '11px', fontWeight: '800', opacity: 0.9 }}>SIN FOTO</span>
                  </div>
                )}
              </div>
              {puedeEditarDatosJugador && rolUsuario !== 'visita' && (
                <button
                  type="button"
                  onClick={() => { setModoFotoObjetivo('perfil'); setMostrarSubirFoto(true); }}
                  title="Cambiar foto de perfil"
                  style={{
                    position: 'absolute', bottom: '2px', right: '2px', width: '34px', height: '34px', borderRadius: '999px',
                    background: 'var(--azul-electrico)', color: 'white', border: '2px solid white', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 10px rgba(0,0,0,0.3)',
                  }}
                >
                  <Camera size={16} />
                </button>
              )}
            </div>
          </div>
        </div>

        {rolUsuario !== 'visita' && (
          <div style={{ marginTop: '16px' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center' }}>
              {insignias.map((insignia) => (
                <span key={`portada-${insignia}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '7px 12px', borderRadius: '999px', background: 'rgba(255,255,255,0.15)', fontSize: '11px', fontWeight: '900' }}>
                  <BadgeCheck size={13} /> {insignia}
                </span>
              ))}
            </div>

            <div style={{ marginTop: '10px', display: 'flex', justifyContent: 'center' }}>
              <RadarChart width={300} height={220} data={radarGamificacionData} outerRadius={78}>
                <PolarGrid stroke="rgba(255,255,255,0.25)" />
                <PolarAngleAxis dataKey="area" tick={{ fill: 'rgba(255,255,255,0.9)', fontSize: 11, fontWeight: 700 }} />
                <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} tickCount={5} />
                <Radar dataKey="valor" stroke="#00C7BE" fill="#00C7BE" fillOpacity={0.35} strokeWidth={2} isAnimationActive={false} />
              </RadarChart>
            </div>
            {!hayEvaluacionReal && (
              <p style={{ margin: '2px 0 0', fontSize: '10px', color: 'rgba(255,255,255,0.65)', fontWeight: '700', textAlign: 'center' }}>
                Física/Técnica/Táctica: aún sin evaluaciones del staff.
              </p>
            )}

            <div style={{ marginTop: '14px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(90px, 1fr))', gap: '10px' }}>
              <div className="stat-box">
                <span className="stat-label">XP</span>
                <strong className="stat-value">{xpActual} XP</strong>
              </div>
              <div className="stat-box">
                <span className="stat-label">Puntos</span>
                <strong className="stat-value">{puntosGamificacion}</strong>
              </div>
              <div className="stat-box">
                <span className="stat-label">Racha</span>
                <strong className="stat-value">{rachaActual} dias</strong>
              </div>
              <div className="stat-box">
                <span className="stat-label">Siguiente nivel</span>
                <strong className="stat-value">{xpParaSiguienteNivel} XP</strong>
              </div>
            </div>

            <div style={{ marginTop: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', opacity: 0.85 }}>
                <span>Progreso al proximo nivel</span>
                <span>{progresoNivel}%</span>
              </div>
              <div style={{ height: '10px', borderRadius: '999px', background: 'rgba(255,255,255,0.15)', overflow: 'hidden' }}>
                <div style={{ width: `${progresoNivel}%`, height: '100%', borderRadius: '999px', background: 'linear-gradient(90deg, #00C7BE 0%, #FFE066 100%)' }} />
              </div>
            </div>

            <div style={{ marginTop: '14px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
              <div className="stat-box">
                <span className="stat-label">PTS</span>
                <strong style={{ display: 'block', marginTop: '4px', fontSize: '14px' }}>{resumenEstadisticas?.partidos > 0 ? resumenEstadisticas.pts : '—'}</strong>
              </div>
              <div className="stat-box">
                <span className="stat-label">REB</span>
                <strong style={{ display: 'block', marginTop: '4px', fontSize: '14px' }}>{resumenEstadisticas?.partidos > 0 ? resumenEstadisticas.reb : '—'}</strong>
              </div>
              <div className="stat-box">
                <span className="stat-label">AST</span>
                <strong style={{ display: 'block', marginTop: '4px', fontSize: '14px' }}>{resumenEstadisticas?.partidos > 0 ? resumenEstadisticas.ast : '—'}</strong>
              </div>
            </div>
            {!(resumenEstadisticas?.partidos > 0) && (
              <p style={{ margin: '6px 0 0', fontSize: '10px', color: 'rgba(255,255,255,0.65)', fontWeight: '700', textAlign: 'center' }}>
                Promedios por partido: aún sin partidos registrados.
              </p>
            )}
          </div>
        )}

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '10px',
          marginTop: '16px'
        }}>
          <div className="stat-box">
            <span className="stat-label">Posición</span>
            <strong className="stat-value">{rolUsuario === 'visita' ? 'N/A' : (pupiloActivo.posicion || 'N/A')}</strong>
          </div>
          <div className="stat-box">
            <span className="stat-label">Nivel</span>
            <strong className="stat-value">{rolUsuario === 'visita' ? 'MAX' : nivelActualNumero}</strong>
          </div>
          <div className="stat-box">
            <span className="stat-label">Estado</span>
            <strong className="stat-value">{pupiloActivo.estadoDeportivo || 'Activo'}</strong>
          </div>
          <div className="stat-box">
            <span className="stat-label">Estatura</span>
            <strong className="stat-value">{pupiloActivo.estatura || 'N/A'}</strong>
          </div>
          <div className="stat-box">
            <span className="stat-label">Peso</span>
            <strong className="stat-value">{pupiloActivo.peso || 'N/A'}</strong>
          </div>
          <div className="stat-box">
            <span className="stat-label">Mano habil</span>
            <strong className="stat-value">{pupiloActivo.manoHabil || 'N/A'}</strong>
          </div>
        </div>

      </div>

      <div className="card collection-panel" style={{ marginTop: '8px', borderRadius: '18px', border: '1px solid var(--borde-suave)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <h4 className="collection-title" style={{ margin: 0, fontSize: '15px', fontWeight: '900', color: 'var(--azul-marino)' }}>Ver mi tarjeta de coleccion</h4>
          <div style={{ display: 'flex', gap: '8px' }}>
            {puedeEditarDatosJugador && rolUsuario !== 'visita' && (
              <button className="player-action-btn" onClick={() => { setModoFotoObjetivo('coleccion'); setMostrarSubirFoto(true); }} style={{ padding: '8px 12px' }}>
                <Camera size={14} /> {fotoColeccion ? 'Cambiar foto' : 'Subir foto'}
              </button>
            )}
            <button className="player-action-btn alt" onClick={descargarTarjetaColeccionActual} style={{ padding: '8px 12px' }}>
              <Download size={14} /> Descargar
            </button>
          </div>
        </div>

        {rolUsuario !== 'visita' && (
          <div style={{ display: 'flex', gap: '8px', marginTop: '10px', flexWrap: 'wrap' }}>
            <button className="player-action-btn" onClick={() => setMostrarMiQRColeccion(true)} style={{ padding: '8px 12px' }}>
              <QrCode size={14} /> Mi QR
            </button>
            <button className="player-action-btn" onClick={() => setMostrarEscanerColeccion(true)} style={{ padding: '8px 12px' }}>
              <ScanLine size={14} /> Escanear compañera
            </button>
            <button className="player-action-btn" onClick={abrirAlbum} style={{ padding: '8px 12px' }}>
              <Users size={14} /> Mi álbum
            </button>
          </div>
        )}

        <div className="collection-preview-wrap" style={{ marginTop: '12px', display: 'flex', justifyContent: 'center' }}>
          {renderFrenteTarjeta({ ancho: 220, sombra: true })}
        </div>
      </div>

      {rolUsuario !== 'visita' && (
        <>
          {mostrarIndumentaria && (
            <>
              <h3 className="section-title mt-20">Gestion de Indumentaria</h3>
              <div className="caja-doble-grid mb-15">
              <div className="card sub-caja-card metric-card" style={{ padding: '15px' }}>
                <h5 className="sub-caja-title" style={{ fontSize: '11px' }}><Shirt size={14} /> Indumentaria (solo administración)</h5>
                <div className="desglose-row"><span>Camiseta:</span><strong>{pupiloActivo.tallaCamiseta || 'N/A'}</strong></div>
                <div className="desglose-row"><span>Short:</span><strong>{pupiloActivo.tallaShort || 'N/A'}</strong></div>
                <div className="desglose-row mt-10 text-center">
                  <span className="badge-urgente" style={{ background: pupiloActivo.poleraEntregada ? 'var(--verde-victoria)' : 'var(--rojo-alerta)', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px', padding: '8px 0' }}>
                    {pupiloActivo.poleraEntregada ? <>ROPA ENTREGADA <BadgeCheck size={13} /></> : 'FALTA ENTREGA'}
                  </span>
                </div>
              </div>
              </div>
            </>
          )}

        </>
      )}

      {mostrarCredencialAsistencia && createPortal(
        <div className="attendance-overlay" role="dialog" aria-modal="true">
          <div className="attendance-card">
            <button className="attendance-close" onClick={() => setMostrarCredencialAsistencia(false)}>
              <X size={18} />
            </button>
            <div className="attendance-eyebrow">Credencial de asistencia</div>
            <h3>{pupiloActivo.nombre || 'Jugador'}</h3>
            <div className="attendance-meta">
              <span>{pupiloActivo.categoria || 'General'}</span>
              <span>{clubNombre}</span>
              <span>{etiquetaClub}</span>
            </div>
            <div className="attendance-qr-wrap">
              <QRCodeSVG value={qrPayload} size={178} bgColor="#FFFFFF" fgColor="#0D2244" level="M" includeMargin />
            </div>
            <p>Presenta este QR al staff para registrar tu asistencia.</p>
          </div>
        </div>,
        document.body
      )}

      {mostrarMiQRColeccion && createPortal(
        <div className="attendance-overlay" role="dialog" aria-modal="true">
          <div className="attendance-card">
            <button className="attendance-close" onClick={() => setMostrarMiQRColeccion(false)}>
              <X size={18} />
            </button>
            <div className="attendance-eyebrow">Mi QR de colección</div>
            <h3>{pupiloActivo.nombre || 'Jugador'}</h3>
            <div className="attendance-qr-wrap">
              <QRCodeSVG value={qrColeccionPayload} size={178} bgColor="#FFFFFF" fgColor="#0D2244" level="M" includeMargin />
            </div>
            <p>Muéstrale este código a una compañera para que agregue tu Tarjeta a su álbum.</p>
          </div>
        </div>,
        document.body
      )}

      {mostrarEscanerColeccion && (
        <QrScanner
          titulo="Escanear tarjeta de compañera"
          tipoEsperado="coleccion_tarjeta"
          onScan={handleEscaneoColeccion}
          onClose={() => setMostrarEscanerColeccion(false)}
        />
      )}

      {mostrarAlbum && createPortal(
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000, padding: '20px',
        }}>
          <div style={{
            background: 'white', borderRadius: '16px', padding: '24px', maxWidth: '480px', width: '100%',
            maxHeight: '80vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.3)', color: 'var(--texto-principal)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
              <h3 style={{ margin: 0, fontSize: '17px' }}>Mi álbum</h3>
              <button onClick={() => setMostrarAlbum(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }} aria-label="Cerrar">
                <X size={20} />
              </button>
            </div>
            <p style={{ margin: '0 0 14px 0', fontSize: '13px', color: 'var(--texto-secundario)', fontWeight: '700' }}>
              {album.items.length} / {album.total_club} compañeras coleccionadas
            </p>

            {cargandoAlbum ? (
              <p style={{ fontSize: '13px', color: 'var(--texto-secundario)', textAlign: 'center', padding: '20px 0' }}>Cargando...</p>
            ) : album.items.length === 0 ? (
              <p style={{ fontSize: '13px', color: 'var(--texto-secundario)', fontStyle: 'italic', textAlign: 'center', padding: '20px 0' }}>
                Aún no coleccionas ninguna tarjeta. Usa "Escanear compañera" para agregar la primera.
              </p>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: '12px' }}>
                {album.items.map((item) => {
                  const nombreItem = `${item.nombres || ''} ${item.apellido_paterno || ''}`.trim() || 'Jugador';
                  const { estilo: estiloItem } = obtenerEstiloRarezaPorNivel(item.nivel);
                  return (
                    <div key={item.rut_jugador} style={{
                      borderRadius: '12px', padding: '10px', textAlign: 'center',
                      background: estiloItem.background, color: 'white',
                      border: `2px solid ${estiloItem.border}`,
                    }}>
                      <div style={{
                        width: '56px', height: '56px', borderRadius: '50%', margin: '0 auto',
                        border: `2px solid ${estiloItem.accent}`, overflow: 'hidden',
                        background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        {item.foto_jugador ? (
                          <img src={resolverUrlFoto(item.foto_jugador)} alt={nombreItem} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          <User size={22} />
                        )}
                      </div>
                      <div style={{ marginTop: '6px', fontSize: '11px', fontWeight: '900', lineHeight: 1.2 }}>{nombreItem}</div>
                      <div style={{ marginTop: '2px', fontSize: '9px', fontWeight: '800', opacity: 0.85, textTransform: 'uppercase' }}>Nivel {item.nivel}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>,
        document.body
      )}

      {mostrarEditarJugador && (
        <EditarJugadorModal
          jugador={detalleJugador || pupiloActivo}
          esAdmin={esAdminDatosJugador}
          onClose={() => setMostrarEditarJugador(false)}
          onSaved={(actualizado) => setDetalleJugador((prev) => ({ ...prev, ...actualizado }))}
        />
      )}

      {mostrarSubirFoto && createPortal(
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Cambiar foto del jugador"
          style={{
            position: 'fixed', inset: 0, background: 'rgba(10,15,25,0.5)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200, padding: '16px',
          }}
          onClick={cerrarModalFoto}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'var(--blanco-tarjeta)', borderRadius: 'var(--radius-lg)', padding: '20px',
              maxWidth: '420px', width: '100%', maxHeight: '85vh', overflowY: 'auto',
              boxShadow: '0 25px 60px rgba(0,0,0,0.3)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <h3 style={{ margin: 0, fontSize: '17px' }}>{modoFotoObjetivo === 'perfil' ? 'Foto de perfil' : 'Foto para la tarjeta'}</h3>
              <button onClick={cerrarModalFoto} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }} aria-label="Cerrar">
                <X size={20} />
              </button>
            </div>

            <p style={{ margin: '0 0 14px 0', fontSize: '12px', color: 'var(--texto-secundario)' }}>
              {modoFotoObjetivo === 'perfil'
                ? 'Elige la foto y arrastra/acerca para elegir qué parte se ve. Esta es tu foto de perfil general: no cambia la foto de la tarjeta coleccionable.'
                : 'Elige la foto y arrastra/acerca para elegir qué parte se ve en la tarjeta. Esta foto es solo para la tarjeta: no cambia la foto de perfil del jugador.'}
            </p>

            <input
              type="file"
              accept="image/png,image/jpeg,image/jpg,image/webp"
              className="form-input mb-10"
              onChange={(e) => handleSeleccionArchivoFoto(e.target.files?.[0] || null)}
            />

            {previewFoto && fotoNatural.w > 0 && (
              <>
                <div
                  style={{
                    width: `${CROP_BOX_ANCHO}px`, height: `${CROP_BOX_ALTO}px`, margin: '0 auto 10px',
                    borderRadius: '12px', overflow: 'hidden', position: 'relative', touchAction: 'none',
                    border: '1px solid var(--borde-suave)', cursor: 'grab',
                    background: 'repeating-conic-gradient(#e5e5e5 0% 25%, #ffffff 0% 50%) 0 0 / 16px 16px',
                  }}
                  onPointerDown={handleCropPointerDown}
                  onPointerMove={handleCropPointerMove}
                  onPointerUp={handleCropPointerUp}
                  onPointerLeave={handleCropPointerUp}
                >
                  <img
                    src={previewFoto}
                    alt="Vista previa"
                    draggable={false}
                    style={{
                      position: 'absolute', left: `${cropOffset.x}px`, top: `${cropOffset.y}px`,
                      width: `${cropImgAncho}px`, height: `${cropImgAlto}px`, maxWidth: 'none', userSelect: 'none',
                    }}
                  />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                  <span style={{ fontSize: '11px', color: 'var(--texto-secundario)' }}>Acercar</span>
                  <input
                    type="range"
                    min="1" max="3" step="0.01"
                    value={cropZoom}
                    onChange={(e) => handleCropZoomChange(Number(e.target.value))}
                    style={{ flex: 1 }}
                  />
                </div>
              </>
            )}

            <button
              className="btn-electric"
              style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
              onClick={handleConfirmarFoto}
              disabled={!archivoFoto || procesandoFoto}
            >
              {procesandoFoto ? <Loader2 size={16} className="spin" /> : <Camera size={16} />}
              {procesandoFoto ? 'Subiendo...' : 'Guardar foto'}
            </button>
          </div>
        </div>,
        document.body
      )}

      {mostrarDetalleAsistencia && createPortal(
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000, padding: '20px',
        }}>
          <div style={{
            background: 'white', borderRadius: '16px', padding: '24px', maxWidth: '440px', width: '100%',
            maxHeight: '80vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.3)', color: 'var(--texto-principal)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0 }}>Historial de asistencia</h3>
              <button onClick={() => setMostrarDetalleAsistencia(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}>
                <X size={22} color="var(--gris-secundario)" strokeWidth={1.5} />
              </button>
            </div>

            <h4 style={{ fontSize: '13px', margin: '0 0 8px' }}>Entrenamientos</h4>
            {(resumenAsistencia?.historialEntrenamientos || []).length === 0 ? (
              <p style={{ fontSize: '12px', color: 'var(--texto-secundario)', fontStyle: 'italic', margin: '0 0 16px' }}>Sin registros todavía.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '16px' }}>
                {resumenAsistencia.historialEntrenamientos.map((r, idx) => {
                  const color = r.estado_asistencia === 'presente' ? 'var(--verde-victoria)' : r.estado_asistencia === 'ausente' ? 'var(--rojo-alerta)' : '#FF9500';
                  const etiqueta = r.estado_asistencia === 'presente' ? 'Presente' : r.estado_asistencia === 'ausente' ? 'Ausente' : r.estado_asistencia === 'justificado' ? 'Justificado' : 'Pendiente';
                  return (
                    <div key={`ent-${idx}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', padding: '8px 10px', borderRadius: '10px', background: 'var(--gris-fondo)', fontSize: '12px' }}>
                      <span>{r.fecha ? new Date(r.fecha).toLocaleDateString('es-CL') : 'Sin fecha'}</span>
                      <span style={{ fontWeight: '800', color, fontSize: '11px', textTransform: 'uppercase' }}>{etiqueta}</span>
                    </div>
                  );
                })}
              </div>
            )}

            <h4 style={{ fontSize: '13px', margin: '0 0 8px' }}>Citaciones y torneos</h4>
            {(resumenAsistencia?.historialCitaciones || []).length === 0 ? (
              <p style={{ fontSize: '12px', color: 'var(--texto-secundario)', fontStyle: 'italic', margin: 0 }}>Sin convocatorias todavía.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {resumenAsistencia.historialCitaciones.map((c, idx) => (
                  <div key={`cit-${idx}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', padding: '8px 10px', borderRadius: '10px', background: 'var(--gris-fondo)', fontSize: '12px' }}>
                    <span>
                      {c.dia_citacion ? new Date(c.dia_citacion).toLocaleDateString('es-CL') : 'Sin fecha'} — {c.competencia_nombre} vs {c.rival_nombre}
                    </span>
                    <span style={{ fontWeight: '800', fontSize: '11px', textTransform: 'uppercase', color: c.asistio_evento ? 'var(--verde-victoria)' : 'var(--texto-secundario)' }}>
                      {c.asistio_evento ? '✓ Asistió' : 'Sin registro'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>,
        document.body
      )}

      <div aria-hidden="true" style={{ position: 'fixed', left: '-9999px', top: '-9999px', opacity: 0, pointerEvents: 'none' }}>
        {renderFrenteTarjeta({ ancho: EXPORT_WIDTH, innerRef: cardFrontExportRef })}
      </div>
    </div>
  );
}

export default TarjetaJugadorPanel;
