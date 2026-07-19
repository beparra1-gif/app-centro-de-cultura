import { lazy, Suspense, useState, useEffect, useRef } from 'react';
import './App.css';
import { 
  Home, User, Trophy, CreditCard, Shirt, CheckCircle, Bell, LogOut, 
  Settings, LayoutGrid, List, Star, Target, MapPin, 
  Brain, PlayCircle, BookOpen, Video, Users, HeartPulse,
  Save, Monitor, Activity, ArrowRight, ArrowLeft, AlertTriangle, 
  FileText, Flag, QrCode, Lock, Camera, ChevronRight, ChevronLeft, 
  ShieldAlert, Zap, Clock, FileDown, RefreshCw,
  History, CheckSquare,
  XSquare, UserPlus, ListOrdered
} from 'lucide-react';
import { 
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer 
} from 'recharts';
import * as api from './api/client';
import { nextId } from './utils/runtimeId';
import { calcularCuotaFinal, noDebeMensualidad } from './utils/beca';
import SkeletonLoaderPanel from './components/SkeletonLoaderPanel';
import ApiStatusBanner from './components/ApiStatusBanner';
import ToastContainer from './components/ToastContainer';
import ConfirmDialog from './components/ConfirmDialog';
import { showToast } from './utils/toast';
import { confirmAction } from './utils/confirmDialog';
import { cuentasDemo } from './data/demoAccounts';
import {
  getUTMLastDayPreviousMonth,
  getColorUrgencia,
} from './utils/appHelpers';
import {
  MODULOS_ACCESO,
  obtenerPermisosEfectivos,
  puedeVerModulo,
  normalizarRol,
} from './security/accessControl';

const ComunicacionesPanel = lazy(() => import('./components/ComunicacionesPanel'));
const KioscoPanel = lazy(() => import('./components/KioscoPanel'));
const SuperAdminPanel = lazy(() => import('./components/SuperAdminPanel'));
const MesaControlPanel = lazy(() => import('./components/MesaControlPanel'));
const TorneosPanel = lazy(() => import('./components/TorneosPanel'));
const PerfilTesoreriaPanel = lazy(() => import('./components/PerfilTesoreriaPanel'));
const StaffAsistenciaPanel = lazy(() => import('./components/StaffAsistenciaPanel'));
const AcademiaPanel = lazy(() => import('./components/AcademiaPanel'));
const TarjetaJugadorPanel = lazy(() => import('./components/TarjetaJugadorPanel'));
const PushToast = lazy(() => import('./components/PushToast'));
const PushHistorialModal = lazy(() => import('./components/PushHistorialModal'));
const WhatsAppPanel = lazy(() => import('./components/WhatsAppPanel'));
const WhatsAppHistorialModal = lazy(() => import('./components/WhatsAppHistorialModal'));
const SettingsPanel = lazy(() => import('./components/SettingsPanel'));
const OnboardingModal = lazy(() => import('./components/OnboardingModal'));
const PublicFacadePanel = lazy(() => import('./components/PublicFacadePanel'));
const ComunicacionFormPanel = lazy(() => import('./components/ComunicacionFormPanel'));
const NotificationsPanel = lazy(() => import('./components/NotificationsPanel'));
const SearchPanel = lazy(() => import('./components/SearchPanel'));
const NotificationHistoryPanel = lazy(() => import('./components/NotificationHistoryPanel'));

