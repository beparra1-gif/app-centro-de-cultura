import { lazy, Suspense, useState, useEffect, useRef } from 'react';
import './App.css';
import { 
  Home, User, Trophy, CreditCard, Shirt, CheckCircle, Bell, LogOut, 
  Settings, LayoutGrid, List, Star, Target, MapPin, 
  Brain, PlayCircle, BookOpen, Video, Users, Sliders, HeartPulse, 
  Save, Monitor, Activity, ArrowRight, ArrowLeft, AlertTriangle, 
  FileText, Flag, QrCode, Lock, Camera, ChevronRight, ChevronLeft, 
  ShieldAlert, Zap, Clock, FileDown, 
  History, CheckSquare, 
  XSquare
} from 'lucide-react';
import { 
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer 
} from 'recharts';
import * as api from './api/client';
import { nextId } from './utils/runtimeId';
import SkeletonLoaderPanel from './components/SkeletonLoaderPanel';
import ApiStatusBanner from './components/ApiStatusBanner';
import {
  getUTMLastDayPreviousMonth,
  getColorUrgencia,
} from './utils/appHelpers';
import { productosKioscoBase } from './data/productosBase';
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
const PerfilTesoreriaPanel = lazy(() => import('./components/PerfilTesoreriaPanel'));
const StaffAsistenciaPanel = lazy(() => import('./components/StaffAsistenciaPanel'));
const StaffEvaluacionPanel = lazy(() => import('./components/StaffEvaluacionPanel'));
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

  // --- ESTADOS: GAMIFICACIÓN Y PERFIL ---
  const [quizCompletado, setQuizCompletado] = useState(false);
  const [opcionSeleccionada, setOpcionSeleccionada] = useState(null);
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
  const [mesesSeleccionados, setMesesSeleccionados] = useState([]);
  const [tipoPago, setTipoPago] = useState('completo'); 
  const [montoAbono, setMontoAbono] = useState('');
  const [comprobanteSubido, setComprobanteSubido] = useState(false);
  const [pagosPendientesAdmin, setPagosPendientesAdmin] = useState([]);
  const [pagosMensualidadesAdmin, setPagosMensualidadesAdmin] = useState([]);
  const [partidosResumen, setPartidosResumen] = useState([]);
  const [morososAdmin, setMorososAdmin] = useState([]);
  const [materialesAcademia, setMaterialesAcademia] = useState([]);
  const [pizarrasAcademia, setPizarrasAcademia] = useState([]);
  const [quizActivo, setQuizActivo] = useState({
    titulo: 'Sin desafío activo',
    pregunta: 'No hay quiz táctico publicado en este momento.',
    opciones: ['-', '-', '-'],
    respuestaCorrecta: 'A',
    explicacion: 'Cuando el staff publique un quiz, aparecerá aquí.',
  });

  // --- ESTADOS: KIOSCO POS, INVENTARIO Y CAJA (PREMIUM) ---
  const [cajaAbierta, setCajaAbierta] = useState(false);
  const [datosCaja, setDatosCaja] = useState({ dia: '', responsable: '', montoInicial: '' });
  const [vistaKiosco, setVistaKiosco] = useState('pos');
  const [inventarioProductos, setInventarioProductos] = useState(productosKioscoBase);
  const [carritoKiosco, setCarritoKiosco] = useState([]);
  const [modalPagoPOS, setModalPagoPOS] = useState(null); 
  const [montoRecibidoEfectivo, setMontoRecibidoEfectivo] = useState('');
  
  const [fiadosLista, setFiadosLista] = useState([]);
  const [nombreFiado, setNombreFiado] = useState('');
  const [detalleFiado, setDetalleFiado] = useState('');
  
  const [cajaEfectivoKiosco, setCajaEfectivoKiosco] = useState(0);
  const [cajaTransferKiosco, setCajaTransferKiosco] = useState(0);
  const [cajaEfectivoEntradas, setCajaEfectivoEntradas] = useState(0);
  const [cajaTransferEntradas, setCajaTransferEntradas] = useState(0);
  const [ticketCounter, setTicketCounter] = useState(1);
  
  const [egresosLista, setEgresosLista] = useState([]);
  const [historialCierres, setHistorialCierres] = useState([]);
  const [gastoRegistro, setGastoRegistro] = useState({ desc: '', monto: ''});
  const [nuevoProducto, setNuevoProducto] = useState({ nombre: '', costo: '', precio: '', categoria: 'Bebida' });

  // --- ESTADOS: SUPER ADMIN (MODO DIOS) ---
  const [vistaAdmin, setVistaAdmin] = useState('dashboard');
  const [filtroMorosos, setFiltroMorosos] = useState('todos');
  const [logAuditoria, setLogAuditoria] = useState([]);
  const [jugadoresVisitaAdmin, setJugadoresVisitaAdmin] = useState([]);
  const [usuarioAutenticado, setUsuarioAutenticado] = useState(null);

  const [destinatarios, setDestinatarios] = useState({ admin: false, staff: false, socios: true, apoderados: true, deportistas: true });
  const [cuentaEditando, setCuentaEditando] = useState(null);
  const [guardandoCuenta, setGuardandoCuenta] = useState(false);
  
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
  const settingsButtonRef = useRef(null);
  const notificationsButtonRef = useRef(null);
  const settingsPanelRef = useRef(null);
  const notificationsPanelRef = useRef(null);

  useEffect(() => {
    try {
      const sesionRaw = window.localStorage.getItem(SESSION_STORAGE_KEY);
      if (sesionRaw) {
        const sesion = JSON.parse(sesionRaw);
        // Para SuperAdmin, no verificar expiración - mantener sesión indefinidamente
        if (sesion?.rol && sesion?.usuario) {
          const rolNormalizado = resolverRolPrincipal(sesion.rol, sesion.usuario);
          setRolUsuario(rolNormalizado);
          setUsuarioAutenticado({
            ...sesion.usuario,
            rol: resolverRolPrincipal(sesion.usuario?.rol || rolNormalizado, sesion.usuario),
          });
          setPantallaActiva(sesion.pantallaActiva || (rolNormalizado === 'super_admin' ? 'admin_dashboard' : 'comunicaciones'));
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
          updatedAt: new Date().toISOString(),
        })
      );
      return;
    }

    window.localStorage.removeItem(SESSION_STORAGE_KEY);
  }, [rolUsuario, usuarioAutenticado, pantallaActiva, sesionHidratada, SESSION_STORAGE_KEY]);

  const [nominaCita, setNominaCita] = useState([]);

  // ==========================================
  // 3. LÓGICA BASE Y EFECTOS
  // ==========================================

  const construirMorososDesdePagos = (pagos = [], jugadores = []) => {
    const jugadoresPorRut = new Map((jugadores || []).map((j) => [j.rut_jugador, j]));
    const pendientes = (pagos || []).filter((p) => ['pendiente', 'rechazado'].includes((p.estado_pago || '').toLowerCase()));
    const agrupados = new Map();

    pendientes.forEach((pago) => {
      const rut = pago.rut_jugador || pago.correo_apoderado || `pendiente-${pago.id}`;
      const jugador = jugadoresPorRut.get(pago.rut_jugador);
      const actual = agrupados.get(rut) || {
        id: rut,
        rut,
        nombre: jugador
          ? `${jugador.nombres || ''} ${jugador.apellido_paterno || ''}`.trim()
          : `Pago pendiente #${pago.id}`,
        tipo: jugador?.rama?.toLowerCase().includes('femen') ? 'apoderado' : 'socio-apoderado',
        mesesDeuda: 0,
        montoDeuda: 0,
        contacto: pago.correo_apoderado || jugador?.correo_apoderado || 'Sin contacto',
        pupilos: jugador ? [jugador.nombres || jugador.rut_jugador] : [],
      };

      actual.montoDeuda += Number(pago.monto_total_pagado || 0);
      actual.mesesDeuda += Number(pago.cantidad_meses_pagados || 1);
      agrupados.set(rut, actual);
    });

    return [...agrupados.values()].sort((a, b) => b.montoDeuda - a.montoDeuda);
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

        const nuevoRoster = jugadoresRes.slice(0, 24).map((j, idx) => ({
          id: idx + 1,
          rut_jugador: j.rut_jugador || `sin-rut-${idx + 1}`,
          nombre: `${j.nombres || ''} ${j.apellido_paterno || ''} ${j.apellido_materno || ''}`.trim(),
          correo_apoderado: j.correo_apoderado || '',
          rama: j.rama || 'MASCULINA',
          categoria: j.categoria || 'SUB-13',
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
        setMorososAdmin(construirMorososDesdePagos(pagosMensualidadesRes, jugadoresRes));
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

      if (Array.isArray(quizRes) && quizRes.length > 0) {
        const primera = quizRes[0];
        const opcionesQuiz = Array.isArray(primera.opciones_json)
          ? primera.opciones_json
          : (typeof primera.opciones_json === 'string'
            ? JSON.parse(primera.opciones_json)
            : []);

        setQuizActivo({
          titulo: primera.titulo || 'Desafío semanal',
          pregunta: primera.pregunta || 'Pregunta no disponible',
          opciones: opcionesQuiz,
          respuestaCorrecta: primera.respuesta_correcta || 'A',
          explicacion: primera.explicacion || 'Revisa la respuesta con tu entrenador.',
        });
      }

      try {
        const partidoRef = partidosLiveRes?.[0]?.id_partido;
        if (partidoRef) {
          const pizarrasRes = await api.pizarraAPI.getByPartido(partidoRef);
          if (Array.isArray(pizarrasRes)) {
            setPizarrasAcademia(pizarrasRes);
          }
        } else {
          setPizarrasAcademia([]);
        }
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
      case 'evaluacion_staff': return "Lab Rendimiento";
      case 'scoreboard_live': return "Mesa FIBA Live";
      case 'kiosco': return "Kiosco POS";
      case 'admin_dashboard': return "Administración";
      default: return "Club Cultura Física";
    }
  };

  const abrirFormularioLogin = (tipo) => { setTipoLoginSeleccionado(tipo); setMostrarFormularioLogin(true); setRutInput(tipo === 'invitado' ? 'visita' : ''); };
  const volverInicioLogin = () => { setMostrarFormularioLogin(false); setRutInput(''); setPassInput(''); };

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
      alert(error.message || 'No se pudo subir la foto de perfil.');
    } finally {
      setOnboardingSubiendoFoto(false);
    }
  };

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    if(!rutInput || !passInput) return alert("Ingresa tu RUT y contraseña.");

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
        iniciarSesionFinal(perfilDetectado, usuarioDetectado);
      }
    } catch (error) {
      alert(error.message || 'No se pudo iniciar sesión. Revisa RUT y contraseña.');
    }
  };

  const avanzarOnboarding = async () => {
    if (onboardingStep === 1) {
      const nuevaClave = String(onboardingPassword || '').trim();
      const confirmacion = String(onboardingPasswordConfirm || '').trim();
      if (nuevaClave.length < 5) {
        alert('La nueva contraseña debe tener al menos 5 caracteres.');
        return;
      }
      if (nuevaClave !== confirmacion) {
        alert('La confirmación de contraseña no coincide.');
        return;
      }
      if (!onboardingCuenta?.rut) {
        alert('No se pudo identificar la cuenta para actualizar contraseña.');
        return;
      }

      let onboardingInfo = { fusion: onboardingCuenta || {}, camposPendientes: [] };
      try {
        await api.authAPI.changePassword({
          rut: onboardingCuenta.rut,
          currentPassword: onboardingPasswordActual,
          newPassword: nuevaClave,
        });

        onboardingInfo = await cargarCuentaOnboarding(onboardingCuenta);
      } catch (error) {
        alert(error.message || 'No se pudo actualizar la contraseña.');
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
        alert('No se pudo identificar la cuenta para completar perfil.');
        return;
      }

      const faltantesTexto = onboardingCamposPendientes.filter((campo) => campo !== 'foto_perfil_url');
      const faltanteTextoInvalido = faltantesTexto.find((campo) => !String(onboardingPerfilDraft[campo] || '').trim());
      if (faltanteTextoInvalido) {
        alert('Completa todos los datos pendientes antes de continuar.');
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
        alert(error.message || 'No se pudieron guardar los datos pendientes.');
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

  const iniciarSesionFinal = (perfil, usuario = null) => {
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
        savedAt: new Date().toISOString(),
      })
    );
    
    setRutInput(''); setPassInput(''); setMostrarFormularioLogin(false);
  };

  const cerrarSesion = () => {
    setShowModalSalir(false);
    setRolUsuario(null);
    setUsuarioAutenticado(null);
    setPantallaActiva('comunicaciones');
    setMostrarFormularioLogin(false);
    setShowSettings(false);
    setVistaAdmin('dashboard');
    setCuentaEditando(null);
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

  const abrirEdicionCuenta = (cuenta) => {
    setCuentaEditando({
      id: cuenta.id,
      correo: cuenta.correo || '',
      rut: cuenta.rut || '',
      nombres: cuenta.nombres || '',
      apellido_paterno: cuenta.apellido_paterno || '',
      apellido_materno: cuenta.apellido_materno || '',
      telefono: cuenta.telefono || '',
      direccion: cuenta.direccion || '',
      comuna: cuenta.comuna || '',
      rol: cuenta.rol || 'apoderado',
      estado_civil: cuenta.estado_civil || '',
      profesion_oficio: cuenta.profesion_oficio || '',
      nombre_segundo_contacto: cuenta.nombre_segundo_contacto || '',
      parentesco_segundo_contacto: cuenta.parentesco_segundo_contacto || '',
      num_segundo_contacto: cuenta.num_segundo_contacto || '',
      es_socio: Boolean(cuenta.es_socio),
      dia_pago_acordado: cuenta.dia_pago_acordado || '',
    });
    setVistaAdmin('usuarios');
  };

  const actualizarCampoCuenta = (campo, valor) => {
    setCuentaEditando((prev) => ({ ...prev, [campo]: valor }));
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
        ? construirMorososDesdePagos(pagosRes, jugadoresAdmin)
        : []
    );
  };

  const guardarCuentaPendiente = async () => {
    if (!cuentaEditando) return;

    if (!api.validarRutChileno(cuentaEditando.rut)) {
      alert('El RUT ingresado no es valido. Revisa digito verificador.');
      return;
    }

    try {
      setGuardandoCuenta(true);
      await api.cuentasAPI.update(cuentaEditando.id, cuentaEditando);
      await recargarUsuariosAdmin();
      alert('Cuenta actualizada correctamente.');
      setCuentaEditando(null);
    } catch (error) {
      alert(`No se pudo guardar la cuenta: ${error.message}`);
    } finally {
      setGuardandoCuenta(false);
    }
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

  const publicarMaterialAcademia = async ({ titulo, url, tipo }) => {
    const tipoComunicado = tipo === 'video'
      ? 'Academia-Video'
      : tipo === 'imagen'
        ? 'Academia-Imagen'
        : 'Academia-Documento';

    await api.comunicacionesAPI.create({
      titulo,
      cuerpo_texto: url,
      tipo: tipoComunicado,
      rama: 'General',
      categoria: 'General',
      urgencia: 'Baja',
      solicita_asistencia: false,
    });

    await cargarDatos({ manual: true });
  };

  const crearQuizAcademia = async ({ titulo, pregunta, opciones, respuestaCorrecta }) => {
    await api.quizAPI.create({
      titulo,
      tipo_quiz: 'academia',
      rama: 'General',
      pregunta,
      opciones_json: opciones,
      respuesta_correcta: respuestaCorrecta,
      dificultad: 'media',
    });

    await cargarDatos({ manual: true });
  };

  const guardarPizarraAcademia = async ({ nombre_tactica, descripcion, formacion, zona_defensa, zona_ataque }) => {
    const partidoOrdenado = [...(partidosResumen || [])].sort((a, b) => {
      const fechaA = a.fechaISO ? new Date(a.fechaISO).getTime() : 0;
      const fechaB = b.fechaISO ? new Date(b.fechaISO).getTime() : 0;
      if (fechaA !== fechaB) return fechaB - fechaA;
      return Number(b.id || 0) - Number(a.id || 0);
    });
    const partidoRef = partidoOrdenado[0]?.id || null;

    if (!partidoRef) {
      throw new Error('No hay un partido reciente disponible para asociar la pizarra.');
    }

    await api.pizarraAPI.create({
      id_partido: partidoRef,
      entrenador_rut: 'staff-ccf',
      nombre_tactica,
      descripcion,
      formacion,
      zona_defensa,
      zona_ataque,
    });

    await cargarDatos({ manual: true });
  };

  const mapPartidosResumen = (partidosLiveRes = []) => {
    return (Array.isArray(partidosLiveRes) ? partidosLiveRes : []).map((p, idx) => ({
      id: p.id_partido || idx + 1,
      rama: p.rama || ((p.categoria_rama || '').toLowerCase().includes('femen') ? 'Femenina' : 'Masculina'),
      categoria: p.categoria || p.categoria_rama || 'General',
      torneo: p.estado_juego || 'Partido oficial',
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
    }));
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
    
    addNotificacionHistorial('reporte', '📥 Reporte Exportado', 'Archivo descargado exitosamente');
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
          <text x="40" y="160" textAnchor="middle" fontSize="11" fill="var(--texto-secundario)" fontWeight="600">💬</text>
          <text x="105" y="160" textAnchor="middle" fontSize="11" fill="var(--texto-secundario)" fontWeight="600">❤️</text>
          <text x="170" y="160" textAnchor="middle" fontSize="11" fill="var(--texto-secundario)" fontWeight="600">✓</text>
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
        titulo: '📉 Engagement Bajo',
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
        titulo: '💬 Sin Respuestas',
        descripcion: `${comSinRespuesta.length} comunicaciones esperando respuesta`,
        urgencia: 'Baja',
        timestamp: new Date()
      });
    }
    
    // Alerta 3: Stock crítico en kiosco
    const stockCritico = inventarioProductos.filter(p => p.stock < 5);
    if (stockCritico.length > 0) {
      nuevasAlertas.push({
        id: nextId(),
        tipo: 'stock',
        titulo: '⚠️ Stock Crítico',
        descripcion: `${stockCritico.length} productos con stock bajo`,
        urgencia: 'Alta',
        timestamp: new Date()
      });
    }
    
    // Alerta 4: Usuarios inactivos
    nuevasAlertas.push({
      id: nextId(),
      tipo: 'inactividad',
      titulo: '😴 Usuarios Inactivos',
      descripcion: '3 usuarios sin actividad > 7 días',
      urgencia: 'Baja',
      timestamp: new Date()
    });
    
    setAlertas(nuevasAlertas);
    setSaludDelSistema({
      estado: totalEngagement > 30 ? 'Óptimo' : totalEngagement > 15 ? 'Atención' : 'Crítico',
      emoji: totalEngagement > 30 ? '🟢' : totalEngagement > 15 ? '🟡' : '🔴'
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
      alert('Activa las notificaciones del navegador para ver el push nativo.');
    }

    crearPushNotificacion('alerta', '🔔 Notificación del sistema', 'Las notificaciones están activas y conectadas.', 'Baja');
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
      crearPushNotificacion('whatsapp', '📤 Mensaje Enviado', `Enviado a ${nuevoMensaje.contacto}`, 'Baja');
    } catch (error) {
      console.error('Error enviando mensaje WhatsApp:', error);
      alert('Error al enviar el mensaje');
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
      alert('Por favor completa nombre y número');
      return;
    }

    try {
      const numero = nuevoContactoWA.numero.startsWith('+') ? nuevoContactoWA.numero : '+56' + nuevoContactoWA.numero;
      
      const contactoNuevo = await api.whatsappAPI.agregarContacto(nuevoContactoWA.nombre, numero);
      
      setContactosWhatsApp(prev => [...prev, contactoNuevo]);
      setNuevoContactoWA({ nombre: '', numero: '' });
      crearPushNotificacion('whatsapp', '📞 Contacto Agregado', `${contactoNuevo.nombre} añadido a WhatsApp`, 'Baja');
    } catch (error) {
      console.error('Error agregando contacto:', error);
      alert('Error al agregar el contacto: ' + error.message);
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

  const obtenerAnioNacimientoJugador = (jugador = {}) => (
    jugador.anioNacimiento
    ?? jugador.anio_nacimiento
    ?? jugador.ano_nacimiento
    ?? jugador['año_nacimiento']
    ?? jugador['a├▒o_nacimiento']
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
  const modulosNavegacionOrden = ['admin_dashboard', 'comunicaciones', 'academia', 'perfil', 'jugador', 'asistencia_staff', 'evaluacion_staff', 'scoreboard_live', 'kiosco'];
  const modulosNavegacionVisibles = modulosNavegacionOrden.filter((modulo) => puedeVerPantalla(modulo));

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
      case 'evaluacion_staff':
        return { label: 'Evaluar', Icon: Sliders };
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
          {rolUsuario && (
            <div className="btn-icon-header" style={{ cursor: 'default' }}>
              <ShieldAlert size={22} color="#6B7280" strokeWidth={1.5} />
            </div>
          )}
        </div>
        <div className="logo-temporal" style={{ background: 'none', width: 'auto', flex: 1, minWidth: 0, padding: '0 10px' }}>
          {!rolUsuario
            ? (
              <div className="home-header-brand">
                <img src="/logos/Club-frase.png" alt="Club Centro de Cultura Física" className="home-header-club-mark" />
                <span className="home-header-subtitle">Viña Del Mar</span>
              </div>
            )
            : <h2 style={{ margin: 0, fontSize: '16px', fontWeight: '900', letterSpacing: '1px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{getHeaderTitle()}</h2>
          }
        </div>
        <div className="header-btn-zone right">
          {rolUsuario && (
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', justifyContent: 'flex-end', width: '100%', flexWrap: 'nowrap' }}>
              {(rolUsuario === 'admin' || rolUsuario === 'super_admin') && (
                <button ref={settingsButtonRef} className="btn-icon-header" onClick={toggleSettingsPanel} title="Configuración y Perfil">
                  <Settings size={24} color="#6B7280" strokeWidth={1.5} />
                </button>
              )}
              <div
                ref={notificationsButtonRef}
                style={{position: 'relative', cursor: 'pointer'}}
                onClick={toggleNotificationsPanel}
              >
                <Bell size={24} color="#6B7280" strokeWidth={1.5} />
                {notificaciones.filter(n=>!n.leida).length > 0 && (
                  <span style={{position: 'absolute', top: '-5px', right: '-5px', background: '#FF3B30', color: 'white', fontSize: '10px', fontWeight: '900', padding: '3px 6px', borderRadius: '10px', border: '2px solid var(--azul-marino)'}}>
                    {notificaciones.filter(n=>!n.leida).length}
                  </span>
                )}
              </div>
              <button className="btn-icon-header" onClick={() => setShowModalSalir(true)}>
                <LogOut size={24} color="#6B7280" strokeWidth={1.5} />
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
          background: '#FF3B30',
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
                rolUsuario={rolUsuario}
                animacionXP={animacionXP}
                setAnimacionXP={setAnimacionXP}
                quizCompletado={quizCompletado}
                setQuizCompletado={setQuizCompletado}
                opcionSeleccionada={opcionSeleccionada}
                setOpcionSeleccionada={setOpcionSeleccionada}
                quizActivo={quizActivo}
                materialesAcademia={materialesAcademia}
                pizarrasAcademia={pizarrasAcademia}
                publicarMaterialAcademia={publicarMaterialAcademia}
                crearQuizAcademia={crearQuizAcademia}
                guardarPizarraAcademia={guardarPizarraAcademia}
              />
            )}
            {puedeVerPantalla('perfil') && pantallaActiva === 'perfil' && (
              <PerfilTesoreriaPanel
                pupiloActivo={pupiloActivo}
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
            {puedeVerPantalla('evaluacion_staff') && pantallaActiva === 'evaluacion_staff' && (
              <StaffEvaluacionPanel
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
              />
            )}
            {puedeVerPantalla('kiosco') && pantallaActiva === 'kiosco' && (
              <KioscoPanel
                cajaAbierta={cajaAbierta}
                setCajaAbierta={setCajaAbierta}
                datosCaja={datosCaja}
                setDatosCaja={setDatosCaja}
                vistaKiosco={vistaKiosco}
                setVistaKiosco={setVistaKiosco}
                inventarioProductos={inventarioProductos}
                setInventarioProductos={setInventarioProductos}
                carritoKiosco={carritoKiosco}
                setCarritoKiosco={setCarritoKiosco}
                modalPagoPOS={modalPagoPOS}
                setModalPagoPOS={setModalPagoPOS}
                montoRecibidoEfectivo={montoRecibidoEfectivo}
                setMontoRecibidoEfectivo={setMontoRecibidoEfectivo}
                fiadosLista={fiadosLista}
                setFiadosLista={setFiadosLista}
                nombreFiado={nombreFiado}
                setNombreFiado={setNombreFiado}
                detalleFiado={detalleFiado}
                setDetalleFiado={setDetalleFiado}
                cajaEfectivoKiosco={cajaEfectivoKiosco}
                setCajaEfectivoKiosco={setCajaEfectivoKiosco}
                cajaTransferKiosco={cajaTransferKiosco}
                setCajaTransferKiosco={setCajaTransferKiosco}
                cajaEfectivoEntradas={cajaEfectivoEntradas}
                setCajaEfectivoEntradas={setCajaEfectivoEntradas}
                cajaTransferEntradas={cajaTransferEntradas}
                setCajaTransferEntradas={setCajaTransferEntradas}
                ticketCounter={ticketCounter}
                setTicketCounter={setTicketCounter}
                egresosLista={egresosLista}
                setEgresosLista={setEgresosLista}
                gastoRegistro={gastoRegistro}
                setGastoRegistro={setGastoRegistro}
                nuevoProducto={nuevoProducto}
                setNuevoProducto={setNuevoProducto}
              />
            )}
            {puedeVerPantalla('admin_dashboard') && pantallaActiva === 'admin_dashboard' && (
              <SuperAdminPanel
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
                abrirEdicionCuenta={abrirEdicionCuenta}
                cuentaEditando={cuentaEditando}
                actualizarCampoCuenta={actualizarCampoCuenta}
                guardarCuentaPendiente={guardarCuentaPendiente}
                guardandoCuenta={guardandoCuenta}
                setCuentaEditando={setCuentaEditando}
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
                jugadoresVisitaAdmin={jugadoresVisitaAdmin}
                guardarJugadorVisitaAdmin={guardarJugadorVisitaAdmin}
                validarPagoMensualidad={validarPagoMensualidad}
                morososAdmin={morososAdmin}
                pagosMensualidadesAdmin={pagosMensualidadesAdmin}
                onSheetsSyncComplete={sincronizarDatosDesdeSheets}
                onCancelEdit={restaurarPermisosAntesCancelacion}
                onPartidosChanged={recargarPartidosResumen}
                onComunicacionesChanged={recargarComunicacionesResumen}
              />
            )}
          </>
        )}
      </main>

      {/* NAVEGACIÓN GLASSMORPHISM */}
      <nav className="ios-bottom-nav">
        {!rolUsuario ? (
          <>
            <div className={`nav-item ${vistaPublica === 'inicio' ? 'active' : ''}`} onClick={() => setVistaPublica('inicio')}><Home size={26} color="#6B7280" strokeWidth={1.5} /><span className="mt-5">Inicio</span></div>
            <div className={`nav-item ${vistaPublica === 'noticias' ? 'active' : ''}`} onClick={() => setVistaPublica('noticias')}><Bell size={26} color="#6B7280" strokeWidth={1.5} /><span className="mt-5">Noticias</span></div>
            <div className={`nav-item ${vistaPublica === 'resultados' ? 'active' : ''}`} onClick={() => setVistaPublica('resultados')}><Trophy size={26} color="#6B7280" strokeWidth={1.5} /><span className="mt-5">Resultados</span></div>
          </>
        ) : rolUsuario === 'visita' ? (
          <>
            {puedeVerPantalla('comunicaciones') && <div className={`nav-item ${pantallaActiva === 'comunicaciones' ? 'active' : ''}`} onClick={() => cambiarPantallaConLoader('comunicaciones')}><Trophy size={26} color="#6B7280" strokeWidth={1.5} /><span className="mt-5">Torneo</span></div>}
            {puedeVerPantalla('jugador') && <div className={`nav-item ${pantallaActiva === 'jugador' ? 'active' : ''}`} onClick={() => cambiarPantallaConLoader('jugador')}><QrCode size={26} color="#6B7280" strokeWidth={1.5} /><span className="mt-5">Pase/Fixture</span></div>}
          </>
        ) : rolUsuario === 'mesa' ? (
          <div className="nav-item active" style={{width: '100%'}}><Monitor size={26} color="#6B7280" strokeWidth={1.5} /><span className="mt-5">Consola Transmisión</span></div>
        ) : modulosNavegacionVisibles.length > 0 ? (
          <>
            {modulosNavegacionVisibles.map((modulo) => {
              const meta = obtenerMetaModuloNav(modulo);
              if (!meta) return null;
              const Icon = meta.Icon;
              return (
                <div
                  key={`nav-${modulo}`}
                  className={`nav-item ${pantallaActiva === modulo ? 'active' : ''}`}
                  onClick={() => cambiarPantallaConLoader(modulo)}
                >
                  <Icon size={26} color="#6B7280" strokeWidth={1.5} />
                  <span className="mt-5">{meta.label}</span>
                </div>
              );
            })}
          </>
        ) : null}
      </nav>

      {/* MODAL DE CIERRE DE SESIÓN */}
      {showModalSalir && (
        <div className="modal-overlay-alert">
          <div className="modal-alert-card text-center">
            <AlertTriangle size={48} color="#FF3B30" className="icon-bounce mb-15" />
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








