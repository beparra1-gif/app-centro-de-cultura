import { useState, useEffect } from 'react';
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
import ResultadosCards from './components/ResultadosCards';
import ComunicacionesPanel from './components/ComunicacionesPanel';
import PupiloSelector from './components/PupiloSelector';
import KioscoPanel from './components/KioscoPanel';
import SuperAdminPanel from './components/SuperAdminPanel';
import MesaControlPanel from './components/MesaControlPanel';
import PerfilTesoreriaPanel from './components/PerfilTesoreriaPanel';
import StaffAsistenciaPanel from './components/StaffAsistenciaPanel';
import StaffEvaluacionPanel from './components/StaffEvaluacionPanel';
import AcademiaPanel from './components/AcademiaPanel';
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
            {rolUsuario && pantallaActiva === 'comunicaciones' && (
              <ComunicacionesPanel
                rolUsuario={rolUsuario}
                mostrarFormComunicaciones={mostrarFormComunicaciones}
                setMostrarFormComunicaciones={setMostrarFormComunicaciones}
                renderFormularioComunicaciones={renderFormularioComunicaciones}
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
            {(rolUsuario === 'jugador' || rolUsuario === 'visita' || rolUsuario === 'super_admin') && pantallaActiva === 'jugador' && renderTarjetaJugador()}
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
                renderDashboardSalud={renderDashboardSalud}
                renderAlertasPanel={renderAlertasPanel}
                renderTimelineActividad={renderTimelineActividad}
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
  )
}

export default App;