// ==========================================
// 2. COMPONENTE PRINCIPAL (APP)
// ==========================================
function App() {
  const UI_RELEASE_TAG = '2026-07-11-rut-selection-fix';
  void UI_RELEASE_TAG;
  const SESSION_STORAGE_KEY = 'ccf.auth.session.v1';

  // --- ESTADOS: GLOBAL Y TEMA ---
  const temaOscuro = false;
  const [isAppLoading, setIsAppLoading] = useState(false); // Skeleton Loaders
  
  // --- ESTADOS: NAVEGACIÓN Y LOGIN ---
  const [rolUsuario, setRolUsuario] = useState(null); 
  const [pantallaActiva, setPantallaActiva] = useState('comunicaciones'); 
  const [showModalSalir, setShowModalSalir] = useState(false);
  const [mostrarFormularioLogin, setMostrarFormularioLogin] = useState(false);
  const [tipoLoginSeleccionado, setTipoLoginSeleccionado] = useState(''); 
  const [rutInput, setRutInput] = useState('');
  const [passInput, setPassInput] = useState('');

  // --- ESTADOS: MULTI-PUPILO Y NOTIFICACIONES (PREMIUM) ---
  const [pupiloActivo, setPupiloActivo] = useState(null);
  
  // --- ESTADOS: ONBOARDING ---
  const [isOnboarding, setIsOnboarding] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState(1);
  const [onboardingProgress, setOnboardingProgress] = useState(0);
  const [rolUsuarioTemporal, setRolUsuarioTemporal] = useState(null);
  const [onboardingPassword, setOnboardingPassword] = useState('');
  const [onboardingPasswordConfirm, setOnboardingPasswordConfirm] = useState('');
  const [onboardingCuenta, setOnboardingCuenta] = useState(null);
  const [onboardingPasswordActual, setOnboardingPasswordActual] = useState('');
  const [onboardingCuentaDetalle, setOnboardingCuentaDetalle] = useState(null);
  const [onboardingCamposPendientes, setOnboardingCamposPendientes] = useState([]);
  const [onboardingPerfilDraft, setOnboardingPerfilDraft] = useState({
    nombres: '',
    apellido_paterno: '',
    apellido_materno: '',
    telefono: '',
    direccion: '',
    comuna: '',
    foto_perfil_url: '',
  });
  const [onboardingSubiendoFoto, setOnboardingSubiendoFoto] = useState(false);
  const [sesionHidratada, setSesionHidratada] = useState(false);
  const [sesionToken, setSesionToken] = useState(null);

  // --- ESTADOS: GAMIFICACIÓN Y PERFIL ---
  // Antes escalares (un solo quiz "activo" global) — con varios quiz
  // simultáneos filtrados por categoría, cada uno lleva su propio estado de
  // respuesta: { [quizId]: { opcionSeleccionada, completado } }.
  const [respuestasQuiz, setRespuestasQuiz] = useState({});
  const [animacionXP, setAnimacionXP] = useState(false); // Efecto Partículas

  // --- ESTADOS: MURO Y RRSS ---
  const [vistaMuro, setVistaMuro] = useState('noticias'); 
  const [vistaPublica, setVistaPublica] = useState('inicio');
  const [respuestaCitacion, setRespuestaCitacion] = useState(null); 
  const [alertasPublicadas, setAlertasPublicadas] = useState([]);

  // --- ESTADOS: MESA FIBA AVANZADA (PREMIUM) ---
  const [liveScore, setLiveScore] = useState({ 
    ptsLocal: 0, ptsVisita: 0, faltasLocal: 0, faltasVisita: 0, 
    periodo: 1, reloj: "10:00", timeoutsLocal: 3, timeoutsVisita: 3, flecha: 'LOCAL',
    equipoLocalNombre: 'Centro de Cultura Física',
    equipoVisitaNombre: 'Visitante',
    equipoLocalLogoUrl: '/logos/club-logo.png',
    equipoVisitaLogoUrl: '',
    competenciaNombre: '',
    competenciaLogoUrl: '',
    canchaSede: '',
  });
  const [jugadorSeleccionadoLive, setJugadorSeleccionadoLive] = useState(null);
  const [playByPlay, setPlayByPlay] = useState([]); 
  const [notaScouting, setNotaScouting] = useState('');
  const [modoChromaKey, setModoChromaKey] = useState(false); // Para Streaming OBS
  
  // --- ESTADOS: FASE 5 - NOTIFICACIONES, BÚSQUEDA Y REPORTES ---
  const [notificaciones, setNotificaciones] = useState([]);
  const [mostrarNotificaciones, setMostrarNotificaciones] = useState(false);
  const [busquedaGlobal, setBusquedaGlobal] = useState('');
  const [resultadosBusqueda, setResultadosBusqueda] = useState({ comunicaciones: [], comentarios: [], usuarios: [] });
  const [mostrarBusqueda, setMostrarBusqueda] = useState(false);
  const [vistaReportes, setVistaReportes] = useState('engagement'); // engagement, comentaristas, comunicaciones-top
  const [cuentasIncompletas, setCuentasIncompletas] = useState([]);
  const [cuentasAdmin, setCuentasAdmin] = useState([]);
  const [jugadoresAdmin, setJugadoresAdmin] = useState([]);
  
  // --- ESTADOS: FASE 6 - REPORTES AVANZADOS, PDF, GRÁFICOS ---
  const [historialNotificaciones, setHistorialNotificaciones] = useState([]);
  const [mostrarHistorialNotif, setMostrarHistorialNotif] = useState(false);
  const [filtroReporteFecha, setFiltroReporteFecha] = useState('mes'); // mes, semana, todos
  const [filtroReporteRama, setFiltroReporteRama] = useState('General'); // General, Femenina, Masculina
  const [vistaGraficos, setVistaGraficos] = useState('pie'); // pie, bar, line

  // --- ESTADOS: FASE 7 - DASHBOARD SALUD + ALERTAS INTELIGENTES ---
  const [alertas, setAlertas] = useState([]);
  const [saludDelSistema, setSaludDelSistema] = useState({});
  const [vistaSaludTab, setVistaSaludTab] = useState('dashboard'); // dashboard, alertas, timeline

  // --- ESTADOS: FASE 8 - NOTIFICACIONES PUSH EN TIEMPO REAL ---
  const [pushNotificaciones, setPushNotificaciones] = useState([]);
  const [badgeCount, setBadgeCount] = useState(0);
  const [mostrarHistorialPush, setMostrarHistorialPush] = useState(false);
  const [preferenciasSonido, setPreferenciasSonido] = useState({
    habilitado: true,
    sonidoAlerta: 'sistema',
    sonidoNotif: 'tono',
    vibración: true,
    volumen: 80
  });
  const [historialPushTotal, setHistorialPushTotal] = useState([]);

  // --- ESTADOS: FASE 9 - INTEGRACIÓN WHATSAPP + WEBHOOKS ---
  const [contactosWhatsApp, setContactosWhatsApp] = useState([]);
  const [historialWhatsApp, setHistorialWhatsApp] = useState([]);
  const [mostrarWhatsAppPanel, setMostrarWhatsAppPanel] = useState(false);
  const [nuevoContactoWA, setNuevoContactoWA] = useState({ nombre: '', numero: '' });
  const [templateMensaje, setTemplateMensaje] = useState('alerta'); // alerta, pago, confirmacion, general
  const [mensajeCustomWA, setMensajeCustomWA] = useState('');
  const [mostrarHistorialWA, setMostrarHistorialWA] = useState(false);
  const [phoneNumberToValidate, setPhoneNumberToValidate] = useState('');
  const [webhookRespuestas, setWebhookRespuestas] = useState([]);
  
  // --- ESTADOS: STAFF TÉCNICO (DT) ---
  const [vistaStaff, setVistaStaff] = useState('asistencia'); // asistencia, evaluacion, historial
  const [filtroRamaStaff, setFiltroRamaStaff] = useState('Masculina');
  const [filtroCatStaff, setFiltroCatStaff] = useState('U15');
  
  const [rosterEquipo, setRosterEquipo] = useState([]);
  
  const [evalTiro, setEvalTiro] = useState(70);
  const [evalDefensa, setEvalDefensa] = useState(70);
  const [evalFisico, setEvalFisico] = useState(70);
  const [evalTactico, setEvalTactico] = useState(70);
  const [notasEvaluacion, setNotasEvaluacion] = useState({ fortaleza: '', mejora: '', metas: '' });

  // --- ESTADOS: TESORERÍA Y VALIDACIONES ---
  // mesesSeleccionados es { [rutPupilo]: number[] } — cada pupilo tiene su
  // propia selección de meses en la grilla "Mensualidad Deportista" (antes
  // era un arreglo plano compartido entre todas las tarjetas de pupilo).
  const [mesesSeleccionados, setMesesSeleccionados] = useState({});
  const [tipoPago, setTipoPago] = useState('completo'); 
  const [montoAbono, setMontoAbono] = useState('');
  const [comprobanteSubido, setComprobanteSubido] = useState(false);
  const [pagosPendientesAdmin, setPagosPendientesAdmin] = useState([]);
  const [pagosMensualidadesAdmin, setPagosMensualidadesAdmin] = useState([]);
  const [partidosResumen, setPartidosResumen] = useState([]);
  const [morososAdmin, setMorososAdmin] = useState([]);
  const [materialesAcademia, setMaterialesAcademia] = useState([]);
  const [pizarrasAcademia, setPizarrasAcademia] = useState([]);
  const [quizList, setQuizList] = useState([]);

  // Kiosco POS: el panel ahora es autocontenido (fetch propio a /api/kiosco-*),
  // ver src/components/KioscoPanel.jsx — ya no vive acá como estado prop-drilled.

  // --- ESTADOS: SUPER ADMIN (MODO DIOS) ---
  const [vistaAdmin, setVistaAdmin] = useState('dashboard');
  const [filtroMorosos, setFiltroMorosos] = useState('todos');
  const [logAuditoria, setLogAuditoria] = useState([]);
  const [jugadoresVisitaAdmin, setJugadoresVisitaAdmin] = useState([]);
  const [usuarioAutenticado, setUsuarioAutenticado] = useState(null);

  const [destinatarios, setDestinatarios] = useState({ admin: false, staff: false, socios: true, apoderados: true, deportistas: true });

  const [busquedaPermisos, setBusquedaPermisos] = useState('');
  const [filtroRolPermisos, setFiltroRolPermisos] = useState('Todos');
  const [permisosPorUsuario, setPermisosPorUsuario] = useState({});

  const perfilesPermisosFallback = [];

  const matrixPermisosBase = (Array.isArray(cuentasAdmin) && cuentasAdmin.length > 0 ? cuentasAdmin : perfilesPermisosFallback).map((usuario) => {
    const idUsuario = usuario.id ?? usuario.id_usuario ?? usuario.id_cuenta ?? usuario.rut ?? usuario.correo;
    const rolUsuarioBase = normalizarRol(usuario.perfil_principal || usuario.rol || usuario.rol_usuario || 'jugador');
    const permisosEfectivos = obtenerPermisosEfectivos({
      rol: rolUsuarioBase,
      // permisosPorUsuario stores only overrides; effective perms are computed here.
      override: permisosPorUsuario[idUsuario] || {},
    });

    return {
      id: idUsuario,
      nombre: usuario.nombre || `${usuario.nombres || ''} ${usuario.apellido_paterno || ''}`.trim() || usuario.correo || 'Sin nombre',
      rol: rolUsuarioBase,
      permisos: permisosEfectivos,
    };
  });
  
  // --- ESTADOS: VISTAS Y CONFIGURACIÓN ---
  const [pagoViewMode, setPageViewMode] = useState('grid'); // grid | list
  const [showSettings, setShowSettings] = useState(false); // Panel de configuración
  const [mostrarFormComunicaciones, setMostrarFormComunicaciones] = useState(false);
  const [comunicaciones, setComunicaciones] = useState([]);
  const [encuestas, setEncuestas] = useState([]);
  const [formCom, setFormCom] = useState({ titulo: '', mensaje: '', audiencia: ['deportistas'], rama: 'General', categoria: 'General', tipo: 'Aviso', urgencia: 'Media', solicita_asistencia: false });
  const [comentariosUI, setComentariosUI] = useState({}); // {comId: [{id, usuario, texto, timestamp, respuestas: [], likes}, ...]}
  const [formComentario, setFormComentario] = useState({}); // {comId: 'texto', comId_respuesta_parentId: 'texto'}
  const [mostrarFormComentario, setMostrarFormComentario] = useState({}); // {comId: true/false}
  const [apiOffline, setApiOffline] = useState(false);
  const [apiRetrying, setApiRetrying] = useState(false);
  const [apiStatusMessage, setApiStatusMessage] = useState('');
  const [appVersionState, setAppVersionState] = useState({
    checking: false,
    hasUpdate: false,
    isLatest: true,
    currentBuild: '',
    latestBuild: '',
    error: '',
    lastCheckedAt: null,
  });
  const settingsButtonRef = useRef(null);
  const notificationsButtonRef = useRef(null);
  const settingsPanelRef = useRef(null);
  const notificationsPanelRef = useRef(null);
  const appVersionCheckInFlightRef = useRef(false);

  const resolverRolPrincipal = (rolBase = '', usuario = null) => {
    const candidatos = [
      usuario?.perfil_principal,
      usuario?.rol,
      ...(Array.isArray(usuario?.access_profiles) ? usuario.access_profiles : []),
      rolBase,
    ]
      .map((rol) => normalizarRol(rol))
      .filter(Boolean);

    const prioridadRoles = [
      'super_admin',
      'admin',
      'staff',
      'mesa',
      'directiva',
      'socio_apoderado',
      'socio-apoderado',
      'socio',
      'apoderado',
      'jugador',
      'visita',
    ];

    const rolPriorizado = prioridadRoles.find((rol) => candidatos.includes(rol));
    return rolPriorizado || normalizarRol(rolBase || usuario?.rol || 'jugador');
  };

  // El muro de "Últimos Resultados" (ComunicacionesPanel/PublicFacadePanel)
  // siempre se narra desde la perspectiva del club ("GANAMOS"/"PERDIMOS") —
  // no sirve para partidos entre dos equipos rivales que se cargan solo para
  // llevar la tabla de posiciones completa de un torneo externo (Torneos ya
  // los muestra sin ese sesgo). Se filtran acá para que no aparezcan en el
  // muro general con un marco que no corresponde.
  const esEquipoPropio = (nombre = '') => /centro\s*de\s*cultura\s*f[ií]sica/i.test(String(nombre || ''));

  const mapPartidosResumen = (partidosLiveRes = []) => {
    return (Array.isArray(partidosLiveRes) ? partidosLiveRes : [])
      // publicado === false: se cargó solo para la tabla de posiciones, el
      // club decidió no destacarlo como noticia en el muro.
      .filter((p) => p.publicado !== false && (esEquipoPropio(p.equipo_local) || esEquipoPropio(p.equipo_visitante)))
      .map((p, idx) => ({
      id: p.id_partido || idx + 1,
      rama: p.rama || ((p.categoria_rama || '').toLowerCase().includes('femen') ? 'Femenina' : 'Masculina'),
      categoria: p.categoria || p.categoria_rama || 'General',
      torneo: p.torneo_nombre || p.competencia_nombre || 'Partido oficial',
      torneoLogoUrl: p.torneo_logo_url || p.logo_torneo_url || '',
      fechaISO: p.fecha_hora || null,
      fecha: p.fecha_hora ? new Date(p.fecha_hora).toLocaleDateString('es-CL') : 'Sin fecha',
      miEquipo: Number(p.pts_local || 0),
      rival: Number(p.pts_visitante || 0),
      nombreRival: p.equipo_visitante || p.equipo_visitante_nombre || 'Rival',
      equipoLocalNombre: p.equipo_local || p.equipo_local_nombre || 'Centro de Cultura Física',
      equipoLocalLogoUrl: p.logo_local_url || p.equipo_local_logo_url || '/logos/club-logo.png',
      equipoVisitaLogoUrl: p.logo_visitante_url || p.equipo_visitante_logo_url || '',
      rivalLogoUrl: p.logo_visitante_url || p.equipo_visitante_logo_url || '',
    }));
  };

  const mapComunicacionesResumen = (comunicacionesRes = []) => {
    return (Array.isArray(comunicacionesRes) ? comunicacionesRes : []).map((c) => ({
      id: c.id,
      TITULO: c.titulo,
      CUERPO_TEXTO: c.cuerpo_texto,
      FECHA: c.created_at ? new Date(c.created_at).toLocaleDateString('es-CL') : new Date().toLocaleDateString('es-CL'),
      TIPO_COMUNICADO: c.tipo,
      rama: c.rama,
      categoria: c.categoria,
      urgencia: c.urgencia,
      solicita_asistencia: c.solicita_asistencia,
      reacciones: c.reacciones || {},
      asistencias: c.asistencias || [],
      citacion_id: c.citacion_id || null,
      convocatoria_ruts: c.convocatoria_ruts || [],
      convocatoria_alertas_morosidad: c.convocatoria_alertas_morosidad || [],
      responsable_nombre: c.responsable_nombre || '',
      responsable_rol: c.responsable_rol || '',
      categorias_objetivo: Array.isArray(c.categorias_objetivo) ? c.categorias_objetivo : [],
      creado_por: c.creado_por || '',
      academia_video_id: c.academia_video_id || null,
      activo: c.activo !== false,
    }));
  };

  const obtenerAnioNacimientoJugador = (jugador = {}) => (
    jugador.anioNacimiento
    ?? jugador.anio_nacimiento
    ?? jugador.ano_nacimiento
    ?? jugador['año_nacimiento']
    ?? ''
  );

  const obtenerNumeroCamisetaJugador = (jugador = {}, fallback = 0) => {
    const raw = (
      jugador.numeroCamiseta
      ?? jugador.numero_camiseta
      ?? jugador.numero
      ?? jugador.dorsal
      ?? fallback
    );

    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  };

  useEffect(() => {
    try {
      const sesionRaw = window.localStorage.getItem(SESSION_STORAGE_KEY);
      if (sesionRaw) {
        const sesion = JSON.parse(sesionRaw);
        // Para SuperAdmin, no verificar expiración - mantener sesión indefinidamente
        if (sesion?.rol && sesion?.usuario) {
          const rolNormalizado = resolverRolPrincipal(sesion.rol, sesion.usuario);

          // Una sesión de un rol autenticado (no invitado) sin token es una sesión
          // corrupta/vieja (p. ej. guardada antes de un fix de login): sin token todos
          // los fetches protegidos devuelven 401 en silencio y la app queda "logueada"
          // pero sin poder traer ningún dato. Se descarta en vez de restaurarla.
          if (rolNormalizado !== 'visita' && !sesion.token) {
            window.localStorage.removeItem(SESSION_STORAGE_KEY);
          } else {
            setRolUsuario(rolNormalizado);
            setUsuarioAutenticado({
              ...sesion.usuario,
              rol: resolverRolPrincipal(sesion.usuario?.rol || rolNormalizado, sesion.usuario),
            });
            setPantallaActiva(sesion.pantallaActiva || (rolNormalizado === 'super_admin' ? 'admin_dashboard' : 'comunicaciones'));
            setSesionToken(sesion.token || null);
            api.setAuthToken(sesion.token || null);
          }
        }
      }
    } catch {
      window.localStorage.removeItem(SESSION_STORAGE_KEY);
    } finally {
      setSesionHidratada(true);
    }
  }, [SESSION_STORAGE_KEY]);

  useEffect(() => {
    if (!sesionHidratada) return;

    if (rolUsuario && usuarioAutenticado) {
      window.localStorage.setItem(
        SESSION_STORAGE_KEY,
        JSON.stringify({
          rol: rolUsuario,
          usuario: usuarioAutenticado,
          pantallaActiva,
          token: sesionToken,
          updatedAt: new Date().toISOString(),
        })
      );
      return;
    }

    // Durante el cambio de clave obligatorio / onboarding, sesionToken ya
    // está seteado (se necesita para las llamadas del propio onboarding, ej.
    // GET /api/cuentas/:id en cargarCuentaOnboarding) pero rolUsuario /
    // usuarioAutenticado recién se completan al terminar el flujo, en
    // iniciarSesionFinal. Sin este guard, este efecto interpretaba ese estado
    // transitorio (token sin rol/usuario todavía) como "sesión cerrada" y
    // limpiaba el token a mitad del onboarding: el siguiente fetch protegido
    // (GET /api/cuentas/:id) volvía 401 y el modal quedaba pegado en el
    // primer paso, sin avanzar tras cambiar la contraseña.
    if (isOnboarding) return;

    api.setAuthToken(null);
    window.localStorage.removeItem(SESSION_STORAGE_KEY);
  }, [rolUsuario, usuarioAutenticado, pantallaActiva, sesionToken, sesionHidratada, SESSION_STORAGE_KEY, isOnboarding]);

  const [nominaCita, setNominaCita] = useState([]);

  // ==========================================
  // 3. LÓGICA BASE Y EFECTOS
  // ==========================================

  const construirMorososDesdePagos = (pagos = [], jugadores = [], cuentas = []) => {
    const normalizarRutComparacion = (rut = '') => String(rut || '').replace(/\./g, '').replace(/-/g, '').trim().toUpperCase();
    const normalizarCorreo = (correo = '') => String(correo || '').trim().toLowerCase();
    const cuentaPorCorreo = new Map();
    const cuentaPorRut = new Map();
    (cuentas || []).forEach((cuenta) => {
      const correo = normalizarCorreo(cuenta?.correo);
      if (correo) cuentaPorCorreo.set(correo, cuenta);
      const rut = normalizarRutComparacion(cuenta?.rut);
      if (rut) cuentaPorRut.set(rut, cuenta);
    });
    const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
    const ANIO_OBJETIVO = 2026;
    const now = new Date();
    const limiteMesDeuda = now.getFullYear() > ANIO_OBJETIVO
      ? 12
      : (now.getFullYear() < ANIO_OBJETIVO ? 0 : Math.max(0, now.getMonth()));

    const getMesNumero = (texto = '') => {
      const normalizado = String(texto || '')
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
      if (!normalizado) return null;
      const token = normalizado.slice(0, 3);
      const idx = MESES.findIndex((m) => m === token);
      return idx >= 0 ? idx + 1 : null;
    };

    const getAnioIngreso = (jugador = {}) => {
      const candidatos = [
        jugador?.anio_ingreso,
        jugador?.año_ingreso,
      ];
      for (const valor of candidatos) {
        const num = Number(valor);
        if (Number.isFinite(num) && num >= 2000 && num <= 2100) return num;
      }

      const fechaIngreso = String(jugador?.fecha_ingreso || '').trim();
      const matchFecha = fechaIngreso.match(/(20\d{2})/);
      if (matchFecha) return Number(matchFecha[1]);

      // Regla de negocio: sin mes/año configurados => enero 2026.
      return ANIO_OBJETIVO;
    };

    const getMesIngreso = (jugador = {}) => {
      const mesDesdeCampo = getMesNumero(jugador?.mes_inicio_cobro || '');
      if (mesDesdeCampo) return mesDesdeCampo;

      const fechaIngreso = String(jugador?.fecha_ingreso || '').trim();
      const fecha = fechaIngreso ? new Date(fechaIngreso) : null;
      if (fecha instanceof Date && !Number.isNaN(fecha.getTime())) {
        return fecha.getMonth() + 1;
      }

      // Regla de negocio: sin mes/año configurados => enero 2026.
      return 1;
    };

    const parseMesesDePago = (pago = {}) => {
      const textoMeses = String(pago.meses_correspondientes || '').trim();
      if (!textoMeses) return [];

      const anioMatch = textoMeses.match(/(20\d{2})/);
      const anio = anioMatch ? Number(anioMatch[1]) : ANIO_OBJETIVO;
      if (anio !== ANIO_OBJETIVO) return [];

      const partes = textoMeses
        .replace(/20\d{2}/g, '')
        .replace(/[,]/g, ' ')
        .split(/\s+/)
        .map((p) => p.trim())
        .filter(Boolean);

      const candidatos = [];
      partes.forEach((parte) => {
        if (parte.includes('-')) {
          const [inicio, fin] = parte.split('-');
          const mIni = getMesNumero(inicio);
          const mFin = getMesNumero(fin);
          if (mIni && mFin && mIni <= mFin) {
            for (let m = mIni; m <= mFin; m += 1) candidatos.push(m);
            return;
          }
        }

        const mes = getMesNumero(parte);
        if (mes) candidatos.push(mes);
      });

      return [...new Set(candidatos)];
    };

    const esPagoInvalidoLegacy = (pago = {}) => {
      const monto = Number(pago.monto_total_pagado || 0);
      const meses = String(pago.meses_correspondientes || '').trim();
      const notas = String(pago.notas_tesoreria || '').toLowerCase();
      const sinMes = /^sinmes\b/i.test(meses);
      const correccionLegacy = notas.includes('correccion requerida');
      return (monto <= 0 && sinMes) || (monto <= 0 && correccionLegacy);
    };

    const pagosPorRut = new Map();
    (pagos || []).forEach((pago) => {
      if (esPagoInvalidoLegacy(pago)) return;
      const rutPagoJugador = normalizarRutComparacion(pago.rut_jugador || '');
      const rutPagoPagador = normalizarRutComparacion(pago.rut_pagos || '');
      const rutPago = rutPagoJugador || rutPagoPagador;
      if (!rutPago) return;
      const mesesPago = parseMesesDePago(pago);
      if (mesesPago.length === 0) return;
      if (!pagosPorRut.has(rutPago)) pagosPorRut.set(rutPago, []);
      pagosPorRut.get(rutPago).push({ ...pago, mesesPago });
    });

    const morosos = [];

    (jugadores || []).forEach((jugador) => {
      const rutJugadorNorm = normalizarRutComparacion(jugador.rut_jugador || '');
      if (!rutJugadorNorm) return;

      if (noDebeMensualidad(jugador)) {
        // Regla de negocio: beca 100% o exención = no debe nada, nunca aparece en morosos.
        return;
      }

      const anioIngreso = getAnioIngreso(jugador);
      const mesIngreso = getMesIngreso(jugador);
      const inicioCobro = anioIngreso > ANIO_OBJETIVO
        ? 13
        : (anioIngreso < ANIO_OBJETIVO ? 1 : mesIngreso);
      const pagosJugador = pagosPorRut.get(rutJugadorNorm) || [];

      const estadoPorMes = new Map();
      pagosJugador.forEach((pago) => {
        const estado = String(pago.estado_pago || '').toLowerCase();
        pago.mesesPago.forEach((mes) => {
          if (!estadoPorMes.has(mes)) estadoPorMes.set(mes, new Set());
          estadoPorMes.get(mes).add(estado);
        });
      });

      let mesesDeuda = 0;
      for (let mes = inicioCobro; mes <= limiteMesDeuda; mes += 1) {
        const estados = estadoPorMes.get(mes) || new Set();
        const pagado = estados.has('aprobado') || estados.has('validado');
        if (!pagado) mesesDeuda += 1;
      }

      if (mesesDeuda <= 0) return;

      // calcularCuotaFinal aplica el % de beca parcial (si tiene) al monto
      // base — un jugador con 50% de beca debe aparecer con la mitad de
      // deuda, no con el precio completo.
      const cuotaRef = calcularCuotaFinal(Number(jugador.valor_mensualidad || 0), jugador);
      const cuentaApoderado = cuentaPorRut.get(normalizarRutComparacion(jugador.rut_apoderado))
        || cuentaPorCorreo.get(normalizarCorreo(jugador.correo_apoderado));
      const telefonoCuenta = String(cuentaApoderado?.telefono || '').trim();
      const telefono = telefonoCuenta
        ? `${String(cuentaApoderado?.prefijo_tel || '+56').trim()}${telefonoCuenta}`
        : '';
      morosos.push({
        id: rutJugadorNorm,
        rut: jugador.rut_jugador || rutJugadorNorm,
        nombre: `${jugador.nombres || ''} ${jugador.apellido_paterno || ''}`.trim() || `Jugador ${jugador.rut_jugador || ''}`,
        tipo: jugador?.rama?.toLowerCase().includes('femen') ? 'apoderado' : 'socio-apoderado',
        mesesDeuda,
        montoDeuda: cuotaRef > 0 ? (mesesDeuda * cuotaRef) : mesesDeuda,
        contacto: telefono || jugador.correo_apoderado || 'Sin contacto',
        telefono,
        correo: jugador.correo_apoderado || '',
        pupilos: [jugador.nombres || jugador.rut_jugador],
      });
    });

    return morosos.sort((a, b) => b.montoDeuda - a.montoDeuda);
  };

  // El backend devuelve dia_citacion como timestamp ISO (columna DATE serializada
  // por pg/JSON) y las horas como HH:MM:SS (columna TIME), pero el resto de la UI
  // espera el mismo formato que generaban los <input type="date"/"time"> originales
  // (YYYY-MM-DD y HH:MM). Se normaliza una sola vez al entrar los datos del API.
  const normalizarHora = (hora) => (hora ? String(hora).slice(0, 5) : hora);
  const normalizarCitacion = (cita) => ({
    ...cita,
    dia_citacion: cita?.dia_citacion ? String(cita.dia_citacion).slice(0, 10) : cita?.dia_citacion,
    hora_citacion: normalizarHora(cita?.hora_citacion),
    hora_presentacion: normalizarHora(cita?.hora_presentacion),
  });

  // Compartida entre la carga inicial (cargarDatos) y el polling periódico
  // de abajo, para que ambos caminos actualicen nominaCita/notificaciones
  // exactamente igual.
  const aplicarCitacionesYNotificaciones = (citacionesRes, notificacionesAppRes) => {
    if (Array.isArray(citacionesRes)) {
      setNominaCita(citacionesRes.map(normalizarCitacion));
    }

    if (Array.isArray(notificacionesAppRes) && notificacionesAppRes.length > 0) {
      const pendientes = notificacionesAppRes.filter((n) => !n.leida);
      if (pendientes.length > 0) {
        setNotificaciones((prev) => {
          const idsExistentes = new Set(prev.map((n) => n.origenId).filter(Boolean));
          const nuevas = pendientes
            .filter((n) => !idsExistentes.has(n.id))
            .map((n) => ({
              id: nextId(),
              origenId: n.id,
              tipo: n.tipo || 'citacion',
              titulo: n.titulo || 'Notificación',
              mensaje: n.cuerpo || '',
              leida: false,
              firmada: false,
            }));
          return [...nuevas, ...prev];
        });
      }
    }
  };

  // Refresco periódico (ver useEffect de polling más abajo): sin esto, el
  // muro y el progreso de una citación solo se actualizaban en la carga
  // inicial de la sesión, quedando desincronizados cuando otra persona
  // respondía en otra sesión/dispositivo.
  const cargarCitacionesYNotificaciones = async () => {
    try {
      const [citacionesRes, notificacionesAppRes] = await Promise.all([
        api.citacionesAPI.getAll(),
        api.notificacionesAppAPI.getAll(),
      ]);
      aplicarCitacionesYNotificaciones(citacionesRes, notificacionesAppRes);
    } catch {
      // Un fallo puntual del poll no debe interrumpir la UI.
    }
  };

  const cargarDatos = async ({ manual = false } = {}) => {
    if (manual) setApiRetrying(true);

    try {
      const resultados = await Promise.allSettled([
        api.comunicacionesAPI.getAll(),
        api.whatsappAPI.getContactos(),
        api.cuentasAPI.getIncompletas(),
        api.cuentasAPI.getAll(),
        api.jugadoresAPI.getAll(),
        api.jugadoresVisitaAPI.getAll(),
        api.pagosMensualidadesAPI.getAll(),
        api.partidosLiveAPI.getAll(),
        api.auditoriaAPI.getAll(),
        api.encuestasAPI.getAll(),
        api.quizAPI.getAll(),
        api.citacionesAPI.getAll(),
        api.notificacionesAppAPI.getAll(),
      ]);

      const getResult = (index, fallback = []) => (
        resultados[index]?.status === 'fulfilled'
          ? resultados[index].value
          : fallback
      );

      const comunicacionesRes = getResult(0, []);
      const contactosRes = getResult(1, []);
      const cuentasIncompletasRes = getResult(2, []);
      const cuentasRes = getResult(3, []);
      const jugadoresRes = getResult(4, []);
      const jugadoresVisitaRes = getResult(5, []);
      const pagosMensualidadesRes = getResult(6, []);
      const partidosLiveRes = getResult(7, []);
      const auditoriaRes = getResult(8, []);
      const encuestasRes = getResult(9, []);
      const quizRes = getResult(10, []);
      const citacionesRes = getResult(11, []);
      const notificacionesAppRes = getResult(12, []);
      const totalErrores = resultados.filter((r) => r.status === 'rejected').length;

      if (Array.isArray(comunicacionesRes)) {
        const comunicacionesTransformadas = mapComunicacionesResumen(comunicacionesRes);
        setComunicaciones(comunicacionesTransformadas);
        const materiales = comunicacionesTransformadas.filter((c) =>
          ['academia-video', 'academia-imagen', 'academia-documento'].includes((c.TIPO_COMUNICADO || '').toLowerCase())
        );
        setMaterialesAcademia(materiales);
      }

      if (Array.isArray(contactosRes)) {
        setContactosWhatsApp(contactosRes);
      }

      if (Array.isArray(cuentasIncompletasRes)) {
        setCuentasIncompletas(cuentasIncompletasRes);
        if (cuentasIncompletasRes.length > 0) {
          const nombres = cuentasIncompletasRes
            .slice(0, 3)
            .map(c => `${c.nombres || 'Sin nombre'} ${c.apellido_paterno || ''}`.trim())
            .join(', ');

          setNotificaciones(prev => ([
            {
              id: nextId(),
              tipo: 'datos',
              titulo: 'Cuentas con datos pendientes',
              mensaje: `Hay ${cuentasIncompletasRes.length} cuentas que deben actualizar datos (ej: ${nombres}).`,
              leida: false,
              firmada: false
            },
            ...prev
          ]));
        }
      }

      if (Array.isArray(cuentasRes)) {
        setCuentasAdmin(cuentasRes);
      }

      if (Array.isArray(jugadoresRes)) {
        setJugadoresAdmin(jugadoresRes);

        const nuevoRoster = jugadoresRes.map((j, idx) => ({
          id: idx + 1,
          rut_jugador: j.rut_jugador || `sin-rut-${idx + 1}`,
          nombre: `${j.nombres || ''} ${j.apellido_paterno || ''} ${j.apellido_materno || ''}`.trim(),
          correo_apoderado: j.correo_apoderado || '',
          rama: j.rama || 'MASCULINA',
          categoria: j.categoria || 'SUB-13',
          equipo: j.equipo_nombre || j.club_nombre || 'Centro de Cultura Física',
          equipo_nombre: j.equipo_nombre || j.club_nombre || 'Centro de Cultura Física',
          equipo_logo_url: j.equipo_logo_url || j.club_logo_url || '',
          dorsal: j.numero_camiseta || idx + 1,
          año: j.año_nacimiento || 0,
          estadoAsistencia: 'pendiente',
          pts: 0,
          reb: 0,
          ast: 0,
          stl: 0,
          blk: 0,
          flt: 0,
          to: 0,
        }));

        setRosterEquipo(nuevoRoster);

        if (jugadoresRes.length > 0) {
          const primerJugador = jugadoresRes[0];
          setPupiloActivo((prev) => prev || {
            id: 1,
            rut: primerJugador.rut_jugador,
            nombre: `${primerJugador.nombres || ''} ${primerJugador.apellido_paterno || ''} ${primerJugador.apellido_materno || ''}`.trim(),
            nombres: primerJugador.nombres || '',
            apellido_paterno: primerJugador.apellido_paterno || '',
            apellido_materno: primerJugador.apellido_materno || '',
            correo_apoderado: primerJugador.correo_apoderado || '',
            categoria: primerJugador.categoria || 'General',
            rama: primerJugador.rama || primerJugador.categoria_rama || 'General',
            genero: primerJugador.genero || primerJugador.sexo || '',
            fecha_ingreso: primerJugador.fecha_ingreso || null,
            mes_inicio_cobro: primerJugador.mes_inicio_cobro || '',
            anio_ingreso: primerJugador.anio_ingreso ?? primerJugador.año_ingreso ?? null,
            nivel: Number(primerJugador.nivel_actual || 1),
            xp: Number(primerJugador.xp_total || 0),
            anioNacimiento: obtenerAnioNacimientoJugador(primerJugador),
            numeroCamiseta: obtenerNumeroCamisetaJugador(primerJugador, 0),
            posicion: primerJugador.posicion_juego || 'N/A',
            estatura: primerJugador.estatura || 'N/A',
            peso: primerJugador.peso || 'N/A',
            manoHabil: primerJugador.mano_habil || 'N/A',
            tallaCamiseta: primerJugador.talla_camiseta || 'N/A',
            tallaShort: primerJugador.talla_short || 'N/A',
            poleraEntregada: Boolean(primerJugador.polera_entregada),
            asistencia: primerJugador.asistencia || 'N/A',
            estadoDeportivo: primerJugador.estado_deportivo || 'Activo',
            beca: primerJugador.beca || 'Sin beca',
            foto_jugador: primerJugador.foto_jugador || primerJugador.foto_perfil_url || primerJugador.club_logo_url || '',
          });
        } else {
          setPupiloActivo(null);
        }
      }

      if (Array.isArray(jugadoresVisitaRes)) {
        setJugadoresVisitaAdmin(jugadoresVisitaRes);
      }

      if (Array.isArray(pagosMensualidadesRes)) {
        setPagosMensualidadesAdmin(pagosMensualidadesRes);
        setPagosPendientesAdmin(pagosMensualidadesRes.filter((p) => (p.estado_pago || '').toLowerCase() === 'pendiente'));
        setMorososAdmin(construirMorososDesdePagos(pagosMensualidadesRes, jugadoresRes, cuentasRes));
      }

      if (Array.isArray(partidosLiveRes)) {
        setPartidosResumen(mapPartidosResumen(partidosLiveRes));
      }

      if (Array.isArray(auditoriaRes)) {
        setLogAuditoria(auditoriaRes.map((a) => ({
          id: a.id || nextId(),
          accion: a.accion || 'Evento',
          detalle: a.detalle || a.descripcion || 'Sin detalle',
          usuario: a.usuario || 'Sistema',
          hora: a.created_at ? new Date(a.created_at).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' }) : '--:--',
        })));
      }

      if (Array.isArray(encuestasRes)) {
        setEncuestas(encuestasRes.map((e) => ({
          id: e.id,
          titulo: e.pregunta || 'Encuesta',
          opciones: Array.isArray(e.opciones) ? e.opciones : Object.keys(e.votos || {}),
          votos: e.votos || {},
          respondio: false,
        })));
      }

      if (Array.isArray(quizRes)) {
        setQuizList(quizRes.map((q) => {
          const opcionesQuiz = Array.isArray(q.opciones_json)
            ? q.opciones_json
            : (typeof q.opciones_json === 'string' ? JSON.parse(q.opciones_json || '[]') : []);
          return {
            id: q.id_pregunta,
            titulo: q.titulo || 'Desafío semanal',
            pregunta: q.pregunta || 'Pregunta no disponible',
            opciones: opcionesQuiz,
            respuestaCorrecta: q.respuesta_correcta || 'A',
            explicacion: q.explicacion || 'Revisa la respuesta con tu entrenador.',
            rama: q.rama || 'General',
            categorias_objetivo: Array.isArray(q.categorias_objetivo) ? q.categorias_objetivo : [],
            activo: q.activo !== false,
            creado_por: q.creado_por || '',
          };
        }));
      }

      aplicarCitacionesYNotificaciones(citacionesRes, notificacionesAppRes);

      try {
        const pizarrasRes = await api.academiaPizarrasAPI.getAll();
        setPizarrasAcademia(Array.isArray(pizarrasRes) ? pizarrasRes : []);
      } catch {
        setPizarrasAcademia([]);
      }

      setApiOffline(totalErrores > 0 && totalErrores === resultados.length);
      setApiStatusMessage(
        totalErrores > 0
          ? `Algunos servicios no respondieron (${totalErrores}/${resultados.length}). Endpoint: ${api.API_BASE_URL_CONFIG}`
          : ''
      );
    } catch (error) {
      setApiOffline(true);
      setApiStatusMessage(error?.message || `Sin conexión con backend (${api.API_BASE_URL_CONFIG})`);
    } finally {
      if (manual) setApiRetrying(false);
    }
  };

  // Cargar datos del API al montar el componente
  useEffect(() => {
    const timer = setTimeout(() => {
      void cargarDatos();
    }, 1000);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  
  // Efecto Skeleton Loader al cambiar de pantalla

  const cambiarPantallaConLoader = (pantalla) => {
    if (pantalla === pantallaActiva) return;
    setPantallaActiva(pantalla);
    setIsAppLoading(false);
  };

  const getUsuarioActivoPermisos = () => {
    if (!usuarioAutenticado) return null;

    return obtenerPermisosEfectivos({
      rol: usuarioAutenticado.rol,
      override: permisosPorUsuario[usuarioAutenticado.id] || {},
    });
  };

  const puedeVerPantalla = (pantalla) => {
    if (!rolUsuario) return false;
    if (normalizarRol(rolUsuario) === 'super_admin') return true;

    const usuarioPermisos = getUsuarioActivoPermisos();
    return Boolean(usuarioPermisos?.[pantalla]);
  };

  const getHeaderTitle = () => {
    if(!rolUsuario) return "Portal Oficial";
    switch(pantallaActiva) {
      case 'comunicaciones': return "Muro Social";
      case 'academia': return "Academia Club";
      case 'perfil': return (rolUsuario === 'admin' || rolUsuario === 'super_admin') ? "Validación Tesorería" : "Mi Cuenta";
      case 'jugador': return "Pase Digital";
      case 'asistencia_staff': return "Control Asistencia";
      case 'scoreboard_live': return "Mesa FIBA Live";
      case 'torneos': return "Torneos y Tabla de Posiciones";
      case 'kiosco': return "Kiosco POS";
      case 'admin_dashboard': return "Administración";
      default: return "Club Cultura Física";
    }
  };

  const abrirFormularioLogin = (tipo) => { setTipoLoginSeleccionado(tipo); setMostrarFormularioLogin(true); setRutInput(tipo === 'invitado' ? 'visita' : ''); };
  const volverInicioLogin = () => { setMostrarFormularioLogin(false); setRutInput(''); setPassInput(''); };

  const getCamposPendientesOnboarding = (cuenta = {}) => {
    const rolBase = normalizarRol(cuenta.perfil_principal || cuenta.rol || rolUsuarioTemporal || 'apoderado');

    const camposTextoPorRol = {
      jugador: ['nombres', 'apellido_paterno', 'telefono'],
      staff: ['nombres', 'apellido_paterno', 'telefono'],
      apoderado: ['nombres', 'apellido_paterno', 'telefono', 'direccion', 'comuna'],
      socio: ['nombres', 'apellido_paterno', 'telefono', 'direccion', 'comuna'],
      socio_apoderado: ['nombres', 'apellido_paterno', 'telefono', 'direccion', 'comuna'],
      'socio-apoderado': ['nombres', 'apellido_paterno', 'telefono', 'direccion', 'comuna'],
      directiva: ['nombres', 'apellido_paterno', 'telefono', 'direccion', 'comuna'],
      admin: ['nombres', 'apellido_paterno', 'telefono'],
      super_admin: ['nombres', 'apellido_paterno', 'telefono'],
    };

    const base = camposTextoPorRol[rolBase] || ['nombres', 'apellido_paterno', 'telefono'];
    const faltantes = base.filter((campo) => !String(cuenta[campo] || '').trim());

    return [...new Set(faltantes)];
  };

  const cargarCuentaOnboarding = async (cuentaBase = null) => {
    const cuentaActual = cuentaBase || onboardingCuenta;
    if (!cuentaActual?.id) return { fusion: cuentaActual || {}, camposPendientes: [] };

    const detalle = await api.cuentasAPI.getById(cuentaActual.id);
    const fusion = { ...cuentaActual, ...(detalle || {}) };
    const camposPendientes = getCamposPendientesOnboarding(fusion);

    setOnboardingCuentaDetalle(fusion);
    setOnboardingCamposPendientes(camposPendientes);
    setOnboardingPerfilDraft({
      nombres: fusion.nombres || '',
      apellido_paterno: fusion.apellido_paterno || '',
      apellido_materno: fusion.apellido_materno || '',
      telefono: fusion.telefono || '',
      direccion: fusion.direccion || '',
      comuna: fusion.comuna || '',
      foto_perfil_url: fusion.foto_perfil_url || fusion.logo_url || '',
    });

    return { fusion, camposPendientes };
  };

  const subirFotoOnboarding = async (file) => {
    if (!file) return;
    try {
      setOnboardingSubiendoFoto(true);
      const formData = new FormData();
      formData.append('nombre', `perfil-${onboardingCuenta?.id || Date.now()}`);
      formData.append('tipo', 'perfil');
      formData.append('archivo', file);
      const resultado = await api.assetsAPI.uploadLogo(formData);
      const fotoUrl = resultado?.url || '';
      setOnboardingPerfilDraft((prev) => ({ ...prev, foto_perfil_url: fotoUrl }));
    } catch (error) {
      showToast({ message: error.message || 'No se pudo subir la foto de perfil.', type: 'error' });
    } finally {
      setOnboardingSubiendoFoto(false);
    }
  };

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    if(!rutInput || !passInput) { showToast({ message: 'Ingresa tu RUT y contraseña.', type: 'error' }); return; }

    if(tipoLoginSeleccionado === 'invitado' || rutInput.toLowerCase().includes('visita')) {
      iniciarSesionFinal('visita', {
        id: `visita-${rutInput || 'anonimo'}`,
        nombre: 'Visita',
        correo: '',
        rut: rutInput || '',
        rol: 'visita',
        access_profiles: ['visita'],
      });
      return;
    }

    try {
      const loginRes = await api.authAPI.login(rutInput, passInput);
      const usuarioDetectado = loginRes?.user || null;
      const perfilDetectado = resolverRolPrincipal(loginRes?.user?.rol || 'jugador', usuarioDetectado);
      const requiereCambioClave = passInput === '12345' || Boolean(loginRes?.user?.forzar_clave);

      // Setear el token de inmediato: los pasos de onboarding (completar
      // perfil) llaman a endpoints protegidos antes de que exista sesión final.
      setSesionToken(loginRes?.token || null);
      api.setAuthToken(loginRes?.token || null);

      if(requiereCambioClave) {
        setRolUsuarioTemporal(perfilDetectado);
        setOnboardingCuenta(usuarioDetectado);
        setOnboardingCuentaDetalle(null);
        setOnboardingCamposPendientes([]);
        setOnboardingPerfilDraft({
          nombres: '',
          apellido_paterno: '',
          apellido_materno: '',
          telefono: '',
          direccion: '',
          comuna: '',
          foto_perfil_url: '',
        });
        setOnboardingPasswordActual(passInput);
        setOnboardingPassword('');
        setOnboardingPasswordConfirm('');
        setIsOnboarding(true);
        setOnboardingStep(1);
        setOnboardingProgress(15);
      } else {
        iniciarSesionFinal(perfilDetectado, usuarioDetectado, loginRes?.token || null);
      }
    } catch (error) {
      const rutIngresado = String(rutInput || '').trim().toLowerCase();
      const passIngresada = String(passInput || '').trim();
      const cuentaDemo = (cuentasDemo || []).find((cuenta) => {
        const rutDemo = String(cuenta?.rut || '').trim().toLowerCase();
        const correoDemo = String(cuenta?.correo || '').trim().toLowerCase();
        const passDemo = String(cuenta?.password || '').trim();
        return passDemo === passIngresada && (rutDemo === rutIngresado || correoDemo === rutIngresado);
      });

      const esEntornoLocal = typeof window !== 'undefined' && ['localhost', '127.0.0.1'].includes(window.location.hostname);
      if (esEntornoLocal && cuentaDemo) {
        iniciarSesionFinal(cuentaDemo.perfil, {
          id: `demo-${cuentaDemo.perfil}`,
          nombre: cuentaDemo.etiqueta || cuentaDemo.perfil,
          correo: cuentaDemo.correo || '',
          rut: cuentaDemo.rut || '',
          rol: cuentaDemo.perfil,
          perfil_principal: cuentaDemo.perfil,
          access_profiles: [cuentaDemo.perfil],
        });
        return;
      }
      showToast({ message: error.message || 'No se pudo iniciar sesión. Revisa RUT y contraseña.', type: 'error' });
    }
  };

  const avanzarOnboarding = async () => {
    if (onboardingStep === 1) {
      const nuevaClave = String(onboardingPassword || '').trim();
      const confirmacion = String(onboardingPasswordConfirm || '').trim();
      if (nuevaClave.length < 5) {
        showToast({ message: 'La nueva contraseña debe tener al menos 5 caracteres.', type: 'error' });
        return;
      }
      if (nuevaClave !== confirmacion) {
        showToast({ message: 'La confirmación de contraseña no coincide.', type: 'error' });
        return;
      }
      if (!onboardingCuenta?.rut) {
        showToast({ message: 'No se pudo identificar la cuenta para actualizar contraseña.', type: 'error' });
        return;
      }

      let onboardingInfo;
      try {
        await api.authAPI.changePassword({
          rut: onboardingCuenta.rut,
          currentPassword: onboardingPasswordActual,
          newPassword: nuevaClave,
        });

        onboardingInfo = await cargarCuentaOnboarding(onboardingCuenta);
      } catch (error) {
        showToast({ message: error.message || 'No se pudo actualizar la contraseña.', type: 'error' });
        return;
      }

      const pendiente = onboardingInfo?.camposPendientes || [];
      if (pendiente.length === 0) {
        setIsOnboarding(false);
        setOnboardingPassword('');
        setOnboardingPasswordConfirm('');
        setOnboardingPasswordActual('');
        setOnboardingCamposPendientes([]);
        setOnboardingCuentaDetalle(null);
        iniciarSesionFinal(rolUsuarioTemporal, onboardingCuenta);
        return;
      }

      setOnboardingStep(2);
      setOnboardingProgress(70);
      return;
    }

    if (onboardingStep === 2) {
      if (!onboardingCuenta?.id) {
        showToast({ message: 'No se pudo identificar la cuenta para completar perfil.', type: 'error' });
        return;
      }

      const faltantesTexto = onboardingCamposPendientes.filter((campo) => campo !== 'foto_perfil_url');
      const faltanteTextoInvalido = faltantesTexto.find((campo) => !String(onboardingPerfilDraft[campo] || '').trim());
      if (faltanteTextoInvalido) {
        showToast({ message: 'Completa todos los datos pendientes antes de continuar.', type: 'error' });
        return;
      }

      try {
        const payload = {};
        onboardingCamposPendientes.forEach((campo) => {
          payload[campo] = String(onboardingPerfilDraft[campo] || '').trim();
        });
        if (String(onboardingPerfilDraft.foto_perfil_url || '').trim()) {
          payload.foto_perfil_url = onboardingPerfilDraft.foto_perfil_url;
        }
        await api.cuentasAPI.update(onboardingCuenta.id, payload);
      } catch (error) {
        showToast({ message: error.message || 'No se pudieron guardar los datos pendientes.', type: 'error' });
        return;
      }
    }

    setIsOnboarding(false);
    setOnboardingPassword('');
    setOnboardingPasswordConfirm('');
    setOnboardingPasswordActual('');
    setOnboardingCuentaDetalle(null);
    setOnboardingCamposPendientes([]);
    iniciarSesionFinal(rolUsuarioTemporal, onboardingCuenta);
  };

  const iniciarSesionFinal = (perfil, usuario = null, token = undefined) => {
    const tokenFinal = token !== undefined ? token : sesionToken;
    setSesionToken(tokenFinal);
    api.setAuthToken(tokenFinal);

    const perfilNormalizado = resolverRolPrincipal(perfil, usuario);
    const usuarioNormalizado = usuario ? {
      ...usuario,
      rol: resolverRolPrincipal(usuario.rol || perfilNormalizado, usuario),
      access_profiles: Array.from(new Set([
        ...(Array.isArray(usuario.access_profiles) ? usuario.access_profiles.map((r) => normalizarRol(r)) : []),
        normalizarRol(usuario.perfil_principal || ''),
        resolverRolPrincipal(usuario.rol || perfilNormalizado, usuario),
      ].filter(Boolean))),
    } : {
      id: `rol-${perfilNormalizado}`,
      nombre: perfilNormalizado,
      correo: '',
      rut: '',
      rol: perfilNormalizado,
      access_profiles: [perfilNormalizado],
    };

    setRolUsuario(perfilNormalizado);
    setUsuarioAutenticado(usuarioNormalizado);
    
    // Determinar pantalla activa según rol
    let pantallaActiva = 'comunicaciones';
    if(perfilNormalizado === 'mesa') pantallaActiva = 'scoreboard_live';
    else if(perfilNormalizado === 'admin' || perfilNormalizado === 'super_admin') pantallaActiva = 'admin_dashboard';
    else if(perfilNormalizado === 'staff') pantallaActiva = 'asistencia_staff'; 
    else if(perfilNormalizado === 'jugador' || perfilNormalizado === 'visita') pantallaActiva = 'jugador';
    
    setPantallaActiva(pantallaActiva);
    
    // Guardar sesión inmediatamente para todos los usuarios (sin requerimiento de contraseña en siguiente acceso)
    window.localStorage.setItem(
      SESSION_STORAGE_KEY,
      JSON.stringify({
        rol: perfilNormalizado,
        usuario: usuarioNormalizado,
        pantallaActiva: pantallaActiva,
        token: tokenFinal,
        savedAt: new Date().toISOString(),
      })
    );
    
    setRutInput(''); setPassInput(''); setMostrarFormularioLogin(false);

    // Recargar datos con el token recién autenticado: el fetch inicial (al montar la app)
    // corre sin sesión y sus resultados protegidos quedan vacíos; sin este refresh, la sesión
    // arranca con jugadores/cuentas/pagos vacíos hasta que algo más dispare una recarga manual.
    void cargarDatos();
  };

  const cerrarSesion = () => {
    setShowModalSalir(false);
    setRolUsuario(null);
    setUsuarioAutenticado(null);
    setSesionToken(null);
    api.setAuthToken(null);
    setPantallaActiva('comunicaciones');
    setMostrarFormularioLogin(false);
    setShowSettings(false);
    setVistaAdmin('dashboard');
    setIsOnboarding(false);
    setOnboardingPassword('');
    setOnboardingPasswordConfirm('');
    setOnboardingPasswordActual('');
    setOnboardingCuenta(null);
    setOnboardingCuentaDetalle(null);
    setOnboardingCamposPendientes([]);
    setOnboardingPerfilDraft({
      nombres: '',
      apellido_paterno: '',
      apellido_materno: '',
      telefono: '',
      direccion: '',
      comuna: '',
      foto_perfil_url: '',
    });
    window.localStorage.removeItem(SESSION_STORAGE_KEY);
  };

  // Si cualquier llamada a la API devuelve 401 (token vencido/ inválido),
  // forzar el mismo cierre de sesión que el botón "Salir".
  useEffect(() => {
    api.setUnauthorizedHandler(cerrarSesion);
    return () => api.setUnauthorizedHandler(null);
  }, []);

  const toggleSettingsPanel = () => {
    if (rolUsuario !== 'admin' && rolUsuario !== 'super_admin') return;
    setShowSettings((prev) => {
      const next = !prev;
      if (next) {
        setMostrarNotificaciones(false);
      }
      return next;
    });
  };

  const toggleNotificationsPanel = () => {
    setMostrarNotificaciones((prev) => {
      const next = !prev;
      if (next) {
        setShowSettings(false);
      }
      return next;
    });
  };

  const extractBuildHashFromUrl = (assetUrl = '') => {
    const safeUrl = String(assetUrl || '').trim();
    const match = safeUrl.match(/\/assets\/index-([a-zA-Z0-9_-]+)\.js/i);
    return match?.[1] || '';
  };

  const getCurrentBuildHash = () => {
    if (typeof document === 'undefined') return '';
    const scripts = Array.from(document.querySelectorAll('script[src]'));
    const indexScript = scripts.find((script) => {
      const src = script.getAttribute('src') || '';
      return /\/assets\/index-[a-zA-Z0-9_-]+\.js/i.test(src);
    });
    return extractBuildHashFromUrl(indexScript?.getAttribute('src') || '');
  };

  const getLatestBuildHashFromHtml = (html = '') => {
    const safeHtml = String(html || '');
    const match = safeHtml.match(/\/assets\/index-([a-zA-Z0-9_-]+)\.js/i);
    return match?.[1] || '';
  };

  const checkLatestAppVersion = async ({ manual = false } = {}) => {
    if (typeof window === 'undefined') return null;
    if (appVersionCheckInFlightRef.current) return null;

    appVersionCheckInFlightRef.current = true;
    setAppVersionState((prev) => ({
      ...prev,
      checking: true,
      error: '',
      currentBuild: prev.currentBuild || getCurrentBuildHash(),
    }));

    try {
      const basePath = `${window.location.origin}${window.location.pathname}`;
      const response = await fetch(`${basePath}?app-version-check=${Date.now()}`, {
        cache: 'no-store',
      });
      const html = await response.text();
      const latestBuild = getLatestBuildHashFromHtml(html);
      const currentBuild = getCurrentBuildHash();
      const hasHashes = Boolean(currentBuild && latestBuild);
      const hasUpdate = hasHashes ? currentBuild !== latestBuild : false;

      const nextState = {
        checking: false,
        hasUpdate,
        isLatest: hasHashes ? !hasUpdate : true,
        currentBuild,
        latestBuild,
        error: '',
        lastCheckedAt: new Date().toISOString(),
      };

      setAppVersionState(nextState);
      return nextState;
    } catch (error) {
      const message = manual
        ? (error?.message || 'No se pudo verificar la versión de la app.')
        : '';
      setAppVersionState((prev) => ({
        ...prev,
        checking: false,
        error: message,
        currentBuild: prev.currentBuild || getCurrentBuildHash(),
        lastCheckedAt: new Date().toISOString(),
      }));
      return null;
    } finally {
      appVersionCheckInFlightRef.current = false;
    }
  };

  const handleUpdateAppClick = async () => {
    const resultado = await checkLatestAppVersion({ manual: true });
    const debeActualizar = Boolean(resultado?.hasUpdate || appVersionState.hasUpdate);

    if (debeActualizar) {
      const destino = `${window.location.origin}${window.location.pathname}?fresh=app-update-${Date.now()}`;
      window.location.assign(destino);
      return;
    }

    if (resultado && !resultado.hasUpdate) {
      showToast({ message: 'Ya tienes la ultima version disponible.', type: 'info' });
    }
  };

  useEffect(() => {
    void checkLatestAppVersion();
    const intervalId = window.setInterval(() => {
      void checkLatestAppVersion();
    }, 120000);

    return () => window.clearInterval(intervalId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sin este refresco, el muro y "Control de Citaciones" solo se actualizaban
  // en la carga inicial de la sesión: si otra persona respondía una citación
  // en otra sesión, no se veía hasta recargar la página manualmente.
  useEffect(() => {
    const intervalId = window.setInterval(() => {
      void cargarCitacionesYNotificaciones();
    }, 20000);

    return () => window.clearInterval(intervalId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!showSettings && !mostrarNotificaciones) return;

    const onPointerDown = (event) => {
      const target = event.target;
      const clicEnSettings = settingsPanelRef.current?.contains(target) || settingsButtonRef.current?.contains(target);
      const clicEnNotificaciones = notificationsPanelRef.current?.contains(target) || notificationsButtonRef.current?.contains(target);

      if (clicEnSettings || clicEnNotificaciones) return;

      setShowSettings(false);
      setMostrarNotificaciones(false);
    };

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('touchstart', onPointerDown);

    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('touchstart', onPointerDown);
    };
  }, [showSettings, mostrarNotificaciones]);

  const restaurarPermisosAntesCancelacion = (snapshot) => {
    if (!snapshot || typeof snapshot !== 'object') return;
    // Restore override state from snapshot taken when the edit was opened.
    // snapshot shape: { [usuarioId]: { [moduloId]: boolean, ... }, ... }
    setPermisosPorUsuario((prev) => {
      const restored = { ...prev };
      for (const [id, permisos] of Object.entries(snapshot)) {
        // Derive only the overrides from the snapshot (diff vs role base).
        // We store the snapshot as matrixPermisos entries (effective), so we must
        // restore permisosPorUsuario (overrides only) from the cuentasAdmin original.
        const cuentaOriginal = cuentasAdmin.find(
          (c) => String(c.id ?? c.rut ?? c.correo) === String(id)
        );
        const override = cuentaOriginal?.permisos_override &&
          typeof cuentaOriginal.permisos_override === 'object'
            ? cuentaOriginal.permisos_override
            : {};
        restored[id] = override;
        void permisos;
      }
      return restored;
    });
  };

  // Función para togglear un permiso específico
  const togglePermiso = (usuarioId, modulo) => {
    setPermisosPorUsuario((prev) => {
      const permisosActuales = prev[usuarioId] || {};
      return {
        ...prev,
        [usuarioId]: {
          ...permisosActuales,
          [modulo]: !permisosActuales[modulo],
        },
      };
    });
  };

  const recargarUsuariosAdmin = async () => {
    const [cuentasRes, cuentasIncompletasRes, jugadoresRes, jugadoresVisitaRes] = await Promise.all([
      api.cuentasAPI.getAll(),
      api.cuentasAPI.getIncompletas(),
      api.jugadoresAPI.getAll(),
      api.jugadoresVisitaAPI.getAll(),
    ]);

    // Store only the persisted OVERRIDES — not fully resolved permission maps.
    // Effective permissions are always computed on-demand via obtenerPermisosEfectivos().
    const overridesPorUsuario = Array.isArray(cuentasRes)
      ? cuentasRes.reduce((acc, cuenta) => {
          const idUsuario = cuenta.id ?? cuenta.id_usuario ?? cuenta.id_cuenta ?? cuenta.rut ?? cuenta.correo;
          if (idUsuario == null) return acc;

          const override = cuenta.permisos_override && typeof cuenta.permisos_override === 'object'
            ? cuenta.permisos_override
            : {};

          acc[idUsuario] = override;
          return acc;
        }, {})
      : {};

    setCuentasAdmin(Array.isArray(cuentasRes) ? cuentasRes : []);
    setCuentasIncompletas(Array.isArray(cuentasIncompletasRes) ? cuentasIncompletasRes : []);
    setJugadoresAdmin(Array.isArray(jugadoresRes) ? jugadoresRes : []);
    setJugadoresVisitaAdmin(Array.isArray(jugadoresVisitaRes) ? jugadoresVisitaRes : []);
    setPermisosPorUsuario(overridesPorUsuario);
  };

  const recargarPagosMensualidades = async () => {
    const pagosRes = await api.pagosMensualidadesAPI.getAll();
    setPagosMensualidadesAdmin(Array.isArray(pagosRes) ? pagosRes : []);
    setPagosPendientesAdmin(
      Array.isArray(pagosRes)
        ? pagosRes.filter((p) => (p.estado_pago || '').toLowerCase() === 'pendiente')
        : []
    );
    setMorososAdmin(
      Array.isArray(pagosRes)
        ? construirMorososDesdePagos(pagosRes, jugadoresAdmin, cuentasAdmin)
        : []
    );
  };

  const guardarCuentaAdmin = async (payload, id = null) => {
    const rutPayload = String(payload?.rut || '').trim();
    if (!id && (!rutPayload || !api.validarRutChileno(rutPayload))) {
      throw new Error('RUT invalido para la cuenta.');
    }
    if (id && rutPayload && !api.validarRutChileno(rutPayload)) {
      throw new Error('RUT invalido para la cuenta.');
    }

    if (id) {
      await api.cuentasAPI.update(id, payload);
    } else {
      await api.cuentasAPI.create(payload);
    }

    await recargarUsuariosAdmin();
  };

  const guardarJugadorAdmin = async (payload, rutOriginal = null) => {
    if (!payload?.rut_jugador) {
      throw new Error('RUT de jugador es obligatorio.');
    }

    if (!api.validarRutChileno(payload.rut_jugador)) {
      throw new Error('RUT chileno invalido para jugador.');
    }

    if (rutOriginal && String(payload.rut_jugador || '').trim().toUpperCase() !== String(rutOriginal || '').trim().toUpperCase()) {
      // Keep original record for traceability and create corrected record with the new RUT.
      await api.jugadoresAPI.update(rutOriginal, { estado: 'BAJA' });
      await api.jugadoresAPI.create({ ...payload, estado: payload.estado || 'ACTIVO' });
    } else if (rutOriginal) {
      await api.jugadoresAPI.update(rutOriginal, payload);
    } else {
      await api.jugadoresAPI.create(payload);
    }

    await recargarUsuariosAdmin();
  };

  const eliminarCuentaAdmin = async (idCuenta) => {
    if (!idCuenta) {
      throw new Error('ID de cuenta inválido.');
    }

    await api.cuentasAPI.delete(idCuenta, usuarioAutenticado);
    await recargarUsuariosAdmin();
  };

  const eliminarJugadorAdmin = async (rutJugador) => {
    const rut = String(rutJugador || '').trim();
    if (!rut) {
      throw new Error('RUT de jugador inválido.');
    }

    await api.jugadoresAPI.delete(rut, usuarioAutenticado);
    await recargarUsuariosAdmin();
    await recargarPagosMensualidades();
  };

  const guardarJugadorVisitaAdmin = async (payload, id = null) => {
    if (id) {
      await api.jugadoresVisitaAPI.update(id, payload);
    } else {
      await api.jugadoresVisitaAPI.create(payload);
    }

    const visitaRes = await api.jugadoresVisitaAPI.getAll();
    setJugadoresVisitaAdmin(Array.isArray(visitaRes) ? visitaRes : []);
  };

  const validarPagoMensualidad = async (id, estadoPago) => {
    await api.pagosMensualidadesAPI.validar(id, estadoPago);
    await recargarPagosMensualidades();
  };

  const sincronizarDatosDesdeSheets = async () => {
    await cargarDatos({ manual: true });
    generarAlertas();
  };

  const publicarMaterialAcademia = async ({ titulo, url, tipo, rama, categorias }) => {
    const tipoComunicado = tipo === 'video'
      ? 'Academia-Video'
      : tipo === 'imagen'
        ? 'Academia-Imagen'
        : 'Academia-Documento';

    await api.comunicacionesAPI.create({
      titulo,
      cuerpo_texto: url,
      tipo: tipoComunicado,
      rama: rama || 'General',
      categoria: (categorias && categorias[0]) || 'General',
      categorias_objetivo: Array.isArray(categorias) ? categorias : [],
      urgencia: 'Baja',
      solicita_asistencia: false,
    });

    await cargarDatos({ manual: true });
  };

  const subirVideoAcademia = async ({ titulo, archivo, rama, categorias }, { onProgress } = {}) => {
    const formData = new FormData();
    formData.append('archivo', archivo);
    formData.append('titulo', titulo);
    formData.append('rama', rama || 'General');
    formData.append('categoria', (categorias && categorias[0]) || 'General');
    formData.append('categorias_objetivo', JSON.stringify(Array.isArray(categorias) ? categorias : []));

    await api.academiaVideosAPI.subir(formData, { onProgress });
    await cargarDatos({ manual: true });
  };

  const crearQuizAcademia = async ({ titulo, pregunta, opciones, respuestaCorrecta, rama, categorias }) => {
    await api.quizAPI.create({
      titulo,
      tipo_quiz: 'academia',
      rama: rama || 'General',
      categorias_objetivo: Array.isArray(categorias) ? categorias : [],
      pregunta,
      opciones_json: opciones,
      respuesta_correcta: respuestaCorrecta,
      dificultad: 'media',
    });

    await cargarDatos({ manual: true });
  };

  const guardarPizarraAcademia = async ({ nombre_tactica, descripcion, rama, categorias, imagenBlob }) => {
    const formData = new FormData();
    if (imagenBlob) formData.append('archivo', imagenBlob, 'pizarra.png');
    formData.append('nombre_tactica', nombre_tactica);
    formData.append('descripcion', descripcion || '');
    formData.append('rama', rama || 'General');
    formData.append('categorias_objetivo', JSON.stringify(Array.isArray(categorias) ? categorias : []));

    await api.academiaPizarrasAPI.guardar(formData);
    await cargarDatos({ manual: true });
  };

  // Edición/borrado para el panel "Mis Publicaciones" de Academia — mismo
  // patrón que los 4 handlers de arriba (llamar API, recargar datos).
  const actualizarMaterialAcademia = async ({ id, titulo, url, rama, categorias, activo }) => {
    await api.comunicacionesAPI.update(id, {
      titulo, cuerpo_texto: url, rama, categorias_objetivo: Array.isArray(categorias) ? categorias : [], activo,
    });
    await cargarDatos({ manual: true });
  };

  const eliminarMaterialAcademia = async (id) => {
    await api.comunicacionesAPI.delete(id);
    await cargarDatos({ manual: true });
  };

  const actualizarVideoAcademia = async ({ id, titulo, rama, categorias, activo }) => {
    await api.academiaVideosAPI.actualizar(id, {
      titulo, rama, categorias_objetivo: Array.isArray(categorias) ? categorias : [], activo,
    });
    await cargarDatos({ manual: true });
  };

  const eliminarVideoAcademia = async (id) => {
    await api.academiaVideosAPI.borrar(id);
    await cargarDatos({ manual: true });
  };

  const actualizarPizarraAcademia = async ({ id, nombre_tactica, descripcion, rama, categorias, activo }) => {
    await api.academiaPizarrasAPI.actualizar(id, {
      nombre_tactica, descripcion, rama, categorias_objetivo: Array.isArray(categorias) ? categorias : [], activo,
    });
    await cargarDatos({ manual: true });
  };

  const eliminarPizarraAcademia = async (id) => {
    await api.academiaPizarrasAPI.borrar(id);
    await cargarDatos({ manual: true });
  };

  const actualizarQuizAcademia = async ({ id, titulo, pregunta, opciones, respuestaCorrecta, rama, categorias, activo }) => {
    await api.quizAPI.actualizar(id, {
      titulo, pregunta, opciones_json: opciones, respuesta_correcta: respuestaCorrecta,
      rama, categorias_objetivo: Array.isArray(categorias) ? categorias : [], activo,
    });
    await cargarDatos({ manual: true });
  };

  const eliminarQuizAcademia = async (id) => {
    await api.quizAPI.borrar(id);
    await cargarDatos({ manual: true });
  };

  const recargarComunicacionesResumen = async () => {
    try {
      const comunicacionesRes = await api.comunicacionesAPI.getAll();
      const comunicacionesTransformadas = mapComunicacionesResumen(comunicacionesRes);
      setComunicaciones(comunicacionesTransformadas);
      const materiales = comunicacionesTransformadas.filter((c) =>
        ['academia-video', 'academia-imagen', 'academia-documento'].includes((c.TIPO_COMUNICADO || '').toLowerCase())
      );
      setMaterialesAcademia(materiales);
    } catch {
      setComunicaciones([]);
      setMaterialesAcademia([]);
    }
  };

  const recargarPartidosResumen = async () => {
    try {
      const partidosLiveRes = await api.partidosLiveAPI.getAll();
      setPartidosResumen(mapPartidosResumen(partidosLiveRes));
    } catch {
      setPartidosResumen([]);
    }
  };

  // ==========================================
  // 4. COMPONENTES VISUALES (PÚBLICO Y ONBOARDING)
  // ==========================================

  // ==========================================
  // 5. LOGICA DE NOTIFICACIONES, BUSQUEDA Y REPORTES
  // ==========================================

  const addNotificacion = (tipo, titulo, descripcion, comId = null) => {
    const nuevaNotif = {
      id: nextId(),
      tipo: tipo, // 'comentario', 'rsvp', 'comunicacion', 'encuesta'
      titulo: titulo,
      descripcion: descripcion,
      comId: comId,
      timestamp: new Date(),
      leida: false
    };
    setNotificaciones([nuevaNotif, ...notificaciones]);
    // Auto-dismiss después de 5 segundos si es de tipo automático
    setTimeout(() => {
      setNotificaciones(notifs => notifs.filter(n => n.id !== nuevaNotif.id));
    }, 5000);
  };

  const buscarGlobal = (query) => {
    if(!query.trim()) {
      setResultadosBusqueda({ comunicaciones: [], comentarios: [], usuarios: [] });
      return;
    }
    
    const q = query.toLowerCase();
    
    // Buscar en comunicaciones
    const comResultados = comunicaciones.filter(c =>
      c.TITULO.toLowerCase().includes(q) || c.CUERPO_TEXTO.toLowerCase().includes(q)
    );

    // Buscar en comentarios
    const comentResultados = [];
    Object.entries(comentariosUI).forEach(([comId, comentarios]) => {
      comentarios.forEach(c => {
        if(c.texto.toLowerCase().includes(q)) {
          comentResultados.push({...c, comId});
        }
        c.respuestas?.forEach(r => {
          if(r.texto.toLowerCase().includes(q)) {
            comentResultados.push({...r, comId, esRespuesta: true});
          }
        });
      });
    });

    // Buscar usuarios
    const usuarios = new Set();
    Object.values(comentariosUI).forEach(comentarios => {
      comentarios.forEach(c => usuarios.add(c.usuario));
    });
    const userResultados = Array.from(usuarios).filter(u => u.toLowerCase().includes(q));

    setResultadosBusqueda({
      comunicaciones: comResultados,
      comentarios: comentResultados,
      usuarios: userResultados
    });
  };

  const calcularReportes = () => {
    // Engagement: total comentarios, reacciones, RSVP
    const totalComentarios = Object.values(comentariosUI).reduce((acc, comentarios) => {
      return acc + comentarios.length + comentarios.reduce((s, c) => s + (c.respuestas?.length || 0), 0);
    }, 0);

    const totalReacciones = comunicaciones.reduce((acc, c) => {
      return acc + Object.values(c.reacciones || {}).reduce((s, v) => s + v, 0);
    }, 0);

    const totalRSVP = comunicaciones.reduce((acc, c) => {
      return acc + (c.asistencias?.length || 0);
    }, 0);

    // Top comentaristas
    const comentaristaCount = {};
    Object.values(comentariosUI).forEach(comentarios => {
      comentarios.forEach(c => {
        comentaristaCount[c.usuario] = (comentaristaCount[c.usuario] || 0) + 1 + (c.respuestas?.length || 0);
      });
    });
    const topComentaristas = Object.entries(comentaristaCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([usuario, count]) => ({usuario, count}));

    // Comunicaciones top
    const comTop = comunicaciones
      .map(c => ({
        titulo: c.TITULO,
        comentarios: (comentariosUI[c.id] || []).length,
        reacciones: Object.values(c.reacciones || {}).reduce((s, v) => s + v, 0),
        rsvp: (c.asistencias || []).length
      }))
      .sort((a, b) => (b.comentarios + b.reacciones + b.rsvp) - (a.comentarios + a.reacciones + a.rsvp))
      .slice(0, 5);

    return { totalComentarios, totalReacciones, totalRSVP, topComentaristas, comTop };
  };

  // FASE 6: Funciones de Gráficos, PDF y Historial
  const addNotificacionHistorial = (tipo, titulo, descripcion) => {
    const notif = {
      id: nextId(),
      tipo, titulo, descripcion,
      timestamp: new Date(),
      leida: false
    };
    setHistorialNotificaciones([notif, ...historialNotificaciones]);
    setNotificaciones([notif, ...notificaciones]);
  };

  const exportarReportePDF = () => {
    const contenido = `
    ╔════════════════════════════════════════════════════════════════╗
    ║           REPORTE DE ACTIVIDAD - CENTRO DE CULTURA FÍSICA      ║
    ║                        ${new Date().toLocaleDateString('es-CL')}                          ║
    ╚════════════════════════════════════════════════════════════════╝
    
    ENGAGEMENT METRICS
    ──────────────────────────────────────────────────────────────
    Comentarios Totales:        ${Object.values(comentariosUI).reduce((acc, comentarios) => {
      return acc + comentarios.length + comentarios.reduce((s, c) => s + (c.respuestas?.length || 0), 0);
    }, 0)}
    Reacciones Totales:         ${comunicaciones.reduce((acc, c) => {
      return acc + Object.values(c.reacciones || {}).reduce((s, v) => s + v, 0);
    }, 0)}
    Confirmaciones de Asistencia: ${comunicaciones.reduce((acc, c) => {
      return acc + (c.asistencias?.length || 0);
    }, 0)}
    
    COMUNICACIONES PUBLICADAS
    ──────────────────────────────────────────────────────────────
    ${comunicaciones.map((c, i) => `${i+1}. [${c.TIPO_COMUNICADO}] ${c.TITULO}`).join('\n')}
    
    USUARIOS MÁS ACTIVOS
    ──────────────────────────────────────────────────────────────
    ${(() => {
      const count = {};
      Object.values(comentariosUI).forEach(comentarios => {
        comentarios.forEach(c => {
          count[c.usuario] = (count[c.usuario] || 0) + 1 + (c.respuestas?.length || 0);
        });
      });
      return Object.entries(count)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([usuario, comentarios], i) => `${i+1}. ${usuario}: ${comentarios} comentarios`)
        .join('\n');
    })()}
    
    Generado automáticamente por Sistema de Gestión CCF
    `;
    
    // Crear blob y descargar
    const elemento = document.createElement('a');
    elemento.href = 'data:text/plain;charset=utf-8,' + encodeURIComponent(contenido);
    elemento.download = `Reporte_CCF_${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(elemento);
    elemento.click();
    document.body.removeChild(elemento);
    
    addNotificacionHistorial('reporte', 'Reporte Exportado', 'Archivo descargado exitosamente');
  };

  const renderGraficoSVG = (tipo) => {
    const reportes = calcularReportes();
    const ancho = 250, alto = 200;

    if(tipo === 'pie') {
      const total = reportes.totalComentarios + reportes.totalReacciones + reportes.totalRSVP;
      const pct1 = (reportes.totalComentarios / total) * 360;
      const pct2 = (reportes.totalReacciones / total) * 360;
      
      return (
        <svg width={ancho} height={alto} style={{marginTop: '20px'}}>
          <circle cx={ancho/2} cy={alto/2} r={60} fill="none" stroke="#E8E8E8" strokeWidth="40" opacity="0.3" />
          <circle cx={ancho/2} cy={alto/2} r={60} fill="none" stroke="var(--azul-electrico)" strokeWidth="40" 
            strokeDasharray={`${pct1 * 1.047} ${360 * 1.047}`} strokeLinecap="round" />
          <circle cx={ancho/2} cy={alto/2} r={60} fill="none" stroke="#34C759" strokeWidth="40" 
            strokeDasharray={`${pct2 * 1.047} ${360 * 1.047}`} strokeLinecap="round" 
            style={{transform: `rotate(${pct1}deg)`, transformOrigin: `${ancho/2}px ${alto/2}px`}} />
          <circle cx={ancho/2} cy={alto/2} r={30} fill="var(--blanco-tarjeta)" stroke="var(--borde-suave)" strokeWidth="1" />
          <text x={ancho/2} y={alto/2 + 5} textAnchor="middle" fontSize="16" fontWeight="800" fill="var(--azul-electrico)">
            {total}
          </text>
        </svg>
      );
    }

    if(tipo === 'bar') {
      const max = Math.max(reportes.totalComentarios, reportes.totalReacciones, reportes.totalRSVP);
      const h1 = (reportes.totalComentarios / max) * 120;
      const h2 = (reportes.totalReacciones / max) * 120;
      const h3 = (reportes.totalRSVP / max) * 120;
      
      return (
        <svg width={ancho} height={alto} style={{marginTop: '20px'}}>
          <rect x="20" y={140 - h1} width="40" height={h1} fill="var(--azul-electrico)" rx="4" />
          <rect x="85" y={140 - h2} width="40" height={h2} fill="#34C759" rx="4" />
          <rect x="150" y={140 - h3} width="40" height={h3} fill="#FF9500" rx="4" />
          <line x1="10" y1="140" x2="200" y2="140" stroke="var(--borde-suave)" strokeWidth="1" />
          <text x="40" y="160" textAnchor="middle" fontSize="10" fill="var(--texto-secundario)" fontWeight="600">Com.</text>
          <text x="105" y="160" textAnchor="middle" fontSize="10" fill="var(--texto-secundario)" fontWeight="600">Reac.</text>
          <text x="170" y="160" textAnchor="middle" fontSize="10" fill="var(--texto-secundario)" fontWeight="600">RSVP</text>
        </svg>
      );
    }

    return null;
  };

  // ========== FASE 7: DASHBOARD DE SALUD + ALERTAS INTELIGENTES ==========
  
  const calcularScoreDeCliente = () => {
    let score = 0;
    
    // 1. Comunicaciones activas (0-25 puntos)
    const comActivas = comunicaciones.filter(c => c.FECHA).length;
    score += Math.min(25, comActivas * 5);
    
    // 2. Engagement promedio (0-25 puntos)
    const totalReacciones = comunicaciones.reduce((sum, c) => sum + Object.values(c.reacciones || {}).reduce((s, r) => s + r, 0), 0);
    const totalComentarios = Object.values(comentariosUI).flat().length;
    score += Math.min(25, (totalReacciones + totalComentarios) * 2);
    
    // 3. Socios activos sin deuda (0-25 puntos)
    const sociosActivos = (cuentasAdmin || []).filter((c) => Boolean(c.es_socio)).length;
    score += Math.min(25, sociosActivos * 2);
    
    // 4. Alertas críticas (0-25 puntos - penalización)
    const alertasCriticas = alertas.filter(a => a.urgencia === 'Crítica').length;
    score -= alertasCriticas * 10;
    
    return Math.max(0, Math.min(100, score));
  };

  const generarAlertas = () => {
    const nuevasAlertas = [];
    
    // Alerta 1: Engagement bajo
    const totalEngagement = Object.values(comentariosUI).flat().length + 
                          comunicaciones.reduce((sum, c) => sum + Object.values(c.reacciones || {}).reduce((s, r) => s + r, 0), 0);
    if (totalEngagement < 15) {
      nuevasAlertas.push({
        id: nextId(),
        tipo: 'engagement',
        titulo: 'Engagement Bajo',
        descripcion: `Solo ${totalEngagement} interacciones en últimas 24h`,
        urgencia: 'Media',
        timestamp: new Date()
      });
    }
    
    // Alerta 2: Comunicaciones sin respuesta
    const comSinRespuesta = comunicaciones.filter(c => {
      const comentarios = comentariosUI[c.id] || [];
      return comentarios.length === 0 && c.solicita_asistencia;
    });
    if (comSinRespuesta.length > 0) {
      nuevasAlertas.push({
        id: nextId(),
        tipo: 'respuesta',
        titulo: 'Sin Respuestas',
        descripcion: `${comSinRespuesta.length} comunicaciones esperando respuesta`,
        urgencia: 'Baja',
        timestamp: new Date()
      });
    }
    
    // Alerta 4: Usuarios inactivos
    nuevasAlertas.push({
      id: nextId(),
      tipo: 'inactividad',
      titulo: 'Usuarios Inactivos',
      descripcion: '3 usuarios sin actividad > 7 días',
      urgencia: 'Baja',
      timestamp: new Date()
    });
    
    setAlertas(nuevasAlertas);
    setSaludDelSistema({
      estado: totalEngagement > 30 ? 'Óptimo' : totalEngagement > 15 ? 'Atención' : 'Crítico',
      color: totalEngagement > 30 ? 'var(--verde-victoria)' : totalEngagement > 15 ? 'var(--naranja-aviso)' : 'var(--rojo-alerta)'
    });
  };

  // ========== FASE 8: SISTEMA DE NOTIFICACIONES PUSH EN TIEMPO REAL ==========

  const crearPushNotificacion = (tipo, titulo, descripcion, urgencia = 'Baja') => {
    const nuevaPush = {
      id: nextId(),
      tipo,
      titulo,
      descripcion,
      urgencia,
      timestamp: new Date(),
      leida: false,
      visto: false
    };

    // Agregar a push activas
    setPushNotificaciones(prev => [...prev, nuevaPush]);
    
    // Agregar a historial
    setHistorialPushTotal(prev => [...prev, nuevaPush]);
    
    // Incrementar badge
    setBadgeCount(prev => prev + 1);

    // Mostrar notificación nativa del navegador si ya está autorizada
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification(titulo, {
          body: descripcion,
          silent: true,
        });
      } catch (error) {
        console.log('No se pudo mostrar la notificación nativa');
      }
    }
    
    // Reproducir sonido si está habilitado
    if (preferenciasSonido.habilitado) {
      reproducirSonido(preferenciasSonido.sonidoAlerta);
    }
    
    // Simular vibración
    if (preferenciasSonido.vibración && navigator.vibrate) {
      navigator.vibrate([200, 100, 200]);
    }
    
    // Auto-eliminar después de 8 segundos
    setTimeout(() => {
      setPushNotificaciones(prev => prev.filter(p => p.id !== nuevaPush.id));
    }, 8000);
  };

  const reproducirSonido = (tipo) => {
    // Crear oscilador de audio para reproducir sonidos (simulado)
    try {
      if (tipo === 'sistema') {
        return;
      }

      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const oscilador = audioContext.createOscillator();
      const ganancia = audioContext.createGain();
      
      oscilador.connect(ganancia);
      ganancia.connect(audioContext.destination);
      
      if (tipo === 'campana') {
        // Sonido de campana (frecuencia más alta)
        oscilador.frequency.value = 800;
        ganancia.gain.setValueAtTime(0.3, audioContext.currentTime);
        ganancia.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
        oscilador.start(audioContext.currentTime);
        oscilador.stop(audioContext.currentTime + 0.5);
      } else if (tipo === 'tono') {
        // Sonido de tono (frecuencia media)
        oscilador.frequency.value = 500;
        ganancia.gain.setValueAtTime(0.2, audioContext.currentTime);
        ganancia.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.4);
        oscilador.start(audioContext.currentTime);
        oscilador.stop(audioContext.currentTime + 0.4);
      }
    } catch (e) {
      console.log('Audio no disponible');
    }
  };

  const solicitarPermisoNotificaciones = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return false;
    }

    if (Notification.permission === 'granted') {
      return true;
    }

    if (Notification.permission === 'denied') {
      return false;
    }

    const permiso = await Notification.requestPermission();
    return permiso === 'granted';
  };

  const probarPushNotificacion = async () => {
    const autorizado = await solicitarPermisoNotificaciones();
    if (!autorizado) {
      showToast({ message: 'Activa las notificaciones del navegador para ver el push nativo.', type: 'warning' });
    }

    crearPushNotificacion('alerta', 'Notificación del sistema', 'Las notificaciones están activas y conectadas.', 'Baja');
  };

  // ========== FASE 9: INTEGRACIÓN WHATSAPP + WEBHOOKS BIDIRECCIONALES ==========

  const enviarPorWhatsApp = async (numero, mensaje, tipo = 'general', comId = null) => {
    try {
      // Enviar por API
      const respuesta = await api.whatsappAPI.enviarMensaje(numero, mensaje, tipo);
      
      const nuevoMensaje = {
        id: respuesta.mensaje_id,
        contacto: contactosWhatsApp.find(c => c.numero === numero)?.nombre || 'Desconocido',
        numero,
        mensaje,
        timestamp: new Date(),
        tipo,
        estado: 'enviado',
        comId
      };

      setHistorialWhatsApp(prev => [...prev, nuevoMensaje]);
      crearPushNotificacion('whatsapp', 'Mensaje Enviado', `Enviado a ${nuevoMensaje.contacto}`, 'Baja');
    } catch (error) {
      console.error('Error enviando mensaje WhatsApp:', error);
      showToast({ message: 'Error al enviar el mensaje', type: 'error' });
    }
  };
  
  const obtenerTemplateWhatsApp = (tipo, variables = {}) => {
    const templates = {
      alerta: `🚨 ALERTA CCF\n\nTienes ${variables.alertas || 0} alertas críticas pendientes.\n\nAccede al dashboard: https://ccf.club/admin\n\n*Centro de Cultura Física*`,
      pago: `💳 CONFIRMACIÓN DE PAGO\n\nTu pago de *$${variables.monto || '0'}* ha sido confirmado.\n\nFecha: ${variables.fecha || 'Hoy'}\nTipo: ${variables.tipo || 'Cuota'}\n\n✅ Estás al día.\n\n*Centro de Cultura Física*`,
      confirmacion: `✅ CONFIRMACIÓN\n\nTu solicitud ha sido confirmada.\n\nDetalles:\n${variables.detalles || 'Pendiente'}\n\n*Centro de Cultura Física*`,
      general: mensajeCustomWA
    };
    return templates[tipo] || templates.general;
  };

  const agregarContactoWhatsApp = async () => {
    if (!nuevoContactoWA.nombre.trim() || !nuevoContactoWA.numero.trim()) {
      showToast({ message: 'Por favor completa nombre y número', type: 'error' });
      return;
    }

    try {
      const numero = nuevoContactoWA.numero.startsWith('+') ? nuevoContactoWA.numero : '+56' + nuevoContactoWA.numero;
      
      const contactoNuevo = await api.whatsappAPI.agregarContacto(nuevoContactoWA.nombre, numero);
      
      setContactosWhatsApp(prev => [...prev, contactoNuevo]);
      setNuevoContactoWA({ nombre: '', numero: '' });
      crearPushNotificacion('whatsapp', 'Contacto Agregado', `${contactoNuevo.nombre} añadido a WhatsApp`, 'Baja');
    } catch (error) {
      console.error('Error agregando contacto:', error);
      showToast({ message: 'Error al agregar el contacto: ' + error.message, type: 'error' });
    }
  };

  const eliminarContactoWhatsApp = async (id) => {
    try {
      await api.whatsappAPI.eliminarContacto(id);
      setContactosWhatsApp(prev => prev.filter(c => c.id !== id));
    } catch (error) {
      console.error('Error eliminando contacto:', error);
    }
  };

  const normalizarRutComparacion = (rut = '') => (
    String(rut || '').replace(/\./g, '').replace(/-/g, '').trim().toUpperCase()
  );

  // ==========================================
  // 5. MÓDULOS DE JUGADOR, ACADEMIA Y TESORERÍA
  // ==========================================

  const pupilosDisponiblesBase = (jugadoresAdmin || []).map((j, idx) => ({
    id: idx + 1,
    rut: j.rut_jugador,
    nombre: `${j.nombres || ''} ${j.apellido_paterno || ''} ${j.apellido_materno || ''}`.trim(),
    nombres: j.nombres || '',
    apellido_paterno: j.apellido_paterno || '',
    apellido_materno: j.apellido_materno || '',
    correo_apoderado: j.correo_apoderado || '',
    rut_apoderado: j.rut_apoderado || '',
    categoria: j.categoria || 'General',
    rama: j.rama || j.categoria_rama || 'General',
    genero: j.genero || j.sexo || '',
    nivel: Number(j.nivel_actual || 1),
    xp: Number(j.xp_total || 0),
    numeroCamiseta: obtenerNumeroCamisetaJugador(j, 0),
    posicion: j.posicion_juego || 'N/A',
    estatura: j.estatura || 'N/A',
    peso: j.peso || 'N/A',
    manoHabil: j.mano_habil || 'N/A',
    tallaCamiseta: j.talla_camiseta || 'N/A',
    tallaShort: j.talla_short || 'N/A',
    poleraEntregada: Boolean(j.polera_entregada),
    asistencia: j.asistencia || 'N/A',
    estadoDeportivo: j.estado_deportivo || 'Activo',
    beca: j.beca || 'Sin beca',
    fecha_ingreso: j.fecha_ingreso || null,
    mes_inicio_cobro: j.mes_inicio_cobro || '',
    anio_ingreso: j.anio_ingreso ?? j.año_ingreso ?? null,
    valor_mensualidad: j.valor_mensualidad ?? null,
    anioNacimiento: obtenerAnioNacimientoJugador(j),
    foto_jugador: j.foto_jugador || j.foto_perfil_url || j.club_logo_url || '',
  }));

  const rolSesionNormalizado = normalizarRol(rolUsuario || usuarioAutenticado?.rol || '');
  const esJugadorAutenticado = rolSesionNormalizado === 'jugador';
  const esPerfilFamiliar = ['apoderado', 'socio', 'socio_apoderado', 'socio-apoderado', 'directiva'].includes(rolSesionNormalizado);
  const rutUsuarioAutenticado = normalizarRutComparacion(usuarioAutenticado?.rut || '');
  const correoUsuarioAutenticado = String(usuarioAutenticado?.correo || '').trim().toLowerCase();

  const puntajeCalidadPupilo = (jugador = {}) => {
    const anio = obtenerAnioNacimientoJugador(jugador);
    const numero = obtenerNumeroCamisetaJugador(jugador, 0);
    const rutRaw = String(jugador.rut || '').trim();
    const rutFmt = String(usuarioAutenticado?.rut || '').trim();

    let score = 0;
    if (rutRaw && rutFmt && rutRaw === rutFmt) score += 5;
    if (anio) score += 3;
    if (numero > 0) score += 3;
    if (String(jugador.fecha_nacimiento || '').trim()) score += 2;
    return score;
  };

  const pupilosDisponibles = (() => {
    if (esJugadorAutenticado) {
      const propios = pupilosDisponiblesBase.filter((j) => normalizarRutComparacion(j.rut) === rutUsuarioAutenticado);
      if (propios.length <= 1) return propios;

      const mejor = [...propios].sort((a, b) => puntajeCalidadPupilo(b) - puntajeCalidadPupilo(a))[0];
      return mejor ? [mejor] : propios;
    }

    if (esPerfilFamiliar) {
      return pupilosDisponiblesBase.filter((j) => {
        const rutApoderado = normalizarRutComparacion(j.rut_apoderado || '');
        if (rutApoderado && rutUsuarioAutenticado && rutApoderado === rutUsuarioAutenticado) return true;

        const correoApoderado = String(j.correo_apoderado || '').trim().toLowerCase();
        return Boolean(correoUsuarioAutenticado) && correoApoderado === correoUsuarioAutenticado;
      });
    }

    return pupilosDisponiblesBase;
  })();

  useEffect(() => {
    if (!esJugadorAutenticado && !esPerfilFamiliar) return;

    if (pupilosDisponibles.length === 0) {
      setPupiloActivo(null);
      return;
    }

    const pupiloPropio = pupilosDisponibles[0];
    const rutActivo = normalizarRutComparacion(pupiloActivo?.rut || '');
    const rutPropio = normalizarRutComparacion(pupiloPropio.rut || '');
    const anioActivo = obtenerAnioNacimientoJugador(pupiloActivo);
    const anioPropio = obtenerAnioNacimientoJugador(pupiloPropio);
    const numeroActivo = obtenerNumeroCamisetaJugador(pupiloActivo, 0);
    const numeroPropio = obtenerNumeroCamisetaJugador(pupiloPropio, 0);

    if (rutActivo !== rutPropio || anioActivo !== anioPropio || numeroActivo !== numeroPropio) {
      setPupiloActivo(pupiloPropio);
    }
  }, [esJugadorAutenticado, esPerfilFamiliar, pupilosDisponibles, pupiloActivo]);

  const comunicacionesPublicas = (comunicaciones || []).filter((c) => {
    const audiencia = Array.isArray(c.audiencia) ? c.audiencia : [];
    return audiencia.length === 0 || audiencia.includes('publico') || audiencia.includes('visita');
  });

  const galeriaPublica = comunicacionesPublicas.slice(0, 4).map((c) => ({
    id: c.id,
    emoji: '🏀',
    titulo: c.TITULO,
    fecha: c.FECHA,
  }));

  const esPerfilFamiliarNav = ['apoderado', 'socio', 'socio_apoderado', 'socio-apoderado', 'directiva'].includes(rolUsuario);
  const modulosNavegacionOrden = ['admin_dashboard', 'comunicaciones', 'academia', 'perfil', 'jugador', 'asistencia_staff', 'scoreboard_live', 'kiosco'];
  const modulosNavegacionVisibles = modulosNavegacionOrden.filter((modulo) => puedeVerPantalla(modulo));
  const LOCAL_PREVIEW_LABEL = 'MODO LOCAL · CAMBIOS INMEDIATOS';
  const mostrarApartadoLocal = (() => {
    if (typeof window === 'undefined') return false;
    const host = String(window.location.hostname || '').toLowerCase();
    const params = new URLSearchParams(window.location.search || '');
    return host === 'localhost'
      || host === '127.0.0.1'
      || params.get('preview') === 'local'
      || params.has('local');
  })();

  const obtenerMetaModuloNav = (modulo) => {
    switch (modulo) {
      case 'admin_dashboard':
        return { label: rolUsuario === 'super_admin' ? 'Panel' : 'Admin', Icon: rolUsuario === 'super_admin' ? ShieldAlert : Activity };
      case 'comunicaciones':
        return { label: 'Muro', Icon: Bell };
      case 'academia':
        return { label: 'Academia', Icon: BookOpen };
      case 'perfil':
        return { label: (rolUsuario === 'admin' || rolUsuario === 'super_admin') ? 'Tesorería' : 'Mi Cuenta', Icon: CreditCard };
      case 'jugador':
        return { label: esPerfilFamiliarNav ? 'Pupilos' : 'Jugador', Icon: User };
      case 'asistencia_staff':
        return { label: 'Lista', Icon: Users };
      case 'scoreboard_live':
        return { label: 'Mesa', Icon: Monitor };
      case 'kiosco':
        return { label: 'Kiosco', Icon: LayoutGrid };
      default:
        return null;
    }
  };

  // ==========================================
  // 10. ESTRUCTURA HTML FINAL (APP)
  // ==========================================
  return (
    <Suspense fallback={<SkeletonLoaderPanel />}>
    <div className="ios-app-container" data-theme={temaOscuro ? 'dark' : 'light'}>
      {isOnboarding && (
        <OnboardingModal
          onboardingProgress={onboardingProgress}
          onboardingStep={onboardingStep}
          avanzarOnboarding={avanzarOnboarding}
          onboardingPassword={onboardingPassword}
          onboardingPasswordConfirm={onboardingPasswordConfirm}
          setOnboardingPassword={setOnboardingPassword}
          setOnboardingPasswordConfirm={setOnboardingPasswordConfirm}
          onboardingCamposPendientes={onboardingCamposPendientes}
          onboardingPerfilDraft={onboardingPerfilDraft}
          setOnboardingPerfilDraft={setOnboardingPerfilDraft}
          onboardingSubiendoFoto={onboardingSubiendoFoto}
          subirFotoOnboarding={subirFotoOnboarding}
        />
      )}
      
      {/* HEADER DINÁMICO E INTELIGENTE */}
      <header className="ios-header">
        <div className="header-btn-zone">
          <button
            className={`btn-app-update ${appVersionState.hasUpdate ? 'pending' : 'latest'}`}
            onClick={handleUpdateAppClick}
            title={
              appVersionState.hasUpdate
                ? 'Hay una nueva version disponible. Pulsa para actualizar la app.'
                : 'Tu app esta al dia.'
            }
          >
            <span className="btn-app-update-icon" aria-hidden="true">
              {appVersionState.checking ? (
                <Clock size={14} strokeWidth={2} />
              ) : appVersionState.hasUpdate ? (
                <RefreshCw size={14} strokeWidth={2} />
              ) : (
                <CheckCircle size={14} strokeWidth={2} />
              )}
            </span>
            <span className="btn-app-update-text">
              {appVersionState.checking
                ? 'Revisando'
                : appVersionState.hasUpdate
                  ? 'Nueva version'
                  : 'App al dia'}
            </span>
          </button>
        </div>
        <div className="logo-temporal" style={{ background: 'none', width: 'auto', flex: 1, minWidth: 0, padding: '0 10px' }}>
          {!rolUsuario
            ? (
              <div className="home-header-brand">
                <img src="/logos/Club-frase.png" alt="Club Centro de Cultura Física" className="home-header-club-mark" />
                <span className="home-header-subtitle">Viña Del Mar</span>
              </div>
            )
            : (
              <div className="home-header-brand">
                <img src="/logos/Club-frase.png" alt="Club Centro de Cultura Física" className="home-header-club-mark" />
                <span className="home-header-subtitle">{getHeaderTitle()}</span>
              </div>
            )
          }
        </div>
        <div className="header-btn-zone right">
          {rolUsuario && (
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', justifyContent: 'flex-end', width: '100%', flexWrap: 'nowrap' }}>
              {(rolUsuario === 'admin' || rolUsuario === 'super_admin') && (
                <button ref={settingsButtonRef} className="btn-icon-header" onClick={toggleSettingsPanel} title="Configuración y Perfil">
                  <Settings size={24} color="var(--gris-secundario)" strokeWidth={1.5} />
                </button>
              )}
              <button
                type="button"
                className="btn-icon-header"
                ref={notificationsButtonRef}
                style={{position: 'relative'}}
                onClick={toggleNotificationsPanel}
              >
                <Bell size={24} color="var(--gris-secundario)" strokeWidth={1.5} />
                {notificaciones.filter(n=>!n.leida).length > 0 && (
                  <span style={{position: 'absolute', top: '-5px', right: '-5px', background: 'var(--rojo-alerta)', color: 'white', fontSize: '11px', fontWeight: '900', padding: '3px 6px', borderRadius: '10px', border: '2px solid var(--azul-marino)'}}>
                    {notificaciones.filter(n=>!n.leida).length}
                  </span>
                )}
              </button>
              <button className="btn-icon-header" onClick={() => setShowModalSalir(true)}>
                <LogOut size={24} color="var(--gris-secundario)" strokeWidth={1.5} />
              </button>
            </div>
          )}
        </div>
      </header>

      <ApiStatusBanner
        visible={apiOffline}
        message={apiStatusMessage}
        retrying={apiRetrying}
        onRetry={() => {
          void cargarDatos({ manual: true });
        }}
      />

      {mostrarApartadoLocal && (
        <section className="local-preview-banner" aria-label="apartado-local-cambios">
          <strong>{LOCAL_PREVIEW_LABEL}</strong>
          <span>Este entorno es para revisión inmediata de ajustes antes del deploy.</span>
        </section>
      )}

      {(rolUsuario === 'admin' || rolUsuario === 'super_admin') && showSettings && (
        <div ref={settingsPanelRef} className="floating-panel settings-panel" style={{position: 'absolute', top: '90px', right: '15px', width: '380px', maxHeight: '500px', background: 'var(--blanco-tarjeta)', borderRadius: '16px', boxShadow: '0 15px 40px rgba(0,0,0,0.3)', zIndex: 999, padding: '20px', border: '1px solid rgba(0,0,0,0.05)', overflowY: 'auto'}}>
          <SettingsPanel
            rolUsuario={rolUsuario}
            busquedaPermisos={busquedaPermisos}
            setBusquedaPermisos={setBusquedaPermisos}
            filtroRolPermisos={filtroRolPermisos}
            setFiltroRolPermisos={setFiltroRolPermisos}
            matrixPermisos={matrixPermisosBase}
            togglePermiso={togglePermiso}
            preferenciasSonido={preferenciasSonido}
            setPreferenciasSonido={setPreferenciasSonido}
            reproducirSonido={reproducirSonido}
            onProbarPush={probarPushNotificacion}
            onCerrarConfiguracion={() => setShowSettings(false)}
          />
        </div>
      )}

      {mostrarNotificaciones && (
        <div ref={notificationsPanelRef}>
          <NotificationsPanel
            notificaciones={notificaciones}
            setNotificaciones={setNotificaciones}
          />
        </div>
      )}

      {/* Panel antiguo de notificaciones - REMOVIDO EN FAVOR DE RENDERNOTIFICACIONES */}
      {mostrarBusqueda && (
        <div className="floating-panel search-panel" style={{position: 'fixed', top: '90px', left: '50%', transform: 'translateX(-50%)', width: '90%', maxWidth: '500px', maxHeight: '600px', background: 'var(--blanco-tarjeta)', borderRadius: '16px', boxShadow: '0 15px 40px rgba(0,0,0,0.3)', zIndex: 999, padding: '20px', border: '1px solid rgba(0,0,0,0.05)', overflowY: 'auto'}}>
          <SearchPanel
            busquedaGlobal={busquedaGlobal}
            setBusquedaGlobal={setBusquedaGlobal}
            buscarGlobal={buscarGlobal}
            resultadosBusqueda={resultadosBusqueda}
            setMostrarBusqueda={setMostrarBusqueda}
          />
        </div>
      )}

      {mostrarHistorialNotif && (
        <NotificationHistoryPanel
          historialNotificaciones={historialNotificaciones}
          filtroReporteFecha={filtroReporteFecha}
          setFiltroReporteFecha={setFiltroReporteFecha}
          setMostrarHistorialNotif={setMostrarHistorialNotif}
        />
      )}

      {/* PUSH NOTIFICATIONS FLOTANTES */}
      <PushToast
        pushNotificaciones={pushNotificaciones}
        setPushNotificaciones={setPushNotificaciones}
      />

      {/* TOASTS Y CONFIRMACIONES (reemplazo de alert()/confirm() nativos) */}
      <ToastContainer />
      <ConfirmDialog />
      
      {/* HISTORIAL DE PUSH MODAL */}
      {mostrarHistorialPush && (
        <PushHistorialModal
          historialPushTotal={historialPushTotal}
          setMostrarHistorialPush={setMostrarHistorialPush}
        />
      )}

      {/* WHATSAPP PANEL */}
      {mostrarWhatsAppPanel && (
        <WhatsAppPanel
          mostrarWhatsAppPanel={mostrarWhatsAppPanel}
          setMostrarWhatsAppPanel={setMostrarWhatsAppPanel}
          setMostrarHistorialWA={setMostrarHistorialWA}
          contactosWhatsApp={contactosWhatsApp}
          setPhoneNumberToValidate={setPhoneNumberToValidate}
          templateMensaje={templateMensaje}
          setTemplateMensaje={setTemplateMensaje}
          mensajeCustomWA={mensajeCustomWA}
          setMensajeCustomWA={setMensajeCustomWA}
          obtenerTemplateWhatsApp={obtenerTemplateWhatsApp}
          phoneNumberToValidate={phoneNumberToValidate}
          enviarPorWhatsApp={enviarPorWhatsApp}
          nuevoContactoWA={nuevoContactoWA}
          setNuevoContactoWA={setNuevoContactoWA}
          agregarContactoWhatsApp={agregarContactoWhatsApp}
          eliminarContactoWhatsApp={eliminarContactoWhatsApp}
        />
      )}
      
      {/* HISTORIAL WHATSAPP MODAL */}
      {mostrarHistorialWA && (
        <WhatsAppHistorialModal
          historialWhatsApp={historialWhatsApp}
          setMostrarHistorialWA={setMostrarHistorialWA}
        />
      )}

      {/* BADGE COUNTER EN HEADER */}
      {badgeCount > 0 && (
        <div style={{
          position: 'fixed',
          top: '16px',
          right: '60px',
          background: 'var(--rojo-alerta)',
          color: 'white',
          width: '24px',
          height: '24px',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '12px',
          fontWeight: '800',
          zIndex: 999,
          boxShadow: '0 2px 8px rgba(255,59,48,0.3)'
        }}>{badgeCount}</div>
      )}

      {/* RUTEADOR CENTRAL CON SKELETON LOADERS */}
      <main className={`ios-main ${isAppLoading ? 'screen-loading' : 'screen-ready'}`}>
        {isAppLoading ? <SkeletonLoaderPanel /> : (
          <>
            {!rolUsuario && (
              <PublicFacadePanel
                vistaPublica={vistaPublica}
                mostrarFormularioLogin={mostrarFormularioLogin}
                abrirFormularioLogin={abrirFormularioLogin}
                tipoLoginSeleccionado={tipoLoginSeleccionado}
                handleLoginSubmit={handleLoginSubmit}
                rutInput={rutInput}
                setRutInput={setRutInput}
                passInput={passInput}
                setPassInput={setPassInput}
                volverInicioLogin={volverInicioLogin}
                comunicacionesPublicas={comunicacionesPublicas}
                galeriaPublica={galeriaPublica}
                partidos={partidosResumen}
              />
            )}
            {puedeVerPantalla('comunicaciones') && pantallaActiva === 'comunicaciones' && (
              <ComunicacionesPanel
                rolUsuario={rolUsuario}
                usuarioAutenticado={usuarioAutenticado}
                pupiloActivo={pupiloActivo}
                mostrarFormComunicaciones={mostrarFormComunicaciones}
                setMostrarFormComunicaciones={setMostrarFormComunicaciones}
                formularioComunicaciones={(
                  <ComunicacionFormPanel
                    formCom={formCom}
                    setFormCom={setFormCom}
                    comunicaciones={comunicaciones}
                    setComunicaciones={setComunicaciones}
                    setMostrarFormComunicaciones={setMostrarFormComunicaciones}
                    addNotificacionHistorial={addNotificacionHistorial}
                    onIrACitaciones={() => {
                      setMostrarFormComunicaciones(false);
                      setVistaAdmin('citaciones');
                      cambiarPantallaConLoader('admin_dashboard');
                    }}
                  />
                )}
                vistaMuro={vistaMuro}
                setVistaMuro={setVistaMuro}
                alertasPublicadas={alertasPublicadas}
                respuestaCitacion={respuestaCitacion}
                setRespuestaCitacion={setRespuestaCitacion}
                comunicaciones={comunicaciones}
                setComunicaciones={setComunicaciones}
                comentariosUI={comentariosUI}
                setComentariosUI={setComentariosUI}
                formComentario={formComentario}
                setFormComentario={setFormComentario}
                mostrarFormComentario={mostrarFormComentario}
                setMostrarFormComentario={setMostrarFormComentario}
                encuestas={encuestas}
                setEncuestas={setEncuestas}
                partidos={partidosResumen}
                nominaCita={nominaCita}
                setNominaCita={setNominaCita}
              />
            )}
            {puedeVerPantalla('academia') && pantallaActiva === 'academia' && (
              <AcademiaPanel
                pupiloActivo={pupiloActivo}
                setPupiloActivo={setPupiloActivo}
                pupilosDisponibles={pupilosDisponibles}
                jugadoresAdmin={jugadoresAdmin}
                rolUsuario={rolUsuario}
                rutUsuarioAutenticado={rutUsuarioAutenticado}
                usuarioAutenticado={usuarioAutenticado}
                animacionXP={animacionXP}
                setAnimacionXP={setAnimacionXP}
                respuestasQuiz={respuestasQuiz}
                setRespuestasQuiz={setRespuestasQuiz}
                quizList={quizList}
                materialesAcademia={materialesAcademia}
                pizarrasAcademia={pizarrasAcademia}
                publicarMaterialAcademia={publicarMaterialAcademia}
                subirVideoAcademia={subirVideoAcademia}
                crearQuizAcademia={crearQuizAcademia}
                guardarPizarraAcademia={guardarPizarraAcademia}
                actualizarMaterialAcademia={actualizarMaterialAcademia}
                eliminarMaterialAcademia={eliminarMaterialAcademia}
                actualizarVideoAcademia={actualizarVideoAcademia}
                eliminarVideoAcademia={eliminarVideoAcademia}
                actualizarPizarraAcademia={actualizarPizarraAcademia}
                eliminarPizarraAcademia={eliminarPizarraAcademia}
                actualizarQuizAcademia={actualizarQuizAcademia}
                eliminarQuizAcademia={eliminarQuizAcademia}
                evalTiro={evalTiro}
                setEvalTiro={setEvalTiro}
                evalDefensa={evalDefensa}
                setEvalDefensa={setEvalDefensa}
                evalFisico={evalFisico}
                setEvalFisico={setEvalFisico}
                evalTactico={evalTactico}
                setEvalTactico={setEvalTactico}
                notasEvaluacion={notasEvaluacion}
                setNotasEvaluacion={setNotasEvaluacion}
              />
            )}
            {puedeVerPantalla('perfil') && pantallaActiva === 'perfil' && (
              <PerfilTesoreriaPanel
                pupiloActivo={pupiloActivo}
                setPupiloActivo={setPupiloActivo}
                rolUsuario={rolUsuario}
                pupilosDisponibles={pupilosDisponibles}
                cuentasAdmin={cuentasAdmin}
                pagosMensualidadesAdmin={pagosMensualidadesAdmin}
                morososAdmin={morososAdmin}
                mesesSeleccionados={mesesSeleccionados}
                setMesesSeleccionados={setMesesSeleccionados}
                tipoPago={tipoPago}
                setTipoPago={setTipoPago}
                montoAbono={montoAbono}
                setMontoAbono={setMontoAbono}
                comprobanteSubido={comprobanteSubido}
                setComprobanteSubido={setComprobanteSubido}
                setPagosPendientesAdmin={setPagosPendientesAdmin}
                pagoViewMode={pagoViewMode}
                setPageViewMode={setPageViewMode}
              />
            )}
            {puedeVerPantalla('jugador') && pantallaActiva === 'jugador' && (
              <TarjetaJugadorPanel
                pupiloActivo={pupiloActivo}
                setPupiloActivo={setPupiloActivo}
                pupilosDisponibles={pupilosDisponibles}
                rolUsuario={rolUsuario}
              />
            )}
            {puedeVerPantalla('asistencia_staff') && pantallaActiva === 'asistencia_staff' && (
              <StaffAsistenciaPanel
                usuarioAutenticado={usuarioAutenticado}
                vistaStaff={vistaStaff}
                setVistaStaff={setVistaStaff}
                filtroRamaStaff={filtroRamaStaff}
                setFiltroRamaStaff={setFiltroRamaStaff}
                filtroCatStaff={filtroCatStaff}
                setFiltroCatStaff={setFiltroCatStaff}
                rosterEquipo={rosterEquipo}
                setRosterEquipo={setRosterEquipo}
              />
            )}
            {puedeVerPantalla('scoreboard_live') && pantallaActiva === 'scoreboard_live' && (
              <MesaControlPanel
                jugadorSeleccionadoLive={jugadorSeleccionadoLive}
                setJugadorSeleccionadoLive={setJugadorSeleccionadoLive}
                rosterEquipo={rosterEquipo}
                setRosterEquipo={setRosterEquipo}
                liveScore={liveScore}
                setLiveScore={setLiveScore}
                playByPlay={playByPlay}
                setPlayByPlay={setPlayByPlay}
                notaScouting={notaScouting}
                setNotaScouting={setNotaScouting}
                modoChromaKey={modoChromaKey}
                setModoChromaKey={setModoChromaKey}
                partidos={partidosResumen}
                onPartidoFinalizado={recargarPartidosResumen}
              />
            )}
            {(puedeVerPantalla('scoreboard_live') || puedeVerPantalla('admin_dashboard')) && pantallaActiva === 'torneos' && (
              <TorneosPanel />
            )}
            {puedeVerPantalla('kiosco') && pantallaActiva === 'kiosco' && (
              <KioscoPanel
                nombreResponsable={usuarioAutenticado?.nombres || usuarioAutenticado?.nombre || ''}
              />
            )}
            {(puedeVerPantalla('admin_dashboard') || puedeVerPantalla('citaciones') || puedeVerPantalla('resultados')) && pantallaActiva === 'admin_dashboard' && (
              <SuperAdminPanel
                puedeAdminCompleto={puedeVerPantalla('admin_dashboard')}
                puedeVerCitaciones={puedeVerPantalla('citaciones')}
                puedeVerResultados={puedeVerPantalla('resultados')}
                usuarioAutenticado={usuarioAutenticado}
                vistaAdmin={vistaAdmin}
                setVistaAdmin={setVistaAdmin}
                generarAlertas={generarAlertas}
                filtroMorosos={filtroMorosos}
                setFiltroMorosos={setFiltroMorosos}
                pagosPendientesAdmin={pagosPendientesAdmin}
                setPagosPendientesAdmin={setPagosPendientesAdmin}
                logAuditoria={logAuditoria}
                nominaCita={nominaCita}
                setNominaCita={setNominaCita}
                calcularReportes={calcularReportes}
                vistaReportes={vistaReportes}
                setVistaReportes={setVistaReportes}
                filtroReporteFecha={filtroReporteFecha}
                setFiltroReporteFecha={setFiltroReporteFecha}
                filtroReporteRama={filtroReporteRama}
                setFiltroReporteRama={setFiltroReporteRama}
                setMostrarHistorialNotif={setMostrarHistorialNotif}
                exportarReportePDF={exportarReportePDF}
                renderGraficoSVG={renderGraficoSVG}
                cuentasIncompletas={cuentasIncompletas}
                vistaSaludTab={vistaSaludTab}
                setVistaSaludTab={setVistaSaludTab}
                alertas={alertas}
                saludDelSistema={saludDelSistema}
                comunicacionesCount={comunicaciones.length}
                calcularScoreDeCliente={calcularScoreDeCliente}
                comunicaciones={comunicaciones}
                setComunicaciones={setComunicaciones}
                cuentasAdmin={cuentasAdmin}
                matrixPermisos={matrixPermisosBase}
                togglePermiso={togglePermiso}
                jugadoresAdmin={jugadoresAdmin}
                guardarCuentaAdmin={guardarCuentaAdmin}
                guardarJugadorAdmin={guardarJugadorAdmin}
                eliminarCuentaAdmin={eliminarCuentaAdmin}
                eliminarJugadorAdmin={eliminarJugadorAdmin}
                jugadoresVisitaAdmin={jugadoresVisitaAdmin}
                guardarJugadorVisitaAdmin={guardarJugadorVisitaAdmin}
                validarPagoMensualidad={validarPagoMensualidad}
                morososAdmin={morososAdmin}
                pagosMensualidadesAdmin={pagosMensualidadesAdmin}
                onSheetsSyncComplete={sincronizarDatosDesdeSheets}
                onCancelEdit={restaurarPermisosAntesCancelacion}
                onPartidosChanged={recargarPartidosResumen}
                onComunicacionesChanged={recargarComunicacionesResumen}
                enviarPorWhatsApp={enviarPorWhatsApp}
              />
            )}
          </>
        )}
      </main>

      {/* NAVEGACIÓN GLASSMORPHISM */}
      <nav className="ios-bottom-nav">
        {!rolUsuario ? (
          <>
            <button type="button" className={`nav-item ${vistaPublica === 'inicio' ? 'active' : ''}`} onClick={() => setVistaPublica('inicio')}><Home size={26} color="var(--gris-secundario)" strokeWidth={1.5} /><span className="mt-5">Inicio</span></button>
            <button type="button" className={`nav-item ${vistaPublica === 'noticias' ? 'active' : ''}`} onClick={() => setVistaPublica('noticias')}><Bell size={26} color="var(--gris-secundario)" strokeWidth={1.5} /><span className="mt-5">Noticias</span></button>
            <button type="button" className={`nav-item ${vistaPublica === 'resultados' ? 'active' : ''}`} onClick={() => setVistaPublica('resultados')}><Trophy size={26} color="var(--gris-secundario)" strokeWidth={1.5} /><span className="mt-5">Resultados</span></button>
            <button type="button" className={`nav-item ${vistaPublica === 'torneos' ? 'active' : ''}`} onClick={() => setVistaPublica('torneos')}><ListOrdered size={26} color="var(--gris-secundario)" strokeWidth={1.5} /><span className="mt-5">Torneos</span></button>
          </>
        ) : rolUsuario === 'visita' ? (
          <>
            {puedeVerPantalla('comunicaciones') && <button type="button" className={`nav-item ${pantallaActiva === 'comunicaciones' ? 'active' : ''}`} onClick={() => cambiarPantallaConLoader('comunicaciones')}><Trophy size={26} color="var(--gris-secundario)" strokeWidth={1.5} /><span className="mt-5">Torneo</span></button>}
            {puedeVerPantalla('jugador') && <button type="button" className={`nav-item ${pantallaActiva === 'jugador' ? 'active' : ''}`} onClick={() => cambiarPantallaConLoader('jugador')}><QrCode size={26} color="var(--gris-secundario)" strokeWidth={1.5} /><span className="mt-5">Pase/Fixture</span></button>}
          </>
        ) : rolUsuario === 'mesa' ? (
          <div className="nav-item active" style={{width: '100%'}}><Monitor size={26} color="var(--gris-secundario)" strokeWidth={1.5} /><span className="mt-5">Consola Transmisión</span></div>
        ) : modulosNavegacionVisibles.length > 0 || ((puedeVerPantalla('citaciones') || puedeVerPantalla('resultados')) && !puedeVerPantalla('admin_dashboard')) ? (
          <>
            {modulosNavegacionVisibles.map((modulo) => {
              const meta = obtenerMetaModuloNav(modulo);
              if (!meta) return null;
              const Icon = meta.Icon;
              return (
                <button
                  type="button"
                  key={`nav-${modulo}`}
                  className={`nav-item ${pantallaActiva === modulo ? 'active' : ''}`}
                  onClick={() => cambiarPantallaConLoader(modulo)}
                >
                  <Icon size={26} color="var(--gris-secundario)" strokeWidth={1.5} />
                  <span className="mt-5">{meta.label}</span>
                </button>
              );
            })}
            {/* 'citaciones' y 'resultados' no son pantallas propias (viven dentro de
                admin_dashboard como sub-vistas de SuperAdminPanel), así que no pueden
                pasar por el loop genérico de arriba — se agregan a mano solo para
                quien tiene alguno de esos permisos sin admin_dashboard completo (ej.
                un profesor con módulos individuales activados). Un solo botón de
                entrada: una vez adentro, SuperAdminPanel ya restringe qué pestañas
                puede ver (ver el efecto de vistaAdmin en ese componente). */}
            {(puedeVerPantalla('citaciones') || puedeVerPantalla('resultados')) && !puedeVerPantalla('admin_dashboard') && (
              <button
                type="button"
                className={`nav-item ${pantallaActiva === 'admin_dashboard' ? 'active' : ''}`}
                onClick={() => cambiarPantallaConLoader('admin_dashboard')}
              >
                <UserPlus size={26} color="var(--gris-secundario)" strokeWidth={1.5} />
                <span className="mt-5">
                  {puedeVerPantalla('citaciones') && puedeVerPantalla('resultados') ? 'Gestión' : puedeVerPantalla('citaciones') ? 'Citaciones' : 'Resultados'}
                </span>
              </button>
            )}
            {/* 'torneos' tampoco es un módulo de MODULOS_ACCESO propio — se
                muestra con el mismo criterio que ya decide quién ve Mesa
                (scoreboard_live) o admin_dashboard, sin agregar un permiso nuevo. */}
            {(puedeVerPantalla('scoreboard_live') || puedeVerPantalla('admin_dashboard')) && (
              <button
                type="button"
                className={`nav-item ${pantallaActiva === 'torneos' ? 'active' : ''}`}
                onClick={() => cambiarPantallaConLoader('torneos')}
              >
                <Trophy size={26} color="var(--gris-secundario)" strokeWidth={1.5} />
                <span className="mt-5">Torneos</span>
              </button>
            )}
          </>
        ) : null}
      </nav>

      {/* MODAL DE CIERRE DE SESIÓN */}
      {showModalSalir && (
        <div className="modal-overlay-alert">
          <div className="modal-alert-card text-center">
            <AlertTriangle size={48} color="var(--rojo-alerta)" className="icon-bounce mb-15" />
            <h3 style={{margin: '0 0 10px 0', fontSize: '22px', color: 'var(--texto-principal)'}}>¿Cerrar Sesión?</h3>
            <p style={{color: 'var(--texto-secundario)', marginBottom: '20px'}}>Se cerrará el módulo actual de trabajo.</p>
            <div className="modal-alert-buttons">
              <button className="btn-modal-cancelar" onClick={() => setShowModalSalir(false)}>Cancelar</button>
              <button className="btn-modal-confirmar" onClick={cerrarSesion}>SALIR</button>
            </div>
          </div>
        </div>
      )}
    </div>
    </Suspense>
  )
}

export default App;








