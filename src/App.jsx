import { useState, useEffect } from 'react';
import './App.css';
import { 
  Home, User, Trophy, CreditCard, Shirt, CheckCircle, Bell, LogOut, 
  Settings, LayoutGrid, List, Star, Target, MapPin, 
  Brain, PlayCircle, BookOpen, Video, Users, Sliders, HeartPulse, 
  Save, Monitor, Activity, ArrowRight, ArrowLeft, AlertTriangle, 
  FileText, Flag, QrCode, Lock, Camera, ChevronRight, ChevronLeft, 
  Wallet, ShieldAlert, Zap, MessageCircle, Clock, FileDown, 
  ArrowRightLeft, TrendingUp, TrendingDown, History, CheckSquare, 
  XSquare, Moon, Sun, Tv, Search
} from 'lucide-react';
import { 
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer 
} from 'recharts';
import * as api from './api/client';
import { nextId } from './utils/runtimeId';
import ResultadosCards from './components/ResultadosCards';
import PupiloSelector from './components/PupiloSelector';
import {
  getUTMLastDayPreviousMonth,
  getColorUrgencia,
  getColorPorCategoria,
  colorTipo,
  calcularEff,
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
  mockMorosos,
} from './data/mockData';

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
  const [mostrarAlertas, setMostrarAlertas] = useState(false);
  const [scoreDeCliente, setScoreDeCliente] = useState(85);
  const [timelineActividad, setTimelineActividad] = useState([]);
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

  const [nominaCita, setNominaCita] = useState([
    { id: 201, nombre: "Martina Parra", dorsal: 10, pos: "Base", activo: true, deuda: false, lesion: false, citado: false, catOriginal: 'U15' },
    { id: 202, nombre: "Sofía Lagos", dorsal: 4, pos: "Alero", activo: true, deuda: true, lesion: false, citado: false, catOriginal: 'U15' },
    { id: 203, nombre: "Camila Silva", dorsal: 15, pos: "Pívot", activo: true, deuda: false, lesion: true, citado: false, catOriginal: 'U15' }
  ]);

  // ==========================================
  // 3. LÓGICA BASE Y EFECTOS
  // ==========================================

  // Cargar datos del API al montar el componente
  useEffect(() => {
    const cargarDatos = async () => {
      try {
        // Cargar comunicaciones
        const comunicacionesRes = await api.comunicacionesAPI.getAll();
        if (comunicacionesRes && comunicacionesRes.length > 0) {
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

        // Cargar contactos WhatsApp
        const contactosRes = await api.whatsappAPI.getContactos();
        if (contactosRes && contactosRes.length > 0) {
          setContactosWhatsApp(contactosRes);
        }

        // Cargar cuentas incompletas para solicitar actualización de datos
        const cuentasIncompletasRes = await api.cuentasAPI.getIncompletas();
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

        console.log('✅ Datos del API cargados correctamente');
      } catch (error) {
        console.error('⚠️ Error cargando datos del API:', error);
        // Mantener datos mock como fallback
      }
    };

    // Pequeña pausa para que el servidor esté listo
    setTimeout(cargarDatos, 1000);
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
  
  // PANEL DE CONFIGURACIÓN Y PERFIL
  const renderSettingsPanel = () => {
    if (rolUsuario === 'admin' || rolUsuario === 'super_admin') {
      const permisosDisponibles = ['kiosco', 'inventario', 'citaciones', 'mesa', 'validacion_pagos', 'auditoria', 'resumen'];
      const usuariosFiltrados = matrixPermisos.filter(u => u.nombre.toLowerCase().includes(busquedaPermisos.toLowerCase()) && (filtroRolPermisos === 'Todos' || u.rol === filtroRolPermisos));
      return <div style={{padding: '12px'}}><h4 style={{margin: '0 0 10px 0', fontSize: '14px', fontWeight: '900'}}>🔐 Control de Permisos</h4><input type="text" placeholder="Buscar..." value={busquedaPermisos} onChange={(e) => setBusquedaPermisos(e.target.value)} style={{width: '100%', padding: '8px', marginBottom: '10px', borderRadius: '8px', border: '1px solid var(--borde-suave)', fontSize: '12px'}} /><div style={{display: 'flex', gap: '6px', marginBottom: '10px', flexWrap: 'wrap'}}>{['Todos', 'Admin', 'Staff', 'Socio', 'Jugador'].map(r => <button key={r} onClick={() => setFiltroRolPermisos(r)} style={{padding: '6px 10px', borderRadius: '8px', background: filtroRolPermisos === r ? 'var(--azul-electrico)' : 'var(--fondo-input)', color: filtroRolPermisos === r ? 'white' : 'var(--texto-principal)', fontSize: '11px', fontWeight: '700', border: 'none', cursor: 'pointer'}}>{r}</button>)}</div><div style={{maxHeight: '300px', overflowY: 'auto'}}>{usuariosFiltrados.map(u => <div key={u.id} style={{marginBottom: '8px', padding: '8px', background: 'var(--fondo-card-sutil)', borderRadius: '8px', border: '1px solid var(--borde-suave)'}}><strong style={{fontSize: '11px', display: 'block'}}>{u.nombre}</strong><span style={{fontSize: '10px', color: 'var(--texto-secundario)'}}>{u.rol}</span><div style={{marginTop: '6px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(80px, 1fr))', gap: '4px'}}>{permisosDisponibles.map(p => <button key={p} onClick={() => togglePermiso(u.id, p)} style={{padding: '4px 6px', fontSize: '9px', borderRadius: '6px', background: u.permisos[p] ? 'rgba(52,199,89,0.2)' : 'transparent', border: u.permisos[p] ? '1px solid var(--verde-victoria)' : '1px solid rgba(0,0,0,0.1)', color: u.permisos[p] ? 'var(--verde-victoria)' : 'var(--texto-secundario)', fontWeight: '700', cursor: 'pointer'}}>{u.permisos[p] ? '✓' : '○'} {p.split('_')[0]}</button>)}</div></div>)}</div></div>;
    } else {
      return (
        <div style={{padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px'}}>
          <h4 style={{margin: '0 0 10px 0', fontSize: '14px', fontWeight: '900'}}>⚙️ Mi Perfil</h4>
          <div>
            <label style={{fontSize: '11px', fontWeight: '700', display: 'block', marginBottom: '4px'}}>Tema</label>
            <div style={{display: 'flex', gap: '6px'}}>
              <button onClick={() => setTemaOscuro(false)} style={{flex: 1, padding: '6px', borderRadius: '6px', background: !temaOscuro ? 'var(--azul-electrico)' : 'var(--fondo-input)', color: !temaOscuro ? 'white' : 'var(--texto-principal)', fontSize: '11px', fontWeight: '700', border: 'none', cursor: 'pointer'}}>☀️ Claro</button>
              <button onClick={() => setTemaOscuro(true)} style={{flex: 1, padding: '6px', borderRadius: '6px', background: temaOscuro ? 'var(--azul-electrico)' : 'var(--fondo-input)', color: temaOscuro ? 'white' : 'var(--texto-principal)', fontSize: '11px', fontWeight: '700', border: 'none', cursor: 'pointer'}}>🌙 Oscuro</button>
            </div>
          </div>
          <button onClick={() => alert('Próximamente')} style={{padding: '6px', borderRadius: '6px', background: 'rgba(0,122,255,0.1)', color: 'var(--azul-electrico)', fontSize: '11px', fontWeight: '700', border: '1px solid rgba(0,122,255,0.3)', cursor: 'pointer'}}>🔑 Contraseña</button>
          <hr style={{margin: '10px 0', border: 'none', borderTop: '1px solid var(--borde-suave)'}}/>
          {renderPreferenciasPush()}
        </div>
      );
    }
  };
  
  // PREMIUM UPGRADE: Skeleton Loaders (Transiciones ultra rápidas)
  const renderSkeleton = () => (
    <div className="skeleton-container fade-in" style={{padding: '15px'}}>
      <div className="skeleton-header" style={{height: '30px', width: '50%', background: 'rgba(0,0,0,0.05)', borderRadius: '8px', marginBottom: '20px'}}></div>
      <div className="skeleton-card" style={{height: '150px', background: 'rgba(0,0,0,0.05)', borderRadius: '20px', marginBottom: '15px'}}></div>
      <div className="skeleton-card" style={{height: '100px', background: 'rgba(0,0,0,0.05)', borderRadius: '20px', marginBottom: '15px'}}></div>
      <div className="skeleton-card" style={{height: '200px', background: 'rgba(0,0,0,0.05)', borderRadius: '20px'}}></div>
    </div>
  );

  const renderOnboardingModal = () => (
    <div className="onboarding-overlay">
      <div className="onboarding-card">
        <div className="progress-circle-container">
          <div className="progress-circle" style={{background: `conic-gradient(var(--verde-victoria) ${onboardingProgress}%, #f0f0f0 ${onboardingProgress}%)`}}>
            <div className="progress-inner">{onboardingProgress}%</div>
          </div>
        </div>
        
        {onboardingStep === 1 && (
          <div className="step-content">
            <h3><Lock size={20} color="var(--azul-marino)"/> Clave de Seguridad</h3>
            <p>Debes cambiar tu contraseña inicial (12345) por una personal y segura para continuar.</p>
            <input type="password" placeholder="Nueva Contraseña" className="form-input mt-10" />
            <input type="password" placeholder="Repetir Contraseña" className="form-input mt-10" />
          </div>
        )}
        
        {onboardingStep === 2 && (
          <div className="step-content">
            <h3><Camera size={20} color="var(--azul-marino)"/> Foto Credencial</h3>
            <p>Sube tu imagen clara y frontal para la Tarjeta Holográfica Oficial del Torneo.</p>
            <div className="foto-upload-box mt-10">
              <User size={40} color="var(--texto-secundario)"/>
              <span>Tocar para subir desde la galería</span>
            </div>
          </div>
        )}
        
        {onboardingStep === 3 && (
          <div className="step-content">
            <h3><HeartPulse size={20} color="var(--azul-marino)"/> Ficha Médica Base</h3>
            <p>Completemos los datos mínimos vitales para alcanzar el 70% del perfil requerido.</p>
            <input type="email" placeholder="Correo Electrónico" className="form-input mt-10" />
            <input type="text" placeholder="Teléfono de Emergencia" className="form-input mt-10" />
          </div>
        )}
        
        <button className="btn-electric mt-20" onClick={avanzarOnboarding}>
          {onboardingStep === 3 ? '¡Desbloquear Acceso!' : 'Siguiente Paso'} <ChevronRight size={18}/>
        </button>
      </div>
    </div>
  );

  const renderFachadaPublica = () => (
    <>
      {vistaPublica === 'inicio' && (
      <div className="text-center login-card-main hero-panel">
        <span className="hero-badge">Portal Oficial</span>
        <div className="escudo-club-login">🛡️</div>
        <h2 className="hero-title">Centro de Cultura Física<br/><span style={{fontSize:'72%',fontWeight:'800',opacity:.85}}>Viña Del Mar</span></h2>
        
        {!mostrarFormularioLogin ? (
          <div className="login-botones-iniciales">
            <button className="btn-electric" onClick={() => abrirFormularioLogin('socios')}>
              <User size={18} /> Acceso Socios y Staff
            </button>
            <button className="btn-secondary mt-15" onClick={() => abrirFormularioLogin('invitado')}>
              <QrCode size={18} /> Entrar como Visitante
            </button>
            <button className="btn-whatsapp mt-15" onClick={() => window.open('https://wa.me/56953297869?text=Hola!%20Quiero%20conocer%20m%C3%A1s%20sobre%20el%20Club%20Centro%20de%20Cultura%20F%C3%ADsica%20de%20Vi%C3%B1a%20del%20Mar%20%F0%9F%8F%80', '_blank')}>
              💬 ¿Quieres ser parte del Club?
            </button>
          </div>
        ) : (
          <form className="login-form-real fade-in" onSubmit={handleLoginSubmit}>
            <h4 className="login-form-title">
              {tipoLoginSeleccionado === 'invitado' ? 'Portal Invitados' : 'Acceso Oficial'}
            </h4>
            <div className="input-group-login">
              <User size={18} color="var(--texto-secundario)"/>
              <input type="text" placeholder="RUT" value={rutInput} onChange={(e)=>setRutInput(e.target.value)} required />
            </div>
            <div className="input-group-login mt-10">
              <Lock size={18} color="var(--texto-secundario)"/>
              <input type="password" placeholder="Contraseña" value={passInput} onChange={(e)=>setPassInput(e.target.value)} required />
            </div>
            <button type="submit" className="btn-electric mt-20">Ingresar al Sistema</button>
            <button type="button" className="btn-volver-texto mt-15" onClick={volverInicioLogin}>
              <ChevronLeft size={16}/> Volver a opciones
            </button>
          </form>
        )}
      </div>
      )}

      {vistaPublica === 'noticias' && (
        <div className="fade-in">

          {/* Anuncios públicos solamente */}
          <h3 className="section-title mt-20">Anuncios del Club</h3>
          {mockComunicaciones.filter(c => c.publico).map(c => (
            <div key={c.id} className="ios-rrss-card fade-in">
              <div className="ios-rrss-header">
                <span className="badge-tipo">{c.TIPO_COMUNICADO}</span>
                <span className="fecha-comunicado">{c.FECHA}</span>
              </div>
              <h4 className="titulo-comunicado">
                <Bell size={16} style={{marginRight: '6px'}}/>
                {c.TITULO}
              </h4>
              <p className="ios-rrss-body">{c.CUERPO_TEXTO}</p>
            </div>
          ))}

          {/* Galería de fotos */}
          <h3 className="section-title mt-20">📸 Galería</h3>
          <div className="fotos-grid mb-20">
            {mockFotos.map(foto => (
              <div key={foto.id} className="foto-card">
                <span className="foto-emoji">{foto.emoji}</span>
                <span className="foto-titulo">{foto.titulo}</span>
                <span className="foto-fecha">{foto.fecha}</span>
              </div>
            ))}
          </div>

          {/* CTA Contacto */}
          <div className="cta-contacto-card">
            <h3 style={{margin: '0 0 6px 0', fontSize: '18px', fontWeight: '900'}}>Club Centro de Cultura Física</h3>
            <p style={{margin: 0, fontSize: '13px', color: 'rgba(255,255,255,0.85)', lineHeight: '1.5'}}>
              ¿Quieres ser parte de nuestra familia deportiva?<br/>Conoce nuestros programas y catálogo de servicios.
            </p>
            <button className="btn-contacto" onClick={() => alert('¡Gracias por tu interés! Un representante del Club Centro de Cultura Física se pondrá en contacto contigo pronto. 🏀')}>
              📬 ¡Contáctanos, haz clic acá!
            </button>
          </div>
        </div>
      )}

      {vistaPublica === 'resultados' && (
        <div className="fade-in">
          <h3 className="section-title mt-20">Últimos Resultados</h3>
          <ResultadosCards partidos={partidosPrueba} />
        </div>
      )}
    </>
  );

  const renderFormularioComunicaciones = () => {
    const agregarComunicacion = async () => {
      try {
        const nuevaCom = await api.comunicacionesAPI.create({
          titulo: formCom.titulo,
          cuerpo_texto: formCom.mensaje,
          tipo: formCom.tipo,
          rama: formCom.rama,
          categoria: formCom.categoria,
          urgencia: formCom.urgencia,
          solicita_asistencia: formCom.solicita_asistencia
        });

        // Agregar a estado local
        setComunicaciones([{
          id: nuevaCom.id,
          TITULO: nuevaCom.titulo,
          CUERPO_TEXTO: nuevaCom.cuerpo_texto,
          FECHA: new Date(nuevaCom.created_at).toLocaleDateString('es-CL'),
          TIPO_COMUNICADO: nuevaCom.tipo,
          rama: nuevaCom.rama,
          categoria: nuevaCom.categoria,
          urgencia: nuevaCom.urgencia,
          solicita_asistencia: nuevaCom.solicita_asistencia,
          reacciones: nuevaCom.reacciones || {},
          asistencias: nuevaCom.asistencias || []
        }, ...comunicaciones]);

        setFormCom({ titulo: '', mensaje: '', audiencia: ['deportistas'], rama: 'General', categoria: 'General', tipo: 'Aviso', urgencia: 'Media', solicita_asistencia: false });
        setMostrarFormComunicaciones(false);
        addNotificacionHistorial('comunicacion', '📢 Nueva Comunicación', `"${formCom.titulo}" publicada correctamente`);
      } catch (error) {
        console.error('Error agregando comunicación:', error);
        alert('Error al crear la comunicación');
      }
    };

    const toggleAudiencia = (aud) => {
      const nuevaAudiencia = formCom.audiencia.includes(aud) 
        ? formCom.audiencia.filter(a => a !== aud)
        : [...formCom.audiencia, aud];
      setFormCom({...formCom, audiencia: nuevaAudiencia});
    };

    return (
      <div className="card mt-20 fade-in" style={{background: 'linear-gradient(135deg, rgba(0, 122, 255, 0.05), rgba(52, 199, 89, 0.05))', border: '1px solid var(--borde-suave)'}}>
        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', gap: '8px', flexWrap: 'wrap'}}>
          <h4 style={{margin: 0, color: 'var(--texto-heading)', fontSize: '18px', fontWeight: '800'}}>📢 Nueva Comunicación</h4>
          <button onClick={() => setMostrarFormComunicaciones(false)} style={{background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer'}}>✕</button>
        </div>

        <input type="text" placeholder="Título de la comunicación" value={formCom.titulo} onChange={e => setFormCom({...formCom, titulo: e.target.value})} className="form-input mb-10" style={{width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--borde-suave)', fontSize: '14px'}} />

        <textarea placeholder="Mensaje/Descripción" value={formCom.mensaje} onChange={e => setFormCom({...formCom, mensaje: e.target.value})} className="form-input mb-10" style={{width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--borde-suave)', minHeight: '80px', fontSize: '14px', resize: 'vertical'}} />

        <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '15px'}}>
          <select value={formCom.tipo} onChange={e => setFormCom({...formCom, tipo: e.target.value})} className="form-input" style={{padding: '8px', borderRadius: '6px', border: '1px solid var(--borde-suave)', fontSize: '13px'}}>
            <option>Aviso</option>
            <option>Evento</option>
            <option>Suspensión</option>
            <option>Asamblea</option>
            <option>Rendimiento</option>
            <option>Tesorería</option>
          </select>
          <select value={formCom.urgencia} onChange={e => setFormCom({...formCom, urgencia: e.target.value})} className="form-input" style={{padding: '8px', borderRadius: '6px', border: '1px solid var(--borde-suave)', fontSize: '13px', borderLeft: `3px solid ${getColorUrgencia(formCom.urgencia)}`}}>
            <option>Baja</option>
            <option>Media</option>
            <option>Alta</option>
            <option>Crítica</option>
          </select>
        </div>

        <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '15px'}}>
          <select value={formCom.rama} onChange={e => setFormCom({...formCom, rama: e.target.value})} className="form-input" style={{padding: '8px', borderRadius: '6px', border: '1px solid var(--borde-suave)', fontSize: '13px'}}>
            <option>General</option>
            <option>Femenina</option>
            <option>Masculina</option>
          </select>
          <select value={formCom.categoria} onChange={e => setFormCom({...formCom, categoria: e.target.value})} className="form-input" style={{padding: '8px', borderRadius: '6px', border: '1px solid var(--borde-suave)', fontSize: '13px'}}>
            <option>General</option>
            <option>U13</option>
            <option>U15</option>
            <option>U17</option>
            <option>Adultos</option>
          </select>
        </div>

        <div style={{display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '15px'}}>
          {['socios', 'apoderados', 'deportistas'].map(aud => (
            <button key={aud} onClick={() => toggleAudiencia(aud)} style={{padding: '8px', borderRadius: '6px', background: formCom.audiencia.includes(aud) ? 'var(--azul-electrico)' : 'var(--blanco-tarjeta)', color: formCom.audiencia.includes(aud) ? 'white' : 'var(--texto-principal)', border: formCom.audiencia.includes(aud) ? 'none' : '1px solid var(--borde-suave)', cursor: 'pointer', fontSize: '13px', fontWeight: formCom.audiencia.includes(aud) ? '700' : '500', transition: '0.2s'}}>
              {aud === 'socios' ? '👥 Socios' : aud === 'apoderados' ? '👨‍👩‍👧 Apoderados' : '🏃 Deportistas'}
            </button>
          ))}
        </div>

        <label style={{display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '15px', cursor: 'pointer', fontSize: '13px'}}>
          <input type="checkbox" checked={formCom.solicita_asistencia} onChange={e => setFormCom({...formCom, solicita_asistencia: e.target.checked})} style={{cursor: 'pointer', width: '16px', height: '16px'}} />
          <span>Solicitar asistencia / RSVP</span>
        </label>

        <div style={{display: 'flex', gap: '10px'}}>
          <button onClick={agregarComunicacion} className="btn-electric" style={{flex: 1, padding: '12px', borderRadius: '8px', border: 'none', color: 'white', fontWeight: '700', cursor: 'pointer', fontSize: '14px'}}>
            ✓ Publicar
          </button>
          <button onClick={() => setMostrarFormComunicaciones(false)} className="btn-secondary" style={{flex: 1, padding: '12px', borderRadius: '8px', border: '1px solid var(--borde-suave)', background: 'var(--blanco-tarjeta)', color: 'var(--texto-principal)', fontWeight: '600', cursor: 'pointer', fontSize: '14px'}}>
            Cancelar
          </button>
        </div>
      </div>
    );
  };

  const renderComunicaciones = () => {
    const emojisReacciones = ['👍', '❤️', '😂', '😮', '😢', '😡'];
    
    const addReaccion = (comId, emoji) => {
      setComunicaciones(comunicaciones.map(c => {
        if(c.id === comId) {
          const nuevasReacciones = {...c.reacciones};
          nuevasReacciones[emoji] = (nuevasReacciones[emoji] || 0) + 1;
          return {...c, reacciones: nuevasReacciones};
        }
        return c;
      }));
    };

    const addRSVP = (comId, respuesta) => {
      setComunicaciones(comunicaciones.map(c => {
        if(c.id === comId) {
          return {...c, asistencias: [...c.asistencias, {respuesta, timestamp: new Date()}]};
        }
        return c;
      }));
    };

    const voteEncuesta = (encId, opcion) => {
      setEncuestas(encuestas.map(e => {
        if(e.id === encId) {
          return {...e, votos: {...e.votos, [opcion]: (e.votos[opcion] || 0) + 1}, respondio: true};
        }
        return e;
      }));
    };

    // Funciones de Comentarios
    const addComentario = (comId, texto, parentId = null) => {
      if(!texto.trim()) return;
      const nuevoComentario = {
        id: nextId(),
        usuario: rolUsuario === 'admin' ? 'Administrador' : rolUsuario === 'staff' ? 'Entrenador' : rolUsuario === 'socio' ? 'Socio' : 'Usuario',
        avatar: rolUsuario === 'admin' ? '👨‍💼' : rolUsuario === 'staff' ? '👨‍🏫' : rolUsuario === 'socio' ? '👤' : '👤',
        texto: texto,
        timestamp: new Date().toLocaleTimeString('es-CL', {hour: '2-digit', minute: '2-digit'}),
        likes: 0,
        meGusta: false,
        respuestas: []
      };

      const key = `${comId}${parentId ? `_resp_${parentId}` : ''}`;
      
      if(parentId) {
        // Respuesta a un comentario
        setComentariosUI(prev => ({
          ...prev,
          [comId]: prev[comId]?.map(c => 
            c.id === parentId 
              ? {...c, respuestas: [...(c.respuestas || []), nuevoComentario]}
              : c
          ) || []
        }));
      } else {
        // Comentario principal
        setComentariosUI(prev => ({
          ...prev,
          [comId]: [...(prev[comId] || []), nuevoComentario]
        }));
      }
      
      setFormComentario(prev => ({...prev, [key]: ''}));
    };

    const likeComentario = (comId, comentId, parentId = null) => {
      setComentariosUI(prev => {
        const comentarios = prev[comId] || [];
        if(parentId) {
          return {
            ...prev,
            [comId]: comentarios.map(c =>
              c.id === parentId
                ? {...c, respuestas: c.respuestas.map(r => r.id === comentId ? {...r, meGusta: !r.meGusta, likes: r.meGusta ? r.likes - 1 : r.likes + 1} : r)}
                : c
            )
          };
        } else {
          return {
            ...prev,
            [comId]: comentarios.map(c => c.id === comentId ? {...c, meGusta: !c.meGusta, likes: c.meGusta ? c.likes - 1 : c.likes + 1} : c)
          };
        }
      });
    };

    const renderComentarios = (comId) => {
      const comentarios = comentariosUI[comId] || [];
      return (
        <div style={{marginTop: '15px', paddingTop: '15px', borderTop: '1px solid var(--borde-suave)'}}>
          <h6 style={{margin: '0 0 12px 0', fontSize: '13px', fontWeight: '700', color: 'var(--texto-principal)'}}>💬 Comentarios ({comentarios.length})</h6>
          
          {/* Formulario de comentario */}
          <div style={{display: 'flex', gap: '8px', marginBottom: '12px'}}>
            <input
              type="text"
              placeholder="Escribe un comentario..."
              value={formComentario[comId] || ''}
              onChange={e => setFormComentario(prev => ({...prev, [comId]: e.target.value}))}
              onKeyPress={e => e.key === 'Enter' && addComentario(comId, formComentario[comId] || '')}
              style={{flex: 1, padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--borde-suave)', fontSize: '13px'}}
            />
            <button
              onClick={() => addComentario(comId, formComentario[comId] || '')}
              style={{padding: '8px 12px', background: 'var(--azul-electrico)', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: '700'}}
            >
              ↩️
            </button>
          </div>

          {/* Lista de comentarios */}
          <div style={{display: 'flex', flexDirection: 'column', gap: '10px'}}>
            {comentarios.map(com => (
              <div key={com.id} style={{background: 'rgba(0,0,0,0.02)', padding: '10px', borderRadius: '6px', borderLeft: '2px solid var(--azul-electrico)'}}>
                <div style={{display: 'flex', gap: '8px', marginBottom: '6px'}}>
                  <span style={{fontSize: '18px'}}>{com.avatar}</span>
                  <div style={{flex: 1}}>
                    <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                      <span style={{fontWeight: '700', fontSize: '13px', color: 'var(--texto-principal)'}}>{com.usuario}</span>
                      <span style={{fontSize: '11px', color: 'var(--texto-secundario)'}}>{com.timestamp}</span>
                    </div>
                    <p style={{margin: '4px 0 0 0', fontSize: '13px', color: 'var(--texto-principal)', lineHeight: '1.4'}}>{com.texto}</p>
                  </div>
                </div>
                
                <div style={{display: 'flex', gap: '10px', fontSize: '12px'}}>
                  <button
                    onClick={() => likeComentario(comId, com.id)}
                    style={{background: 'none', border: 'none', cursor: 'pointer', color: com.meGusta ? '#FF3B30' : 'var(--texto-secundario)', fontWeight: com.meGusta ? '700' : '500'}}
                  >
                    ❤️ {com.likes > 0 ? com.likes : ''}
                  </button>
                  <button
                    onClick={() => setMostrarFormComentario(prev => ({...prev, [`${comId}_resp_${com.id}`]: !prev[`${comId}_resp_${com.id}`]}))}
                    style={{background: 'none', border: 'none', cursor: 'pointer', color: 'var(--texto-secundario)'}}
                  >
                    💬 Responder
                  </button>
                </div>

                {/* Respuestas */}
                {com.respuestas && com.respuestas.length > 0 && (
                  <div style={{marginTop: '10px', paddingLeft: '20px', borderLeft: '1px solid var(--borde-suave)'}}>
                    {com.respuestas.map(resp => (
                      <div key={resp.id} style={{background: 'rgba(0,122,255,0.03)', padding: '8px', borderRadius: '4px', marginBottom: '6px'}}>
                        <div style={{display: 'flex', gap: '6px', marginBottom: '4px'}}>
                          <span style={{fontSize: '16px'}}>{resp.avatar}</span>
                          <div style={{flex: 1}}>
                            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                              <span style={{fontWeight: '700', fontSize: '12px'}}>{resp.usuario}</span>
                              <span style={{fontSize: '10px', color: 'var(--texto-secundario)'}}>{resp.timestamp}</span>
                            </div>
                            <p style={{margin: '2px 0 0 0', fontSize: '12px', lineHeight: '1.3'}}>{resp.texto}</p>
                          </div>
                        </div>
                        <button
                          onClick={() => likeComentario(comId, resp.id, com.id)}
                          style={{background: 'none', border: 'none', cursor: 'pointer', color: resp.meGusta ? '#FF3B30' : 'var(--texto-secundario)', fontSize: '11px', fontWeight: resp.meGusta ? '700' : '500'}}
                        >
                          ❤️ {resp.likes > 0 ? resp.likes : ''}
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Formulario de respuesta */}
                {mostrarFormComentario[`${comId}_resp_${com.id}`] && (
                  <div style={{marginTop: '10px', display: 'flex', gap: '8px', paddingLeft: '20px'}}>
                    <input
                      type="text"
                      placeholder={`Responder a ${com.usuario}...`}
                      value={formComentario[`${comId}_resp_${com.id}`] || ''}
                      onChange={e => setFormComentario(prev => ({...prev, [`${comId}_resp_${com.id}`]: e.target.value}))}
                      onKeyPress={e => e.key === 'Enter' && (addComentario(comId, formComentario[`${comId}_resp_${com.id}`] || '', com.id), setMostrarFormComentario(prev => ({...prev, [`${comId}_resp_${com.id}`]: false})))}
                      style={{flex: 1, padding: '6px 8px', borderRadius: '4px', border: '1px solid var(--borde-suave)', fontSize: '12px'}}
                    />
                    <button
                      onClick={() => (addComentario(comId, formComentario[`${comId}_resp_${com.id}`] || '', com.id), setMostrarFormComentario(prev => ({...prev, [`${comId}_resp_${com.id}`]: false})))}
                      style={{padding: '6px 10px', background: 'var(--azul-electrico)', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', fontWeight: '700'}}
                    >
                      ↩️
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      );
    };

    return (
      <div className="mt-20">
        {/* ADMIN: Botón para crear comunicación */}
        {rolUsuario === 'admin' && (
          <button onClick={() => setMostrarFormComunicaciones(!mostrarFormComunicaciones)} className="btn-electric" style={{width: '100%', padding: '12px', marginBottom: '15px', borderRadius: '8px', border: 'none', color: 'white', fontWeight: '700', cursor: 'pointer', fontSize: '14px'}}>
            📢 {mostrarFormComunicaciones ? 'Cerrar' : 'Nueva Comunicación'}
          </button>
        )}

        {/* Mostrar formulario si está activo */}
        {mostrarFormComunicaciones && renderFormularioComunicaciones()}

        {/* PREMIUM UPGRADE: MENÚ INVITADO / VISITA */}
        {rolUsuario === 'visita' && (
          <div className="card mb-20 fade-in panel-surface" style={{background: 'linear-gradient(135deg, var(--azul-marino), #1a2a42)', color: 'white', border: 'none'}}>
            <h4 style={{margin: '0 0 10px 0', display: 'flex', alignItems: 'center', gap: '8px'}}><FileDown size={18}/> Fixture y Documentos</h4>
            <p style={{fontSize: '12px', color: 'rgba(255,255,255,0.7)'}}>Descarga las bases del torneo y revisa los horarios oficiales de tu equipo.</p>
            <button className="btn-secondary mt-10" style={{background: 'rgba(255,255,255,0.1)', color: 'white'}}>Descargar PDF Bases 2026</button>
          </div>
        )}

        <div className="segment-control mb-20">
          <div className={`segment-btn ${vistaMuro === 'noticias' ? 'active' : ''}`} onClick={() => setVistaMuro('noticias')}>
            📢 Comunicaciones
          </div>
          <div className={`segment-btn ${vistaMuro === 'resultados' ? 'active' : ''}`} onClick={() => setVistaMuro('resultados')}>
            🏆 Resultados
          </div>
          <div className={`segment-btn ${vistaMuro === 'encuestas' ? 'active' : ''}`} onClick={() => setVistaMuro('encuestas')}>
            📊 Encuestas
          </div>
        </div>

        {vistaMuro === 'noticias' ? (
          <>
            {alertasPublicadas.map((alerta, i) => (
              <div key={i} className="card citacion-card fade-in" style={{borderColor: '#FF3B30', background: '#fff0f0'}}>
                  <div className="citacion-header">
                    <span className="badge-urgente" style={{backgroundColor: '#FF3B30'}}>
                      <ShieldAlert size={12}/> ALERTA DEL CLUB
                    </span>
                  </div>
                  <h4 style={{color: '#FF3B30', margin:0}}>{alerta}</h4>
              </div>
            ))}
            
            {/* CITACIÓN DEL JUGADOR */}
            {(rolUsuario === 'jugador' || rolUsuario === 'visita') && (
              <div className="card citacion-card fade-in">
                <div className="citacion-header">
                  <span className="badge-urgente">ACCIÓN REQUERIDA</span>
                </div>
                <h4 className="titulo-citacion">🏀 Convocatoria Oficial</h4>
                <div className="info-citacion">
                  <p><strong>Rival:</strong> {rolUsuario === 'visita' ? 'Local CCF' : 'Sportiva Italiana'}</p>
                  <p><strong>Fecha:</strong> Sábado 10:00 hrs</p>
                  <p className="ubicacion-texto"><MapPin size={14}/> Gimnasio Arlegui, Viña del Mar</p>
                </div>

                {!respuestaCitacion ? (
                  <div className="botones-asistencia mt-10">
                    <button className="btn-confirmar" onClick={() => setRespuestaCitacion('confirmada')}>Confirmar Asistencia</button>
                    <button className="btn-ausente" onClick={() => setRespuestaCitacion('ausente')}>Avisar Ausencia</button>
                  </div>
                ) : respuestaCitacion === 'confirmada' ? (
                  <div className="asistencia-confirmada mt-10">
                    <div className="mensaje-exito"><CheckCircle size={18}/> Asistencia Confirmada</div>
                    {rolUsuario !== 'visita' && (
                      <div className="transporte-selector mt-10">
                        <label>Logística de Transporte:</label>
                        <select className="form-input mt-5">
                          <option>Llego directo a la cancha</option>
                          <option>Necesito un cupo en auto</option>
                          <option>🚗 Ofrezco 1 cupo en auto</option>
                        </select>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="asistencia-ausente mt-10">
                    <span className="mensaje-error"><XSquare size={18}/> Ausencia Informada.</span>
                    <p style={{fontSize: '12px', marginTop: '5px'}}>El cuerpo técnico ha sido notificado.</p>
                  </div>
                )}
              </div>
            )}

            {/* MURO DE COMUNICACIONES MEJORADO */}
            {comunicaciones.map(c => (
              <div key={c.id} className="ios-rrss-card fade-in" style={{borderLeft: `4px solid ${c.urgencia === 'Crítica' ? '#8B0000' : c.urgencia === 'Alta' ? '#FF3B30' : c.urgencia === 'Media' ? '#FF9500' : '#34C759'}`}}>
                <div className="ios-rrss-header" style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px'}}>
                  <div style={{display: 'flex', gap: '8px', alignItems: 'center'}}>
                    <span className={`badge-tipo`} style={{background: c.urgencia === 'Crítica' ? '#8B0000' : c.urgencia === 'Alta' ? '#FF3B30' : c.urgencia === 'Media' ? '#FF9500' : '#34C759', color: 'white', padding: '4px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '700'}}>
                      {c.TIPO_COMUNICADO}
                    </span>
                    {c.rama !== 'General' && <span style={{fontSize: '11px', background: 'rgba(0,0,0,0.1)', padding: '2px 6px', borderRadius: '3px'}}>{c.rama}</span>}
                    {c.categoria !== 'General' && <span style={{fontSize: '11px', background: 'rgba(0,0,0,0.1)', padding: '2px 6px', borderRadius: '3px'}}>{c.categoria}</span>}
                  </div>
                  <span className="fecha-comunicado">{c.FECHA}</span>
                </div>

                <h4 className="titulo-comunicado" style={{marginBottom: '8px', color: 'var(--texto-principal)', fontWeight: '800', fontSize: '16px'}}>
                  {c.TIPO_COMUNICADO === 'Evento' ? '🎉' : c.TIPO_COMUNICADO === 'Asamblea' ? '📋' : c.TIPO_COMUNICADO === 'Suspensión' ? '⚠️' : '📢'} {c.TITULO}
                </h4>
                <p className="ios-rrss-body">{c.CUERPO_TEXTO}</p>

                {/* Panel de RSVP si se solicita asistencia */}
                {c.solicita_asistencia && (
                  <div style={{background: 'rgba(0, 122, 255, 0.08)', padding: '10px', borderRadius: '8px', marginBottom: '12px', marginTop: '10px'}}>
                    <p style={{margin: '0 0 8px 0', fontSize: '12px', fontWeight: '600', color: 'var(--texto-principal)'}}>¿Vas a asistir?</p>
                    <div style={{display: 'flex', gap: '8px'}}>
                      <button onClick={() => addRSVP(c.id, 'si')} className="btn-confirmar" style={{flex: 1, padding: '8px', fontSize: '13px', borderRadius: '6px', border: 'none', background: '#34C759', color: 'white', cursor: 'pointer', fontWeight: '600'}}>
                        ✓ Sí
                      </button>
                      <button onClick={() => addRSVP(c.id, 'no')} className="btn-ausente" style={{flex: 1, padding: '8px', fontSize: '13px', borderRadius: '6px', border: 'none', background: '#FF3B30', color: 'white', cursor: 'pointer', fontWeight: '600'}}>
                        ✕ No
                      </button>
                      <button onClick={() => addRSVP(c.id, 'quizas')} style={{flex: 1, padding: '8px', fontSize: '13px', borderRadius: '6px', border: '1px solid var(--borde-suave)', background: 'var(--blanco-tarjeta)', color: 'var(--texto-principal)', cursor: 'pointer', fontWeight: '600'}}>
                        ❓ Quiz
                      </button>
                    </div>
                  </div>
                )}

                {/* Reacciones */}
                <div style={{display: 'flex', gap: '4px', flexWrap: 'wrap', marginBottom: '10px', paddingBottom: '10px', borderBottom: '1px solid var(--borde-suave)'}}>
                  {emojisReacciones.map(emoji => (
                    <button key={emoji} onClick={() => addReaccion(c.id, emoji)} style={{padding: '6px 12px', borderRadius: '20px', background: Object.keys(c.reacciones || {}).includes(emoji) ? 'rgba(0, 122, 255, 0.2)' : 'rgba(0,0,0,0.05)', border: 'none', cursor: 'pointer', fontSize: '16px', display: 'flex', alignItems: 'center', gap: '4px', transition: '0.2s'}}>
                      {emoji} {(c.reacciones || {})[emoji] > 0 && <span style={{fontSize: '11px', fontWeight: '700'}}>{(c.reacciones || {})[emoji]}</span>}
                    </button>
                  ))}
                </div>

                {/* Asistencias confirmadas */}
                {c.asistencias && c.asistencias.length > 0 && (
                  <div style={{fontSize: '12px', color: 'var(--texto-secundario)', marginTop: '8px', padding: '8px', background: 'rgba(0,0,0,0.02)', borderRadius: '6px'}}>
                    ✓ <strong>{c.asistencias.filter(a => a.respuesta === 'si').length}</strong> confirmados • 
                    <strong>{c.asistencias.filter(a => a.respuesta === 'no').length}</strong> rechazaron
                  </div>
                )}

                {/* Sección de comentarios */}
                {renderComentarios(c.id)}
              </div>
            ))}
          </>
        ) : vistaMuro === 'encuestas' ? (
          <div className="fade-in">
            <h4 style={{color: 'var(--texto-heading)', marginBottom: '15px'}}>📊 Encuestas y Sondeos</h4>
            {encuestas.map(enc => {
              const totalVotos = Object.values(enc.votos).reduce((a, b) => a + b, 0);
              return (
                <div key={enc.id} className="card mb-15" style={{padding: '15px', background: 'linear-gradient(135deg, rgba(52, 199, 89, 0.05), rgba(0, 122, 255, 0.05))'}}>
                  <h5 style={{color: 'var(--texto-principal)', margin: '0 0 15px 0', fontWeight: '700'}}>{enc.titulo}</h5>
                  {enc.opciones.map(opcion => {
                    const votos = enc.votos[opcion] || 0;
                    const porcentaje = totalVotos > 0 ? (votos / totalVotos) * 100 : 0;
                    return (
                      <div key={opcion} style={{marginBottom: '12px'}}>
                        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px'}}>
                          <span style={{fontSize: '13px', fontWeight: '500'}}>{opcion}</span>
                          <span style={{fontSize: '12px', color: 'var(--texto-secundario)', fontWeight: '600'}}>{votos} votos ({porcentaje.toFixed(0)}%)</span>
                        </div>
                        <div style={{width: '100%', height: '20px', background: 'rgba(0,0,0,0.08)', borderRadius: '10px', overflow: 'hidden'}}>
                          <div style={{width: `${porcentaje}%`, height: '100%', background: 'linear-gradient(90deg, #007AFF, #34C759)', transition: 'width 0.3s'}}></div>
                        </div>
                        {!enc.respondio && (
                          <button onClick={() => voteEncuesta(enc.id, opcion)} style={{marginTop: '6px', padding: '6px 10px', fontSize: '12px', background: 'var(--azul-electrico)', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', width: '100%'}}>
                            Votar por {opcion}
                          </button>
                        )}
                      </div>
                    );
                  })}
                  {enc.respondio && <p style={{margin: '10px 0 0 0', fontSize: '12px', color: '#34C759', fontWeight: '600'}}>✓ Ya has votado en esta encuesta</p>}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="mt-20 fade-in">
            <h4 className="rama-title femenina">🏀 Rama Femenina</h4>
            <ResultadosCards partidos={partidosPrueba.filter(p => p.rama === "Femenina")} />
            <h4 className="rama-title masculina mt-20">🏀 Rama Masculina</h4>
            <ResultadosCards partidos={partidosPrueba.filter(p => p.rama === "Masculina")} />
          </div>
        )}
      </div>
    );
  };

  // FASE 5: Funciones de Notificaciones, Búsqueda y Reportes
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

  const renderNotificaciones = () => {
    const notifAgrupadas = {
      comentario: notificaciones.filter(n => n.tipo === 'comentario'),
      rsvp: notificaciones.filter(n => n.tipo === 'rsvp'),
      comunicacion: notificaciones.filter(n => n.tipo === 'comunicacion')
    };

    return (
      <div style={{position: 'fixed', top: '90px', right: '15px', width: '320px', maxHeight: '400px', overflowY: 'auto', zIndex: 1000}}>
        {notificaciones.length === 0 ? (
          <div style={{padding: '20px', textAlign: 'center', color: 'var(--texto-secundario)', fontSize: '13px'}}>
            ✓ Sin notificaciones
          </div>
        ) : (
          notificaciones.map(notif => (
            <div
              key={notif.id}
              style={{
                background: 'var(--blanco-tarjeta)',
                border: '1px solid var(--borde-suave)',
                borderRadius: '8px',
                padding: '12px',
                marginBottom: '8px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                animation: 'slideIn 0.3s ease-out'
              }}
            >
              <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px'}}>
                <span style={{fontWeight: '700', fontSize: '13px', color: 'var(--texto-principal)'}}>
                  {notif.tipo === 'comentario' ? '💬' : notif.tipo === 'rsvp' ? '✓' : notif.tipo === 'comunicacion' ? '📢' : '🔔'} {notif.titulo}
                </span>
                <button onClick={() => setNotificaciones(notifs => notifs.filter(n => n.id !== notif.id))} style={{background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px'}}>✕</button>
              </div>
              <p style={{margin: '0', fontSize: '12px', color: 'var(--texto-secundario)', lineHeight: '1.3'}}>{notif.descripcion}</p>
            </div>
          ))
        )}
        <style>{`@keyframes slideIn { from { transform: translateX(350px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }`}</style>
      </div>
    );
  };

  const renderBusqueda = () => {
    return (
      <div className="card fade-in" style={{background: 'linear-gradient(135deg, rgba(0, 122, 255, 0.05), rgba(52, 199, 89, 0.05))', marginBottom: '20px'}}>
        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px'}}>
          <h4 style={{margin: 0, color: 'var(--texto-heading)', fontSize: '16px', fontWeight: '700'}}>🔍 Búsqueda Global</h4>
          <button onClick={() => setMostrarBusqueda(false)} style={{background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer'}}>✕</button>
        </div>

        <input
          type="text"
          placeholder="Buscar comunicaciones, comentarios, usuarios..."
          value={busquedaGlobal}
          onChange={e => {setBusquedaGlobal(e.target.value); buscarGlobal(e.target.value);}}
          style={{width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--borde-suave)', marginBottom: '12px', fontSize: '13px'}}
        />

        {resultadosBusqueda.comunicaciones.length > 0 && (
          <div style={{marginBottom: '12px'}}>
            <h6 style={{margin: '0 0 8px 0', fontSize: '12px', fontWeight: '700', color: 'var(--azul-electrico)'}}>📢 Comunicaciones ({resultadosBusqueda.comunicaciones.length})</h6>
            {resultadosBusqueda.comunicaciones.map(c => (
              <div key={c.id} style={{background: 'rgba(0,0,0,0.02)', padding: '8px', borderRadius: '4px', marginBottom: '6px', fontSize: '12px', cursor: 'pointer'}} onClick={() => setMostrarBusqueda(false)}>
                <strong>{c.TITULO}</strong>
                <p style={{margin: '4px 0 0 0', fontSize: '11px', color: 'var(--texto-secundario)'}}>{c.CUERPO_TEXTO.substring(0, 60)}...</p>
              </div>
            ))}
          </div>
        )}

        {resultadosBusqueda.comentarios.length > 0 && (
          <div style={{marginBottom: '12px'}}>
            <h6 style={{margin: '0 0 8px 0', fontSize: '12px', fontWeight: '700', color: 'var(--azul-electrico)'}}>💬 Comentarios ({resultadosBusqueda.comentarios.length})</h6>
            {resultadosBusqueda.comentarios.slice(0, 3).map((c, i) => (
              <div key={i} style={{background: 'rgba(0,0,0,0.02)', padding: '8px', borderRadius: '4px', marginBottom: '6px', fontSize: '12px', cursor: 'pointer'}} onClick={() => setMostrarBusqueda(false)}>
                <strong>{c.usuario}</strong> {c.esRespuesta && '(respuesta)'}
                <p style={{margin: '4px 0 0 0', fontSize: '11px', color: 'var(--texto-secundario)'}}>{c.texto.substring(0, 60)}...</p>
              </div>
            ))}
          </div>
        )}

        {resultadosBusqueda.usuarios.length > 0 && (
          <div>
            <h6 style={{margin: '0 0 8px 0', fontSize: '12px', fontWeight: '700', color: 'var(--azul-electrico)'}}>👥 Usuarios ({resultadosBusqueda.usuarios.length})</h6>
            <div style={{display: 'flex', gap: '6px', flexWrap: 'wrap'}}>
              {resultadosBusqueda.usuarios.map(u => (
                <span key={u} style={{background: 'var(--azul-electrico)', color: 'white', padding: '4px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: '600'}}>@{u}</span>
              ))}
            </div>
          </div>
        )}

        {busquedaGlobal.trim() && resultadosBusqueda.comunicaciones.length === 0 && resultadosBusqueda.comentarios.length === 0 && resultadosBusqueda.usuarios.length === 0 && (
          <p style={{textAlign: 'center', color: 'var(--texto-secundario)', fontSize: '12px', margin: 0}}>Sin resultados para "{busquedaGlobal}"</p>
        )}
      </div>
    );
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

  const renderHistorialNotificaciones = () => {
    const notifFiltradas = historialNotificaciones.filter(n => {
      const diasAtras = (new Date() - n.timestamp) / (1000 * 60 * 60 * 24);
      if(filtroReporteFecha === 'semana') return diasAtras <= 7;
      if(filtroReporteFecha === 'mes') return diasAtras <= 30;
      return true;
    });

    return (
      <div style={{position: 'fixed', top: '90px', left: '50%', transform: 'translateX(-50%)', width: '90%', maxWidth: '500px', maxHeight: '600px', background: 'var(--blanco-tarjeta)', borderRadius: '16px', boxShadow: '0 15px 40px rgba(0,0,0,0.3)', zIndex: 999, padding: '20px', border: '1px solid rgba(0,0,0,0.05)', overflowY: 'auto'}}>
        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px'}}>
          <h4 style={{margin: 0, color: 'var(--texto-heading)', fontSize: '16px', fontWeight: '700'}}>📜 Historial de Notificaciones</h4>
          <button onClick={() => setMostrarHistorialNotif(false)} style={{background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer'}}>✕</button>
        </div>

        <div style={{display: 'flex', gap: '6px', marginBottom: '12px'}}>
          {['semana', 'mes', 'todos'].map(f => (
            <button key={f} onClick={() => setFiltroReporteFecha(f)} style={{padding: '6px 10px', borderRadius: '6px', border: filtroReporteFecha === f ? 'none' : '1px solid var(--borde-suave)', background: filtroReporteFecha === f ? 'var(--azul-electrico)' : 'var(--blanco-tarjeta)', color: filtroReporteFecha === f ? 'white' : 'var(--texto-principal)', fontSize: '11px', fontWeight: '600', cursor: 'pointer'}}>
              {f === 'semana' ? '📅 Semana' : f === 'mes' ? '📆 Mes' : '🕐 Todo'}
            </button>
          ))}
        </div>

        <div style={{display: 'flex', flexDirection: 'column', gap: '8px'}}>
          {notifFiltradas.length === 0 ? (
            <p style={{textAlign: 'center', color: 'var(--texto-secundario)', fontSize: '12px'}}>Sin notificaciones</p>
          ) : (
            notifFiltradas.map(notif => (
              <div key={notif.id} style={{background: 'rgba(0,0,0,0.02)', padding: '10px', borderRadius: '6px', borderLeft: '3px solid var(--azul-electrico)'}}>
                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px'}}>
                  <span style={{fontWeight: '700', fontSize: '13px', color: 'var(--texto-principal)'}}>{notif.titulo}</span>
                  <span style={{fontSize: '10px', color: 'var(--texto-secundario)'}}>
                    {notif.timestamp.toLocaleTimeString('es-CL', {hour: '2-digit', minute: '2-digit'})}
                  </span>
                </div>
                <p style={{margin: '0', fontSize: '12px', color: 'var(--texto-secundario)', lineHeight: '1.3'}}>{notif.descripcion}</p>
              </div>
            ))
          )}
        </div>
      </div>
    );
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

  const renderTimelineActividad = () => {
    const horas = Array.from({length: 24}, (_, i) => ({
      hora: `${i.toString().padStart(2, '0')}:00`,
      // Curva estable con pico vespertino para evitar datos aleatorios en cada render.
      cantidad: Math.max(1, Math.round(6 + (Math.sin((i - 5) * 0.55) + 1) * 4 + (i >= 18 && i <= 22 ? 5 : 0)))
    }));
    const maxCantidad = Math.max(...horas.map(h => h.cantidad), 1);
    
    return (
      <div style={{background: 'var(--blanco-tarjeta)', borderRadius: '12px', padding: '15px', marginTop: '15px'}}>
        <h6 style={{margin: '0 0 12px 0', fontSize: '13px', fontWeight: '700', color: 'var(--texto-principal)'}}>📅 Últimas 24 Horas</h6>
        <div style={{display: 'flex', alignItems: 'flex-end', gap: '4px', height: '150px'}}>
          {horas.map((h, i) => (
            <div key={i} style={{flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px'}}>
              <div style={{width: '100%', background: 'linear-gradient(180deg, var(--azul-electrico) 0%, rgba(0,122,255,0.3) 100%)', height: `${(h.cantidad / maxCantidad) * 130}px`, borderRadius: '4px', cursor: 'pointer', transition: 'all 0.2s'}} title={h.cantidad + ' acciones'}></div>
              {i % 3 === 0 && <span style={{fontSize: '9px', color: 'var(--texto-secundario)', fontWeight: '500'}}>{h.hora}</span>}
            </div>
          ))}
        </div>
        <p style={{margin: '12px 0 0 0', fontSize: '11px', color: 'var(--texto-secundario)', textAlign: 'center'}}>📈 Pico de actividad: 20:00 - 22:30 hrs (Tarde)</p>
      </div>
    );
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

  const renderPushNotificacion = () => {
    if (pushNotificaciones.length === 0) return null;

    const push = pushNotificaciones[pushNotificaciones.length - 1];
    const colorUrgencia = push.urgencia === 'Crítica' ? '#FF3B30' : 
                          push.urgencia === 'Alta' ? '#FF9500' : 
                          push.urgencia === 'Media' ? '#FFD60A' : '#34C759';

    return (
      <div style={{
        position: 'fixed',
        top: '70px',
        right: '15px',
        width: '320px',
        background: 'var(--blanco-tarjeta)',
        borderRadius: '12px',
        boxShadow: '0 10px 30px rgba(0,0,0,0.2)',
        padding: '15px',
        borderLeft: `4px solid ${colorUrgencia}`,
        zIndex: 1000,
        animation: 'slideInRight 0.4s ease',
        '@keyframes slideInRight': {
          from: { transform: 'translateX(350px)', opacity: 0 },
          to: { transform: 'translateX(0)', opacity: 1 }
        }
      }}>
        <div style={{display: 'flex', alignItems: 'flex-start', gap: '10px'}}>
          <span style={{fontSize: '20px', marginTop: '2px'}}>
            {push.tipo === 'alerta' ? '🚨' : push.tipo === 'comunicacion' ? '💬' : push.tipo === 'pago' ? '💳' : '📨'}
          </span>
          <div style={{flex: 1}}>
            <h6 style={{margin: '0 0 4px 0', fontSize: '13px', fontWeight: '700', color: 'var(--texto-principal)'}}>{
              push.titulo
            }</h6>
            <p style={{margin: '0 0 8px 0', fontSize: '12px', color: 'var(--texto-secundario)', lineHeight: '1.4'}}>
              {push.descripcion}
            </p>
            <div style={{display: 'flex', gap: '8px', fontSize: '10px', color: 'var(--texto-secundario)'}}>
              <span>🕐 {push.timestamp.toLocaleTimeString('es-CL', {hour: '2-digit', minute: '2-digit'})}</span>
              <span style={{color: colorUrgencia, fontWeight: '600'}}>● {push.urgencia}</span>
            </div>
          </div>
          <button onClick={() => setPushNotificaciones(prev => prev.filter(p => p.id !== push.id))} style={{
            background: 'none',
            border: 'none',
            fontSize: '16px',
            cursor: 'pointer',
            color: 'var(--texto-secundario)'
          }}>✕</button>
        </div>
      </div>
    );
  };

  const renderPreferenciasPush = () => {
    return (
      <div className="card fade-in" style={{marginTop: '15px'}}>
        <h5 style={{margin: '0 0 15px 0', fontSize: '14px', fontWeight: '700', color: 'var(--texto-principal)'}}>🔔 Preferencias de Notificaciones Push</h5>
        
        <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', paddingBottom: '12px', borderBottom: '1px solid var(--borde-suave)'}}>
          <label style={{fontSize: '12px', fontWeight: '600', color: 'var(--texto-principal)'}}>Habilitar Notificaciones</label>
          <button onClick={() => setPreferenciasSonido({...preferenciasSonido, habilitado: !preferenciasSonido.habilitado})} style={{
            padding: '6px 12px',
            borderRadius: '20px',
            border: 'none',
            background: preferenciasSonido.habilitado ? 'var(--azul-electrico)' : 'var(--borde-suave)',
            color: preferenciasSonido.habilitado ? 'white' : 'var(--texto-principal)',
            fontSize: '11px',
            fontWeight: '600',
            cursor: 'pointer'
          }}>{
            preferenciasSonido.habilitado ? '✓ Activo' : 'Inactivo'
          }</button>
        </div>

        <div style={{marginBottom: '12px', paddingBottom: '12px', borderBottom: '1px solid var(--borde-suave)'}}>
          <label style={{fontSize: '12px', fontWeight: '600', color: 'var(--texto-principal)', display: 'block', marginBottom: '6px'}}>Sonido de Alerta</label>
          <select value={preferenciasSonido.sonidoAlerta} onChange={e => setPreferenciasSonido({...preferenciasSonido, sonidoAlerta: e.target.value})} style={{
            width: '100%',
            padding: '8px',
            borderRadius: '6px',
            border: '1px solid var(--borde-suave)',
            fontSize: '12px',
            background: 'var(--blanco-tarjeta)',
            color: 'var(--texto-principal)'
          }}>
            <option value="campana">🔔 Campana Clásica</option>
            <option value="tono">📱 Tono Moderno</option>
          </select>
          <button onClick={() => reproducirSonido(preferenciasSonido.sonidoAlerta)} style={{
            marginTop: '8px',
            padding: '6px 10px',
            borderRadius: '6px',
            border: '1px solid var(--borde-suave)',
            background: 'rgba(0,122,255,0.08)',
            color: 'var(--azul-electrico)',
            fontSize: '11px',
            fontWeight: '600',
            cursor: 'pointer',
            width: '100%'
          }}>🔊 Reproducir Preview</button>
        </div>

        <div style={{marginBottom: '12px', paddingBottom: '12px', borderBottom: '1px solid var(--borde-suave)'}}>
          <label style={{fontSize: '12px', fontWeight: '600', color: 'var(--texto-principal)', display: 'block', marginBottom: '6px'}}>Volumen ({preferenciasSonido.volumen}%)</label>
          <input type="range" min="0" max="100" value={preferenciasSonido.volumen} onChange={e => setPreferenciasSonido({...preferenciasSonido, volumen: parseInt(e.target.value)})} style={{
            width: '100%',
            cursor: 'pointer'
          }}/>
        </div>

        <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between'}}>
          <label style={{fontSize: '12px', fontWeight: '600', color: 'var(--texto-principal)'}}>Vibración</label>
          <button onClick={() => setPreferenciasSonido({...preferenciasSonido, vibración: !preferenciasSonido.vibración})} style={{
            padding: '6px 12px',
            borderRadius: '20px',
            border: 'none',
            background: preferenciasSonido.vibración ? '#34C759' : 'var(--borde-suave)',
            color: preferenciasSonido.vibración ? 'white' : 'var(--texto-principal)',
            fontSize: '11px',
            fontWeight: '600',
            cursor: 'pointer'
          }}>{
            preferenciasSonido.vibración ? '✓ Activo' : 'Inactivo'
          }</button>
        </div>
      </div>
    );
  };

  const renderHistorialPush = () => {
    return (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        background: 'rgba(0,0,0,0.5)',
        zIndex: 998,
        display: 'flex',
        alignItems: 'flex-end',
        animation: 'fadeIn 0.3s ease'
      }} onClick={() => setMostrarHistorialPush(false)}>
        <div style={{
          width: '100%',
          background: 'var(--blanco-tarjeta)',
          borderRadius: '24px 24px 0 0',
          padding: '20px',
          maxHeight: '80vh',
          overflowY: 'auto',
          animation: 'slideUp 0.4s ease'
        }} onClick={e => e.stopPropagation()}>
          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px'}}>
            <h4 style={{margin: 0, fontSize: '16px', fontWeight: '800', color: 'var(--texto-principal)'}}>📲 Historial de Push</h4>
            <button onClick={() => setMostrarHistorialPush(false)} style={{background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer'}}>✕</button>
          </div>

          {historialPushTotal.length === 0 ? (
            <p style={{textAlign: 'center', color: 'var(--texto-secundario)', fontSize: '13px'}}>Sin notificaciones aún</p>
          ) : (
            <div style={{display: 'flex', flexDirection: 'column', gap: '10px'}}>
              {historialPushTotal.slice().reverse().map(push => (
                <div key={push.id} style={{
                  background: push.leida ? 'rgba(0,0,0,0.01)' : 'rgba(0,122,255,0.05)',
                  padding: '12px',
                  borderRadius: '8px',
                  borderLeft: push.urgencia === 'Crítica' ? '4px solid #FF3B30' : 
                              push.urgencia === 'Alta' ? '4px solid #FF9500' : 
                              push.urgencia === 'Media' ? '4px solid #FFD60A' : '4px solid #34C759',
                  display: 'flex',
                  gap: '10px',
                  alignItems: 'flex-start'
                }}>
                  <span style={{fontSize: '18px', marginTop: '2px'}}>
                    {push.tipo === 'alerta' ? '🚨' : push.tipo === 'comunicacion' ? '💬' : push.tipo === 'pago' ? '💳' : '📨'}
                  </span>
                  <div style={{flex: 1}}>
                    <p style={{margin: '0 0 4px 0', fontSize: '12px', fontWeight: '700', color: 'var(--texto-principal)'}}>{push.titulo}</p>
                    <p style={{margin: '0 0 4px 0', fontSize: '11px', color: 'var(--texto-secundario)'}}>{push.descripcion}</p>
                    <span style={{fontSize: '10px', color: 'var(--texto-secundario)'}}>🕐 {push.timestamp.toLocaleTimeString('es-CL')}</span>
                  </div>
                  <div style={{display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px'}}>
                    <span style={{fontSize: '11px', fontWeight: '600', color: push.urgencia === 'Crítica' ? '#FF3B30' : push.urgencia === 'Alta' ? '#FF9500' : '#34C759'}}>● {push.urgencia}</span>
                    {!push.leida && <span style={{fontSize: '9px', background: 'var(--azul-electrico)', color: 'white', padding: '2px 6px', borderRadius: '3px', fontWeight: '600'}}>NUEVA</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
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

  const renderWhatsAppPanel = () => {
    return (
      <div className="floating-panel whatsapp-panel" style={{
        position: 'fixed',
        top: '90px',
        right: '15px',
        width: '380px',
        background: 'var(--blanco-tarjeta)',
        borderRadius: '16px',
        boxShadow: '0 10px 40px rgba(0,0,0,0.2)',
        zIndex: 997,
        padding: '20px',
        maxHeight: '80vh',
        overflowY: 'auto',
        animation: 'slideInRight 0.4s ease'
      }}>
        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px'}}>
          <h4 style={{margin: 0, fontSize: '16px', fontWeight: '800', color: 'var(--texto-principal)'}}>💬 WhatsApp</h4>
          <button onClick={() => setMostrarWhatsAppPanel(false)} style={{background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer'}}>✕</button>
        </div>

        <div style={{display: 'flex', gap: '6px', marginBottom: '15px', borderBottom: '1px solid var(--borde-suave)', paddingBottom: '12px'}}>
          <button onClick={() => setMostrarWhatsAppPanel('enviar')} style={{flex: 1, padding: '6px', borderRadius: '6px', background: 'rgba(52,199,89,0.2)', color: '#34C759', fontSize: '11px', fontWeight: '700', border: '1px solid #34C759', cursor: 'pointer'}}>📤 Enviar</button>
          <button onClick={() => setMostrarHistorialWA(true)} style={{flex: 1, padding: '6px', borderRadius: '6px', background: 'rgba(0,122,255,0.1)', color: 'var(--azul-electrico)', fontSize: '11px', fontWeight: '700', border: '1px solid rgba(0,122,255,0.3)', cursor: 'pointer'}}>📜 Historial</button>
          <button onClick={() => setMostrarWhatsAppPanel('contactos')} style={{flex: 1, padding: '6px', borderRadius: '6px', background: 'rgba(255,159,64,0.1)', color: '#FF9500', fontSize: '11px', fontWeight: '700', border: '1px solid rgba(255,159,64,0.3)', cursor: 'pointer'}}>👥 Contactos</button>
        </div>

        {mostrarWhatsAppPanel === 'enviar' && (
          <div style={{display: 'flex', flexDirection: 'column', gap: '10px'}}>
            <div>
              <label style={{fontSize: '11px', fontWeight: '700', color: 'var(--texto-principal)', display: 'block', marginBottom: '4px'}}>Destinatario</label>
              <select style={{
                width: '100%',
                padding: '8px',
                borderRadius: '6px',
                border: '1px solid var(--borde-suave)',
                fontSize: '12px',
                background: 'var(--blanco-tarjeta)',
                color: 'var(--texto-principal)'
              }} onChange={e => setPhoneNumberToValidate(e.target.value)}>
                <option value="">-- Seleccionar --</option>
                {contactosWhatsApp.filter(c => c.activo).map(c => (
                  <option key={c.id} value={c.numero}>{c.nombre} ({c.numero})</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{fontSize: '11px', fontWeight: '700', color: 'var(--texto-principal)', display: 'block', marginBottom: '4px'}}>Tipo de Mensaje</label>
              <select value={templateMensaje} onChange={e => setTemplateMensaje(e.target.value)} style={{
                width: '100%',
                padding: '8px',
                borderRadius: '6px',
                border: '1px solid var(--borde-suave)',
                fontSize: '12px',
                background: 'var(--blanco-tarjeta)',
                color: 'var(--texto-principal)'
              }}>
                <option value="alerta">🚨 Alerta Crítica</option>
                <option value="pago">💳 Confirmación Pago</option>
                <option value="confirmacion">✅ Confirmación General</option>
                <option value="general">📝 Personalizado</option>
              </select>
            </div>

            {templateMensaje === 'general' && (
              <div>
                <label style={{fontSize: '11px', fontWeight: '700', color: 'var(--texto-principal)', display: 'block', marginBottom: '4px'}}>Tu Mensaje</label>
                <textarea value={mensajeCustomWA} onChange={e => setMensajeCustomWA(e.target.value)} placeholder="Escribe tu mensaje..." style={{
                  width: '100%',
                  padding: '8px',
                  borderRadius: '6px',
                  border: '1px solid var(--borde-suave)',
                  fontSize: '12px',
                  background: 'var(--blanco-tarjeta)',
                  color: 'var(--texto-principal)',
                  minHeight: '80px',
                  fontFamily: 'inherit',
                  resize: 'vertical'
                }}/>
              </div>
            )}

            {templateMensaje !== 'general' && (
              <div style={{
                background: 'rgba(0,0,0,0.02)',
                padding: '10px',
                borderRadius: '8px',
                fontSize: '11px',
                color: 'var(--texto-principal)',
                lineHeight: '1.5',
                whiteSpace: 'pre-wrap',
                fontFamily: 'monospace'
              }}>
                {obtenerTemplateWhatsApp(templateMensaje, { alertas: 2, monto: 45000, fecha: '09/07/2026' })}
              </div>
            )}

            <button onClick={() => {
              if (!phoneNumberToValidate) {
                alert('Selecciona un destinatario');
                return;
              }
              enviarPorWhatsApp(phoneNumberToValidate, obtenerTemplateWhatsApp(templateMensaje, { alertas: 2, monto: 45000, fecha: '09/07/2026' }), templateMensaje);
              setPhoneNumberToValidate('');
              setMensajeCustomWA('');
              setMostrarWhatsAppPanel(false);
            }} style={{
              padding: '10px',
              borderRadius: '6px',
              border: 'none',
              background: '#34C759',
              color: 'white',
              fontSize: '12px',
              fontWeight: '700',
              cursor: 'pointer'
            }}>✓ Enviar por WhatsApp</button>
          </div>
        )}

        {mostrarWhatsAppPanel === 'contactos' && (
          <div style={{display: 'flex', flexDirection: 'column', gap: '10px'}}>
            <h5 style={{margin: '0 0 8px 0', fontSize: '13px', fontWeight: '700', color: 'var(--texto-principal)'}}>Gestionar Contactos</h5>
            
            <div>
              <input type="text" placeholder="Nombre" value={nuevoContactoWA.nombre} onChange={e => setNuevoContactoWA({...nuevoContactoWA, nombre: e.target.value})} style={{
                width: '100%',
                padding: '8px',
                borderRadius: '6px',
                border: '1px solid var(--borde-suave)',
                fontSize: '12px',
                marginBottom: '6px',
                background: 'var(--blanco-tarjeta)',
                color: 'var(--texto-principal)'
              }}/>
              <input type="text" placeholder="Número (+56 o 9XXXX)" value={nuevoContactoWA.numero} onChange={e => setNuevoContactoWA({...nuevoContactoWA, numero: e.target.value})} style={{
                width: '100%',
                padding: '8px',
                borderRadius: '6px',
                border: '1px solid var(--borde-suave)',
                fontSize: '12px',
                marginBottom: '6px',
                background: 'var(--blanco-tarjeta)',
                color: 'var(--texto-principal)'
              }}/>
              <button onClick={agregarContactoWhatsApp} style={{
                width: '100%',
                padding: '8px',
                borderRadius: '6px',
                border: 'none',
                background: 'rgba(52,199,89,0.2)',
                color: '#34C759',
                fontSize: '11px',
                fontWeight: '700',
                cursor: 'pointer'
              }}>+ Agregar Contacto</button>
            </div>

            <div style={{marginTop: '10px', borderTop: '1px solid var(--borde-suave)', paddingTop: '10px'}}>
              {contactosWhatsApp.map(c => (
                <div key={c.id} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '8px',
                  background: 'rgba(0,0,0,0.02)',
                  borderRadius: '6px',
                  marginBottom: '6px',
                  fontSize: '11px'
                }}>
                  <div>
                    <p style={{margin: '0 0 2px 0', fontWeight: '700', color: 'var(--texto-principal)'}}>{c.nombre}</p>
                    <p style={{margin: 0, fontSize: '10px', color: 'var(--texto-secundario)'}}>{c.numero}</p>
                  </div>
                  <button onClick={() => eliminarContactoWhatsApp(c.id)} style={{
                    background: 'rgba(255,59,48,0.2)',
                    border: '1px solid rgba(255,59,48,0.3)',
                    color: '#FF3B30',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    fontSize: '10px',
                    fontWeight: '700',
                    cursor: 'pointer'
                  }}>Eliminar</button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderHistorialWhatsApp = () => {
    return (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        background: 'rgba(0,0,0,0.5)',
        zIndex: 996,
        display: 'flex',
        alignItems: 'flex-end',
        animation: 'fadeIn 0.3s ease'
      }} onClick={() => setMostrarHistorialWA(false)}>
        <div style={{
          width: '100%',
          background: 'var(--blanco-tarjeta)',
          borderRadius: '24px 24px 0 0',
          padding: '20px',
          maxHeight: '80vh',
          overflowY: 'auto',
          animation: 'slideUp 0.4s ease'
        }} onClick={e => e.stopPropagation()}>
          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px'}}>
            <h4 style={{margin: 0, fontSize: '16px', fontWeight: '800', color: 'var(--texto-principal)'}}>💬 Historial WhatsApp</h4>
            <button onClick={() => setMostrarHistorialWA(false)} style={{background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer'}}>✕</button>
          </div>

          <div style={{display: 'flex', flexDirection: 'column', gap: '10px'}}>
            {historialWhatsApp.slice().reverse().map(msg => (
              <div key={msg.id} style={{
                background: msg.tipo === 'salida' ? 'rgba(52,199,89,0.08)' : 'rgba(0,122,255,0.08)',
                padding: '12px',
                borderRadius: '8px',
                borderLeft: msg.tipo === 'salida' ? '4px solid #34C759' : '4px solid var(--azul-electrico)',
                display: 'flex',
                gap: '10px'
              }}>
                <span style={{fontSize: '16px'}}>{msg.tipo === 'salida' ? '📤' : '📥'}</span>
                <div style={{flex: 1}}>
                  <p style={{margin: '0 0 4px 0', fontSize: '12px', fontWeight: '700', color: 'var(--texto-principal)'}}>{msg.contacto}</p>
                  <p style={{margin: '0 0 4px 0', fontSize: '11px', color: 'var(--texto-principal)', lineHeight: '1.4'}}>{msg.mensaje}</p>
                  <div style={{display: 'flex', gap: '8px', fontSize: '10px', color: 'var(--texto-secundario)'}}>
                    <span>🕐 {msg.timestamp.toLocaleTimeString('es-CL', {hour: '2-digit', minute: '2-digit'})}</span>
                    <span style={{color: msg.estado === 'entregado' ? '#34C759' : '#FF9500'}}>✓ {msg.estado === 'entregado' ? 'Entregado' : 'Enviando'}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const renderDashboardSalud = () => {
    const scoreActual = calcularScoreDeCliente();
    const reportes = calcularReportes();
    
    return (
      <div>
        <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '15px'}}>
          <div className="card" style={{textAlign: 'center', background: 'linear-gradient(135deg, rgba(0,122,255,0.15), rgba(52,199,89,0.15))', borderTop: '3px solid var(--azul-electrico)'}}>
            <h6 style={{margin: '0 0 8px 0', fontSize: '11px', fontWeight: '600', color: 'var(--texto-secundario)'}}>🏥 SALUD DEL SISTEMA</h6>
            <div style={{fontSize: '48px', fontWeight: '900', color: 'var(--azul-electrico)'}}>
              {scoreActual}
            </div>
            <span style={{fontSize: '22px'}}>{saludDelSistema.emoji || '🟢'}</span>
            <p style={{margin: '6px 0 0 0', fontSize: '11px', color: 'var(--texto-principal)', fontWeight: '600'}}>
              {saludDelSistema.estado || 'Óptimo'}
            </p>
          </div>

          <div style={{display: 'grid', gridTemplateRows: '1fr 1fr', gap: '12px'}}>
            <div className="card" style={{padding: '10px', textAlign: 'center', background: 'rgba(0,122,255,0.05)', borderLeft: '3px solid var(--azul-electrico)'}}>
              <p style={{margin: '0 0 4px 0', fontSize: '10px', fontWeight: '600', color: 'var(--texto-secundario)'}}>👥 Socios Activos</p>
              <p style={{margin: 0, fontSize: '20px', fontWeight: '800', color: 'var(--azul-electrico)'}}>12/15</p>
            </div>
            <div className="card" style={{padding: '10px', textAlign: 'center', background: 'rgba(52,199,89,0.05)', borderLeft: '3px solid #34C759'}}>
              <p style={{margin: '0 0 4px 0', fontSize: '10px', fontWeight: '600', color: 'var(--texto-secundario)'}}>💬 Comunicaciones</p>
              <p style={{margin: 0, fontSize: '20px', fontWeight: '800', color: '#34C759'}}>{comunicaciones.length}</p>
            </div>
          </div>
        </div>

        <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '15px'}}>
          <div className="card" style={{padding: '10px', textAlign: 'center', background: 'rgba(255,159,64,0.05)', borderLeft: '3px solid #FF9500'}}>
            <p style={{margin: '0 0 4px 0', fontSize: '10px', fontWeight: '600', color: 'var(--texto-secundario)'}}>📊 Engagement Total</p>
            <p style={{margin: 0, fontSize: '20px', fontWeight: '800', color: '#FF9500'}}>
              {reportes.totalComentarios + reportes.totalReacciones}
            </p>
          </div>
          <div className="card" style={{padding: '10px', textAlign: 'center', background: 'rgba(255,59,48,0.05)', borderLeft: '3px solid #FF3B30'}}>
            <p style={{margin: '0 0 4px 0', fontSize: '10px', fontWeight: '600', color: 'var(--texto-secundario)'}}>⚠️ Alertas Activas</p>
            <p style={{margin: 0, fontSize: '20px', fontWeight: '800', color: '#FF3B30'}}>{alertas.length}</p>
          </div>
        </div>

        {renderTimelineActividad()}
      </div>
    );
  };

  const renderAlertasPanel = () => {
    return (
      <div style={{background: 'var(--blanco-tarjeta)', borderRadius: '12px', padding: '15px', marginTop: '15px'}}>
        <h6 style={{margin: '0 0 12px 0', fontSize: '13px', fontWeight: '700', color: 'var(--texto-principal)'}}>🚨 Alertas Inteligentes ({alertas.length})</h6>
        
        {alertas.length === 0 ? (
          <div style={{textAlign: 'center', padding: '20px'}}>
            <p style={{margin: 0, fontSize: '14px', color: 'var(--texto-secundario)'}}>✅ No hay alertas críticas</p>
          </div>
        ) : (
          <div style={{display: 'flex', flexDirection: 'column', gap: '10px'}}>
            {alertas.map(alerta => (
              <div key={alerta.id} style={{
                background: alerta.urgencia === 'Crítica' ? 'rgba(255,59,48,0.08)' : 
                            alerta.urgencia === 'Alta' ? 'rgba(255,159,64,0.08)' : 
                            'rgba(52,199,89,0.08)',
                borderLeft: alerta.urgencia === 'Crítica' ? '4px solid #FF3B30' : 
                           alerta.urgencia === 'Alta' ? '4px solid #FF9500' : 
                           '4px solid #34C759',
                padding: '12px',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '10px'
              }}>
                <span style={{fontSize: '18px', marginTop: '2px'}}>{
                  alerta.urgencia === 'Crítica' ? '🔴' : 
                  alerta.urgencia === 'Alta' ? '🟠' : '🟡'
                }</span>
                <div style={{flex: 1}}>
                  <p style={{margin: '0 0 4px 0', fontSize: '12px', fontWeight: '700', color: 'var(--texto-principal)'}}>
                    {alerta.titulo}
                  </p>
                  <p style={{margin: '0', fontSize: '11px', color: 'var(--texto-secundario)', lineHeight: '1.4'}}>
                    {alerta.descripcion}
                  </p>
                  <span style={{fontSize: '9px', color: 'var(--texto-secundario)', marginTop: '6px', display: 'block'}}>
                    {alerta.timestamp.toLocaleTimeString('es-CL', {hour: '2-digit', minute: '2-digit'})}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderReportes = () => {
    const reportes = calcularReportes();
    const totalEngagement = reportes.totalComentarios + reportes.totalReacciones + reportes.totalRSVP;

    return (
      <div className="mt-20">
        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px'}}>
          <h4 style={{color: 'var(--texto-heading)', margin: 0, fontSize: '18px', fontWeight: '800'}}>📊 Reportes de Actividad</h4>
          <div style={{display: 'flex', gap: '8px', flexWrap: 'wrap'}}>
            <button onClick={() => setMostrarHistorialNotif(true)} style={{padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--borde-suave)', background: 'var(--blanco-tarjeta)', color: 'var(--texto-principal)', fontSize: '12px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px'}}>
              📜 Historial
            </button>
            <button onClick={exportarReportePDF} style={{padding: '8px 12px', borderRadius: '6px', border: 'none', background: 'var(--azul-electrico)', color: 'white', fontSize: '12px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px'}}>
              📥 Exportar
            </button>
          </div>
        </div>

        <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '10px', marginBottom: '15px'}}>
          <select value={filtroReporteFecha} onChange={e => setFiltroReporteFecha(e.target.value)} style={{padding: '8px', borderRadius: '6px', border: '1px solid var(--borde-suave)', fontSize: '12px'}}>
            <option value="semana">📅 Esta semana</option>
            <option value="mes">📆 Este mes</option>
            <option value="todos">🕐 Todo el tiempo</option>
          </select>
          <select value={filtroReporteRama} onChange={e => setFiltroReporteRama(e.target.value)} style={{padding: '8px', borderRadius: '6px', border: '1px solid var(--borde-suave)', fontSize: '12px'}}>
            <option value="General">General</option>
            <option value="Femenina">Rama Femenina</option>
            <option value="Masculina">Rama Masculina</option>
          </select>
        </div>

        <div className="segment-control mb-20" style={{background: 'var(--blanco-tarjeta)', flexWrap: 'wrap', gap: '4px'}}>
          <div className={`segment-btn ${vistaReportes === 'engagement' ? 'active' : ''}`} onClick={() => setVistaReportes('engagement')} style={{flex: '1 1 150px'}}>
            📈 Engagement
          </div>
          <div className={`segment-btn ${vistaReportes === 'comentaristas' ? 'active' : ''}`} onClick={() => setVistaReportes('comentaristas')} style={{flex: '1 1 150px'}}>
            💬 Top Comentaristas
          </div>
          <div className={`segment-btn ${vistaReportes === 'comunicaciones-top' ? 'active' : ''}`} onClick={() => setVistaReportes('comunicaciones-top')} style={{flex: '1 1 150px'}}>
            🏆 Comunicaciones Top
          </div>
        </div>

        {vistaReportes === 'engagement' && (
          <div className="fade-in">
            {totalEngagement === 0 ? (
              <div className="card text-center" style={{padding: '24px 14px'}}>
                <h5 style={{margin: '0 0 8px 0', fontSize: '16px', color: 'var(--texto-principal)'}}>Sin datos de engagement aún</h5>
                <p style={{margin: 0, fontSize: '13px', color: 'var(--texto-secundario)'}}>
                  Publica comunicaciones o interactúa con reacciones/comentarios para ver métricas.
                </p>
              </div>
            ) : (
              <>
            <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '12px', marginBottom: '15px'}}>
              <div className="card" style={{background: 'linear-gradient(135deg, rgba(0, 122, 255, 0.1), rgba(0, 122, 255, 0.05))', borderLeft: '4px solid var(--azul-electrico)'}}>
                <h6 style={{margin: '0 0 6px 0', fontSize: '11px', fontWeight: '600', color: 'var(--texto-secundario)'}}>💬 Comentarios</h6>
                <h3 style={{margin: 0, fontSize: '28px', fontWeight: '800', color: 'var(--azul-electrico)'}}>{reportes.totalComentarios}</h3>
              </div>
              <div className="card" style={{background: 'linear-gradient(135deg, rgba(52, 199, 89, 0.1), rgba(52, 199, 89, 0.05))', borderLeft: '4px solid #34C759'}}>
                <h6 style={{margin: '0 0 6px 0', fontSize: '11px', fontWeight: '600', color: 'var(--texto-secundario)'}}>❤️ Reacciones</h6>
                <h3 style={{margin: 0, fontSize: '28px', fontWeight: '800', color: '#34C759'}}>{reportes.totalReacciones}</h3>
              </div>
              <div className="card" style={{background: 'linear-gradient(135deg, rgba(255, 159, 64, 0.1), rgba(255, 159, 64, 0.05))', borderLeft: '4px solid #FF9500'}}>
                <h6 style={{margin: '0 0 6px 0', fontSize: '11px', fontWeight: '600', color: 'var(--texto-secundario)'}}>✓ RSVP</h6>
                <h3 style={{margin: 0, fontSize: '28px', fontWeight: '800', color: '#FF9500'}}>{reportes.totalRSVP}</h3>
              </div>
            </div>

            <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '15px', marginBottom: '15px'}}>
              <div className="card" style={{textAlign: 'center'}}>
                <h6 style={{margin: '0 0 10px 0', fontSize: '12px', fontWeight: '700', color: 'var(--texto-principal)'}}>📊 Gráfico Pie</h6>
                {renderGraficoSVG('pie')}
              </div>
              <div className="card" style={{textAlign: 'center'}}>
                <h6 style={{margin: '0 0 10px 0', fontSize: '12px', fontWeight: '700', color: 'var(--texto-principal)'}}>📈 Gráfico Barras</h6>
                {renderGraficoSVG('bar')}
              </div>
            </div>

            <div style={{marginTop: '15px', textAlign: 'center', padding: '15px', background: 'rgba(0,0,0,0.02)', borderRadius: '8px', fontSize: '13px', color: 'var(--texto-secundario)'}}>
              <p style={{margin: 0}}>📅 Período: {filtroReporteFecha === 'semana' ? 'Esta semana' : filtroReporteFecha === 'mes' ? 'Este mes' : 'Todo el tiempo'}</p>
              <p style={{margin: '4px 0 0 0'}}>Total de Engagement: <strong style={{color: 'var(--azul-electrico)'}}>{totalEngagement}</strong> interacciones</p>
            </div>
              </>
            )}
          </div>
        )}

        {vistaReportes === 'comentaristas' && (
          <div className="fade-in">
            {reportes.topComentaristas.length > 0 ? (
              <div>
                {reportes.topComentaristas.map((com, i) => (
                  <div key={i} className="card mb-10" style={{display: 'flex', alignItems: 'center', gap: '12px'}}>
                    <div style={{background: 'var(--azul-electrico)', color: 'white', width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '800', fontSize: '14px'}}>
                      {i + 1}
                    </div>
                    <div style={{flex: 1}}>
                      <p style={{margin: 0, fontWeight: '700', color: 'var(--texto-principal)'}}>{com.usuario}</p>
                      <p style={{margin: '2px 0 0 0', fontSize: '12px', color: 'var(--texto-secundario)'}}>💬 {com.count} comentario{com.count !== 1 ? 's' : ''}</p>
                    </div>
                    <div style={{background: 'linear-gradient(90deg, var(--azul-electrico), #34C759)', color: 'white', padding: '6px 12px', borderRadius: '12px', fontWeight: '700', fontSize: '12px'}}>
                      {com.count}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{textAlign: 'center', color: 'var(--texto-secundario)', fontSize: '13px'}}>Sin comentarios aún</p>
            )}
          </div>
        )}

        {vistaReportes === 'comunicaciones-top' && (
          <div className="fade-in">
            {reportes.comTop.length > 0 ? (
              <div>
                {reportes.comTop.map((com, i) => (
                  <div key={i} className="card mb-10">
                    <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px'}}>
                      <h6 style={{margin: 0, fontWeight: '700', fontSize: '13px', color: 'var(--texto-principal)', maxWidth: '70%'}}>{com.titulo}</h6>
                      <span style={{background: 'var(--azul-electrico)', color: 'white', padding: '4px 8px', borderRadius: '12px', fontWeight: '700', fontSize: '11px'}}>#{i + 1}</span>
                    </div>
                    <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(92px, 1fr))', gap: '10px', fontSize: '12px'}}>
                      <div style={{background: 'rgba(0, 122, 255, 0.08)', padding: '6px', borderRadius: '4px', textAlign: 'center'}}>
                        <p style={{margin: 0, fontWeight: '700', color: 'var(--azul-electrico)'}}>{com.comentarios}</p>
                        <p style={{margin: '2px 0 0 0', fontSize: '10px', color: 'var(--texto-secundario)'}}>💬 Comentarios</p>
                      </div>
                      <div style={{background: 'rgba(52, 199, 89, 0.08)', padding: '6px', borderRadius: '4px', textAlign: 'center'}}>
                        <p style={{margin: 0, fontWeight: '700', color: '#34C759'}}>{com.reacciones}</p>
                        <p style={{margin: '2px 0 0 0', fontSize: '10px', color: 'var(--texto-secundario)'}}>❤️ Reacciones</p>
                      </div>
                      <div style={{background: 'rgba(255, 159, 64, 0.08)', padding: '6px', borderRadius: '4px', textAlign: 'center'}}>
                        <p style={{margin: 0, fontWeight: '700', color: '#FF9500'}}>{com.rsvp}</p>
                        <p style={{margin: '2px 0 0 0', fontSize: '10px', color: 'var(--texto-secundario)'}}>✓ RSVP</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{textAlign: 'center', color: 'var(--texto-secundario)', fontSize: '13px'}}>Sin comunicaciones aún</p>
            )}
          </div>
        )}
      </div>
    );
  };

  // ==========================================
  // 5. MÓDULOS DE JUGADOR, ACADEMIA Y TESORERÍA
  // ==========================================

  const renderTarjetaJugador = () => {
    let claseRareza = "holo-bronce"; let textoRareza = "BRONCE";
    const nivelActual = rolUsuario === 'visita' ? 'MAX' : pupiloActivo.nivel;
    const nombreDisplay = rolUsuario === 'visita' ? 'Invitado' : pupiloActivo.nombre.split(' ')[0];
    const apellidoDisplay = rolUsuario === 'visita' ? 'TORNEO' : pupiloActivo.nombre.split(' ')[1]?.toUpperCase() || '';
    
    if(nivelActual > 10 && nivelActual <= 20) { claseRareza = "holo-plata"; textoRareza = "PLATA"; } 
    else if(nivelActual > 20) { claseRareza = "holo-oro"; textoRareza = "ORO"; }
    if(rolUsuario === 'visita') { claseRareza = "holo-visita"; textoRareza = "VISITA"; }

    return (
      <div className="fade-in player-screen-shell">
        <PupiloSelector
          pupilos={mockTesoreriaDB.pupilos}
          pupiloActivo={pupiloActivo}
          rolUsuario={rolUsuario}
          onChangePupilo={setPupiloActivo}
        />
        
        <div className="holographic-wrapper horizontal-holo">
          <div className={`holographic-card horizontal ${claseRareza}`}>
            <div className="holo-glare"></div>
            <div className="holo-header">
              <div className="holo-club-logo">🏀</div>
              <div className="holo-season">SEASON 2026</div>
              <div className="holo-rarity-badge">{textoRareza}</div>
            </div>
            <div className="holo-center-content">
              <div className="holo-foto-marco"><User size={50} color="white" /></div>
              <div className="holo-jugador-info">
                <h2>{nombreDisplay}</h2>
                <h1>{apellidoDisplay}</h1>
                <div className="holo-dorsal">#{rolUsuario === 'visita' ? '00' : mockJugador.NUMERO_CAMISETA}</div>
              </div>
            </div>
            <div className="holo-bottom-bar">
              <div className="holo-stats">
                <div><span>POS</span><strong>{rolUsuario === 'visita' ? 'N/A' : mockJugador.POSICION_DE_JUEGO}</strong></div>
                <div><span>CAT</span><strong>{rolUsuario === 'visita' ? 'Open' : pupiloActivo.categoria}</strong></div>
                <div><span>LVL</span><strong>{nivelActual}</strong></div>
              </div>
              <div className="holo-qr-zone"><QrCode size={40} color="black"/></div>
            </div>
          </div>
        </div>
        <p className="text-center mt-5" style={{fontSize: '11px', color: 'var(--texto-secundario)', fontWeight: 'bold'}}>Escanea este QR en portería para asistencia.</p>

        {rolUsuario !== 'visita' && (
          <>
            <h3 className="section-title mt-20">Ficha Atlética e Indumentaria</h3>
            <div className="caja-doble-grid mb-15">
               <div className="card sub-caja-card metric-card" style={{padding: '15px'}}>
                  <h5 className="sub-caja-title" style={{fontSize: '11px'}}><Target size={14}/> Biometría</h5>
                  <div className="desglose-row"><span>Estatura:</span><strong>{mockJugador.ESTATURA}</strong></div>
                  <div className="desglose-row"><span>Peso:</span><strong>{mockJugador.PESO}</strong></div>
                  <div className="desglose-row"><span>Mano Hábil:</span><strong>{mockJugador.MANO_HABIL}</strong></div>
               </div>
               
               <div className="card sub-caja-card metric-card" style={{padding: '15px'}}>
                  <h5 className="sub-caja-title" style={{fontSize: '11px'}}><Shirt size={14}/> Tallas</h5>
                  <div className="desglose-row"><span>Camiseta:</span><strong>{mockJugador.TALLA_CAMISETA}</strong></div>
                  <div className="desglose-row"><span>Short:</span><strong>{mockJugador.TALLA_SHORT}</strong></div>
                  <div className="desglose-row mt-10 text-center">
                    <span className="badge-urgente" style={{background: mockJugador.POLERA_ENTREGADA ? 'var(--verde-victoria)' : '#FF3B30', width: '100%', display: 'block', padding: '8px 0'}}>
                      {mockJugador.POLERA_ENTREGADA ? 'ROPA ENTREGADA ✓' : 'FALTA ENTREGA'}
                    </span>
                  </div>
               </div>
            </div>
            
            <div className="card history-card" style={{background: 'linear-gradient(135deg, #1A222D, #0B1017)', color: 'white', border: 'none'}}>
               <h4 className="form-subtitle" style={{color: '#00C7BE', margin: '0 0 15px 0'}}>📊 Historial Deportivo</h4>
               <div className="desglose-row"><span>Asistencia Entrenamientos:</span><strong style={{color: 'var(--verde-victoria)'}}>{mockJugador.ASISTENCIA}</strong></div>
               <div className="desglose-row"><span>Estado del Jugador:</span><strong style={{color: '#00C7BE'}}>{mockJugador.ESTADO_DEPORTIVO}</strong></div>
               <div className="desglose-row"><span>Beca Asignada:</span><strong>{mockJugador.BECA}</strong></div>
            </div>
          </>
        )}
      </div>
    );
  };

  const renderPerfilTesoreria = () => {
    let tarifaMensual = 0; 
    const utmActual = getUTMLastDayPreviousMonth(mockTesoreriaDB.utmValor); // UTM dinámico del mes anterior
    const cuotaSocio = utmActual * 0.003; 
    
    if (mockTesoreriaDB.esSocio) { 
      tarifaMensual += cuotaSocio; 
      if (mockTesoreriaDB.pupilos.length === 1) tarifaMensual += 15000; 
      else if (mockTesoreriaDB.pupilos.length >= 2) tarifaMensual += 24000; 
    } else { 
      tarifaMensual += 30000 * mockTesoreriaDB.pupilos.length; 
    }
    
    const tarifaRedondeada = Math.round(tarifaMensual); 
    const totalSeleccionado = tarifaRedondeada * mesesSeleccionados.length; 
    const totalFinalPagar = tipoPago === 'completo' ? totalSeleccionado : (Number(montoAbono) || 0);
    
    const toggleMes = (idMes, estado) => { 
      if (estado === 'pagado') return; 
      if (mesesSeleccionados.includes(idMes)) { setMesesSeleccionados(mesesSeleccionados.filter(m => m !== idMes)); } 
      else { setMesesSeleccionados([...mesesSeleccionados, idMes]); } 
    };

    return (
      <div className="fade-in">
        {/* PREMIUM UPGRADE: VISTA DUAL SOCIO/PUPILOS */}
        <div className="status-account-card payment-overview-card mt-15">
          <div className="status-header">
            <div>
              <span style={{fontSize: '11px', color: 'rgba(255,255,255,0.6)', fontWeight: '800', textTransform: 'uppercase', letterSpacing:'0.5px'}}>Mensualidad / Perfil</span>
              <h3 className="status-titular" style={{color:'white'}}>{mockTesoreriaDB.titular}</h3>
              <span className="status-rol">{mockTesoreriaDB.esSocio ? 'Socio Activo Club Cultura Física' : 'Apoderado Base'}</span>
            </div>
            <div className={`status-badge ${mockTesoreriaDB.estadoCuenta === 'Al Día' ? 'ok' : 'moroso'}`}>
              {mockTesoreriaDB.estadoCuenta}
            </div>
          </div>
          {mockTesoreriaDB.estadoCuenta === 'Moroso' && (
            <div className="status-alert"><AlertTriangle size={16}/> Presenta {mockTesoreriaDB.mesesAtraso} meses de atraso en cuotas.</div>
          )}
        </div>

        {/* FICHA DEL SOCIO */}
        <div className="card ficha-socio-card mt-15 fade-in">
          <div style={{display:'flex', alignItems:'center', gap:'14px'}}>
            <div className="ficha-avatar">👤</div>
            <div style={{flex:1}}>
              <h4 style={{margin:'0 0 3px 0', fontSize:'16px', fontWeight:'900', color:'var(--texto-principal)'}}>{mockTesoreriaDB.titular}</h4>
              <span style={{fontSize:'12px', fontWeight:'800', color:'var(--azul-electrico)', display:'block'}}>{
                mockTesoreriaDB.esSocio ? '🏅 Socio Activo · Club Centro de Cultura Física' : '👥 Apoderado'
              }</span>
              {mockTesoreriaDB.pupilos.length > 0 && (
                <p style={{margin:'6px 0 0 0', fontSize:'12px', color:'var(--texto-secundario)', fontWeight:'700', lineHeight:'1.4'}}>
                  👨‍👧‍👦 Apoderado de: {mockTesoreriaDB.pupilos.map(p => p.nombre).join(' · ')}
                </p>
              )}
            </div>
            <div style={{textAlign:'right', flexShrink:0}}>
              <span style={{fontSize:'10px', color:'var(--texto-secundario)', fontWeight:'800', textTransform:'uppercase', display:'block', marginBottom:'3px'}}>Cuota vigente</span>
              <strong style={{fontSize:'18px', color:'var(--texto-principal)', fontWeight:'900'}}>${tarifaRedondeada.toLocaleString('es-CL')}</strong>
              <span style={{fontSize:'11px', color:'var(--texto-secundario)', display:'block', fontWeight:'700'}}>/mes</span>
            </div>
          </div>
        </div>

        {/* RESUMEN DE DEUDA (solo si moroso) */}
        {mockTesoreriaDB.estadoCuenta === 'Moroso' && (
          <div className="card fade-in mt-15 compact-debt-summary" style={{borderLeft:'4px solid var(--rojo-alerta)', background:'linear-gradient(135deg, rgba(255,59,48,0.08), rgba(255,59,48,0.02))'}}>
            <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', alignItems: 'center'}}>
              <div>
                <h4 style={{margin:'0 0 8px 0', fontSize:'14px', color:'var(--rojo-alerta)', fontWeight:'900', display:'flex', alignItems:'center', gap:'6px'}}><AlertTriangle size={18}/> Deuda Pendiente</h4>
                <p style={{margin: '0', fontSize: '12px', color: 'var(--texto-secundario)', fontWeight: '700'}}>{mockTesoreriaDB.mesesAtraso} {mockTesoreriaDB.mesesAtraso === 1 ? 'mes' : 'meses'} adeudados</p>
              </div>
              <div style={{textAlign: 'right'}}>
                <span style={{fontSize: '12px', color: 'var(--texto-secundario)', fontWeight: '700', textTransform: 'uppercase', display: 'block', marginBottom: '4px'}}>Total Estimado</span>
                <strong style={{fontSize: '20px', color: 'var(--rojo-alerta)', fontWeight: '900'}}>-${(tarifaRedondeada * mockTesoreriaDB.mesesAtraso).toLocaleString('es-CL')}</strong>
              </div>
            </div>
            <div style={{marginTop: '12px', paddingTop: '12px', borderTop: '1px solid rgba(255,59,48,0.15)', fontSize: '11px', color: 'var(--texto-secundario)', fontWeight: '700'}}>
              <span>Cuota mensual: <strong style={{color: 'var(--texto-principal)'}}>${tarifaRedondeada.toLocaleString('es-CL')}</strong></span>
            </div>
          </div>
        )}

        <h3 className="section-title mt-20">Panel de Pagos 2026</h3>
        
        {/* TOGGLE VISTA GRID/LISTA */}
        <div style={{display: 'flex', gap: '10px', marginBottom: '15px', justifyContent: 'flex-end'}}>
          <button 
            className={`btn-toggle-view ${pagoViewMode === 'grid' ? 'activo' : ''}`}
            onClick={() => setPageViewMode('grid')}
            title="Vista Cuadrícula"
            style={{padding: '8px 14px', borderRadius: '10px', border: '1px solid var(--borde-suave)', background: pagoViewMode === 'grid' ? 'var(--azul-electrico)' : 'transparent', color: pagoViewMode === 'grid' ? 'white' : 'var(--texto-principal)', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', transition: 'all 0.3s ease'}}
          >
            <LayoutGrid size={16} /> Cuadrícula
          </button>
          <button 
            className={`btn-toggle-view ${pagoViewMode === 'list' ? 'activo' : ''}`}
            onClick={() => setPageViewMode('list')}
            title="Vista Lista"
            style={{padding: '8px 14px', borderRadius: '10px', border: '1px solid var(--borde-suave)', background: pagoViewMode === 'list' ? 'var(--azul-electrico)' : 'transparent', color: pagoViewMode === 'list' ? 'white' : 'var(--texto-principal)', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', transition: 'all 0.3s ease'}}
          >
            <List size={16} /> Lista Compacta
          </button>
        </div>

        <div className="card finanzas-card payment-card">
          {mockTesoreriaDB.esSocio && (
             <div className="mb-20">
               <h4 style={{margin: '0 0 10px 0', fontSize: '14px', color: 'var(--texto-heading)', fontWeight: '800'}}>1. Cuotas de Socio: <span className="payment-chip">Socio activo</span></h4>
               <div className={pagoViewMode === 'grid' ? 'grid-12-meses' : 'lista-12-meses'}>
                 {mock12Meses.map((item) => (
                   <div key={item.id} onClick={() => toggleMes(item.id, item.estado)} className={`mes-box mes-${item.estado} ${mesesSeleccionados.includes(item.id) ? 'seleccionado' : ''}`}>
                     <span className="mes-box-nombre">{item.mes}</span>
                   </div>
                 ))}
               </div>
             </div>
          )}
          
          {mockTesoreriaDB.pupilos.map(pupilo => (
             <div key={pupilo.id} className="mb-20" style={{borderTop: '1px dashed rgba(0,0,0,0.1)', paddingTop: '15px'}}>
               <h4 style={{margin: '0 0 10px 0', fontSize: '14px', color: 'var(--texto-heading)', fontWeight: '800'}}>2. Mensualidad Deportista: {pupilo.nombre.split(' ')[0]} <span className="payment-chip">Inscripción</span></h4>
               <div className={pagoViewMode === 'grid' ? 'grid-12-meses' : 'lista-12-meses'}>
                 {mock12Meses.map((item) => (
                   <div key={item.id + pupilo.id} className={`mes-box mes-${item.estado}`}>
                     <span className="mes-box-nombre">{item.mes}</span>
                   </div>
                 ))}
               </div>
             </div>
          ))}

          {/* MOTOR DE PAGOS AVANZADO */}
          {mesesSeleccionados.length > 0 && !comprobanteSubido && (
            <div className="dynamic-checkout-box fade-in mt-20">
               <h4 className="form-subtitle">Resumen de Liquidación</h4>
               <div className="checkbox-grid mb-15">
                 <label className="checkbox-item"><input type="checkbox" checked readOnly/> Pago Cuota Socio</label>
                 <label className="checkbox-item"><input type="checkbox" checked readOnly/> Pago Cuota Deportista</label>
               </div>
               
               <div className="desglose-row"><span>Valor Unificado (Socio + Deportista):</span><strong>${tarifaRedondeada.toLocaleString('es-CL')} / mes</strong></div>
               <div className="desglose-row total-calc"><span>Total a Pagar ({mesesSeleccionados.length} meses):</span><strong>${totalSeleccionado.toLocaleString('es-CL')}</strong></div>
               
               <div className="tipo-pago-grid mb-15 mt-15" style={{display: 'flex', gap: '10px'}}>
                 <button className={`btn-metodo-pago ${tipoPago === 'completo' ? 'activo' : ''}`} onClick={() => setTipoPago('completo')}>Deuda Completa</button>
                 <button className={`btn-metodo-pago ${tipoPago === 'abono' ? 'activo' : ''}`} onClick={() => setTipoPago('abono')}>Abono Parcial</button>
               </div>
               
               {tipoPago === 'abono' && (
                 <div className="input-group mb-15">
                   <label style={{fontSize: '12px', fontWeight: 'bold'}}>Monto a abonar (CLP)</label>
                   <input type="number" className="form-input mt-5" value={montoAbono} onChange={(e) => setMontoAbono(e.target.value)} placeholder="Ej: 15000"/>
                 </div>
               )}

               <div className="checkout-total-box mt-10">
                 <span>Monto a Transferir</span>
                 <h2>${totalFinalPagar.toLocaleString('es-CL')}</h2>
               </div>
               <div className="btn-pago-cta mt-15" onClick={() => {
                 setComprobanteSubido(true);
                 setPagosPendientesAdmin(prev => [...prev, {
                   id: nextId(),
                   familia: mockTesoreriaDB.titular,
                   monto: totalFinalPagar,
                   detalle: `${tipoPago === 'completo' ? 'Pago total' : 'Abono $' + Number(montoAbono).toLocaleString('es-CL')} — ${mesesSeleccionados.length} mes(es) — Comprobante adjunto`
                 }]);
               }}>
                 <Camera size={24} color="white"/>
                 <div>
                   <strong style={{display:'block', fontSize:'14px'}}>Adjuntar y Enviar Comprobante</strong>
                   <span style={{fontSize:'11px', opacity:.8}}>JPG · PDF · PNG · Imagen WhatsApp</span>
                 </div>
               </div>
            </div>
          )}
          
          {/* FLUJO DE VALIDACIÓN */}
          {comprobanteSubido && (
            <div className="fade-in text-center py-20 mt-20 review-card">
              <Clock size={40} color="#FF9500" style={{margin: '0 auto'}}/>
              <h3 style={{color: '#FF9500', margin: '15px 0 10px 0', fontSize: '20px', fontWeight: '900'}}>Pago en Revisión</h3>
              <p style={{fontSize: '14px', margin: 0, color: 'var(--texto-secundario)', lineHeight: '1.5'}}>Tesorería ha recibido tu comprobante. Será validado a la brevedad y recibirás una notificación.</p>
              <button className="btn-secondary mt-20" style={{color: '#FF9500', background: 'rgba(255,149,0,0.1)'}} onClick={() => { setComprobanteSubido(false); setMesesSeleccionados([]); setMontoAbono(''); }}>
                Entendido, volver
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderAcademia = () => {
    const handleResponderQuiz = (opcion) => {
      if (quizCompletado) return;
      setOpcionSeleccionada(opcion);
      setQuizCompletado(true);
      if (opcion === mockQuiz.RESPUESTA_CORRECTA) {
        setAnimacionXP(true); // Dispara efecto visual CSS
        setTimeout(() => setAnimacionXP(false), 2000);
      }
    };

    return (
      <div className="mt-20 fade-in">
        <PupiloSelector
          pupilos={mockTesoreriaDB.pupilos}
          pupiloActivo={pupiloActivo}
          rolUsuario={rolUsuario}
          onChangePupilo={setPupiloActivo}
        />
        
        {/* PREMIUM UPGRADE: Barra de Experiencia Adictiva */}
        <div className={`card academy-hero-card gamificacion-card mb-20 ${animacionXP ? 'xp-boost-anim' : ''}`} style={{background: 'linear-gradient(135deg, #2E0B5B, #00C7BE)', color: 'white', border: 'none', position: 'relative', overflow: 'hidden'}}>
          {animacionXP && <div className="particulas-xp">✨ +50 XP ✨</div>}
          <div className="gamificacion-header" style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
            <div className="nivel-box" style={{display: 'flex', alignItems: 'center', gap: '15px'}}>
              <Star size={34} color="#FFD700" fill="#FFD700" />
              <div>
                <h4 style={{margin: 0, fontSize: '22px', fontWeight: '900'}}>Nivel {pupiloActivo.nivel}</h4>
                <span className="xp-totales" style={{fontSize: '12px', color: 'rgba(255,255,255,0.8)', fontWeight: 'bold'}}>{pupiloActivo.xp} XP Totales</span>
              </div>
            </div>
          </div>
          <div className="admin-progress-bg mt-15" style={{background: 'rgba(255,255,255,0.2)', height: '14px', borderRadius: '7px'}}>
            <div className="admin-progress-fill" style={{width: '65%', background: '#00C7BE', height: '100%', borderRadius: '7px'}}></div>
          </div>
          <p style={{textAlign: 'right', margin: '8px 0 0 0', fontSize: '11px', fontWeight: '800'}}>Faltan 150 XP para Lvl {pupiloActivo.nivel + 1}</p>
        </div>

        <h3 className="section-title">Video Análisis</h3>
        <div className="card video-card">
          <div className="video-placeholder" style={{borderRadius: '16px'}}>
            <Video size={40} color="white" />
            <div className="play-button"><PlayCircle size={35} color="var(--azul-marino)" fill="white" /></div>
          </div>
          <div className="video-info">
            <span className="badge-video">NUEVO VIDEO</span>
            <h4 style={{margin: '10px 0 0 0', fontSize: '16px'}}>Análisis Zonal 2-3</h4>
          </div>
        </div>

        <h3 className="section-title mt-20">Desafío Semanal</h3>
        <div className="card academia-card" style={{border: '2px solid #FF9500'}}>
          <div className="academia-header">
            <span className="badge-academia" style={{background: '#FF9500', color: 'white'}}><Brain size={12}/> QUIZ TÁCTICO</span>
            <span className="xp-recompensa">+50 XP</span>
          </div>
          <h4 className="titulo-leccion">{mockQuiz.TITULO_LECCION}</h4>
          
          <div className="quiz-container mt-15">
            <p className="pregunta-texto">{mockQuiz.PREGUNTA}</p>
            <div className="opciones-quiz">
              <button className={`btn-opcion ${opcionSeleccionada === 'A' ? (mockQuiz.RESPUESTA_CORRECTA === 'A' ? 'correcta' : 'incorrecta') : ''}`} onClick={() => handleResponderQuiz('A')} disabled={quizCompletado}>A) {mockQuiz.OPCION_A}</button>
              <button className={`btn-opcion ${opcionSeleccionada === 'B' ? (mockQuiz.RESPUESTA_CORRECTA === 'B' ? 'correcta' : 'incorrecta') : ''}`} onClick={() => handleResponderQuiz('B')} disabled={quizCompletado}>B) {mockQuiz.OPCION_B}</button>
              <button className={`btn-opcion ${opcionSeleccionada === 'C' ? (mockQuiz.RESPUESTA_CORRECTA === 'C' ? 'correcta' : 'incorrecta') : ''}`} onClick={() => handleResponderQuiz('C')} disabled={quizCompletado}>C) {mockQuiz.OPCION_C}</button>
            </div>
            {quizCompletado && (
              <div className={`explicacion-box mt-15 ${opcionSeleccionada === mockQuiz.RESPUESTA_CORRECTA ? 'exito' : 'fallo'}`}>
                <strong style={{fontSize: '14px'}}>{opcionSeleccionada === mockQuiz.RESPUESTA_CORRECTA ? '¡Correcto! Sumas XP 🔥' : 'Casi... pero no. 😕'}</strong>
                <p style={{margin: '8px 0 0 0', fontSize: '13px'}}>{mockQuiz.EXPLICACION_RESPUESTA}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // ==========================================
  // 6. ECOSISTEMA DEL STAFF TÉCNICO (ENTRENADOR)
  // ==========================================
  const renderStaffAsistencia = () => {
    // Calculo de porcentajes antes de guardar
    const presentes = rosterEquipo.filter(j => j.estadoAsistencia === 'presente').length;
    const ausentes = rosterEquipo.filter(j => j.estadoAsistencia === 'ausente').length;
    const justificados = rosterEquipo.filter(j => j.estadoAsistencia === 'justificado').length;
    const totalLista = rosterEquipo.length;
    const porcentaje = Math.round((presentes / (totalLista - justificados)) * 100) || 0;

    const cambiarEstado = (id, nuevoEstado) => { 
      setRosterEquipo(rosterEquipo.map(j => j.id === id ? { ...j, estadoAsistencia: nuevoEstado } : j)); 
    };

    return (
      <div className="mt-20 fade-in">
        <div className="segment-control mb-20">
          <div className={`segment-btn ${vistaStaff === 'asistencia' ? 'active' : ''}`} onClick={() => setVistaStaff('asistencia')}>Pasar Lista</div>
          <div className={`segment-btn ${vistaStaff === 'historial' ? 'active' : ''}`} onClick={() => setVistaStaff('historial')}>Historial</div>
        </div>

        {vistaStaff === 'asistencia' && (
          <div className="card">
            <h4 className="form-subtitle">Configurar Entrenamiento</h4>
            <div style={{display:'flex', gap:'10px'}} className="mb-15">
              <select className="form-input" value={filtroRamaStaff} onChange={(e)=>setFiltroRamaStaff(e.target.value)}><option>Masculina</option><option>Femenina</option></select>
              <select className="form-input" value={filtroCatStaff} onChange={(e)=>setFiltroCatStaff(e.target.value)}><option>U13</option><option>U15</option><option>U17</option></select>
            </div>
            
            <div className="staff-header-info mb-15" style={{borderBottom: '1px solid rgba(0,0,0,0.05)', paddingBottom: '15px'}}>
              <h4 style={{margin: '0 0 5px 0', color: 'var(--texto-heading)'}}>Cargando Nómina: {filtroCatStaff} {filtroRamaStaff}</h4>
            </div>
            
            <div className="roster-list">
              {rosterEquipo.map(jugador => (
                <div key={jugador.id} className="roster-item" style={{display:'flex', flexDirection: 'column', gap: '12px', padding:'15px 0', borderBottom:'1px solid rgba(0,0,0,0.05)'}}>
                  <div className="jugador-info-staff" style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                    <div>
                      <span className="roster-nombre" style={{fontWeight: '800', color: 'var(--texto-principal)', fontSize: '15px'}}>{jugador.nombre}</span>
                      <span style={{fontSize: '11px', color: 'var(--texto-secundario)', marginLeft: '10px', fontWeight: 'bold'}}>Nac: {jugador.año}</span>
                    </div>
                  </div>
                  
                  {/* PREMIUM UPGRADE: Botonera de Gestos Rápidos (Swipe-like) */}
                  <div style={{display: 'flex', gap: '8px', width: '100%'}}>
                    <button onClick={() => cambiarEstado(jugador.id, 'presente')} style={{flex: 1, padding: '10px', border: 'none', borderRadius: '10px', fontWeight: '800', fontSize: '11px', background: jugador.estadoAsistencia === 'presente' ? 'var(--verde-victoria)' : 'var(--fondo-app)', color: jugador.estadoAsistencia === 'presente' ? 'white' : 'var(--texto-secundario)', transition: '0.2s'}}>✓ PRESENTE</button>
                    <button onClick={() => cambiarEstado(jugador.id, 'ausente')} style={{flex: 1, padding: '10px', border: 'none', borderRadius: '10px', fontWeight: '800', fontSize: '11px', background: jugador.estadoAsistencia === 'ausente' ? '#FF3B30' : 'var(--fondo-app)', color: jugador.estadoAsistencia === 'ausente' ? 'white' : 'var(--texto-secundario)', transition: '0.2s'}}>❌ AUSENTE</button>
                    <button onClick={() => cambiarEstado(jugador.id, 'justificado')} style={{flex: 1, padding: '10px', border: 'none', borderRadius: '10px', fontWeight: '800', fontSize: '11px', background: jugador.estadoAsistencia === 'justificado' ? '#FF9500' : 'var(--fondo-app)', color: jugador.estadoAsistencia === 'justificado' ? 'white' : 'var(--texto-secundario)', transition: '0.2s'}}>🚑 JUSTIFIC.</button>
                  </div>
                </div>
              ))}
            </div>
            
            {/* Resumen pre-guardado */}
            <div className="mt-20" style={{background: 'rgba(0,122,255,0.05)', borderRadius: '16px', padding: '20px'}}>
              <h5 style={{margin: '0 0 15px 0', fontSize: '15px', color: 'var(--texto-heading)'}}>Resumen a Guardar:</h5>
              <div className="desglose-row"><span>Asistencia Efectiva:</span><strong style={{color: porcentaje > 70 ? 'var(--verde-victoria)' : '#FF3B30', fontSize: '16px'}}>{porcentaje}%</strong></div>
              <div className="desglose-row"><span>Presentes en Cancha:</span><strong>{presentes}</strong></div>
              <div className="desglose-row"><span>Ausentes (Sin aviso):</span><strong style={{color: '#FF3B30'}}>{ausentes}</strong></div>
              <div className="desglose-row"><span>Con Licencia Médica:</span><strong style={{color: '#FF9500'}}>{justificados}</strong></div>
            </div>

            <button className="btn-electric mt-20" onClick={() => alert("Asistencia guardada en la base de datos de Auditoría.")}>
              <Save size={18}/> Confirmar y Guardar Asistencia
            </button>
          </div>
        )}

        {vistaStaff === 'historial' && (
          <div className="card fade-in">
             <h4 className="form-subtitle">Registros Anteriores</h4>
             <input type="date" className="form-input mb-15"/>
             <p className="text-center text-muted" style={{fontStyle: 'italic', fontSize: '13px'}}>Seleccione una fecha para editar la asistencia pasada.</p>
          </div>
        )}
      </div>
    );
  };

  const renderStaffEvaluacion = () => {
    const dataEvalLive = [
      { subject: 'Tiro', score: evalTiro, fullMark: 100 }, 
      { subject: 'Defensa', score: evalDefensa, fullMark: 100 }, 
      { subject: 'Físico', score: evalFisico, fullMark: 100 }, 
      { subject: 'Táctica', score: evalTactico, fullMark: 100 }
    ];

    return (
      <div className="mt-20 fade-in">
        <div className="card mb-15">
           <h4 className="form-subtitle">Selección de Jugador</h4>
           <div style={{display:'flex', gap:'10px'}} className="mb-10">
              <select className="form-input"><option>Femenina</option><option>Masculina</option></select>
              <select className="form-input"><option>U15</option></select>
           </div>
           <select className="form-input" style={{background: 'rgba(0,122,255,0.05)', borderColor: 'var(--azul-electrico)', color: 'var(--texto-heading)', fontWeight: '800'}}>
             <option>Tomás Parra (#8) - Asist: 92% | Nvl: 12</option>
             <option>Luis Soto (#10) - Asist: 85% | Nvl: 10</option>
           </select>
        </div>

        <div className="card grafico-card-dark" style={{background: '#1a2a42', borderRadius: '20px', overflow: 'hidden'}}>
          <h4 style={{color: 'white', textAlign: 'center', margin: '20px 0 0 0'}}>Radar Biomecánico</h4>
          <ResponsiveContainer width="100%" height={250}>
            <RadarChart cx="50%" cy="50%" outerRadius="65%" data={dataEvalLive}>
              <PolarGrid stroke="rgba(255,255,255,0.15)" />
              <PolarAngleAxis dataKey="subject" tick={{ fill: '#ffffff', fontSize: 12, fontWeight: 800 }} />
              <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
              <Radar dataKey="score" stroke="#00C7BE" strokeWidth={3} fill="#00C7BE" fillOpacity={0.5} />
            </RadarChart>
          </ResponsiveContainer>
        </div>

        <div className="card mt-20">
          <h4 className="form-subtitle">Ajuste de Parámetros (Sliders)</h4>
          <div className="slider-group" style={{marginBottom: '15px'}}>
            <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '8px'}}><label style={{fontSize: '14px', fontWeight: '800'}}>Tiro Exterior</label><span style={{color: 'var(--azul-electrico)', fontWeight: 'bold'}}>{evalTiro}</span></div>
            <input type="range" min="0" max="100" value={evalTiro} onChange={(e) => setEvalTiro(e.target.value)} style={{width:'100%'}}/>
          </div>
          <div className="slider-group" style={{marginBottom: '15px'}}>
            <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '8px'}}><label style={{fontSize: '14px', fontWeight: '800'}}>Defensa y Recuperación</label><span style={{color: 'var(--azul-electrico)', fontWeight: 'bold'}}>{evalDefensa}</span></div>
            <input type="range" min="0" max="100" value={evalDefensa} onChange={(e) => setEvalDefensa(e.target.value)} style={{width:'100%'}}/>
          </div>
          <div className="slider-group" style={{marginBottom: '15px'}}>
            <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '8px'}}><label style={{fontSize: '14px', fontWeight: '800'}}>Capacidad Física</label><span style={{color: 'var(--azul-electrico)', fontWeight: 'bold'}}>{evalFisico}</span></div>
            <input type="range" min="0" max="100" value={evalFisico} onChange={(e) => setEvalFisico(e.target.value)} style={{width:'100%'}}/>
          </div>
          <div className="slider-group" style={{marginBottom: '15px'}}>
            <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '8px'}}><label style={{fontSize: '14px', fontWeight: '800'}}>Inteligencia Táctica</label><span style={{color: 'var(--azul-electrico)', fontWeight: 'bold'}}>{evalTactico}</span></div>
            <input type="range" min="0" max="100" value={evalTactico} onChange={(e) => setEvalTactico(e.target.value)} style={{width:'100%'}}/>
          </div>
        </div>

        {/* FEEDBACK DE STAFF Y METAS */}
        <div className="card mt-20">
          <h4 className="form-subtitle"><FileText size={16}/> Notas de Evaluación (Apoderado)</h4>
          <div className="input-group mb-15">
            <label style={{fontSize: '13px', fontWeight: 'bold', display: 'block', marginBottom: '5px'}}>Fortaleza Principal Actual</label>
            <input type="text" className="form-input" placeholder="Ej: Excelente visión de juego perimetral" value={notasEvaluacion.fortaleza} onChange={(e)=>setNotasEvaluacion({...notasEvaluacion, fortaleza: e.target.value})} />
          </div>
          <div className="input-group mb-15">
            <label style={{fontSize: '13px', fontWeight: 'bold', display: 'block', marginBottom: '5px'}}>Aspecto Crítico a Mejorar</label>
            <input type="text" className="form-input" placeholder="Ej: Transición defensiva lenta" value={notasEvaluacion.mejora} onChange={(e)=>setNotasEvaluacion({...notasEvaluacion, mejora: e.target.value})} />
          </div>
          <div className="input-group mb-20">
            <label style={{fontSize: '13px', fontWeight: 'bold', display: 'block', marginBottom: '5px'}}>Metas Corto Plazo (1 Mes)</label>
            <textarea className="form-input" rows="3" placeholder="Ej: Aumentar el % de tiros libres." value={notasEvaluacion.metas} onChange={(e)=>setNotasEvaluacion({...notasEvaluacion, metas: e.target.value})}></textarea>
          </div>
          
          <button className="btn-electric" onClick={() => alert("Evaluación guardada. Se ha enviado la alerta al Apoderado para firmar el Acuse de Recibo.")}>
            <Save size={18}/> Emitir Evaluación Formal
          </button>
        </div>
      </div>
    );
  };

  // ==========================================
  // 7. MÓDULO KIOSCO, INVENTARIO Y CAJA (PREMIUM)
  // ==========================================
  const renderKioscoCaja = () => {
    const totalCarrito = carritoKiosco.reduce((a, b) => a + (b.precio * b.cant), 0);
    const totalGastos = egresosLista.reduce((a, b) => a + b.monto, 0);
    const cajaNetaFinal = (Number(datosCaja.montoInicial) || 0) + cajaEfectivoKiosco + cajaEfectivoEntradas - totalGastos;

    const finalizarDespachoPOS = (metodo) => {
      let nuevoInventario = [...inventarioProductos];
      let sEK = 0; let sTK = 0; let sEE = 0; let sTE = 0;

      carritoKiosco.forEach(itemCart => {
        nuevoInventario = nuevoInventario.map(prod => (
          prod.id === itemCart.id ? { ...prod, stock: Math.max(0, prod.stock - itemCart.cant), ventas: prod.ventas + itemCart.cant } : prod
        ));
        const sub = itemCart.precio * itemCart.cant;
        const esEntrada = itemCart.categoria === 'Entradas';
        if (metodo === 'efectivo') { if (esEntrada) sEE += sub; else sEK += sub; } else { if (esEntrada) sTE += sub; else sTK += sub; }
      });

      setInventarioProductos(nuevoInventario);
      if (sEK > 0) setCajaEfectivoKiosco(p => p + sEK); if (sTK > 0) setCajaTransferKiosco(p => p + sTK);
      if (sEE > 0) setCajaEfectivoEntradas(p => p + sEE); if (sTE > 0) setCajaTransferEntradas(p => p + sTE);
      
      setTicketCounter(prev => prev + 1);
      setCarritoKiosco([]); setModalPagoPOS(null); setMontoRecibidoEfectivo(''); 
      alert(`Ticket #${ticketCounter.toString().padStart(3, '0')} generado con éxito.`);
    };

    const registrarCuentaPendiente = (e) => {
      e.preventDefault();
      const nuevaDeuda = { 
        id: nextId(), nombre: nombreFiado, detalle: detalleFiado || carritoKiosco.map(i => `${i.cant}x ${i.nombre}`).join(', '), 
        monto: totalCarrito, fecha: new Date().toLocaleDateString('es-CL')
      };
      let nuevoInv = [...inventarioProductos];
      carritoKiosco.forEach(iC => { nuevoInv = nuevoInv.map(p => (p.id === iC.id ? { ...p, stock: Math.max(0, p.stock - iC.cant) } : p)); });
      
      setInventarioProductos(nuevoInv); setFiadosLista([...fiadosLista, nuevaDeuda]);
      setCarritoKiosco([]); setModalPagoPOS(null); setNombreFiado(''); setDetalleFiado('');
      setTicketCounter(c => c + 1);
      alert("La cuenta ha sido registrada en Fiados.");
    };

    if (!cajaAbierta) {
      return (
        <div className="fade-in text-center" style={{ padding: '40px 20px', display: 'flex', flexDirection: 'column', justifyContent: 'center', height: '100%' }}>
          <div className="escudo-club-login" style={{background: '#FF9500', color: 'white'}}>🔒</div>
          <h2 style={{color: 'var(--texto-principal)'}}>Caja Bloqueada</h2>
          <p style={{color: 'var(--texto-secundario)'}}>Completa los datos de apertura de turno para habilitar ventas.</p>
          <div className="card" style={{textAlign: 'left'}}>
            <div className="input-group mb-10"><label style={{fontSize: '12px', fontWeight: 'bold'}}>Responsable de Turno</label><input type="text" className="form-input" value={datosCaja.responsable} onChange={(e)=>setDatosCaja({...datosCaja, responsable: e.target.value})} placeholder="Ej: María Tesorera" /></div>
            <div className="input-group mb-10"><label style={{fontSize: '12px', fontWeight: 'bold'}}>Fecha de Caja</label><input type="date" className="form-input" value={datosCaja.dia} onChange={(e)=>setDatosCaja({...datosCaja, dia: e.target.value})} /></div>
            <div className="input-group mb-15"><label style={{fontSize: '12px', fontWeight: 'bold'}}>Sencillo Inicial (CLP)</label><input type="number" className="form-input" value={datosCaja.montoInicial} onChange={(e)=>setDatosCaja({...datosCaja, montoInicial: e.target.value})} placeholder="Ej: 20000" /></div>
            <button className="btn-electric" disabled={!datosCaja.responsable || !datosCaja.dia || !datosCaja.montoInicial} onClick={() => setCajaAbierta(true)}>DESBLOQUEAR SISTEMA</button>
          </div>
        </div>
      );
    }

    return (
      <div className="kiosco-container fade-in kiosco-shell">
        <div className="staff-header-info mb-15 kiosco-header-card" style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--blanco-tarjeta)', padding: '15px', borderRadius: '16px', boxShadow: '0 4px 10px rgba(0,0,0,0.03)'}}>
          <div><h4 style={{margin: '0 0 5px 0', color: 'var(--texto-heading)', fontSize: '15px'}}>Caja Activa: {datosCaja.dia}</h4><span style={{fontSize: '12px', color: 'var(--texto-secundario)', fontWeight: 'bold'}}>👤 {datosCaja.responsable} | 🎫 Ticket: #{ticketCounter.toString().padStart(3, '0')}</span></div>
          <button style={{background: '#FF3B30', color: 'white', border: 'none', padding: '8px 12px', borderRadius: '8px', fontSize: '11px', fontWeight: '900', cursor: 'pointer'}} onClick={()=>setCajaAbierta(false)}>Cerrar Turno</button>
        </div>

        {modalPagoPOS === 'efectivo' && (
          <div className="modal-overlay-alert"><div className="modal-alert-card text-center"><h3>Cobro Efectivo</h3><p>Total: <strong style={{fontSize:'22px'}}>${totalCarrito.toLocaleString('es-CL')}</strong></p><div style={{display:'flex', gap:'10px', justifyContent:'center'}} className="mb-15"><button className="btn-secondary" style={{padding:'10px', fontSize:'13px'}} onClick={() => setMontoRecibidoEfectivo(totalCarrito)}>Exacto</button><button className="btn-secondary" style={{padding:'10px', fontSize:'13px'}} onClick={() => setMontoRecibidoEfectivo(10000)}>$10k</button><button className="btn-secondary" style={{padding:'10px', fontSize:'13px'}} onClick={() => setMontoRecibidoEfectivo(20000)}>$20k</button></div><input type="number" className="form-input" placeholder="¿Con cuánto paga?" value={montoRecibidoEfectivo} onChange={(e) => setMontoRecibidoEfectivo(e.target.value)} />{Number(montoRecibidoEfectivo) >= totalCarrito && (<div className="vuelto-display">VUELTO: ${(Number(montoRecibidoEfectivo) - totalCarrito).toLocaleString('es-CL')}</div>)}<div className="modal-alert-buttons mt-20"><button className="btn-modal-cancelar" onClick={() => setModalPagoPOS(null)}>Atrás</button><button className="btn-modal-confirmar" style={{background: 'var(--verde-victoria)'}} onClick={() => { if(Number(montoRecibidoEfectivo) < totalCarrito) return alert("Falta dinero."); finalizarDespachoPOS('efectivo'); }}>Cobrar</button></div></div></div>
        )}
        {modalPagoPOS === 'transferencia' && (
          <div className="modal-overlay-alert"><div className="modal-alert-card text-center"><ShieldAlert size={40} color="var(--azul-electrico)" style={{margin:'0 auto 10px auto'}}/><h3>Validar Transferencia</h3><div className="modal-alert-buttons mt-20"><button className="btn-modal-cancelar" onClick={() => setModalPagoPOS(null)}>Cancelar</button><button className="btn-modal-confirmar" style={{background: 'var(--azul-electrico)'}} onClick={() => finalizarDespachoPOS('transferencia')}>Verificado</button></div></div></div>
        )}
        {modalPagoPOS === 'fiado' && (
          <div className="modal-overlay-alert"><div className="modal-alert-card"><h3 className="text-center">Dejar Pendiente</h3><form onSubmit={registrarCuentaPendiente}><input type="text" className="form-input mb-10" required placeholder="Nombre (Ej: Papá de Tomás)" value={nombreFiado} onChange={(e)=>setNombreFiado(e.target.value)}/><input type="text" className="form-input mb-15" placeholder="Descripción adicional" value={detalleFiado} onChange={(e)=>setDetalleFiado(e.target.value)}/><div className="modal-alert-buttons"><button type="button" className="btn-modal-cancelar" onClick={() => setModalPagoPOS(null)}>Cancelar</button><button type="submit" className="btn-modal-confirmar" style={{background: '#FF9500'}}>Anotar Deuda</button></div></form></div></div>
        )}

        <div className="scroll-horizontal-menu mb-15">
          <div className="segment-control">
            <div className={`segment-btn ${vistaKiosco === 'pos' ? 'active' : ''}`} onClick={() => setVistaKiosco('pos')}>Vender</div>
            <div className={`segment-btn ${vistaKiosco === 'caja' ? 'active' : ''}`} onClick={() => setVistaKiosco('caja')}>Caja</div>
            <div className={`segment-btn ${vistaKiosco === 'inventario' ? 'active' : ''}`} onClick={() => setVistaKiosco('inventario')}>Inventario</div>
            <div className={`segment-btn ${vistaKiosco === 'analitica' ? 'active' : ''}`} onClick={() => setVistaKiosco('analitica')}>Analítica</div>
            <div className={`segment-btn ${vistaKiosco === 'fiados' ? 'active' : ''}`} onClick={() => setVistaKiosco('fiados')}>Pendientes</div>
          </div>
        </div>

        {vistaKiosco === 'pos' && (
          <div className="kiosco-tablet-layout">
            <div className="kiosco-grid">
              {inventarioProductos.map(prod => {
                const isCritico = prod.stock > 0 && prod.stock <= 5;
                const colorCat = getColorPorCategoria(prod.categoria);
                return (
                  <div key={prod.id} className={`kiosco-item ${prod.stock <= 0 ? 'producto-agotado-card' : ''}`} 
                       style={{background: colorCat.bg, borderColor: colorCat.border}}
                       onClick={() => { if(prod.stock > 0) {
                         // Haptic UI Simulation
                         const elem = document.getElementById(`prod-${prod.id}`);
                         if(elem) { elem.style.transform = 'scale(0.9)'; setTimeout(()=> elem.style.transform = 'scale(1)', 100); }
                         const existente = carritoKiosco.find(i => i.id === prod.id);
                         if (existente) {
                           setCarritoKiosco(carritoKiosco.map(i => i.id === prod.id ? {...i, cant: i.cant + 1} : i));
                         } else {
                           setCarritoKiosco([...carritoKiosco, {...prod, cant: 1}]);
                         }
                       }}}>
                    <div id={`prod-${prod.id}`} className="kiosco-item-inner" style={{transition: '0.1s'}}>
                      <span className="kiosco-emoji">{prod.emoji}</span>
                      <span className="kiosco-nombre" style={{color: colorCat.text}}>{prod.nombre}</span>
                      <span className="kiosco-stock-label" style={{color: isCritico ? '#FF3B30' : colorCat.text}}>Stock: {prod.stock}</span>
                      <span className="kiosco-precio" style={{color: colorCat.text}}>${prod.precio}</span>
                    </div>
                    {prod.stock <= 0 && <span className="badge-agotado-tag">AGOTADO</span>}
                    {isCritico && <span className="badge-critico-tag" style={{position:'absolute', top: 5, left: 5, background:'#FF9500', color:'white', fontSize:'8px', padding:'2px 4px', borderRadius:'4px'}}>CRÍTICO</span>}
                  </div>
                );
              })}
            </div>
            
            <div className="card kiosco-cart mt-20">
              <div className="cart-header-row">
                <h4 className="form-subtitle" style={{margin: 0}}>Ticket #{ticketCounter.toString().padStart(3, '0')}</h4>
                {carritoKiosco.length > 0 && (
                  <button className="btn-borrar-carrito" onClick={() => { if(window.confirm('¿Borrar el contenido del carrito? El número de ticket se mantiene.')) { setCarritoKiosco([]); } }}>
                    🗑 Borrar Contenido
                  </button>
                )}
              </div>
              {carritoKiosco.length === 0 && <p className="text-center text-muted" style={{fontStyle: 'italic', margin: '20px 0'}}>Carrito vacío.</p>}
              {carritoKiosco.length > 0 && (
                <div className="cart-items-list">
                  {carritoKiosco.map(item => (
                    <div key={item.id} className="cart-item-row">
                      <div className="cart-item-info"><span className="cart-item-cant">{item.cant}x</span><span className="cart-item-name">{item.nombre}</span></div>
                      <div className="cart-item-actions"><span className="cart-item-subtotal">${(item.precio * item.cant).toLocaleString('es-CL')}</span><button className="cart-btn-restar" onClick={() => { if(item.cant === 1) setCarritoKiosco(carritoKiosco.filter(i => i.id !== item.id)); else setCarritoKiosco(carritoKiosco.map(i => i.id === item.id ? {...i, cant: i.cant - 1} : i)); }}>-</button></div>
                    </div>
                  ))}
                  <div className="cart-total-row mt-15"><span>TOTAL A PAGAR</span><h2>${totalCarrito.toLocaleString('es-CL')}</h2></div>
                  <div className="cart-pay-buttons mt-15">
                    <button className="btn-pago efectivo" onClick={() => setModalPagoPOS('efectivo')}>💵 Efectivo</button>
                    <button className="btn-pago transferencia" onClick={() => setModalPagoPOS('transferencia')}>📱 Transfer</button>
                    <button className="btn-pago" style={{background: '#FF9500'}} onClick={() => setModalPagoPOS('fiado')}>📝 Fiado</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {vistaKiosco === 'caja' && (
          <div className="fade-in">
            <div className="checkout-total-box"><span style={{color: 'rgba(255,255,255,0.7)'}}>Efectivo Físico Neto en Caja</span><h2 style={{color: 'white', textShadow: 'none'}}>${cajaNetaFinal.toLocaleString('es-CL')}</h2><span style={{fontSize:'12px', color:'rgba(255,255,255,0.6)', marginTop:'8px'}}>Apertura: ${Number(datosCaja.montoInicial).toLocaleString('es-CL')}</span></div>
            <div className="caja-doble-grid mt-15">
               <div className="card sub-caja-card"><h5 className="sub-caja-title">📖 Kiosco</h5><div className="desglose-row"><span>Efec:</span><strong style={{color:'var(--verde-victoria)'}}>+${cajaEfectivoKiosco.toLocaleString('es-CL')}</strong></div><div className="desglose-row"><span>Trans:</span><strong>+${cajaTransferKiosco.toLocaleString('es-CL')}</strong></div></div>
               <div className="card sub-caja-card"><h5 className="sub-caja-title" style={{color:'var(--azul-electrico)'}}>🎟️ Entradas</h5><div className="desglose-row"><span>Efec:</span><strong style={{color:'var(--verde-victoria)'}}>+${cajaEfectivoEntradas.toLocaleString('es-CL')}</strong></div><div className="desglose-row"><span>Trans:</span><strong>+${cajaTransferEntradas.toLocaleString('es-CL')}</strong></div></div>
            </div>
            <div className="card mt-15">
              <h4 className="form-subtitle" style={{color: '#FF3B30'}}><Wallet size={16}/> Registrar Egreso (Salida)</h4>
              <div style={{display:'flex', gap:'10px'}} className="mt-10"><input type="text" className="form-input" style={{flex: 2}} placeholder="Glosa (Ej: Árbitros)" value={gastoRegistro.desc} onChange={(e)=>setGastoRegistro({...gastoRegistro, desc: e.target.value})}/><input type="number" className="form-input" style={{flex: 1}} placeholder="Monto" value={gastoRegistro.monto} onChange={(e)=>setGastoRegistro({...gastoRegistro, monto: e.target.value})}/><button className="btn-electric" style={{background:'#FF3B30', width:'auto', padding:'0 15px'}} onClick={()=>{ if(!gastoRegistro.desc || !gastoRegistro.monto) return; setEgresosLista([...egresosLista, {id: nextId(), desc: gastoRegistro.desc, monto: Number(gastoRegistro.monto)}]); setGastoRegistro({desc:'', monto:''}); }}>Restar</button></div>
              {egresosLista.length > 0 && (<div className="egresos-list mt-15"><span style={{fontSize:'12px', fontWeight:'800', color:'var(--texto-secundario)'}}>Egresos de Hoy</span>{egresosLista.map(eg => (<div key={eg.id} className="egreso-row mt-5"><span className="egreso-desc">❌ {eg.desc}</span><span className="egreso-monto">-${eg.monto.toLocaleString('es-CL')}</span></div>))}</div>)}
            </div>
            <button className="btn-secondary mt-15" style={{background: 'rgba(0,122,255,0.1)'}} onClick={()=>alert("Descargando PDF del Libro de Caja...")}><FileDown size={18}/> Exportar Reporte del Día</button>
          </div>
        )}

        {vistaKiosco === 'inventario' && (
          <div className="fade-in">
            <div className="card mb-15">
              <h4 className="form-subtitle">Crear Producto / Ingreso</h4>
              <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px'}} className="mb-10">
                <input type="text" className="form-input" placeholder="Nombre" value={nuevoProducto.nombre} onChange={(e)=>setNuevoProducto({...nuevoProducto, nombre: e.target.value})} />
                <input type="text" className="form-input" placeholder="Emoji (Ej: 🍫)" value={nuevoProducto.emoji} onChange={(e)=>setNuevoProducto({...nuevoProducto, emoji: e.target.value})} />
                <input type="number" className="form-input" placeholder="Costo Compra ($)" value={nuevoProducto.costo} onChange={(e)=>setNuevoProducto({...nuevoProducto, costo: e.target.value})} />
                <input type="number" className="form-input" placeholder="Precio Venta ($)" value={nuevoProducto.precio} onChange={(e)=>setNuevoProducto({...nuevoProducto, precio: e.target.value})} />
                <select className="form-input" style={{gridColumn: '1 / -1'}} value={nuevoProducto.categoria} onChange={(e)=>setNuevoProducto({...nuevoProducto, categoria: e.target.value})}>
                  <option value="Bebida">Bebida</option><option value="Comida">Comida</option><option value="Entradas">Entradas/Otros</option>
                </select>
              </div>
              <button className="btn-electric" onClick={() => {
                if(!nuevoProducto.nombre || !nuevoProducto.precio) return alert("Faltan datos");
                setInventarioProductos([...inventarioProductos, { id: nextId(), ...nuevoProducto, stock: 10, ventas: 0 }]);
                setNuevoProducto({ nombre: '', emoji: '', costo: '', precio: '', categoria: 'Bebida' }); alert("Producto Creado");
              }}>Añadir al Catálogo</button>
            </div>
            <div className="card">
              <h4 className="form-subtitle">Stock Actual</h4>
              <div className="roster-list mt-10">
                {inventarioProductos.map(prod => (
                  <div key={prod.id} className="roster-item" style={{display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid rgba(0,0,0,0.05)', alignItems: 'center'}}>
                    <div><span style={{fontSize: '24px', marginRight:'10px'}}>{prod.emoji}</span><strong style={{color: 'var(--texto-principal)'}}>{prod.nombre}</strong><br/><span style={{fontSize:'11px', color:'var(--texto-secundario)', fontWeight:'bold'}}>Costo: ${prod.costo} | Venta: ${prod.precio}</span></div>
                    <div style={{display:'flex', flexDirection:'column', alignItems:'flex-end', gap:'8px'}}>
                      {/* Control de stock +/- */}
                      <div style={{display:'flex', alignItems:'center', gap:'6px'}}>
                        <button style={{width:'28px', height:'28px', border:'none', borderRadius:'8px', background:'var(--rojo-alerta)', color:'white', fontWeight:'900', fontSize:'17px', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', lineHeight:1}} onClick={() => setInventarioProductos(inventarioProductos.map(p => p.id === prod.id ? {...p, stock: Math.max(0, p.stock - 1)} : p))}>-</button>
                        <input type="number" style={{width:'50px', textAlign:'center', padding:'4px 4px', border:'1.5px solid var(--borde-suave)', borderRadius:'8px', background:'var(--fondo-input)', color: prod.stock <= 5 ? '#FF3B30' : 'var(--texto-principal)', fontWeight:'900', fontSize:'14px'}} value={prod.stock} onChange={(e) => setInventarioProductos(inventarioProductos.map(p => p.id === prod.id ? {...p, stock: Math.max(0, parseInt(e.target.value)||0)} : p))}/>
                        <button style={{width:'28px', height:'28px', border:'none', borderRadius:'8px', background:'var(--verde-victoria)', color:'white', fontWeight:'900', fontSize:'17px', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', lineHeight:1}} onClick={() => setInventarioProductos(inventarioProductos.map(p => p.id === prod.id ? {...p, stock: p.stock + 1} : p))}>+</button>
                      </div>
                      {/* Precio editable */}
                      <div style={{display:'flex', alignItems:'center', gap:'4px', background:'var(--fondo-input)', padding:'4px 8px', borderRadius:'8px', border:'1.5px solid var(--borde-suave)'}}>
                        <span style={{fontSize:'11px', color:'var(--texto-secundario)', fontWeight:'800'}}>$</span>
                        <input type="number" style={{width:'64px', border:'none', background:'transparent', color:'var(--texto-principal)', fontWeight:'900', fontSize:'13px', textAlign:'center', outline:'none'}} value={prod.precio} onChange={(e) => setInventarioProductos(inventarioProductos.map(p => p.id === prod.id ? {...p, precio: parseInt(e.target.value)||0} : p))}/>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {vistaKiosco === 'analitica' && (
          <div className="fade-in">
            <h3 className="section-title">Inteligencia de Negocio</h3>
            <div className="card" style={{borderLeft: '4px solid var(--verde-victoria)'}}>
               <h4 className="form-subtitle"><TrendingUp size={16} color="var(--verde-victoria)"/> Top 3 Más Vendidos</h4>
               {[...inventarioProductos].sort((a,b) => b.ventas - a.ventas).slice(0,3).map((p, i) => (
                 <div key={p.id} className="desglose-row mt-10" style={{fontSize:'15px'}}><span>{i+1}. {p.emoji} {p.nombre}</span><strong style={{color: 'var(--verde-victoria)'}}>{p.ventas} ud.</strong></div>
               ))}
            </div>
            <div className="card mt-15" style={{borderLeft: '4px solid #FF3B30'}}>
               <h4 className="form-subtitle"><TrendingDown size={16} color="#FF3B30"/> Menos Movimiento</h4>
               {[...inventarioProductos].sort((a,b) => a.ventas - b.ventas).slice(0,2).map((p, i) => (
                 <div key={p.id} className="desglose-row mt-10" style={{fontSize:'15px'}}><span>{p.emoji} {p.nombre}</span><strong style={{color: '#FF3B30'}}>{p.ventas} ud.</strong></div>
               ))}
            </div>
          </div>
        )}

        {vistaKiosco === 'fiados' && (
          <div className="fade-in">
            <div className="checkout-total-box mb-15" style={{background: 'linear-gradient(135deg, #FF9500, #E65100)', border: 'none', padding: '20px'}}><span style={{color: 'rgba(255,255,255,0.8)'}}>Dinero en la calle</span><h2 style={{color: 'white', textShadow: 'none', fontSize: '32px'}}>${fiadosLista.reduce((a,b)=>a+b.monto,0).toLocaleString('es-CL')}</h2></div>
            {fiadosLista.length === 0 ? <p className="text-center text-muted card" style={{fontStyle:'italic'}}>Sin deudas pendientes hoy.</p> : null}
            {fiadosLista.map(f => (
              <div key={f.id} className="card" style={{borderLeft: '4px solid #FF9500', padding:'15px'}}>
                 <div style={{display:'flex', justifyContent:'space-between'}}><h4 style={{margin:0, color: 'var(--texto-principal)'}}>{f.nombre}</h4><span style={{fontWeight:'900', color:'#FF9500', fontSize:'16px'}}>${f.monto.toLocaleString('es-CL')}</span></div>
                 <p style={{fontSize: '13px', color: 'var(--texto-secundario)', margin: '8px 0'}}>{f.detalle}</p>
                 <div style={{display:'flex', gap:'8px', marginTop:'10px'}}>
                   <button style={{flex:1, padding:'9px 8px', fontSize:'12px', background:'var(--verde-victoria)', color:'white', border:'none', borderRadius:'10px', fontWeight:'900', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:'5px', boxShadow:'0 4px 10px rgba(52,199,89,0.28)'}} onClick={()=>{ if(window.confirm('¿Deuda cancelada en EFECTIVO?')){ setCajaEfectivoKiosco(p => p + f.monto); setFiadosLista(fiadosLista.filter(i => i.id !== f.id)); setTicketCounter(c => c + 1); } }}>💵 Efectivo</button>
                   <button style={{flex:1, padding:'9px 8px', fontSize:'12px', background:'var(--azul-electrico)', color:'white', border:'none', borderRadius:'10px', fontWeight:'900', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:'5px', boxShadow:'0 4px 10px rgba(0,122,255,0.28)'}} onClick={()=>{ if(window.confirm('¿Deuda cancelada por TRANSFERENCIA?')){ setCajaTransferKiosco(p => p + f.monto); setFiadosLista(fiadosLista.filter(i => i.id !== f.id)); setTicketCounter(c => c + 1); } }}>📱 Transfer</button>
                 </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  // ==========================================
  // 8. MÓDULO SUPER ADMIN (MODO DIOS)
  // ==========================================
  const renderSuperAdmin = () => {
    const enviarAlerta = () => { alert("Notificación enviada por App y Correo a los destinatarios."); };
    const togglePermiso = (idUsuario, permiso) => { setMatrixPermisos(matrixPermisos.map(u => u.id === idUsuario ? {...u, permisos: {...u.permisos, [permiso]: !u.permisos[permiso]}} : u)); };

    const af = {
      totalSocios: 85, sociosAlDia: 67, sociosMorosos: 18,
      metaSocios: 2975000, recaudadoSocios: 2345000,
      totalDeportistas: 124, deportistasAlDia: 106, deportistasMorosos: 18,
      metaDeportistas: 1860000, recaudadoDeportistas: 1590000,
    };
    const pctSocios = Math.round(af.recaudadoSocios / af.metaSocios * 100);
    const pctDep = Math.round(af.recaudadoDeportistas / af.metaDeportistas * 100);
    const pctGlobal = Math.round((af.recaudadoSocios + af.recaudadoDeportistas) / (af.metaSocios + af.metaDeportistas) * 100);
    const morososFiltrados = filtroMorosos === 'todos' ? mockMorosos
      : filtroMorosos === 'socios' ? mockMorosos.filter(m => m.tipo === 'socio' || m.tipo === 'socio-apoderado')
      : mockMorosos.filter(m => m.tipo === 'apoderado' || m.tipo === 'socio-apoderado');
    return (
      <div className="admin-container fade-in">
        <div className="scroll-horizontal-menu mb-15">
          <div className="segment-control" style={{minWidth: '550px'}}>
            <div className={`segment-btn ${vistaAdmin === 'dashboard' ? 'active' : ''}`} onClick={() => setVistaAdmin('dashboard')}>Resumen</div>
            <div className={`segment-btn ${vistaAdmin === 'pagos' ? 'active' : ''}`} onClick={() => setVistaAdmin('pagos')}>Validar Pago</div>
            <div className={`segment-btn ${vistaAdmin === 'citaciones' ? 'active' : ''}`} onClick={() => setVistaAdmin('citaciones')}>Citaciones</div>
            <div className={`segment-btn ${vistaAdmin === 'auditoria' ? 'active' : ''}`} onClick={() => setVistaAdmin('auditoria')}>Auditoría</div>
            <div className={`segment-btn ${vistaAdmin === 'reportes' ? 'active' : ''}`} onClick={() => setVistaAdmin('reportes')}>📊 Reportes</div>
            <div className={`segment-btn ${vistaAdmin === 'cuentas' ? 'active' : ''}`} onClick={() => setVistaAdmin('cuentas')}>🧾 Cuentas</div>
            <div className={`segment-btn ${vistaAdmin === 'salud' ? 'active' : ''}`} onClick={() => { setVistaAdmin('salud'); generarAlertas(); }}>🏥 Salud</div>
            <div className={`segment-btn ${vistaAdmin === 'permisos' ? 'active' : ''}`} onClick={() => setVistaAdmin('permisos')}>Ajustes</div>
          </div>
        </div>

        {vistaAdmin === 'dashboard' && (
          <div className="fade-in">

            {/* ─ ANILLO GLOBAL ─ */}
            <div className="card text-center admin-panel-card mb-5">
              <h4 className="form-subtitle" style={{justifyContent:'center'}}>Recaudación Global — Jul 2026</h4>
              <div className="radial-progress-container mt-10 mb-10" style={{position:'relative', width:'130px', height:'130px', margin:'0 auto'}}>
                <svg viewBox="0 0 100 100" style={{transform:'rotate(-90deg)', width:'100%', height:'100%'}}>
                  <circle cx="50" cy="50" r="45" fill="transparent" stroke="var(--borde-suave)" strokeWidth="10"/>
                  <circle cx="50" cy="50" r="45" fill="transparent" stroke="url(#gradG)" strokeWidth="10" strokeDasharray={`${pctGlobal * 2.82} 300`} strokeLinecap="round" style={{transition:'stroke-dasharray 1s ease'}}/>
                  <defs><linearGradient id="gradG" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stopColor="var(--azul-electrico)"/><stop offset="100%" stopColor="var(--verde-victoria)"/></linearGradient></defs>
                </svg>
                <div style={{position:'absolute', top:'50%', left:'50%', transform:'translate(-50%,-50%)', textAlign:'center'}}>
                  <h2 style={{margin:0, fontSize:'22px'}}>{pctGlobal}%</h2>
                  <span style={{fontSize:'9px', fontWeight:'bold', color:'var(--texto-secundario)'}}>LOGRADO</span>
                </div>
              </div>
              <h3 style={{margin:'0 0 4px', fontSize:'20px', color:'var(--texto-principal)'}}>${(af.recaudadoSocios + af.recaudadoDeportistas).toLocaleString('es-CL')}</h3>
              <span style={{fontSize:'12px', color:'var(--texto-secundario)', fontWeight:'bold'}}>Meta mensual: ${(af.metaSocios + af.metaDeportistas).toLocaleString('es-CL')}</span>
            </div>

            {/* ─ SOCIOS ─ */}
            <h3 className="section-title mt-20">Socios del Club</h3>
            <div className="caja-triple-grid mb-15">
              <div className="admin-stat-pill verde"><span>Al Día</span><h2>{af.sociosAlDia}</h2></div>
              <div className="admin-stat-pill rojo"><span>Morosos</span><h2>{af.sociosMorosos}</h2></div>
              <div className="admin-stat-pill azul"><span>Total</span><h2>{af.totalSocios}</h2></div>
            </div>
            <div className="card mb-20" style={{borderLeft:'4px solid var(--azul-electrico)'}}>
              <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                <span style={{fontSize:'12px', fontWeight:'800', color:'var(--texto-secundario)', textTransform:'uppercase', letterSpacing:'0.5px'}}>Recaudación Socios</span>
                <span style={{fontWeight:'900', color:'var(--azul-electrico)', fontSize:'14px'}}>{pctSocios}%</span>
              </div>
              <div className="recaud-bar mt-10"><div className="recaud-bar-fill" style={{width:`${pctSocios}%`, background:'linear-gradient(90deg, var(--azul-electrico), var(--verde-victoria))'}}></div></div>
              <div style={{display:'flex', justifyContent:'space-between', marginTop:'8px'}}>
                <span style={{fontSize:'12px', color:'var(--verde-victoria)', fontWeight:'800'}}>✓ ${af.recaudadoSocios.toLocaleString('es-CL')}</span>
                <span style={{fontSize:'12px', color:'var(--rojo-alerta)', fontWeight:'800'}}>✗ ${(af.metaSocios - af.recaudadoSocios).toLocaleString('es-CL')} pendiente</span>
              </div>
            </div>

            {/* ─ DEPORTISTAS ─ */}
            <h3 className="section-title">Deportistas Inscritos</h3>
            <div className="caja-triple-grid mb-15">
              <div className="admin-stat-pill verde"><span>Al Día</span><h2>{af.deportistasAlDia}</h2></div>
              <div className="admin-stat-pill rojo"><span>Morosos</span><h2>{af.deportistasMorosos}</h2></div>
              <div className="admin-stat-pill azul"><span>Total</span><h2>{af.totalDeportistas}</h2></div>
            </div>
            <div className="card mb-20" style={{borderLeft:'4px solid #FF9500'}}>
              <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                <span style={{fontSize:'12px', fontWeight:'800', color:'var(--texto-secundario)', textTransform:'uppercase', letterSpacing:'0.5px'}}>Recaudación Deportistas</span>
                <span style={{fontWeight:'900', color:'#FF9500', fontSize:'14px'}}>{pctDep}%</span>
              </div>
              <div className="recaud-bar mt-10"><div className="recaud-bar-fill" style={{width:`${pctDep}%`, background:'linear-gradient(90deg, #FF9500, var(--verde-victoria))'}}></div></div>
              <div style={{display:'flex', justifyContent:'space-between', marginTop:'8px'}}>
                <span style={{fontSize:'12px', color:'var(--verde-victoria)', fontWeight:'800'}}>✓ ${af.recaudadoDeportistas.toLocaleString('es-CL')}</span>
                <span style={{fontSize:'12px', color:'var(--rojo-alerta)', fontWeight:'800'}}>✗ ${(af.metaDeportistas - af.recaudadoDeportistas).toLocaleString('es-CL')} pendiente</span>
              </div>
            </div>

            {/* ─ MOROSOS ─ */}
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'12px'}}>
              <h3 className="section-title" style={{margin:0}}>Morosos</h3>
              <button className="btn-notificar" style={{background:'var(--rojo-alerta)', color:'white', borderColor:'var(--rojo-alerta)', boxShadow:'0 4px 12px rgba(255,59,48,0.3)'}} onClick={() => alert(`Notificación masiva enviada a ${mockMorosos.length} deudores.`)}>
                <Bell size={13}/> Notificar Todos
              </button>
            </div>
            <div className="filter-chips mb-15">
              <button className={`filter-chip ${filtroMorosos === 'todos' ? 'active' : ''}`} onClick={() => setFiltroMorosos('todos')}>Todos ({mockMorosos.length})</button>
              <button className={`filter-chip ${filtroMorosos === 'socios' ? 'active' : ''}`} onClick={() => setFiltroMorosos('socios')}>Socios ({mockMorosos.filter(m => m.tipo === 'socio' || m.tipo === 'socio-apoderado').length})</button>
              <button className={`filter-chip ${filtroMorosos === 'apoderados' ? 'active' : ''}`} onClick={() => setFiltroMorosos('apoderados')}>Apoderados ({mockMorosos.filter(m => m.tipo === 'apoderado' || m.tipo === 'socio-apoderado').length})</button>
            </div>
            {[...morososFiltrados].sort((a,b) => b.mesesDeuda - a.mesesDeuda).map(m => {
              const gravedad = m.mesesDeuda >= 3 ? 'var(--rojo-alerta)' : m.mesesDeuda === 2 ? '#FF9500' : '#DDAA00';
              const { bg, color } = colorTipo(m.tipo);
              const labelTipo = m.tipo === 'socio' ? 'Socio' : m.tipo === 'apoderado' ? 'Apoderado' : 'Socio / Apod.';
              return (
                <div key={m.id} className="moroso-row" style={{borderLeft:`4px solid ${gravedad}`}}>
                  <div className="moroso-info">
                    <span className="moroso-nombre">{m.nombre}</span>
                    <div style={{display:'flex', alignItems:'center', gap:'6px', marginTop:'5px', flexWrap:'wrap'}}>
                      <span className="moroso-tipo-badge" style={{background:bg, color}}>{labelTipo}</span>
                      {m.pupilos.length > 0 && <span style={{fontSize:'11px', color:'var(--texto-secundario)', fontWeight:'700'}}>👤 {m.pupilos.join(' · ')}</span>}
                    </div>
                    <span style={{fontSize:'11px', color:'var(--texto-secundario)', marginTop:'4px', display:'block', fontWeight:'700'}}>📞 {m.contacto}</span>
                  </div>
                  <div className="moroso-deuda">
                    <span className="moroso-monto">${m.montoDeuda.toLocaleString('es-CL')}</span>
                    <span className="moroso-meses" style={{color: gravedad}}>{m.mesesDeuda} {m.mesesDeuda === 1 ? 'mes' : 'meses'}</span>
                  </div>
                  <button className="btn-notificar" onClick={() => alert(`Notificación enviada a ${m.nombre}\n📞 ${m.contacto}`)}>
                    <Bell size={13}/> Avisar
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {vistaAdmin === 'pagos' && (
          <div className="fade-in">
            <h3 className="section-title">Bandeja de Validación</h3>
            {pagosPendientesAdmin.length === 0 ? <p className="text-muted text-center italic mt-20">Sin comprobantes pendientes.</p> : null}
            {pagosPendientesAdmin.map(pago => (
              <div key={pago.id} className="card" style={{borderLeft: '4px solid var(--azul-electrico)'}}>
                 <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                    <div><h4 style={{margin: 0, color: 'var(--texto-heading)', fontSize: '16px'}}>{pago.familia}</h4><span style={{fontSize: '11px', color: 'var(--texto-secundario)'}}>ID Transacción: #{pago.id}</span></div>
                    <span style={{fontWeight: '900', fontSize: '20px', color: 'var(--azul-electrico)'}}>${pago.monto.toLocaleString('es-CL')}</span>
                 </div>
                 <p style={{fontSize: '13px', margin: '15px 0', color: 'var(--texto-principal)'}}><strong>Detalle:</strong> {pago.detalle}</p>
                 
                 <div className="foto-upload-box mb-15" style={{padding: '15px', background: 'rgba(0,122,255,0.05)', borderColor: 'rgba(0,122,255,0.2)'}}>
                   <FileText size={24} color="var(--azul-electrico)"/>
                   <span style={{fontSize: '12px', fontWeight: 'bold', color: 'var(--azul-electrico)'}}>Ver Comprobante Adjunto</span>
                 </div>

                 <div style={{display: 'flex', gap: '10px'}}>
                    <button style={{flex: 1, padding: '12px', background: 'var(--verde-victoria)', color: 'white', border: 'none', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems:'center', justifyContent:'center', gap:'5px'}} onClick={() => { alert("Pago Aprobado."); setPagosPendientesAdmin(pagosPendientesAdmin.filter(p=>p.id!==pago.id)); }}><CheckSquare size={16}/> Aprobar</button>
                    <button style={{flex: 1, padding: '12px', background: '#FF3B30', color: 'white', border: 'none', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems:'center', justifyContent:'center', gap:'5px'}} onClick={() => alert("Pago Rechazado.")}><XSquare size={16}/> Rechazar</button>
                 </div>
              </div>
            ))}
          </div>
        )}

        {vistaAdmin === 'auditoria' && (
          <div className="fade-in card">
             <h4 className="form-subtitle"><History size={16}/> Log de Movimientos</h4>
             <p style={{fontSize: '12px', color: 'var(--texto-secundario)', marginBottom: '20px'}}>Registro inmutable de acciones críticas del sistema.</p>
             {logAuditoria.map(log => (
               <div key={log.id} style={{borderBottom: '1px dashed rgba(0,0,0,0.1)', paddingBottom: '12px', marginBottom: '12px'}}>
                  <div style={{display: 'flex', justifyContent: 'space-between'}}><strong style={{fontSize: '14px', color: 'var(--texto-heading)'}}>{log.accion}</strong><span style={{fontSize: '12px', color: 'var(--azul-electrico)', fontWeight: 'bold'}}>{log.hora}</span></div>
                  <div style={{fontSize: '13px', color: 'var(--texto-principal)', margin: '5px 0'}}>{log.detalle}</div>
                  <span style={{fontSize: '11px', color: 'var(--texto-secundario)', fontWeight: 'bold'}}>👤 Usuario Auth: {log.usuario}</span>
               </div>
             ))}
          </div>
        )}
        
        {vistaAdmin === 'citaciones' && (
          <div className="fade-in">
            <h3 className="section-title">Creador de Convocatorias</h3>
            <div className="card mt-15">
              <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'15px'}}>
                <h4 className="form-subtitle" style={{margin:0}}>Nómina FIBA (Tope 12)</h4>
                <span style={{background: nominaCita.filter(j => j.citado).length >= 12 ? '#FF3B30' : 'var(--verde-victoria)', color: 'white', padding: '6px 12px', borderRadius: '10px', fontSize:'12px', fontWeight:'900'}}>
                  {nominaCita.filter(j => j.citado).length}/12 Cupos
                </span>
              </div>
              <button className="btn-secondary mb-15" style={{fontSize: '13px', padding: '12px'}}><User size={16}/> Subir jugador de otra categoría (Call-up)</button>
              
              {nominaCita.map(jugador => (
                <div key={jugador.id} style={{display:'flex', justifyContent:'space-between', alignItems:'center', padding:'15px', background: jugador.deuda ? 'rgba(255,59,48,0.05)' : (jugador.lesion ? 'rgba(0,0,0,0.05)' : 'var(--fondo-app)'), border: `1px solid ${jugador.deuda ? '#FF3B30' : 'rgba(0,0,0,0.05)'}`, borderRadius:'12px', marginBottom:'10px'}}>
                   <div style={{display:'flex', flexDirection:'column'}}>
                     <strong style={{fontSize:'15px', color: 'var(--texto-principal)'}}>{jugador.nombre} {jugador.deuda && '⚠️'} {jugador.lesion && '🚑'}</strong>
                     <span style={{fontSize: '12px', color: 'var(--texto-secundario)', marginTop: '4px', fontWeight: 'bold'}}>POS: {jugador.pos} | Cat: {jugador.catOriginal}</span>
                   </div>
                   {jugador.lesion ? (
                     <span style={{fontSize:'11px', color:'#FF3B30', fontWeight:'900'}}>NO DISPONIBLE</span>
                   ) : jugador.deuda ? (
                     <button style={{background:'#FF9500', color:'white', border:'none', padding:'8px 12px', borderRadius:'8px', fontSize:'11px', fontWeight:'800', cursor:'pointer'}} onClick={() => alert("Excepción autorizada. Administrador asume responsabilidad.")}>Forzar Citación</button>
                   ) : (
                     <input type="checkbox" style={{width:'24px', height:'24px', accentColor: 'var(--azul-electrico)'}} checked={jugador.citado} disabled={!jugador.citado && nominaCita.filter(j => j.citado).length >= 12} onChange={() => setNominaCita(nominaCita.map(j => j.id === jugador.id ? {...j, citado: !j.citado} : j))}/>
                   )}
                </div>
              ))}
              <button className="btn-electric mt-20" onClick={() => alert("Citación publicada y enviada a los Muros.")}>CONFIRMAR Y CITAR</button>
            </div>
          </div>
        )}

        {vistaAdmin === 'reportes' && renderReportes()}

        {vistaAdmin === 'cuentas' && (
          <div className="fade-in">
            <h3 className="section-title">Cuentas por Actualizar</h3>
            <p style={{fontSize: '13px', color: 'var(--texto-secundario)', marginBottom: '12px'}}>
              Completa los datos faltantes y valida RUT chileno antes de guardar.
            </p>

            {cuentasIncompletas.length === 0 && (
              <div className="card text-center" style={{fontWeight: '700', color: 'var(--verde-victoria)'}}>
                Todo bien: no hay cuentas pendientes de completar.
              </div>
            )}

            {cuentasIncompletas.map((c) => (
              <div key={c.id} className="card" style={{marginBottom: '10px', borderLeft: '4px solid #FF9500'}}>
                <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', gap:'10px'}}>
                  <div>
                    <strong style={{fontSize:'14px'}}>{`${c.nombres || 'Sin nombre'} ${c.apellido_paterno || ''}`.trim()}</strong>
                    <div style={{fontSize:'12px', color:'var(--texto-secundario)', marginTop:'4px'}}>
                      {c.correo || 'Sin correo'} · {c.rut || 'Sin RUT'}
                    </div>
                    <div style={{display:'flex', flexWrap:'wrap', gap:'6px', marginTop:'8px'}}>
                      {(c.campos_faltantes || []).map((f) => (
                        <span key={f} style={{fontSize:'11px', background:'rgba(255,149,0,0.14)', color:'#b36200', padding:'4px 8px', borderRadius:'999px', fontWeight:'800'}}>
                          Falta: {f}
                        </span>
                      ))}
                    </div>
                  </div>
                  <button className="btn-notificar" onClick={() => abrirEdicionCuenta(c)}>
                    Completar
                  </button>
                </div>
              </div>
            ))}

            {cuentaEditando && (
              <div className="card" style={{marginTop:'14px', border:'1px solid var(--azul-electrico)'}}>
                <h4 className="form-subtitle">Editar Cuenta #{cuentaEditando.id}</h4>
                <div style={{marginTop:'8px', marginBottom:'8px', fontSize:'12px', fontWeight:'800', color:'var(--texto-secundario)', textTransform:'uppercase', letterSpacing:'0.5px'}}>Identidad</div>
                <div className="form-group"><label>Correo</label><input className="form-input" value={cuentaEditando.correo} onChange={(e)=>actualizarCampoCuenta('correo', e.target.value)} /></div>
                <div className="form-group"><label>RUT</label><input className="form-input" value={cuentaEditando.rut} onChange={(e)=>actualizarCampoCuenta('rut', e.target.value)} style={{borderColor: cuentaEditando.rut && !api.validarRutChileno(cuentaEditando.rut) ? '#FF3B30' : undefined}} /></div>
                {cuentaEditando.rut && !api.validarRutChileno(cuentaEditando.rut) && <p style={{fontSize:'12px', color:'#FF3B30', marginTop:'-6px'}}>RUT invalido</p>}
                <div className="form-group"><label>Nombres</label><input className="form-input" value={cuentaEditando.nombres} onChange={(e)=>actualizarCampoCuenta('nombres', e.target.value)} /></div>
                <div className="form-group"><label>Apellido Paterno</label><input className="form-input" value={cuentaEditando.apellido_paterno} onChange={(e)=>actualizarCampoCuenta('apellido_paterno', e.target.value)} /></div>
                <div className="form-group"><label>Apellido Materno</label><input className="form-input" value={cuentaEditando.apellido_materno} onChange={(e)=>actualizarCampoCuenta('apellido_materno', e.target.value)} /></div>
                <div style={{marginTop:'10px', marginBottom:'8px', fontSize:'12px', fontWeight:'800', color:'var(--texto-secundario)', textTransform:'uppercase', letterSpacing:'0.5px'}}>Contacto</div>
                <div className="form-group"><label>Telefono</label><input className="form-input" value={cuentaEditando.telefono} onChange={(e)=>actualizarCampoCuenta('telefono', e.target.value)} /></div>
                <div className="form-group"><label>Direccion</label><input className="form-input" value={cuentaEditando.direccion} onChange={(e)=>actualizarCampoCuenta('direccion', e.target.value)} /></div>
                <div className="form-group"><label>Comuna</label><input className="form-input" value={cuentaEditando.comuna} onChange={(e)=>actualizarCampoCuenta('comuna', e.target.value)} /></div>
                <div style={{marginTop:'10px', marginBottom:'8px', fontSize:'12px', fontWeight:'800', color:'var(--texto-secundario)', textTransform:'uppercase', letterSpacing:'0.5px'}}>Gestión</div>
                <div className="form-group"><label>Rol</label><input className="form-input" value={cuentaEditando.rol} onChange={(e)=>actualizarCampoCuenta('rol', e.target.value)} /></div>
                <div className="form-group"><label>Estado Civil</label><input className="form-input" value={cuentaEditando.estado_civil} onChange={(e)=>actualizarCampoCuenta('estado_civil', e.target.value)} /></div>
                <div className="form-group"><label>Profesion u Oficio</label><input className="form-input" value={cuentaEditando.profesion_oficio} onChange={(e)=>actualizarCampoCuenta('profesion_oficio', e.target.value)} /></div>
                <div className="form-group"><label>Segundo Contacto</label><input className="form-input" value={cuentaEditando.nombre_segundo_contacto} onChange={(e)=>actualizarCampoCuenta('nombre_segundo_contacto', e.target.value)} /></div>
                <div className="form-group"><label>Parentesco Segundo Contacto</label><input className="form-input" value={cuentaEditando.parentesco_segundo_contacto} onChange={(e)=>actualizarCampoCuenta('parentesco_segundo_contacto', e.target.value)} /></div>
                <div className="form-group"><label>Numero Segundo Contacto</label><input className="form-input" value={cuentaEditando.num_segundo_contacto} onChange={(e)=>actualizarCampoCuenta('num_segundo_contacto', e.target.value)} /></div>
                <div className="form-group"><label>Dia Pago Acordado</label><input className="form-input" type="number" min="1" max="31" value={cuentaEditando.dia_pago_acordado} onChange={(e)=>actualizarCampoCuenta('dia_pago_acordado', e.target.value)} /></div>
                <label style={{display:'flex', alignItems:'center', gap:'8px', marginBottom:'12px', fontSize:'13px'}}>
                  <input type="checkbox" checked={Boolean(cuentaEditando.es_socio)} onChange={(e)=>actualizarCampoCuenta('es_socio', e.target.checked)} />
                  Es socio
                </label>

                <div style={{display:'flex', gap:'8px'}}>
                  <button className="btn-electric" onClick={guardarCuentaPendiente} disabled={guardandoCuenta || !api.validarRutChileno(cuentaEditando.rut)}>
                    {guardandoCuenta ? 'Guardando...' : 'Guardar Cuenta'}
                  </button>
                  <button className="btn-secondary" onClick={() => setCuentaEditando(null)}>Cancelar</button>
                </div>
              </div>
            )}
          </div>
        )}

        {vistaAdmin === 'salud' && (
          <div className="fade-in">
            <div className="scroll-horizontal-menu mb-15">
              <div className="segment-control" style={{minWidth: '300px'}}>
                <div className={`segment-btn ${vistaSaludTab === 'dashboard' ? 'active' : ''}`} onClick={() => setVistaSaludTab('dashboard')}>Dashboard</div>
                <div className={`segment-btn ${vistaSaludTab === 'alertas' ? 'active' : ''}`} onClick={() => setVistaSaludTab('alertas')}>Alertas</div>
                <div className={`segment-btn ${vistaSaludTab === 'timeline' ? 'active' : ''}`} onClick={() => setVistaSaludTab('timeline')}>Timeline</div>
              </div>
            </div>

            {vistaSaludTab === 'dashboard' && renderDashboardSalud()}
            {vistaSaludTab === 'alertas' && renderAlertasPanel()}
            {vistaSaludTab === 'timeline' && renderTimelineActividad()}
          </div>
        )}

        {vistaAdmin === 'permisos' && (
          <div className="fade-in card">
             <h4 className="form-subtitle">Permisos de Sistema</h4>
             <p>Gestión de permisos activa. Configura accesos por rol y módulo según políticas del club.</p>
          </div>
        )}
      </div>
    );
  };

  // ==========================================
  // 9. MESA FIBA AVANZADA (CHROMA KEY & TIMEOUTS)
  // ==========================================
  const renderMesaControl = () => {
    const ejecutarAccionFIBA = (tipo, puntos = 0) => {
      if (!jugadorSeleccionadoLive) return alert("Selecciona un jugador del Roster primero.");
      let nombreJugador = "";
      
      setRosterEquipo(rosterEquipo.map(j => {
        if (j.id === jugadorSeleccionadoLive) {
          nombreJugador = `#${j.dorsal} ${j.nombre}`;
          return { ...j, pts: j.pts + puntos, reb: tipo === 'REB' ? j.reb + 1 : j.reb, ast: tipo === 'AST' ? j.ast + 1 : j.ast, stl: tipo === 'ROBO' ? j.stl + 1 : j.stl, flt: tipo === 'FALTA' ? j.flt + 1 : j.flt, to: tipo === 'PERDIDA' ? j.to + 1 : j.to };
        }
        return j;
      }));
      
      if (puntos > 0) setLiveScore(prev => ({ ...prev, ptsLocal: prev.ptsLocal + puntos }));
      if (tipo === 'FALTA') setLiveScore(prev => ({ ...prev, faltasLocal: prev.faltasLocal + 1 }));
      
      const logTexto = puntos > 0 ? `${nombreJugador} anota ${puntos} pts` : `${nombreJugador} registra ${tipo}`;
      setPlayByPlay([{ id: nextId(), tiempo: liveScore.reloj, texto: logTexto }, ...playByPlay]);
      setJugadorSeleccionadoLive(null);
    };

    // PREMIUM UPGRADE: Modo Pantalla Verde para OBS (Streaming Live)
    if (modoChromaKey) {
      return (
        <div style={{position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: '#00FF00', zIndex: 99999, display: 'flex', alignItems: 'flex-end', padding: '50px'}}>
          <div style={{background: '#1C1C1E', border: '3px solid #333', borderRadius: '15px', padding: '20px 40px', display: 'flex', gap: '40px', alignItems: 'center', boxShadow: '0 20px 50px rgba(0,0,0,0.5)'}}>
            <div className="text-center"><span style={{color: '#aaa', fontSize:'14px', fontWeight:'bold'}}>LOCAL {liveScore.flecha === 'LOCAL' && '◀'}</span><h1 style={{color: 'white', margin: 0, fontSize: '60px', fontFamily: 'Orbitron'}}>{liveScore.ptsLocal}</h1><span style={{color: '#FF3B30', fontSize:'12px', fontWeight:'bold'}}>FALTAS: {liveScore.faltasLocal}</span></div>
            <div className="text-center"><span style={{background: '#333', color: '#00FF00', padding: '10px 20px', borderRadius: '10px', fontSize: '24px', fontWeight: '900', fontFamily: 'Orbitron'}}>{liveScore.reloj}</span><h3 style={{color: 'white', margin: '10px 0 0 0'}}>Q{liveScore.periodo}</h3></div>
            <div className="text-center"><span style={{color: '#aaa', fontSize:'14px', fontWeight:'bold'}}>{liveScore.flecha === 'VISITA' && '▶'} VISITA</span><h1 style={{color: 'white', margin: 0, fontSize: '60px', fontFamily: 'Orbitron'}}>{liveScore.ptsVisita}</h1><span style={{color: '#FF3B30', fontSize:'12px', fontWeight:'bold'}}>FALTAS: {liveScore.faltasVisita}</span></div>
            <button style={{position: 'absolute', top: '10px', right: '10px', background: 'black', color: 'white', border: 'none', padding: '10px', borderRadius: '8px', cursor: 'pointer', opacity: 0.2}} onClick={()=>setModoChromaKey(false)}>Cerrar Modo TV</button>
          </div>
        </div>
      );
    }

    return (
      <div className="fiba-container fade-in">
        <div style={{display: 'flex', justifyContent: 'flex-end', marginBottom: '10px'}}>
          <button className="btn-secondary" style={{width: 'auto', padding: '8px 15px', fontSize: '11px', gap: '5px'}} onClick={()=>setModoChromaKey(true)}><Tv size={14}/> Modo Transmisión (OBS)</button>
        </div>

        {/* MARCADOR DE TRANSMISIÓN CON TIMEOUTS Y FLECHA */}
        <div className="checkout-total-box mb-15" style={{background: '#1C1C1E', border: '2px solid var(--azul-marino)', display: 'flex', flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', padding: '20px 10px'}}>
           <div className="text-center" style={{flex: 1}}>
             <span style={{fontSize: '12px', color: 'var(--texto-secundario)', fontWeight: '800'}}>LOCAL {liveScore.flecha === 'LOCAL' && '◀'}</span>
             <h1 style={{fontSize: '52px', margin: 0, color: 'white', fontFamily: 'Orbitron'}}>{liveScore.ptsLocal}</h1>
             <span style={{fontSize: '11px', color: '#FF3B30', fontWeight: '800', display: 'block'}}>FALTAS: {liveScore.faltasLocal}</span>
             <div style={{display: 'flex', gap: '5px', justifyContent: 'center', marginTop: '8px'}}>
               {[...Array(3)].map((_, i) => <div key={i} style={{width: '10px', height: '10px', borderRadius: '50%', background: i < liveScore.timeoutsLocal ? '#FFD700' : '#333'}}></div>)}
             </div>
           </div>
           
           <div className="text-center" style={{flex: 1}}>
             <span style={{fontSize: '16px', color: 'var(--verde-victoria)', fontWeight: '900', background: 'rgba(52,199,89,0.1)', padding: '8px 20px', borderRadius: '12px', border: '1px solid var(--verde-victoria)'}}>{liveScore.reloj}</span>
             <h4 style={{margin: '10px 0 0 0', color: 'white', fontSize: '18px'}}>Q{liveScore.periodo}</h4>
           </div>
           
           <div className="text-center" style={{flex: 1}}>
             <span style={{fontSize: '12px', color: 'var(--texto-secundario)', fontWeight: '800'}}>{liveScore.flecha === 'VISITA' && '▶'} VISITA</span>
             <h1 style={{fontSize: '52px', margin: 0, color: 'white', fontFamily: 'Orbitron'}}>{liveScore.ptsVisita}</h1>
             <span style={{fontSize: '11px', color: '#FF3B30', fontWeight: '800', display: 'block'}}>FALTAS: {liveScore.faltasVisita}</span>
             <div style={{display: 'flex', gap: '5px', justifyContent: 'center', marginTop: '8px'}}>
               {[...Array(3)].map((_, i) => <div key={i} style={{width: '10px', height: '10px', borderRadius: '50%', background: i < liveScore.timeoutsVisita ? '#FFD700' : '#333'}}></div>)}
             </div>
           </div>
        </div>
        
        {/* BOTONERA DE MESA TÉCNICA */}
        <div style={{display: 'flex', gap: '10px', marginBottom: '20px'}}>
          <button className="btn-secondary" style={{padding: '12px', fontSize: '12px', fontWeight: '800'}} onClick={()=>setLiveScore({...liveScore, timeoutsLocal: Math.max(0, liveScore.timeoutsLocal - 1)})}>TM Local</button>
          <button className="btn-secondary" style={{padding: '12px', fontSize: '12px', background: 'var(--azul-marino)', color: 'white'}} onClick={()=>setLiveScore({...liveScore, flecha: liveScore.flecha === 'LOCAL' ? 'VISITA' : 'LOCAL'})}><ArrowRightLeft size={16}/></button>
          <button className="btn-secondary" style={{padding: '12px', fontSize: '12px', fontWeight: '800'}} onClick={()=>setLiveScore({...liveScore, timeoutsVisita: Math.max(0, liveScore.timeoutsVisita - 1)})}>TM Visita</button>
        </div>

        <div className="caja-doble-grid landscape-mode">
          <div className="card" style={{padding: '15px'}}><h5 className="sub-caja-title">Roster Local</h5><div className="roster-fiba-list">{rosterEquipo.map(j => (<div key={j.id} onClick={() => setJugadorSeleccionadoLive(j.id)} className={`roster-fiba-item ${jugadorSeleccionadoLive === j.id ? 'seleccionado' : ''}`}><div className="fiba-dorsal">#{j.dorsal}</div><div className="fiba-info"><strong>{j.nombre}</strong><span>{j.pts}pts | {j.flt}F | EFF: {calcularEff(j)}</span></div></div>))}</div></div>
          <div className="card" style={{padding: '20px'}}><h5 className="sub-caja-title text-center" style={{color: jugadorSeleccionadoLive ? 'var(--verde-victoria)' : '#FF3B30'}}>{jugadorSeleccionadoLive ? `Control de Acciones` : 'Seleccione Jugador'}</h5><div className="fiba-botones-grid"><button className="btn-fiba pt" disabled={!jugadorSeleccionadoLive} onClick={() => ejecutarAccionFIBA('PUNTO', 1)}>+1 TL</button><button className="btn-fiba pt" disabled={!jugadorSeleccionadoLive} onClick={() => ejecutarAccionFIBA('PUNTO', 2)}>+2 PTS</button><button className="btn-fiba pt" disabled={!jugadorSeleccionadoLive} onClick={() => ejecutarAccionFIBA('PUNTO', 3)}>+3 PTS</button><button className="btn-fiba st" disabled={!jugadorSeleccionadoLive} onClick={() => ejecutarAccionFIBA('REB')}>REB</button><button className="btn-fiba st" disabled={!jugadorSeleccionadoLive} onClick={() => ejecutarAccionFIBA('AST')}>AST</button><button className="btn-fiba st" disabled={!jugadorSeleccionadoLive} onClick={() => ejecutarAccionFIBA('ROBO')}>ROBO</button><button className="btn-fiba err" disabled={!jugadorSeleccionadoLive} onClick={() => ejecutarAccionFIBA('PERDIDA')}>PÉRDIDA</button><button className="btn-fiba err" disabled={!jugadorSeleccionadoLive} onClick={() => ejecutarAccionFIBA('FALTA')}>FALTA</button></div></div>
        </div>

        <div className="card mt-20">
           <h4 className="form-subtitle"><FileText size={16}/> Línea de Tiempo (Play-by-Play)</h4>
           <div style={{display: 'flex', gap: '10px'}} className="mb-15"><input type="text" className="form-input" placeholder="Nota rápida..." value={notaScouting} onChange={(e) => setNotaScouting(e.target.value)} /><button className="btn-electric" style={{width: 'auto', padding: '0 20px'}} onClick={() => { if(!notaScouting) return; setPlayByPlay([{ id: nextId(), tiempo: "DT", texto: `📝 ${notaScouting}` }, ...playByPlay]); setNotaScouting(''); }}>Log</button></div>
           <div className="play-by-play-box">{playByPlay.length === 0 ? <p className="text-center text-muted" style={{fontSize: '13px', fontStyle: 'italic', margin: '20px 0'}}>Inicio de transmisión.</p> : playByPlay.map(play => (<div key={play.id} className="play-row"><span className="play-tiempo">{play.tiempo}</span><span className="play-texto">{play.texto}</span></div>))}</div>
        </div>
      </div>
    );
  };

  // ==========================================
  // 10. ESTRUCTURA HTML FINAL (APP)
  // ==========================================
  return (
    <div className="ios-app-container" data-theme={temaOscuro ? 'dark' : 'light'}>
      {isOnboarding && renderOnboardingModal()}
      
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

      {/* Panel antiguo de notificaciones - REMOVIDO EN FAVOR DE RENDERNOTIFICACIONES */}

      {showSettings && (
        <div className="floating-panel settings-panel" style={{position: 'absolute', top: '90px', right: '15px', width: '380px', maxHeight: '500px', background: 'var(--blanco-tarjeta)', borderRadius: '16px', boxShadow: '0 15px 40px rgba(0,0,0,0.3)', zIndex: 999, padding: '20px', border: '1px solid rgba(0,0,0,0.05)', overflowY: 'auto'}}>
          {renderSettingsPanel()}
        </div>
      )}

      {mostrarNotificaciones && renderNotificaciones()}

      {mostrarBusqueda && (
        <div className="floating-panel search-panel" style={{position: 'fixed', top: '90px', left: '50%', transform: 'translateX(-50%)', width: '90%', maxWidth: '500px', maxHeight: '600px', background: 'var(--blanco-tarjeta)', borderRadius: '16px', boxShadow: '0 15px 40px rgba(0,0,0,0.3)', zIndex: 999, padding: '20px', border: '1px solid rgba(0,0,0,0.05)', overflowY: 'auto'}}>
          {renderBusqueda()}
        </div>
      )}

      {mostrarHistorialNotif && renderHistorialNotificaciones()}

      {/* PUSH NOTIFICATIONS FLOTANTES */}
      {renderPushNotificacion()}
      
      {/* HISTORIAL DE PUSH MODAL */}
      {mostrarHistorialPush && renderHistorialPush()}

      {/* WHATSAPP PANEL */}
      {mostrarWhatsAppPanel && renderWhatsAppPanel()}
      
      {/* HISTORIAL WHATSAPP MODAL */}
      {mostrarHistorialWA && renderHistorialWhatsApp()}

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
        {isAppLoading ? renderSkeleton() : (
          <>
            {!rolUsuario && renderFachadaPublica()}
            {rolUsuario && pantallaActiva === 'comunicaciones' && renderComunicaciones()}
            {rolUsuario === 'jugador' && pantallaActiva === 'academia' && renderAcademia()}
            {(rolUsuario === 'jugador' || rolUsuario === 'admin' || rolUsuario === 'super_admin') && pantallaActiva === 'perfil' && renderPerfilTesoreria()}
            {(rolUsuario === 'jugador' || rolUsuario === 'visita' || rolUsuario === 'super_admin') && pantallaActiva === 'jugador' && renderTarjetaJugador()}
            {(rolUsuario === 'staff' || rolUsuario === 'super_admin') && pantallaActiva === 'asistencia_staff' && renderStaffAsistencia()}
            {(rolUsuario === 'staff' || rolUsuario === 'super_admin') && pantallaActiva === 'evaluacion_staff' && renderStaffEvaluacion()}
            {(rolUsuario === 'mesa' || rolUsuario === 'super_admin') && pantallaActiva === 'scoreboard_live' && renderMesaControl()}
            {(rolUsuario === 'admin' || rolUsuario === 'super_admin') && pantallaActiva === 'kiosco' && renderKioscoCaja()}
            {(rolUsuario === 'admin' || rolUsuario === 'super_admin') && pantallaActiva === 'admin_dashboard' && renderSuperAdmin()}
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
  )
}

export default App;