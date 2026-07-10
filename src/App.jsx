import { lazy, Suspense, useState, useEffect } from 'react';
import './App.css';
import { 
  Home, User, Trophy, CreditCard, Shirt, CheckCircle, Bell, LogOut, 
  Settings, LayoutGrid, List, Star, Target, MapPin, 
  Brain, PlayCircle, BookOpen, Video, Users, Sliders, HeartPulse, 
  Save, Monitor, Activity, ArrowRight, ArrowLeft, AlertTriangle, 
  FileText, Flag, QrCode, Lock, Camera, ChevronRight, ChevronLeft, 
  ShieldAlert, Zap, MessageCircle, Clock, FileDown, 
  History, CheckSquare, 
  XSquare, Moon, Sun, Search
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
import {
  mockNotificaciones,
  mockAuditoria,
  mockComunicaciones,
  mockFotos,
  productosKioscoBase,
  mockTesoreriaDB,
  mock12Meses,
  partidosPrueba,
  mockJugador,
  mockEvaluacion,
  mockQuiz,
} from './data/mockData';

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
  // --- ESTADOS: GLOBAL Y TEMA ---
  const [temaOscuro, setTemaOscuro] = useState(true); // Iniciamos en Modo Noche (Premium)
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
  const [pupiloActivo, setPupiloActivo] = useState(mockTesoreriaDB.pupilos[0]);
  
  // --- ESTADOS: ONBOARDING ---
  const [isOnboarding, setIsOnboarding] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState(1);
  const [onboardingProgress, setOnboardingProgress] = useState(0);
  const [rolUsuarioTemporal, setRolUsuarioTemporal] = useState(null);

  // --- ESTADOS: GAMIFICACIÓN Y PERFIL ---
  const [showTarjetaHolo, setShowTarjetaHolo] = useState(false);
  const [quizCompletado, setQuizCompletado] = useState(false);
  const [opcionSeleccionada, setOpcionSeleccionada] = useState(null);
  const [animacionXP, setAnimacionXP] = useState(false); // Efecto Partículas

  // --- ESTADOS: MURO Y RRSS ---
  const [vistaMuro, setVistaMuro] = useState('noticias'); 
  const [vistaPublica, setVistaPublica] = useState('inicio');
  const [respuestaCitacion, setRespuestaCitacion] = useState(null); 
  const [noticiasRRSS, setNoticiasRRSS] = useState(mockComunicaciones.map(n => ({...n, likes: 0, meGusta: false})));
  const [alertasPublicadas, setAlertasPublicadas] = useState([]);

  // --- ESTADOS: MESA FIBA AVANZADA (PREMIUM) ---
  const [liveScore, setLiveScore] = useState({ 
    ptsLocal: 0, ptsVisita: 0, faltasLocal: 0, faltasVisita: 0, 
    periodo: 1, reloj: "10:00", timeoutsLocal: 3, timeoutsVisita: 3, flecha: 'LOCAL'
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
    sonidoAlerta: 'campana',
    sonidoNotif: 'tono',
    vibración: true,
    volumen: 80
  });
  const [historialPushTotal, setHistorialPushTotal] = useState([]);

  // --- ESTADOS: FASE 9 - INTEGRACIÓN WHATSAPP + WEBHOOKS ---
  const [contactosWhatsApp, setContactosWhatsApp] = useState([
    { id: 1, nombre: 'Tomás Parra', numero: '+56987654321', activo: true },
    { id: 2, nombre: 'Juan Silva', numero: '+56912345678', activo: true }
  ]);
  const [historialWhatsApp, setHistorialWhatsApp] = useState([
    { id: 1, contacto: 'Tomás Parra', numero: '+56987654321', mensaje: '✅ Pago de $45.000 confirmado', timestamp: new Date(), tipo: 'salida', estado: 'entregado' }
  ]);
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
  
  const [rosterEquipo, setRosterEquipo] = useState([
    { id: 1, nombre: "Tomás Parra", dorsal: 8, año: 2011, estadoAsistencia: 'presente', pts: 0, reb: 0, ast: 0, stl: 0, blk: 0, flt: 0, to: 0 }, 
    { id: 2, nombre: "Luis Soto", dorsal: 10, año: 2011, estadoAsistencia: 'presente', pts: 0, reb: 0, ast: 0, stl: 0, blk: 0, flt: 0, to: 0 },
    { id: 3, nombre: "Martín Silva", dorsal: 5, año: 2012, estadoAsistencia: 'justificado', pts: 0, reb: 0, ast: 0, stl: 0, blk: 0, flt: 0, to: 0 } // Lesionado/Justificado
  ]);
  
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
  const [pagosPendientesAdmin, setPagosPendientesAdmin] = useState([
    { id: 901, familia: 'Familia Parra Silva', detalle: 'Cuota Socio + U15 (Mes Jul)', monto: 45000, estado: 'Pendiente' }
  ]);

  // --- ESTADOS: KIOSCO POS, INVENTARIO Y CAJA (PREMIUM) ---
  const [cajaAbierta, setCajaAbierta] = useState(false);
  const [datosCaja, setDatosCaja] = useState({ dia: '', responsable: '', montoInicial: '' });
  const [vistaKiosco, setVistaKiosco] = useState('pos');
  const [inventarioProductos, setInventarioProductos] = useState(productosKioscoBase);
  const [carritoKiosco, setCarritoKiosco] = useState([]);
  const [modalPagoPOS, setModalPagoPOS] = useState(null); 
  const [montoRecibidoEfectivo, setMontoRecibidoEfectivo] = useState('');
  
  const [fiadosLista, setFiadosLista] = useState([
    { id: 1, nombre: "Papá de Tomás Parra", detalle: "2x Completo Italiano, 1x Bebida", monto: 6500, fecha: "Hoy" }
  ]);
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
  const [logAuditoria, setLogAuditoria] = useState(mockAuditoria);

  const [destinatarios, setDestinatarios] = useState({ admin: false, staff: false, socios: true, apoderados: true, deportistas: true });
  const [cuentaEditando, setCuentaEditando] = useState(null);
  const [guardandoCuenta, setGuardandoCuenta] = useState(false);
  
  const [busquedaPermisos, setBusquedaPermisos] = useState('');
  const [filtroRolPermisos, setFiltroRolPermisos] = useState('Todos');
  const [matrixPermisos, setMatrixPermisos] = useState([
    { id: 101, nombre: "Juan Entrenador", rol: "Staff", permisos: { kiosco: false, inventario: false, citaciones: false, mesa: true, validacion_pagos: false, auditoria: false, resumen: false } },
    { id: 102, nombre: "Maria Tesorera", rol: "Admin", permisos: { kiosco: true, inventario: true, citaciones: true, mesa: false, validacion_pagos: true, auditoria: true, resumen: true } },
    { id: 103, nombre: "Pedro Apoderado", rol: "Socio", permisos: { kiosco: false, inventario: false, citaciones: false, mesa: true, validacion_pagos: false, auditoria: false, resumen: false } },
    { id: 104, nombre: "Carlos Gerente", rol: "Admin", permisos: { kiosco: true, inventario: true, citaciones: true, mesa: true, validacion_pagos: true, auditoria: true, resumen: true } },
    { id: 105, nombre: "Laura Deportista", rol: "Jugador", permisos: { kiosco: false, inventario: false, citaciones: true, mesa: false, validacion_pagos: false, auditoria: false, resumen: false } }
  ]);
  
  // --- ESTADOS: VISTAS Y CONFIGURACIÓN ---
  const [pagoViewMode, setPageViewMode] = useState('grid'); // grid | list
  const [showSettings, setShowSettings] = useState(false); // Panel de configuración
  const [mostrarFormComunicaciones, setMostrarFormComunicaciones] = useState(false);
  const [comunicaciones, setComunicaciones] = useState(mockComunicaciones);
  const [encuestas, setEncuestas] = useState([
    { id: 1, titulo: 'Preferencia de hora de entrenamientos', opciones: ['7:00 AM', '6:00 PM', '7:00 PM'], votos: {'7:00 AM': 3, '6:00 PM': 12, '7:00 PM': 8}, respondio: false }
  ]);
  const [formCom, setFormCom] = useState({ titulo: '', mensaje: '', audiencia: ['deportistas'], rama: 'General', categoria: 'General', tipo: 'Aviso', urgencia: 'Media', solicita_asistencia: false });
  const [comentariosUI, setComentariosUI] = useState({}); // {comId: [{id, usuario, texto, timestamp, respuestas: [], likes}, ...]}
  const [formComentario, setFormComentario] = useState({}); // {comId: 'texto', comId_respuesta_parentId: 'texto'}
  const [mostrarFormComentario, setMostrarFormComentario] = useState({}); // {comId: true/false}
  const [apiOffline, setApiOffline] = useState(false);
  const [apiRetrying, setApiRetrying] = useState(false);
  const [apiStatusMessage, setApiStatusMessage] = useState('');

  const [nominaCita, setNominaCita] = useState([
    { id: 201, nombre: "Martina Parra", dorsal: 10, pos: "Base", activo: true, deuda: false, lesion: false, citado: false, catOriginal: 'U15' },
    { id: 202, nombre: "Sofía Lagos", dorsal: 4, pos: "Alero", activo: true, deuda: true, lesion: false, citado: false, catOriginal: 'U15' },
    { id: 203, nombre: "Camila Silva", dorsal: 15, pos: "Pívot", activo: true, deuda: false, lesion: true, citado: false, catOriginal: 'U15' }
  ]);

  // ==========================================
  // 3. LÓGICA BASE Y EFECTOS
  // ==========================================

  const cargarDatos = async ({ manual = false } = {}) => {
    if (manual) setApiRetrying(true);

    try {
      const [comunicacionesRes, contactosRes, cuentasIncompletasRes] = await Promise.all([
        api.comunicacionesAPI.getAll(),
        api.whatsappAPI.getContactos(),
        api.cuentasAPI.getIncompletas(),
      ]);

      if (Array.isArray(comunicacionesRes) && comunicacionesRes.length > 0) {
        setComunicaciones(comunicacionesRes.map(c => ({
          id: c.id,
          TITULO: c.titulo,
          CUERPO_TEXTO: c.cuerpo_texto,
          FECHA: new Date(c.created_at).toLocaleDateString('es-CL'),
          TIPO_COMUNICADO: c.tipo,
          rama: c.rama,
          categoria: c.categoria,
          urgencia: c.urgencia,
          solicita_asistencia: c.solicita_asistencia,
          reacciones: c.reacciones || {},
          asistencias: c.asistencias || []
        })));
      }

      if (Array.isArray(contactosRes) && contactosRes.length > 0) {
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

      setApiOffline(false);
      setApiStatusMessage('');
    } catch (error) {
      // Fallback silencioso a datos mock para demo cuando el backend está caído.
      setApiOffline(true);
      setApiStatusMessage(error?.message || 'Sin conexión con backend');
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
  }, []);
  
  // Efecto Skeleton Loader al cambiar de pantalla

  const cambiarPantallaConLoader = (pantalla) => {
    setIsAppLoading(true);
    setPantallaActiva(pantalla);
    setTimeout(() => setIsAppLoading(false), 400); // Falso delay para Skeletons
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

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    if(!rutInput || !passInput) return alert("Ingresa tu RUT y contraseña.");

    if(tipoLoginSeleccionado === 'invitado' || rutInput.toLowerCase().includes('visita')) {
      iniciarSesionFinal('visita');
      return;
    }

    try {
      const loginRes = await api.authAPI.login(rutInput, passInput);
      const perfilDetectado = loginRes?.user?.rol || 'jugador';

      if(passInput === '12345') {
        setRolUsuarioTemporal(perfilDetectado); setIsOnboarding(true); setOnboardingStep(1); setOnboardingProgress(15);
      } else {
        iniciarSesionFinal(perfilDetectado);
      }
    } catch (error) {
      alert(error.message || 'No se pudo iniciar sesión. Revisa RUT y contraseña.');
    }
  };

  const avanzarOnboarding = () => {
    if(onboardingStep === 1) { setOnboardingStep(2); setOnboardingProgress(45); } 
    else if (onboardingStep === 2) { setOnboardingStep(3); setOnboardingProgress(70); } 
    else { setIsOnboarding(false); iniciarSesionFinal(rolUsuarioTemporal); }
  };

  const iniciarSesionFinal = (perfil) => {
    setRolUsuario(perfil);
    if(perfil === 'mesa') setPantallaActiva('scoreboard_live');
    else if(perfil === 'admin' || perfil === 'super_admin') setPantallaActiva('admin_dashboard');
    else if(perfil === 'staff') setPantallaActiva('asistencia_staff'); 
    else if(perfil === 'jugador' || perfil === 'visita') setPantallaActiva('jugador');
    else setPantallaActiva('comunicaciones');
    
    setRutInput(''); setPassInput(''); setMostrarFormularioLogin(false);
  };

  // Función para togglear un permiso específico
  const togglePermiso = (usuarioId, modulo) => {
    setMatrixPermisos(matrixPermisos.map(u => 
      u.id === usuarioId 
        ? { ...u, permisos: { ...u.permisos, [modulo]: !u.permisos[modulo] } }
        : u
    ));
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
    setVistaAdmin('cuentas');
  };

  const actualizarCampoCuenta = (campo, valor) => {
    setCuentaEditando((prev) => ({ ...prev, [campo]: valor }));
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
      const cuentasIncompletasRes = await api.cuentasAPI.getIncompletas();
      setCuentasIncompletas(Array.isArray(cuentasIncompletasRes) ? cuentasIncompletasRes : []);
      alert('Cuenta actualizada correctamente.');
      setCuentaEditando(null);
    } catch (error) {
      alert(`No se pudo guardar la cuenta: ${error.message}`);
    } finally {
      setGuardandoCuenta(false);
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
    const sociosActivos = 12; // Mock
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

  // ==========================================
  // 5. MÓDULOS DE JUGADOR, ACADEMIA Y TESORERÍA
  // ==========================================

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
        />
      )}
      
      {/* HEADER DINÁMICO E INTELIGENTE */}
      <header className="ios-header">
        <div className="header-btn-zone">
          <button className="btn-icon-header" onClick={() => setTemaOscuro(!temaOscuro)}>
            {temaOscuro ? <Sun size={24} color="#FFD700" /> : <Moon size={24} color="white" />}
          </button>
        </div>
        <div className="logo-temporal" style={{background: 'none', width: 'auto'}}>
          {!rolUsuario
            ? <span style={{fontSize:'24px', lineHeight:'1'}}>🛡️</span>
            : <h2 style={{margin: 0, fontSize: '16px', fontWeight: '900', letterSpacing: '1px'}}>{getHeaderTitle()}</h2>
          }
        </div>
        <div className="header-btn-zone right">
          {rolUsuario && (
            <div style={{display: 'flex', gap: '15px', alignItems: 'center'}}>
              <button className="btn-icon-header" onClick={() => setMostrarBusqueda(!mostrarBusqueda)} title="Búsqueda Global">
                <Search size={24} color="white" />
              </button>
              <button className="btn-icon-header" onClick={() => setShowSettings(!showSettings)} title="Configuración y Perfil">
                <Settings size={24} color="white" />
              </button>
              <div style={{position: 'relative', cursor: 'pointer'}} onClick={() => setMostrarNotificaciones(!mostrarNotificaciones)}>
                <Bell size={24} color="white" />
                {notificaciones.filter(n=>!n.leida).length > 0 && (
                  <span style={{position: 'absolute', top: '-5px', right: '-5px', background: '#FF3B30', color: 'white', fontSize: '10px', fontWeight: '900', padding: '3px 6px', borderRadius: '10px', border: '2px solid var(--azul-marino)'}}>
                    {notificaciones.filter(n=>!n.leida).length}
                  </span>
                )}
              </div>
              <button className="btn-icon-header" onClick={() => setMostrarWhatsAppPanel(mostrarWhatsAppPanel ? false : 'enviar')} title="WhatsApp" style={{position: 'relative'}}>
                <span style={{fontSize: '20px'}}>💬</span>
                {contactosWhatsApp.filter(c => c.activo).length > 0 && (
                  <span style={{position: 'absolute', top: '-5px', right: '-5px', background: '#34C759', color: 'white', fontSize: '10px', fontWeight: '900', padding: '3px 6px', borderRadius: '10px', border: '2px solid var(--azul-marino)'}}>
                    {contactosWhatsApp.filter(c => c.activo).length}
                  </span>
                )}
              </button>
              <button className="btn-icon-header" onClick={() => setShowModalSalir(true)}>
                <LogOut size={24} />
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

      {/* Panel antiguo de notificaciones - REMOVIDO EN FAVOR DE RENDERNOTIFICACIONES */}

      {showSettings && (
        <div className="floating-panel settings-panel" style={{position: 'absolute', top: '90px', right: '15px', width: '380px', maxHeight: '500px', background: 'var(--blanco-tarjeta)', borderRadius: '16px', boxShadow: '0 15px 40px rgba(0,0,0,0.3)', zIndex: 999, padding: '20px', border: '1px solid rgba(0,0,0,0.05)', overflowY: 'auto'}}>
          <SettingsPanel
            rolUsuario={rolUsuario}
            busquedaPermisos={busquedaPermisos}
            setBusquedaPermisos={setBusquedaPermisos}
            filtroRolPermisos={filtroRolPermisos}
            setFiltroRolPermisos={setFiltroRolPermisos}
            matrixPermisos={matrixPermisos}
            togglePermiso={togglePermiso}
            temaOscuro={temaOscuro}
            setTemaOscuro={setTemaOscuro}
            preferenciasSonido={preferenciasSonido}
            setPreferenciasSonido={setPreferenciasSonido}
            reproducirSonido={reproducirSonido}
          />
        </div>
      )}

      {mostrarNotificaciones && (
        <NotificationsPanel
          notificaciones={notificaciones}
          setNotificaciones={setNotificaciones}
        />
      )}

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
      <main className="ios-main">
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
                mockComunicaciones={mockComunicaciones}
                mockFotos={mockFotos}
                partidosPrueba={partidosPrueba}
              />
            )}
            {rolUsuario && pantallaActiva === 'comunicaciones' && (
              <ComunicacionesPanel
                rolUsuario={rolUsuario}
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
                partidosPrueba={partidosPrueba}
              />
            )}
            {rolUsuario === 'jugador' && pantallaActiva === 'academia' && (
              <AcademiaPanel
                pupiloActivo={pupiloActivo}
                setPupiloActivo={setPupiloActivo}
                rolUsuario={rolUsuario}
                animacionXP={animacionXP}
                setAnimacionXP={setAnimacionXP}
                quizCompletado={quizCompletado}
                setQuizCompletado={setQuizCompletado}
                opcionSeleccionada={opcionSeleccionada}
                setOpcionSeleccionada={setOpcionSeleccionada}
              />
            )}
            {(rolUsuario === 'jugador' || rolUsuario === 'admin' || rolUsuario === 'super_admin') && pantallaActiva === 'perfil' && (
              <PerfilTesoreriaPanel
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
            {(rolUsuario === 'jugador' || rolUsuario === 'visita' || rolUsuario === 'super_admin') && pantallaActiva === 'jugador' && (
              <TarjetaJugadorPanel
                pupiloActivo={pupiloActivo}
                setPupiloActivo={setPupiloActivo}
                rolUsuario={rolUsuario}
              />
            )}
            {(rolUsuario === 'staff' || rolUsuario === 'super_admin') && pantallaActiva === 'asistencia_staff' && (
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
            {(rolUsuario === 'staff' || rolUsuario === 'super_admin') && pantallaActiva === 'evaluacion_staff' && (
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
            {(rolUsuario === 'mesa' || rolUsuario === 'super_admin') && pantallaActiva === 'scoreboard_live' && (
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
            {(rolUsuario === 'admin' || rolUsuario === 'super_admin') && pantallaActiva === 'kiosco' && (
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
            {(rolUsuario === 'admin' || rolUsuario === 'super_admin') && pantallaActiva === 'admin_dashboard' && (
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
              />
            )}
          </>
        )}
      </main>

      {/* NAVEGACIÓN GLASSMORPHISM */}
      <nav className="ios-bottom-nav">
        {!rolUsuario ? (
          <>
            <div className={`nav-item ${vistaPublica === 'inicio' ? 'active' : ''}`} onClick={() => setVistaPublica('inicio')}><Home size={26} /><span className="mt-5">Inicio</span></div>
            <div className={`nav-item ${vistaPublica === 'noticias' ? 'active' : ''}`} onClick={() => setVistaPublica('noticias')}><Bell size={26} /><span className="mt-5">Noticias</span></div>
            <div className={`nav-item ${vistaPublica === 'resultados' ? 'active' : ''}`} onClick={() => setVistaPublica('resultados')}><Trophy size={26} /><span className="mt-5">Resultados</span></div>
          </>
        ) : rolUsuario === 'visita' ? (
          <>
            <div className={`nav-item ${pantallaActiva === 'comunicaciones' ? 'active' : ''}`} onClick={() => cambiarPantallaConLoader('comunicaciones')}><Trophy size={26} /><span className="mt-5">Torneo</span></div>
            <div className={`nav-item ${pantallaActiva === 'jugador' ? 'active' : ''}`} onClick={() => cambiarPantallaConLoader('jugador')}><QrCode size={26} /><span className="mt-5">Pase/Fixture</span></div>
          </>
        ) : rolUsuario === 'jugador' ? (
          <>
            <div className={`nav-item ${pantallaActiva === 'comunicaciones' ? 'active' : ''}`} onClick={() => cambiarPantallaConLoader('comunicaciones')}><Bell size={26} /><span className="mt-5">Muro</span></div>
            <div className={`nav-item ${pantallaActiva === 'academia' ? 'active' : ''}`} onClick={() => cambiarPantallaConLoader('academia')}><BookOpen size={26} /><span className="mt-5">Academia</span></div>
            <div className={`nav-item ${pantallaActiva === 'perfil' ? 'active' : ''}`} onClick={() => cambiarPantallaConLoader('perfil')}><CreditCard size={26} /><span className="mt-5">Mi Cuenta</span></div>
            <div className={`nav-item ${pantallaActiva === 'jugador' ? 'active' : ''}`} onClick={() => cambiarPantallaConLoader('jugador')}><User size={26} /><span className="mt-5">Jugador</span></div>
          </>
        ) : rolUsuario === 'admin' || rolUsuario === 'super_admin' ? (
          <>
            <div className={`nav-item ${pantallaActiva === 'admin_dashboard' ? 'active' : ''}`} onClick={() => cambiarPantallaConLoader('admin_dashboard')}><Activity size={26} /><span className="mt-5">Admin</span></div>
            <div className={`nav-item ${pantallaActiva === 'kiosco' ? 'active' : ''}`} onClick={() => cambiarPantallaConLoader('kiosco')}><LayoutGrid size={26} /><span className="mt-5">Kiosco</span></div>
            <div className={`nav-item ${pantallaActiva === 'perfil' ? 'active' : ''}`} onClick={() => cambiarPantallaConLoader('perfil')}><CreditCard size={26} /><span className="mt-5">Tesorería</span></div>
            <div className={`nav-item ${pantallaActiva === 'comunicaciones' ? 'active' : ''}`} onClick={() => cambiarPantallaConLoader('comunicaciones')}><Bell size={26} /><span className="mt-5">Muro</span></div>
          </>
        ) : rolUsuario === 'staff' ? (
          <>
            <div className={`nav-item ${pantallaActiva === 'comunicaciones' ? 'active' : ''}`} onClick={() => cambiarPantallaConLoader('comunicaciones')}><Bell size={26} /><span className="mt-5">Muro</span></div>
            <div className={`nav-item ${pantallaActiva === 'asistencia_staff' ? 'active' : ''}`} onClick={() => cambiarPantallaConLoader('asistencia_staff')}><Users size={26} /><span className="mt-5">Lista</span></div>
            <div className={`nav-item ${pantallaActiva === 'evaluacion_staff' ? 'active' : ''}`} onClick={() => cambiarPantallaConLoader('evaluacion_staff')}><Sliders size={26} /><span className="mt-5">Evaluar</span></div>
          </>
        ) : rolUsuario === 'mesa' ? (
          <div className="nav-item active" style={{width: '100%'}}><Monitor size={26} /><span className="mt-5">Consola Transmisión</span></div>
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
              <button className="btn-modal-confirmar" onClick={() => { setShowModalSalir(false); setRolUsuario(null); setPantallaActiva('comunicaciones'); setMostrarFormularioLogin(false); }}>Salir Seguramente</button>
            </div>
          </div>
        </div>
      )}
    </div>
    </Suspense>
  )
}

export default App;








