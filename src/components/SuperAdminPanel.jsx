import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Bell,
  CheckSquare,
  FileText,
  Filter,
  History,
  Image,
  Megaphone,
  Plus,
  Search,
  Shield,
  ShieldCheck,
  Stethoscope,
  RefreshCcw,
  Trophy,
  User,
  UserPlus,
  Users,
  XSquare,
} from 'lucide-react';
import * as api from '../api/client';
import LogoAvatar from './LogoAvatar';
import LogoPicker from './LogoPicker';
import PagoForm from './PagoForm';
import ResultadosCards from './ResultadosCards';
import { colorTipo } from '../utils/appHelpers';
import { nextId } from '../utils/runtimeId';
import { MODULOS_ACCESO, obtenerPermisosBasePorRol, normalizarRol } from '../security/accessControl';
import { cuentasDemo } from '../data/demoAccounts';
import ReportesPanel from './ReportesPanel';
import SaludAlertasPanel from './SaludAlertasPanel';
import SaludDashboardPanel from './SaludDashboardPanel';
import SaludTimelinePanel from './SaludTimelinePanel';

function SuperAdminPanel({
  vistaAdmin,
  setVistaAdmin,
  generarAlertas,
  filtroMorosos,
  setFiltroMorosos,
  pagosPendientesAdmin,
  setPagosPendientesAdmin,
  logAuditoria,
  nominaCita,
  setNominaCita,
  calcularReportes,
  vistaReportes,
  setVistaReportes,
  filtroReporteFecha,
  setFiltroReporteFecha,
  filtroReporteRama,
  setFiltroReporteRama,
  setMostrarHistorialNotif,
  exportarReportePDF,
  renderGraficoSVG,
  cuentasIncompletas,
  abrirEdicionCuenta,
  cuentaEditando,
  actualizarCampoCuenta,
  guardarCuentaPendiente,
  guardandoCuenta,
  setCuentaEditando,
  vistaSaludTab,
  setVistaSaludTab,
  alertas,
  saludDelSistema,
  comunicacionesCount,
  calcularScoreDeCliente,
  comunicaciones,
  setComunicaciones,
  cuentasAdmin,
  matrixPermisos,
  togglePermiso,
  jugadoresAdmin,
  jugadoresVisitaAdmin,
  guardarCuentaAdmin,
  guardarJugadorAdmin,
  guardarJugadorVisitaAdmin,
  validarPagoMensualidad,
  morososAdmin,
  pagosMensualidadesAdmin,
  onSheetsSyncComplete,
  onCancelEdit,
  onPartidosChanged,
  onComunicacionesChanged,
}) {
  const enviarAlerta = () => { alert('Notificación enviada por App y Correo a los destinatarios.'); };
  void enviarAlerta;
  void setPagosPendientesAdmin;
  void nominaCita;
  void setNominaCita;

  const totalSocios = (cuentasAdmin || []).filter((c) => Boolean(c.es_socio)).length;
  const totalDeportistas = (jugadoresAdmin || []).length;

  const af = {
    totalSocios,
    sociosMorosos: (morososAdmin || []).filter((m) => m.tipo === 'socio' || m.tipo === 'socio-apoderado').length,
    totalDeportistas,
    deportistasMorosos: (morososAdmin || []).filter((m) => m.tipo !== 'socio').length,
    metaSocios: totalSocios * 35000,
    metaDeportistas: totalDeportistas * 30000,
    recaudadoSocios: (pagosMensualidadesAdmin || [])
      .filter((p) => (p.estado_pago || '').toLowerCase() === 'aprobado' && Number(p.monto_total_pagado || 0) <= 35000)
      .reduce((acc, p) => acc + Number(p.monto_total_pagado || 0), 0),
    recaudadoDeportistas: (pagosMensualidadesAdmin || [])
      .filter((p) => (p.estado_pago || '').toLowerCase() === 'aprobado' && Number(p.monto_total_pagado || 0) > 35000)
      .reduce((acc, p) => acc + Number(p.monto_total_pagado || 0), 0),
  };

  af.sociosAlDia = Math.max(af.totalSocios - af.sociosMorosos, 0);
  af.deportistasAlDia = Math.max(af.totalDeportistas - af.deportistasMorosos, 0);

  const pctSocios = af.metaSocios > 0 ? Math.round(af.recaudadoSocios / af.metaSocios * 100) : 0;
  const pctDep = af.metaDeportistas > 0 ? Math.round(af.recaudadoDeportistas / af.metaDeportistas * 100) : 0;
  const pctGlobal = (af.metaSocios + af.metaDeportistas) > 0
    ? Math.round((af.recaudadoSocios + af.recaudadoDeportistas) / (af.metaSocios + af.metaDeportistas) * 100)
    : 0;

  const morososFiltrados = filtroMorosos === 'todos'
    ? (morososAdmin || [])
    : filtroMorosos === 'socios'
      ? (morososAdmin || []).filter(m => m.tipo === 'socio' || m.tipo === 'socio-apoderado')
      : (morososAdmin || []).filter(m => m.tipo === 'apoderado' || m.tipo === 'socio-apoderado');

  const [filtroUsuariosTexto, setFiltroUsuariosTexto] = useState('');
  const [filtroTipoPerfil, setFiltroTipoPerfil] = useState('todos');
  const [filtroRamaJugadores, setFiltroRamaJugadores] = useState('todas');
  const [filtroCategoriaJugadores, setFiltroCategoriaJugadores] = useState('todas');
  const [filtroPupiloManual, setFiltroPupiloManual] = useState('');
  // Snapshot of override state captured when an edit opens; used to revert on cancel.
  const [permisosSnapshotAntesEdicion, setPermisosSnapshotAntesEdicion] = useState(null);

  // --- PUBLICAR ANUNCIOS ---
  const [formPublicacion, setFormPublicacion] = useState({
    titulo: '',
    mensaje: '',
    tipo: 'Aviso',
    rama: 'General',
    categoria: 'General',
    urgencia: 'Media',
    solicita_asistencia: false,
  });
  const [publicandoForm, setPublicandoForm] = useState(false);
  const [publicacionEditandoId, setPublicacionEditandoId] = useState(null);

  // --- RESULTADOS DE PARTIDOS ---
  const [formResultado, setFormResultado] = useState({
    equipo_local: 'Centro de Cultura Física',
    equipo_visitante: '',
    logo_local_url: '/logos/club-logo.png',
    logo_visitante_url: '',
    torneo_nombre: '',
    torneo_logo_url: '',
    pts_local: '',
    pts_visitante: '',
    rama: 'Mixta',
    categoria: 'SUB-13',
    cancha_sede: '',
    fecha_hora: new Date().toISOString().slice(0, 10),
  });

  // Definir categorías disponibles según rama
  const categoriasDisponibles = {
    'Mixta': ['SUB-13', 'SUB-15', 'SUB-17', 'SUB-19'],
    'Femenina': ['SUB-13', 'SUB-15', 'SUB-17', 'SUB-19'],
    'Masculina': ['SUB-13', 'SUB-15', 'SUB-17', 'SUB-19'],
    'Adulto': ['General'],
  };
  const [partidosAdmin, setPartidosAdmin] = useState([]);
  const [guardandoResultado, setGuardandoResultado] = useState(false);
  const [partidoEditandoId, setPartidoEditandoId] = useState(null);
  const [cargandoPartidos, setCargandoPartidos] = useState(false);
  const [procesandoPupiloRut, setProcesandoPupiloRut] = useState('');
  const [destinoApoderadoPorRut, setDestinoApoderadoPorRut] = useState({});
  const [editandoTipo, setEditandoTipo] = useState(null);
  const [cuentaAdminEdit, setCuentaAdminEdit] = useState(null);
  const [jugadorAdminEdit, setJugadorAdminEdit] = useState(null);
  const [tipoNuevoUsuario, setTipoNuevoUsuario] = useState('cuenta');
  const [guardandoUsuario, setGuardandoUsuario] = useState(false);
  const [citaRama, setCitaRama] = useState('todas');
  const [citaCategoria, setCitaCategoria] = useState('todas');
  const [categoriasExtraCitacion, setCategoriasExtraCitacion] = useState([]);
  const [seleccionCitacion, setSeleccionCitacion] = useState({});
  const [autorizacionMorosos, setAutorizacionMorosos] = useState({});
  const [citacionActivaId, setCitacionActivaId] = useState(null);
  const [citaForm, setCitaForm] = useState(() => ({
    tipo_competencia: 'Liga',
    competencia_nombre: '',
    competencia_logo_url: '',
    dia_citacion: new Date().toISOString().slice(0, 10),
    hora_citacion: '16:00',
    hora_presentacion: '15:30',
    rival_nombre: '',
    rival_logo_url: '',
  }));
  const [jugadorVisitaEdit, setJugadorVisitaEdit] = useState(null);
  const [guardandoVisita, setGuardandoVisita] = useState(false);
  const [syncToken, setSyncToken] = useState('');
  const [syncSheetsRunning, setSyncSheetsRunning] = useState(false);
  const [syncSheetsResult, setSyncSheetsResult] = useState(null);
  const [loadingSyncStatus, setLoadingSyncStatus] = useState(false);
  const [loadingQualityDetails, setLoadingQualityDetails] = useState(false);
  const [qualityDetailResult, setQualityDetailResult] = useState(null);
  const [loadingJugadoresConflicts, setLoadingJugadoresConflicts] = useState(false);
  const [jugadoresConflictsResult, setJugadoresConflictsResult] = useState(null);
  const [resolviendoConflictoRut, setResolviendoConflictoRut] = useState('');
  const [subiendoFotoJugadorNuevo, setSubiendoFotoJugadorNuevo] = useState(false);
  const [subiendoFotoJugadorEdit, setSubiendoFotoJugadorEdit] = useState(false);
  const edicionCuentaRef = useRef(null);
  const edicionJugadorRef = useRef(null);

  const [nuevoJugadorVisita, setNuevoJugadorVisita] = useState({
    rut_visita: '',
    nombres: '',
    apellido_paterno: '',
    apellido_materno: '',
    club_procedencia: '',
    club_logo_url: '',
    rama: 'MASCULINA',
    categoria: 'SUB-15',
    posicion: '',
    contacto_apoderado: '',
    telefono_contacto: '',
  });

  const [nuevaCuenta, setNuevaCuenta] = useState({
    correo: '',
    rut: '',
    password: '',
    nombres: '',
    apellido_paterno: '',
    apellido_materno: '',
    telefono: '',
    direccion: '',
    comuna: '',
    rol: 'apoderado',
    perfil_principal: 'apoderado',
    cargo_directiva: '',
    socio_admin: false,
    aprobado_superadmin: false,
    acceso_nivel: 'estandar',
    utm_valor_referencia: 68000,
    monto_mensual_base: 0,
    monto_mensual_override: '',
    condiciones_pago: '',
    fecha_corte_utm: '',
    estado: 'activo',
    es_socio: false,
    forzar_clave: true,
    logo_url: '',
  });

  const [nuevoJugador, setNuevoJugador] = useState({
    rut_jugador: '',
    correo_apoderado: '',
    nombres: '',
    apellido_paterno: '',
    apellido_materno: '',
    rama: 'MASCULINA',
    categoria: 'SUB-13',
    estado: 'ACTIVO',
    foto_jugador: '',
  });

  const [logoAssetForm, setLogoAssetForm] = useState({
    nombre: '',
    tipo: 'club',
    objetivo: 'jugador',
    archivo: null,
  });
  const [subiendoLogoAsset, setSubiendoLogoAsset] = useState(false);
  const [logoAssetUrl, setLogoAssetUrl] = useState('');

  // --- PAGOS: FORMULARIO Y PAGINACIÓN ---
  const [mostrarFormularioPago, setMostrarFormularioPago] = useState(false);
  const [pagoEditandoId, setPagoEditandoId] = useState(null);
  const [paginaPagosMigrados, setPaginaPagosMigrados] = useState(1);
  const [itemsPorPaginaPagos] = useState(15);

  useEffect(() => {
    if (vistaAdmin === 'cuentas' || vistaAdmin === 'cuentas_legacy') {
      setVistaAdmin('usuarios');
    }
  }, [vistaAdmin, setVistaAdmin]);

  const PERFIL_PRINCIPAL_OPTIONS = [
    { value: 'apoderado', label: 'Apoderado' },
    { value: 'socio', label: 'Socio' },
    { value: 'socio_apoderado', label: 'Socio / Apoderado' },
    { value: 'directiva', label: 'Directiva' },
    { value: 'staff', label: 'Staff' },
    { value: 'admin', label: 'Admin' },
    { value: 'super_admin', label: 'Super Admin' },
  ];

  const CARGO_DIRECTIVA_OPTIONS = [
    { value: '', label: 'Sin cargo' },
    { value: 'presidente', label: 'Presidente' },
    { value: 'secretario', label: 'Secretario' },
    { value: 'tesorero', label: 'Tesorero' },
    { value: 'delegado', label: 'Delegado' },
  ];

  const ACCESO_NIVEL_OPTIONS = [
    { value: 'estandar', label: 'Estándar' },
    { value: 'lectura', label: 'Solo lectura' },
    { value: 'ampliado', label: 'Ampliado' },
  ];

  const calcularFechaCorteMesAnterior = () => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 0).toISOString().slice(0, 10);
  };

  const calcularMensualidadSocio = (utm = 68000) => {
    const base = Number(utm || 0);
    if (!Number.isFinite(base) || base <= 0) return 0;
    return Math.round(base * 0.3);
  };

  const esCuentaCatalogadaSocio = (cuenta = {}) => {
    const perfil = String(cuenta.perfil_principal || cuenta.rol || '').toLowerCase();
    return ['socio', 'socio_apoderado', 'directiva'].includes(perfil) || Boolean(cuenta.es_socio);
  };

  const aplicarReglaMensualidad = (cuenta = {}) => {
    const esSocio = esCuentaCatalogadaSocio(cuenta);
    if (!esSocio) {
      return {
        ...cuenta,
        es_socio: false,
        monto_mensual_base: null,
      };
    }

    const utm = Number(cuenta.utm_valor_referencia || 68000);
    const montoBase = calcularMensualidadSocio(utm);
    return {
      ...cuenta,
      es_socio: true,
      utm_valor_referencia: utm,
      monto_mensual_base: montoBase,
      fecha_corte_utm: cuenta.fecha_corte_utm || calcularFechaCorteMesAnterior(),
    };
  };

  const cuentasDemoEnriquecidas = cuentasDemo.map((cuentaDemo) => {
    const permisosBase = obtenerPermisosBasePorRol(cuentaDemo.perfil);
    const cuentaReal = (cuentasAdmin || []).find((cuenta) => String(cuenta.correo || '').trim().toLowerCase() === String(cuentaDemo.correo || '').trim().toLowerCase())
      || (cuentasAdmin || []).find((cuenta) => normalizarRol(cuenta.rol) === normalizarRol(cuentaDemo.perfil));
    const permisoReal = cuentaReal
      ? (matrixPermisos || []).find((cuenta) => cuenta.id === cuentaReal.id)
      : null;
    return {
      ...cuentaDemo,
      permisosBase,
      modulosBase: MODULOS_ACCESO.filter((modulo) => permisosBase[modulo.id]),
      cuentaReal,
      permisoReal,
    };
  });

  const categoriasUnicas = useMemo(() => {
    const valores = jugadoresAdmin
      .map(j => (j.categoria || '').trim())
      .filter(Boolean);
    return [...new Set(valores)].sort((a, b) => a.localeCompare(b, 'es'));
  }, [jugadoresAdmin]);

  const pagosPendientesReales = useMemo(
    () => (pagosPendientesAdmin || []).filter((p) => {
      const estado = (p.estado_pago || '').toLowerCase();
      if (estado !== 'pendiente') return false;
      // Exclude migrated payments with correction note — they go to the separate section.
      const esLegacy = String(p.notas_tesoreria || '').includes('Migrado desde') ||
        String(p.notas_tesoreria || '').includes('Legacy ID:');
      return !esLegacy;
    }),
    [pagosPendientesAdmin]
  );

  const pagosMigradosPendientes = useMemo(
    () => (pagosPendientesAdmin || []).filter((p) => {
      const notas = String(p.notas_tesoreria || '');
      return (p.estado_pago || '').toLowerCase() === 'pendiente' &&
        (notas.includes('Migrado desde') || notas.includes('Legacy ID:'));
    }),
    [pagosPendientesAdmin]
  );

  const jugadoresIncompletos = useMemo(() => {
    return (jugadoresAdmin || []).filter((j) => {
      const rut = String(j.rut_jugador || '').trim();
      const rutValido = rut ? api.validarRutChileno(rut) : false;
      return (
        !String(j.nombres || '').trim()
        || !rut
        || !String(j.rama || '').trim()
        || !String(j.categoria || '').trim()
        || !rutValido
      );
    });
  }, [jugadoresAdmin]);

  const pagosConCorreccion = useMemo(() => {
    return (pagosMensualidadesAdmin || []).filter((p) => {
      const notas = String(p.notas_tesoreria || '').toLowerCase();
      return notas.includes('correccion requerida')
        || !String(p.rut_jugador || '').trim()
        || !String(p.meses_correspondientes || '').trim();
    });
  }, [pagosMensualidadesAdmin]);

  const jugadorasCitacion = useMemo(() => {
    const base = (jugadoresAdmin || []).filter((j) => (j.estado || 'ACTIVO').toUpperCase() !== 'BAJA');
    const categoriasPermitidas = new Set(
      [citaCategoria, ...categoriasExtraCitacion]
        .map((c) => String(c || '').trim().toLowerCase())
        .filter((c) => c && c !== 'todas')
    );

    return base.filter((j) => {
      const rama = (j.rama || '').toLowerCase();
      const categoria = (j.categoria || '').toLowerCase();

      if (citaRama !== 'todas' && rama !== citaRama.toLowerCase()) return false;
      if (categoriasPermitidas.size > 0 && !categoriasPermitidas.has(categoria)) return false;
      return true;
    });
  }, [jugadoresAdmin, citaRama, citaCategoria, categoriasExtraCitacion]);

  const cuposCitados = Object.values(seleccionCitacion).filter(Boolean).length;

  const listadoUsuarios = useMemo(() => {
    const cuentas = (cuentasAdmin || []).map((c) => ({
      id: `cuenta-${c.id}`,
      tipo: 'cuenta',
      perfil: (c.perfil_principal || c.rol || 'apoderado').toLowerCase(),
      nombre: `${c.nombres || ''} ${c.apellido_paterno || ''}`.trim() || c.correo,
      busqueda: `${c.nombres || ''} ${c.apellido_paterno || ''} ${c.apellido_materno || ''} ${c.correo || ''} ${c.rut || ''} ${c.rol || ''} ${c.perfil_principal || ''} ${c.cargo_directiva || ''}`.toLowerCase(),
      rama: null,
      categoria: null,
      raw: c,
    }));

    const jugadores = (jugadoresAdmin || []).map((j) => ({
      id: `jugador-${j.rut_jugador}`,
      tipo: 'jugador',
      perfil: 'jugador',
      nombre: `${j.nombres || ''} ${j.apellido_paterno || ''}`.trim() || j.rut_jugador,
      busqueda: `${j.nombres || ''} ${j.apellido_paterno || ''} ${j.apellido_materno || ''} ${j.rut_jugador || ''} ${j.rama || ''} ${j.categoria || ''}`.toLowerCase(),
      rama: (j.rama || '').toLowerCase(),
      categoria: (j.categoria || '').toLowerCase(),
      raw: j,
    }));

    return [...cuentas, ...jugadores];
  }, [cuentasAdmin, jugadoresAdmin]);

  const usuariosFiltrados = useMemo(() => {
    const q = filtroUsuariosTexto.trim().toLowerCase();

    return listadoUsuarios.filter((u) => {
      if (filtroTipoPerfil !== 'todos' && u.perfil !== filtroTipoPerfil) return false;
      if (q && !u.busqueda.includes(q)) return false;

      if (filtroTipoPerfil === 'jugador') {
        if (filtroRamaJugadores !== 'todas' && u.rama !== filtroRamaJugadores.toLowerCase()) return false;
        if (filtroCategoriaJugadores !== 'todas' && u.categoria !== filtroCategoriaJugadores.toLowerCase()) return false;
      }

      return true;
    });
  }, [
    listadoUsuarios,
    filtroUsuariosTexto,
    filtroTipoPerfil,
    filtroRamaJugadores,
    filtroCategoriaJugadores,
  ]);

  const cuentaPupilosActiva = cuentaAdminEdit || cuentaEditando || null;

  const pupilosAsignadosCuenta = useMemo(() => {
    if (!cuentaPupilosActiva) return [];
    const correoCuenta = String(cuentaPupilosActiva.correo || '').trim().toLowerCase();
    if (!correoCuenta) return [];

    return (jugadoresAdmin || []).filter((j) => String(j.correo_apoderado || '').trim().toLowerCase() === correoCuenta);
  }, [cuentaPupilosActiva, jugadoresAdmin]);

  const jugadoresDisponiblesAsignacion = useMemo(() => {
    if (!cuentaPupilosActiva) return [];
    const correoCuenta = String(cuentaPupilosActiva.correo || '').trim().toLowerCase();
    const q = String(filtroPupiloManual || '').trim().toLowerCase();

    return (jugadoresAdmin || []).filter((j) => {
      if ((j.estado || 'ACTIVO').toUpperCase() === 'BAJA') return false;
      if (correoCuenta && String(j.correo_apoderado || '').trim().toLowerCase() === correoCuenta) return false;

      if (!q) return true;
      const txt = `${j.nombres || ''} ${j.apellido_paterno || ''} ${j.apellido_materno || ''} ${j.rut_jugador || ''} ${j.rama || ''} ${j.categoria || ''}`.toLowerCase();
      return txt.includes(q);
    });
  }, [cuentaPupilosActiva, jugadoresAdmin, filtroPupiloManual]);

  const cuentasApoderadoDisponibles = useMemo(() => {
    return (cuentasAdmin || [])
      .filter((c) => {
        const correo = String(c.correo || '').trim();
        if (!correo) return false;
        const rol = String(c.rol || '').toLowerCase();
        return rol.includes('apoderado') || rol === 'super_admin' || rol === 'admin';
      })
      .map((c) => ({
        correo: String(c.correo || '').trim(),
        nombre: `${c.nombres || ''} ${c.apellido_paterno || ''}`.trim() || String(c.correo || '').trim(),
      }));
  }, [cuentasAdmin]);

  const getCuentaPermisosConfig = (cuenta = null) => {
    if (!cuenta) return null;

    const idUsuario = cuenta.id ?? cuenta.id_usuario ?? cuenta.id_cuenta ?? cuenta.rut ?? cuenta.correo;
    // Use perfil_principal as primary role source to stay consistent with the matrix.
    const rolUsuario = normalizarRol(cuenta.rol || cuenta.rol_usuario || cuenta.perfil_principal || 'apoderado');
    const permisosGuardados = (matrixPermisos || []).find((item) => item.id === idUsuario);
    const permisosBase = obtenerPermisosBasePorRol(rolUsuario);
    const permisosEfectivos = permisosGuardados?.permisos || permisosBase;

    return {
      id: idUsuario,
      rol: rolUsuario,
      nombre: `${cuenta.nombres || ''} ${cuenta.apellido_paterno || ''}`.trim() || cuenta.correo || 'Cuenta sin nombre',
      permisosBase,
      permisosEfectivos,
      esSuperAdmin: rolUsuario === 'super_admin',
    };
  };

  const cuentaAsociadaJugadorEdit = useMemo(() => {
    const correoApoderado = String(jugadorAdminEdit?.correo_apoderado || '').trim().toLowerCase();
    if (!correoApoderado) return null;

    return (cuentasAdmin || []).find((cuenta) => String(cuenta.correo || '').trim().toLowerCase() === correoApoderado) || null;
  }, [jugadorAdminEdit, cuentasAdmin]);

  const renderPermisosCuenta = ({
    cuenta,
    titulo = 'Permisos y accesos',
    descripcion = 'Activa o restringe módulos específicos para esta cuenta dentro de la misma gestión unificada.',
    emptyMessage = 'No se encontró una cuenta asociada para gestionar permisos.',
  } = {}) => {
    const config = getCuentaPermisosConfig(cuenta);

    if (!config) {
      return (
        <div className="card" style={{ marginTop: '12px', borderRadius: '16px', border: '1px solid rgba(0,122,255,0.16)' }}>
          <h4 className="form-subtitle" style={{ marginBottom: '8px' }}><ShieldCheck size={15} /> {titulo}</h4>
          <p style={{ margin: 0, fontSize: '12px', color: 'var(--texto-secundario)' }}>{emptyMessage}</p>
        </div>
      );
    }

    return (
      <div className="card" style={{ marginTop: '12px', borderRadius: '16px', border: '1px solid rgba(0,122,255,0.16)' }}>
        <h4 className="form-subtitle" style={{ marginBottom: '8px' }}><ShieldCheck size={15} /> {titulo}</h4>
        <p style={{ fontSize: '12px', color: 'var(--texto-secundario)', marginTop: 0, marginBottom: '10px' }}>
          {descripcion}
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '10px' }}>
          <span style={{ fontSize: '11px', fontWeight: '800', color: 'var(--azul-electrico)', background: 'rgba(0,122,255,0.08)', padding: '5px 10px', borderRadius: '999px' }}>
            Cuenta: {config.nombre}
          </span>
          <span style={{ fontSize: '11px', fontWeight: '800', color: 'var(--texto-secundario)', background: 'rgba(15,23,42,0.06)', padding: '5px 10px', borderRadius: '999px' }}>
            Rol base: {config.rol}
          </span>
          {config.esSuperAdmin && (
            <span style={{ fontSize: '11px', fontWeight: '800', color: '#b36200', background: 'rgba(255,149,0,0.12)', padding: '5px 10px', borderRadius: '999px' }}>
              Super Admin mantiene acceso total
            </span>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '8px' }}>
          {MODULOS_ACCESO.filter((modulo) => modulo.id !== 'mesa_publica').map((modulo) => {
            const habilitado = Boolean(config.permisosEfectivos?.[modulo.id]);
            const vienePorRol = Boolean(config.permisosBase?.[modulo.id]);
            return (
              <button
                key={`perm-inline-${config.id}-${modulo.id}`}
                type="button"
                onClick={() => !config.esSuperAdmin && togglePermiso(config.id, modulo.id)}
                disabled={config.esSuperAdmin}
                style={{
                  textAlign: 'left',
                  borderRadius: '14px',
                  border: habilitado ? '1px solid rgba(52,199,89,0.45)' : '1px solid rgba(15,23,42,0.08)',
                  background: habilitado ? 'rgba(52,199,89,0.10)' : 'rgba(255,255,255,0.92)',
                  padding: '10px 12px',
                  cursor: config.esSuperAdmin ? 'not-allowed' : 'pointer',
                  opacity: config.esSuperAdmin ? 0.75 : 1,
                }}
                title={config.esSuperAdmin ? 'Super Admin conserva acceso total.' : 'Clic para agregar o quitar acceso.'}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', alignItems: 'center' }}>
                  <strong style={{ fontSize: '12px', color: 'var(--texto-principal)' }}>{modulo.etiqueta}</strong>
                  <span style={{ fontSize: '11px', fontWeight: '900', color: habilitado ? 'var(--verde-victoria)' : 'var(--texto-secundario)' }}>
                    {habilitado ? 'ACTIVO' : 'OFF'}
                  </span>
                </div>
                <div style={{ fontSize: '11px', color: 'var(--texto-secundario)', marginTop: '5px', lineHeight: '1.35' }}>
                  {modulo.descripcion}
                </div>
                <div style={{ fontSize: '10px', marginTop: '6px', fontWeight: '800', color: vienePorRol ? 'var(--azul-electrico)' : '#b36200' }}>
                  {vienePorRol ? 'Incluido por rol base' : 'Override manual'}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  const getPermisosPersistibles = (cuenta = null) => {
    const config = getCuentaPermisosConfig(cuenta);
    if (!config || config.esSuperAdmin) return {};

    // Persist only the DIFF between effective permissions and the role base.
    // This ensures role changes recompute cleanly instead of being overridden by stale maps.
    const base = config.permisosBase;
    const effective = config.permisosEfectivos;

    const overrideDiff = {};
    for (const modulo of MODULOS_ACCESO) {
      const baseVal = Boolean(base[modulo.id]);
      const effectiveVal = Boolean(effective[modulo.id]);
      if (effectiveVal !== baseVal) {
        overrideDiff[modulo.id] = effectiveVal;
      }
    }

    return overrideDiff;
  };

  const asignarPupiloACuenta = async (jugador) => {
    const correoCuenta = String(cuentaPupilosActiva?.correo || '').trim();
    if (!correoCuenta) {
      alert('Debes guardar un correo válido en la cuenta antes de asignar pupilos.');
      return;
    }

    try {
      setProcesandoPupiloRut(jugador.rut_jugador || '');
      await guardarJugadorAdmin({ ...jugador, correo_apoderado: correoCuenta }, jugador.rut_jugador);
      alert(`Pupilo asignado a ${correoCuenta}.`);
    } catch (error) {
      alert(`No se pudo asignar el pupilo: ${error.message}`);
    } finally {
      setProcesandoPupiloRut('');
    }
  };

  const actualizarCuentaAdminEdit = (changes = {}) => {
    setCuentaAdminEdit((prev) => aplicarReglaMensualidad({ ...(prev || {}), ...changes }));
  };

  const actualizarNuevaCuenta = (changes = {}) => {
    setNuevaCuenta((prev) => aplicarReglaMensualidad({ ...(prev || {}), ...changes }));
  };

  const quitarPupiloDeCuenta = async (jugador) => {
    try {
      setProcesandoPupiloRut(jugador.rut_jugador || '');
      await guardarJugadorAdmin({ ...jugador, correo_apoderado: '' }, jugador.rut_jugador);
      alert('Pupilo desasignado correctamente.');
    } catch (error) {
      alert(`No se pudo quitar el pupilo: ${error.message}`);
    } finally {
      setProcesandoPupiloRut('');
    }
  };

  const moverPupiloAOtroApoderado = async (jugador, correoDestino) => {
    const destino = String(correoDestino || '').trim();
    if (!destino) {
      alert('Selecciona un apoderado destino para mover el pupilo.');
      return;
    }

    try {
      setProcesandoPupiloRut(jugador.rut_jugador || '');
      await guardarJugadorAdmin({ ...jugador, correo_apoderado: destino }, jugador.rut_jugador);
      setDestinoApoderadoPorRut((prev) => ({ ...prev, [jugador.rut_jugador]: '' }));
      alert(`Pupilo movido a ${destino}.`);
    } catch (error) {
      alert(`No se pudo mover el pupilo: ${error.message}`);
    } finally {
      setProcesandoPupiloRut('');
    }
  };

  const iniciarEdicion = (item) => {
    // Snapshot current matrixPermisos so we can restore on cancel.
    const snap = {};
    if (matrixPermisos) {
      for (const entry of matrixPermisos) {
        if (entry.id != null) snap[entry.id] = { ...entry.permisos };
      }
    }
    setPermisosSnapshotAntesEdicion(snap);

    if (item.tipo === 'cuenta') {
      setEditandoTipo('cuenta');
      setJugadorAdminEdit(null);
      setCuentaAdminEdit(aplicarReglaMensualidad({ ...item.raw }));
      return;
    }

    setEditandoTipo('jugador');
    setCuentaAdminEdit(null);
    setJugadorAdminEdit({ ...item.raw, rut_original: item.raw.rut_jugador });
  };

  const cancelarEdicion = () => {
    // Revert any permission toggles made during this edit session.
    if (permisosSnapshotAntesEdicion && typeof togglePermiso === 'function') {
      for (const [id, permisos] of Object.entries(permisosSnapshotAntesEdicion)) {
        for (const moduloId of Object.keys(permisos)) {
          // We can't call togglePermiso per-module; instead restore via setPermisosPorUsuario.
          // This is handled in App.jsx by passing a restorePermisoSnapshot callback.
          void id; void moduloId;
        }
      }
    }
    setPermisosSnapshotAntesEdicion(null);
    setEditandoTipo(null);
    setCuentaAdminEdit(null);
    setJugadorAdminEdit(null);
    if (typeof onCancelEdit === 'function') onCancelEdit(permisosSnapshotAntesEdicion);
  };

  const publicarAnuncio = async () => {
    if (!formPublicacion.titulo.trim() || !formPublicacion.mensaje.trim()) {
      alert('Completa el título y el mensaje antes de publicar.');
      return;
    }
    try {
      setPublicandoForm(true);
      const payload = {
        titulo: formPublicacion.titulo,
        cuerpo_texto: formPublicacion.mensaje,
        tipo: formPublicacion.tipo,
        rama: formPublicacion.rama,
        categoria: formPublicacion.categoria,
        urgencia: formPublicacion.urgencia,
        solicita_asistencia: formPublicacion.solicita_asistencia,
      };

      if (publicacionEditandoId) {
        await api.comunicacionesAPI.update(publicacionEditandoId, payload);
      } else {
        await api.comunicacionesAPI.create(payload);
      }

      setFormPublicacion({ titulo: '', mensaje: '', tipo: 'Aviso', rama: 'General', categoria: 'General', urgencia: 'Media', solicita_asistencia: false });
      setPublicacionEditandoId(null);
      if (typeof onComunicacionesChanged === 'function') {
        await onComunicacionesChanged();
      }
      alert(publicacionEditandoId ? 'Publicación actualizada correctamente.' : 'Publicación creada correctamente. Aparecerá en el Muro.');
    } catch (error) {
      alert(`No se pudo publicar: ${error.message}`);
    } finally {
      setPublicandoForm(false);
    }
  };

  const editarPublicacion = (com) => {
    setPublicacionEditandoId(com.id);
    setFormPublicacion({
      titulo: com.TITULO || '',
      mensaje: com.CUERPO_TEXTO || '',
      tipo: com.TIPO_COMUNICADO || 'Aviso',
      rama: com.rama || 'General',
      categoria: com.categoria || 'General',
      urgencia: com.urgencia || 'Media',
      solicita_asistencia: Boolean(com.solicita_asistencia),
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelarEdicionPublicacion = () => {
    setPublicacionEditandoId(null);
    setFormPublicacion({ titulo: '', mensaje: '', tipo: 'Aviso', rama: 'General', categoria: 'General', urgencia: 'Media', solicita_asistencia: false });
  };

  const borrarPublicacion = async (com) => {
    if (!window.confirm(`¿Confirmas borrar la publicación "${com.TITULO}"?`)) return;
    try {
      await api.comunicacionesAPI.delete(com.id);
      if (publicacionEditandoId === com.id) {
        cancelarEdicionPublicacion();
      }
      if (typeof onComunicacionesChanged === 'function') {
        await onComunicacionesChanged();
      }
      alert('Publicación borrada correctamente.');
    } catch (error) {
      alert(`No se pudo borrar la publicación: ${error.message}`);
    }
  };

  const cargarPartidosAdmin = async () => {
    try {
      setCargandoPartidos(true);
      const res = await api.partidosLiveAPI.getAll();
      setPartidosAdmin(Array.isArray(res) ? res : []);
    } catch {
      setPartidosAdmin([]);
    } finally {
      setCargandoPartidos(false);
    }
  };

  const resetFormResultado = () => {
    setFormResultado({
      equipo_local: 'Centro de Cultura Física',
      equipo_visitante: '',
      logo_local_url: '/logos/club-logo.png',
      logo_visitante_url: '',
      torneo_nombre: '',
      torneo_logo_url: '',
      pts_local: '',
      pts_visitante: '',
      rama: 'Mixta',
      categoria: 'SUB-13',
      cancha_sede: '',
      fecha_hora: new Date().toISOString().slice(0, 10),
    });
    setPartidoEditandoId(null);
  };

  const esPartidoPrueba = (partido) => {
    const texto = [
      partido?.equipo_local,
      partido?.equipo_visitante,
      partido?.torneo_nombre,
      partido?.cancha_sede,
    ].filter(Boolean).join(' ').toLowerCase();
    return /prueba|test|demo|ejemplo/.test(texto);
  };

  const guardarResultado = async () => {
    const {
      equipo_local, equipo_visitante,
      logo_local_url, logo_visitante_url, torneo_nombre, torneo_logo_url,
      pts_local, pts_visitante, cancha_sede, fecha_hora,
    } = formResultado;
    if (!equipo_visitante.trim()) { alert('Ingresa el nombre del equipo visitante.'); return; }
    if (pts_local === '' || pts_visitante === '') { alert('Ingresa los puntos de ambos equipos.'); return; }
    try {
      setGuardandoResultado(true);
      const payload = {
        equipo_local,
        equipo_visitante,
        logo_local_url: logo_local_url || null,
        logo_visitante_url: logo_visitante_url || null,
        torneo_nombre: torneo_nombre || null,
        torneo_logo_url: torneo_logo_url || null,
        pts_local: Number(pts_local),
        pts_visitante: Number(pts_visitante),
        rama: formResultado.rama,
        categoria: formResultado.categoria,
        cancha_sede,
        fecha_hora,
        estado_juego: 'finalizado',
      };

      if (partidoEditandoId) {
        await api.partidosLiveAPI.update(partidoEditandoId, payload);
      } else {
        await api.partidosLiveAPI.create(payload);
      }

      resetFormResultado();
      await cargarPartidosAdmin();
      if (typeof onPartidosChanged === 'function') {
        await onPartidosChanged();
      }
      alert(partidoEditandoId ? 'Resultado actualizado correctamente.' : 'Resultado registrado correctamente.');
    } catch (error) {
      alert(`No se pudo guardar el resultado: ${error.message}`);
    } finally {
      setGuardandoResultado(false);
    }
  };

  const borrarPartidosPrueba = async () => {
    const partidosDePrueba = partidosAdmin.filter(esPartidoPrueba);
    if (partidosDePrueba.length === 0) {
      alert('No se encontraron partidos de prueba para borrar.');
      return;
    }

    if (!window.confirm(`Se borrarán ${partidosDePrueba.length} partidos de prueba. ¿Continuar?`)) return;

    try {
      for (const partido of partidosDePrueba) {
        const id = partido.id_partido || partido.id;
        if (id) {
          // Borrado secuencial para evitar saturar la API.
          await api.partidosLiveAPI.delete(id);
        }
      }
      await cargarPartidosAdmin();
      if (typeof onPartidosChanged === 'function') {
        await onPartidosChanged();
      }
      alert(`${partidosDePrueba.length} partidos de prueba eliminados.`);
    } catch (error) {
      alert(`No se pudieron eliminar todos los partidos de prueba: ${error.message}`);
    }
  };

  useEffect(() => {
    const target = editandoTipo === 'cuenta'
      ? edicionCuentaRef.current
      : editandoTipo === 'jugador'
        ? edicionJugadorRef.current
        : null;

    if (!target) return;

    const timer = window.setTimeout(() => {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 80);

    return () => window.clearTimeout(timer);
  }, [editandoTipo]);

  const guardarEdicionActual = async () => {
    try {
      setGuardandoUsuario(true);

      if (editandoTipo === 'cuenta' && cuentaAdminEdit) {
        const cuentaPreparada = aplicarReglaMensualidad({
          ...cuentaAdminEdit,
          permisos_override: getPermisosPersistibles(cuentaAdminEdit),
        });
        await guardarCuentaAdmin(cuentaPreparada, cuentaAdminEdit.id);
        alert('Cuenta actualizada correctamente.');
      }

      if (editandoTipo === 'jugador' && jugadorAdminEdit) {
        await guardarJugadorAdmin(jugadorAdminEdit, jugadorAdminEdit.rut_original || jugadorAdminEdit.rut_jugador);
        if (cuentaAsociadaJugadorEdit?.id) {
          // Persist ONLY the permission override diff for the linked account.
          // Do not send the full account object to avoid overwriting concurrent edits.
          await guardarCuentaAdmin(
            { permisos_override: getPermisosPersistibles(cuentaAsociadaJugadorEdit) },
            cuentaAsociadaJugadorEdit.id,
          );
        }
        alert('Jugador actualizado correctamente.');
      }

      setEditandoTipo(null);
      setCuentaAdminEdit(null);
      setJugadorAdminEdit(null);
    } catch (error) {
      alert(`No se pudo guardar: ${error.message}`);
    } finally {
      setGuardandoUsuario(false);
    }
  };

  const guardarNuevoUsuario = async () => {
    try {
      setGuardandoUsuario(true);

      if (tipoNuevoUsuario === 'cuenta') {
        const cuentaPreparada = aplicarReglaMensualidad(nuevaCuenta);
        await guardarCuentaAdmin(cuentaPreparada);
        setNuevaCuenta({
          correo: '',
          rut: '',
          password: '',
          nombres: '',
          apellido_paterno: '',
          apellido_materno: '',
          telefono: '',
          direccion: '',
          comuna: '',
          rol: 'apoderado',
          perfil_principal: 'apoderado',
          cargo_directiva: '',
          socio_admin: false,
          aprobado_superadmin: false,
          acceso_nivel: 'estandar',
          utm_valor_referencia: 68000,
          monto_mensual_base: 0,
          monto_mensual_override: '',
          condiciones_pago: '',
          fecha_corte_utm: '',
          estado: 'activo',
          es_socio: false,
          forzar_clave: true,
          logo_url: '',
        });
        alert('Cuenta creada correctamente.');
      } else {
        await guardarJugadorAdmin(nuevoJugador);
        setNuevoJugador({
          rut_jugador: '',
          correo_apoderado: '',
          nombres: '',
          apellido_paterno: '',
          apellido_materno: '',
          rama: 'MASCULINA',
          categoria: 'SUB-13',
          estado: 'ACTIVO',
          foto_jugador: '',
        });
        alert('Jugador creado correctamente.');
      }
    } catch (error) {
      alert(`No se pudo crear: ${error.message}`);
    } finally {
      setGuardandoUsuario(false);
    }
  };

  const guardarNuevoJugadorVisita = async () => {
    if (!nuevoJugadorVisita.rut_visita || !nuevoJugadorVisita.nombres || !nuevoJugadorVisita.apellido_paterno) {
      alert('Completa RUT, nombres y apellido paterno para registrar jugador invitado.');
      return;
    }

    try {
      setGuardandoVisita(true);
      await guardarJugadorVisitaAdmin(nuevoJugadorVisita);
      setNuevoJugadorVisita({
        rut_visita: '',
        nombres: '',
        apellido_paterno: '',
        apellido_materno: '',
        club_procedencia: '',
        club_logo_url: '',
        rama: 'MASCULINA',
        categoria: 'SUB-15',
        posicion: '',
        contacto_apoderado: '',
        telefono_contacto: '',
      });
      alert('Jugador invitado registrado correctamente.');
    } catch (error) {
      alert(`No se pudo registrar: ${error.message}`);
    } finally {
      setGuardandoVisita(false);
    }
  };

  const subirLogoAsset = async () => {
    if (!logoAssetForm.nombre.trim() || !logoAssetForm.archivo) {
      alert('Completa el nombre y selecciona un archivo de logo.');
      return;
    }

    try {
      setSubiendoLogoAsset(true);
      const formData = new FormData();
      formData.append('nombre', logoAssetForm.nombre.trim());
      formData.append('tipo', logoAssetForm.tipo);
      formData.append('archivo', logoAssetForm.archivo);

      const resultado = await api.assetsAPI.uploadLogo(formData);
      const urlLogo = resultado?.url || '';
      setLogoAssetUrl(urlLogo);

      if (logoAssetForm.objetivo === 'jugador') {
        setNuevoJugador((prev) => ({ ...prev, foto_jugador: urlLogo }));
      } else if (logoAssetForm.objetivo === 'cuenta') {
        setNuevaCuenta((prev) => ({ ...prev, logo_url: urlLogo }));
      } else if (logoAssetForm.objetivo === 'invitado') {
        setNuevoJugadorVisita((prev) => ({ ...prev, club_logo_url: urlLogo, club_procedencia: prev.club_procedencia || logoAssetForm.nombre.trim() }));
      }

      setLogoAssetForm({ nombre: '', tipo: 'club', objetivo: 'jugador', archivo: null });
      alert(`Logo guardado en ${resultado.url}`);
    } catch (error) {
      alert(`No se pudo subir el logo: ${error.message}`);
    } finally {
      setSubiendoLogoAsset(false);
    }
  };

  const guardarEdicionJugadorVisita = async () => {
    if (!jugadorVisitaEdit?.id_visita) return;

    try {
      setGuardandoVisita(true);
      await guardarJugadorVisitaAdmin({
        prueba_realizada: Boolean(jugadorVisitaEdit.prueba_realizada),
        resultado_prueba: jugadorVisitaEdit.resultado_prueba || 'pendiente',
        reclutado: Boolean(jugadorVisitaEdit.reclutado),
        observaciones: jugadorVisitaEdit.observaciones || '',
      }, jugadorVisitaEdit.id_visita);

      setJugadorVisitaEdit(null);
      alert('Seguimiento del invitado actualizado.');
    } catch (error) {
      alert(`No se pudo actualizar: ${error.message}`);
    } finally {
      setGuardandoVisita(false);
    }
  };

  const ejecutarSyncSheets = async () => {
    const token = syncToken.trim();
    if (!token) {
      alert('Ingresa el token de sincronización antes de continuar.');
      return;
    }

    try {
      setSyncSheetsRunning(true);
      const resultado = await api.adminAPI.syncSheets(token);
      setSyncSheetsResult(resultado);
      if (onSheetsSyncComplete) {
        await onSheetsSyncComplete();
      }
      alert(`Sincronización completada. Importadas: ${resultado?.totals?.importadas ?? 0}`);
    } catch (error) {
      alert(`No se pudo sincronizar: ${error.message}`);
    } finally {
      setSyncSheetsRunning(false);
    }
  };

  const consultarEstadoSync = async () => {
    const token = syncToken.trim();
    if (!token) {
      alert('Ingresa el token de sincronización para consultar el estado.');
      return;
    }

    try {
      setLoadingSyncStatus(true);
      const estado = await api.adminAPI.getSyncStatus(token);
      setSyncSheetsResult(estado?.lastSync || null);
    } catch (error) {
      alert(`No se pudo consultar el estado: ${error.message}`);
    } finally {
      setLoadingSyncStatus(false);
    }
  };

  const cargarDetalleCalidad = async () => {
    const token = syncToken.trim();
    if (!token) {
      alert('Ingresa el token para consultar el detalle de correcciones.');
      return;
    }

    try {
      setLoadingQualityDetails(true);
      const resultado = await api.adminAPI.getDataQualityDetails(token);
      setQualityDetailResult(resultado?.detail || null);
    } catch (error) {
      alert(`No se pudo obtener el detalle: ${error.message}`);
    } finally {
      setLoadingQualityDetails(false);
    }
  };

  const cargarConflictosJugadores = async () => {
    const token = syncToken.trim();
    if (!token) {
      alert('Ingresa el token para consultar conflictos de jugadores.');
      return;
    }

    try {
      setLoadingJugadoresConflicts(true);
      const resultado = await api.adminAPI.getJugadoresRutConflicts(token);
      setJugadoresConflictsResult(resultado?.detail || null);
    } catch (error) {
      alert(`No se pudieron obtener conflictos: ${error.message}`);
    } finally {
      setLoadingJugadoresConflicts(false);
    }
  };

  const prepararJugadorCorregidoDesdeConflicto = (fila) => {
    setTipoNuevoUsuario('jugador');
    setVistaAdmin('usuarios');
    setNuevoJugador({
      rut_jugador: '',
      correo_apoderado: fila.correo_apoderado || '',
      nombres: fila.nombres || '',
      apellido_paterno: fila.apellido_paterno || '',
      apellido_materno: fila.apellido_materno || '',
      rama: fila.rama || 'MASCULINA',
      categoria: fila.categoria || 'SUB-13',
      estado: fila.estado || 'ACTIVO',
      foto_jugador: '',
    });
    alert('Ficha precargada desde conflicto. Ingresa el RUT correcto y guarda el nuevo jugador.');
  };

  const resolverConflictoRut = async (conflicto, fila) => {
    const token = syncToken.trim();
    if (!token) {
      alert('Ingresa el token para registrar la resolución.');
      return;
    }

    const observaciones = window.prompt('Observaciones de resolución (opcional):', 'Corrección aplicada desde panel superadmin.') || '';
    const opId = `${conflicto.rutNormalizado || conflicto.rut}-${fila.filaSheet}`;

    try {
      setResolviendoConflictoRut(opId);
      await api.adminAPI.resolveJugadoresRutConflict(token, {
        rut: conflicto.rut || conflicto.rutNormalizado,
        filaSheet: fila.filaSheet,
        accion: 'correccion_desde_panel',
        observaciones,
        usuario: 'super_admin',
      });
      alert('Resolución registrada en auditoría.');
    } catch (error) {
      alert(`No se pudo registrar resolución: ${error.message}`);
    } finally {
      setResolviendoConflictoRut('');
    }
  };

  const subirFotoJugadorDesdeGaleria = async (file, target = 'nuevo') => {
    if (!file) return;

    try {
      if (target === 'nuevo') setSubiendoFotoJugadorNuevo(true);
      else setSubiendoFotoJugadorEdit(true);

      const formData = new FormData();
      formData.append('nombre', `jugador-${Date.now()}`);
      formData.append('tipo', 'jugador-foto');
      formData.append('archivo', file);

      const resultado = await api.assetsAPI.uploadLogo(formData);
      const fotoUrl = resultado?.url || '';

      if (target === 'nuevo') {
        setNuevoJugador((prev) => ({ ...prev, foto_jugador: fotoUrl }));
      } else {
        setJugadorAdminEdit((prev) => ({ ...(prev || {}), foto_jugador: fotoUrl }));
      }
    } catch (error) {
      alert(`No se pudo subir la foto: ${error.message}`);
    } finally {
      if (target === 'nuevo') setSubiendoFotoJugadorNuevo(false);
      else setSubiendoFotoJugadorEdit(false);
    }
  };

  const toggleCategoriaExtraCitacion = (categoria) => {
    const valor = String(categoria || '').trim();
    if (!valor || valor.toLowerCase() === 'todas') return;
    setCategoriasExtraCitacion((prev) => (
      prev.includes(valor)
        ? prev.filter((c) => c !== valor)
        : [...prev, valor]
    ));
  };

  const actualizarRespuestaConvocado = (citacionId, rut, payload = {}) => {
    setNominaCita((prev) => (prev || []).map((c) => {
      if (c.id !== citacionId) return c;
      return {
        ...c,
        convocados: (c.convocados || []).map((conv) => {
          if (conv.rut_jugador !== rut) return conv;
          return {
            ...conv,
            ...payload,
            actualizado_en: new Date().toISOString(),
          };
        }),
      };
    }));
  };

  const crearCitacion = () => {
    if (!String(citaForm.competencia_nombre || '').trim()) {
      alert('Debes indicar el nombre de la competencia o torneo.');
      return;
    }
    if (!String(citaForm.rival_nombre || '').trim()) {
      alert('Debes indicar el equipo rival.');
      return;
    }

    const convocados = jugadorasCitacion
      .filter((j) => Boolean(seleccionCitacion[j.rut_jugador]))
      .map((j) => ({
        rut_jugador: j.rut_jugador,
        nombre: `${j.nombres || ''} ${j.apellido_paterno || ''}`.trim(),
        categoria: j.categoria || 'Sin categoría',
        rama: j.rama || 'Sin rama',
        correo_apoderado: j.correo_apoderado || '',
        respuesta: 'pendiente',
        justificacion: '',
        requiere_excepcion_morosidad: (morososAdmin || []).some((m) => String(m.rut || '').trim() === String(j.rut_jugador || '').trim()),
        excepcion_solicitada: false,
        estado_excepcion: 'no_requiere',
        actualizado_en: null,
      }));

    if (convocados.length === 0) {
      alert('Selecciona al menos una jugadora o jugador para crear la citación.');
      return;
    }

    const citacion = {
      id: nextId(),
      tipo_competencia: citaForm.tipo_competencia,
      competencia_nombre: citaForm.competencia_nombre,
      competencia_logo_url: citaForm.competencia_logo_url || '/logos/club-logo.png',
      dia_citacion: citaForm.dia_citacion,
      hora_citacion: citaForm.hora_citacion,
      hora_presentacion: citaForm.hora_presentacion,
      rival_nombre: citaForm.rival_nombre,
      rival_logo_url: citaForm.rival_logo_url || '/logos/club-logo.png',
      rama: citaRama,
      categoria_base: citaCategoria,
      categorias_apoyo: categoriasExtraCitacion,
      convocados,
      creado_en: new Date().toISOString(),
    };

    const nuevaComunicacionCitacion = {
      id: nextId(),
      TITULO: `Citación ${citaForm.tipo_competencia}: ${citaForm.competencia_nombre}`,
      CUERPO_TEXTO: `Convocatoria oficial vs ${citaForm.rival_nombre}. Día ${citaForm.dia_citacion}, citación ${citaForm.hora_citacion}, presentación ${citaForm.hora_presentacion}.`,
      FECHA: new Date().toLocaleDateString('es-CL'),
      TIPO_COMUNICADO: 'Citación',
      rama: citaRama === 'todas' ? 'General' : citaRama,
      categoria: citaCategoria === 'todas' ? 'General' : citaCategoria,
      urgencia: 'Alta',
      solicita_asistencia: true,
      audiencia: ['apoderados', 'deportistas'],
      asistencias: [],
      reacciones: {},
      citacion_id: citacion.id,
      convocatoria_ruts: convocados.map((x) => x.rut_jugador),
      convocatoria_alertas_morosidad: convocados
        .filter((x) => Boolean(x.requiere_excepcion_morosidad))
        .map((x) => x.rut_jugador),
    };

    setNominaCita((prev) => [citacion, ...(prev || [])]);
    setComunicaciones([nuevaComunicacionCitacion, ...(comunicaciones || [])]);
    setCitacionActivaId(citacion.id);
    setSeleccionCitacion({});
    alert(`Citación creada y enviada para ${convocados.length} convocados. Puedes monitorear respuestas en la barra de estado.`);
  };

  return (
    <div className="admin-container fade-in">
      <div className="scroll-horizontal-menu mb-15">
        <div className="segment-control" style={{ minWidth: '100%', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          <div className={`segment-btn ${vistaAdmin === 'dashboard' ? 'active' : ''}`} onClick={() => setVistaAdmin('dashboard')}><Activity size={14} /> Resumen</div>
          <div className={`segment-btn ${vistaAdmin === 'usuarios' ? 'active' : ''}`} onClick={() => setVistaAdmin('usuarios')}><Users size={14} /> Usuarios y Cuentas</div>
          <div className={`segment-btn ${vistaAdmin === 'publicar' ? 'active' : ''}`} onClick={() => setVistaAdmin('publicar')}><Megaphone size={14} /> Publicar</div>
          <div className={`segment-btn ${vistaAdmin === 'resultados' ? 'active' : ''}`} onClick={() => { setVistaAdmin('resultados'); cargarPartidosAdmin(); }}><Trophy size={14} /> Resultados</div>
          <div className={`segment-btn ${vistaAdmin === 'activos' ? 'active' : ''}`} onClick={() => setVistaAdmin('activos')}><Image size={14} /> Activos</div>
          <div className={`segment-btn ${vistaAdmin === 'demo' ? 'active' : ''}`} onClick={() => setVistaAdmin('demo')}><ShieldCheck size={14} /> Demo</div>
          <div className={`segment-btn ${vistaAdmin === 'pagos' ? 'active' : ''}`} onClick={() => setVistaAdmin('pagos')}><CheckSquare size={14} /> Validar Pago</div>
          <div className={`segment-btn ${vistaAdmin === 'citaciones' ? 'active' : ''}`} onClick={() => setVistaAdmin('citaciones')}><UserPlus size={14} /> Citaciones</div>
          <div className={`segment-btn ${vistaAdmin === 'invitados' ? 'active' : ''}`} onClick={() => setVistaAdmin('invitados')}><Users size={14} /> Invitados</div>
          <div className={`segment-btn ${vistaAdmin === 'auditoria' ? 'active' : ''}`} onClick={() => setVistaAdmin('auditoria')}><History size={14} /> Auditoría</div>
          <div className={`segment-btn ${vistaAdmin === 'reportes' ? 'active' : ''}`} onClick={() => setVistaAdmin('reportes')}><FileText size={14} /> Reportes</div>
          <div className={`segment-btn ${vistaAdmin === 'salud' ? 'active' : ''}`} onClick={() => { setVistaAdmin('salud'); generarAlertas(); }}><Stethoscope size={14} /> Salud</div>
          <div className={`segment-btn ${vistaAdmin === 'permisos' ? 'active' : ''}`} onClick={() => setVistaAdmin('permisos')}><Filter size={14} /> Ajustes</div>
        </div>
      </div>

      {vistaAdmin === 'dashboard' && (
        <div className="fade-in">
          <div className="card mb-15" style={{ borderLeft: '4px solid var(--azul-electrico)', borderRadius: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', flexWrap: 'wrap' }}>
              <div>
                <h4 className="form-subtitle" style={{ marginBottom: '6px' }}><RefreshCcw size={16} /> Sincronización Google Sheets</h4>
                <p style={{ margin: 0, fontSize: '12px', color: 'var(--texto-secundario)', lineHeight: '1.5' }}>
                  Ejecuta una carga real desde la hoja maestra hacia PostgreSQL y refresca los datos del panel al terminar.
                </p>
              </div>
              <span style={{ fontSize: '11px', fontWeight: '800', color: 'var(--azul-electrico)', background: 'rgba(0,122,255,0.08)', padding: '6px 10px', borderRadius: '999px' }}>
                Fuente real activa
              </span>
            </div>

            <div className="sync-toolbar" style={{ marginTop: '12px' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Token de sincronización</label>
                <input
                  type="password"
                  className="form-input"
                  placeholder="ADMIN_SYNC_TOKEN"
                  value={syncToken}
                  onChange={(e) => setSyncToken(e.target.value)}
                />
              </div>
              <div className="sync-actions">
                <button className="btn-secondary sync-action-btn" onClick={consultarEstadoSync} disabled={loadingSyncStatus || syncSheetsRunning}>
                  {loadingSyncStatus ? 'Consultando...' : 'Consultar estado'}
                </button>
                <button className="btn-secondary sync-action-btn" onClick={cargarDetalleCalidad} disabled={loadingQualityDetails || syncSheetsRunning}>
                  {loadingQualityDetails ? 'Cargando detalle...' : 'Ver detalle correcciones'}
                </button>
                <button className="btn-secondary sync-action-btn" onClick={cargarConflictosJugadores} disabled={loadingJugadoresConflicts || syncSheetsRunning}>
                  {loadingJugadoresConflicts ? 'Cargando conflictos...' : 'Conflictos RUT jugadores'}
                </button>
                <button className="btn-electric sync-action-btn" onClick={ejecutarSyncSheets} disabled={syncSheetsRunning}>
                  <RefreshCcw size={15} /> {syncSheetsRunning ? 'Sincronizando...' : 'Sincronizar ahora'}
                </button>
              </div>
            </div>

            {syncSheetsResult && (
              <div style={{ marginTop: '12px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '8px' }}>
                <div className="admin-stat-pill azul"><span>Total filas</span><h2>{syncSheetsResult.totals?.total ?? 0}</h2></div>
                <div className="admin-stat-pill verde"><span>Importadas</span><h2>{syncSheetsResult.totals?.importadas ?? 0}</h2></div>
                <div className="admin-stat-pill rojo"><span>Errores</span><h2>{syncSheetsResult.totals?.errores ?? 0}</h2></div>
              </div>
            )}

            {syncSheetsResult && (
              <div style={{ marginTop: '10px', fontSize: '12px', color: 'var(--texto-secundario)', fontWeight: '700', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span>Estado: {syncSheetsResult.status || 'desconocido'}</span>
                {syncSheetsResult.syncedAt && <span>Última sincronización: {new Date(syncSheetsResult.syncedAt).toLocaleString('es-CL')}</span>}
                {syncSheetsResult.error && <span style={{ color: 'var(--rojo-alerta)' }}>Error: {syncSheetsResult.error}</span>}
              </div>
            )}

            {(cuentasIncompletas.length > 0 || jugadoresIncompletos.length > 0 || pagosConCorreccion.length > 0) && (
              <div className="card" style={{ marginTop: '12px', borderLeft: '4px solid #FF9500', borderRadius: '20px', background: 'rgba(255,149,0,0.08)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                  <AlertTriangle size={16} color="#b36200" />
                  <strong style={{ color: '#b36200', fontSize: '13px' }}>Alertas de corrección pendientes</strong>
                </div>
                <div style={{ fontSize: '12px', color: '#8a4f00', fontWeight: '700', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span>Perfiles de cuentas incompletos: {cuentasIncompletas.length}</span>
                  <span>Perfiles de jugadores incompletos: {jugadoresIncompletos.length}</span>
                  <span>Pagos en revisión/corrección: {pagosConCorreccion.length}</span>
                </div>
                <div style={{ marginTop: '10px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <button className="btn-secondary" onClick={() => setVistaAdmin('usuarios')}>Completar cuentas</button>
                  <button className="btn-secondary" onClick={() => setVistaAdmin('usuarios')}>Completar jugadores</button>
                  <button className="btn-secondary" onClick={() => setVistaAdmin('pagos')}>Revisar pagos</button>
                </div>
              </div>
            )}

            {qualityDetailResult && (
              <div className="card" style={{ marginTop: '12px', borderRadius: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                  <h4 className="form-subtitle" style={{ marginBottom: 0 }}><AlertTriangle size={16} /> Detalle de correcciones</h4>
                  <span style={{ fontSize: '11px', fontWeight: '800', color: '#b36200', background: 'rgba(255,149,0,0.12)', padding: '5px 10px', borderRadius: '999px' }}>
                    Cuentas {qualityDetailResult?.totals?.cuentasIncompletas ?? 0} · Jugadores {qualityDetailResult?.totals?.jugadoresIncompletos ?? 0} · Pagos {qualityDetailResult?.totals?.pagosConCorreccion ?? 0}
                  </span>
                </div>

                <div style={{ marginTop: '10px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '10px' }}>
                  <div style={{ border: '1px solid rgba(255,149,0,0.25)', borderRadius: '14px', padding: '10px' }}>
                    <strong style={{ fontSize: '12px' }}>Cuentas incompletas</strong>
                    <div style={{ marginTop: '8px', maxHeight: '180px', overflowY: 'auto' }}>
                      {(qualityDetailResult.cuentasIncompletas || []).slice(0, 8).map((c) => (
                        <div key={`qc-${c.id}`} style={{ marginBottom: '8px', fontSize: '12px' }}>
                          <div style={{ fontWeight: '700' }}>{`${c.nombres || 'Sin nombre'} ${c.apellido_paterno || ''}`.trim()}</div>
                          <div style={{ color: 'var(--texto-secundario)' }}>{c.correo || 'Sin correo'} · {c.rut || 'Sin RUT'}</div>
                          <div style={{ color: '#b36200', fontWeight: '700' }}>{(c.campos_faltantes || []).join(', ')}</div>
                        </div>
                      ))}
                      {(qualityDetailResult.cuentasIncompletas || []).length === 0 && <div style={{ fontSize: '12px', color: 'var(--texto-secundario)' }}>Sin observaciones.</div>}
                    </div>
                  </div>

                  <div style={{ border: '1px solid rgba(255,149,0,0.25)', borderRadius: '14px', padding: '10px' }}>
                    <strong style={{ fontSize: '12px' }}>Jugadores incompletos</strong>
                    <div style={{ marginTop: '8px', maxHeight: '180px', overflowY: 'auto' }}>
                      {(qualityDetailResult.jugadoresIncompletos || []).slice(0, 8).map((j, idx) => (
                        <div key={`qj-${j.rut_jugador || j.correo_apoderado || idx}`} style={{ marginBottom: '8px', fontSize: '12px' }}>
                          <div style={{ fontWeight: '700' }}>{`${j.nombres || 'Sin nombre'} ${j.apellido_paterno || ''}`.trim()}</div>
                          <div style={{ color: 'var(--texto-secundario)' }}>{j.rut_jugador || 'Sin RUT'} · {j.rama || 'Sin rama'} · {j.categoria || 'Sin categoría'}</div>
                          <div style={{ color: '#b36200', fontWeight: '700' }}>{(j.campos_faltantes || []).join(', ')}</div>
                        </div>
                      ))}
                      {(qualityDetailResult.jugadoresIncompletos || []).length === 0 && <div style={{ fontSize: '12px', color: 'var(--texto-secundario)' }}>Sin observaciones.</div>}
                    </div>
                  </div>

                  <div style={{ border: '1px solid rgba(255,149,0,0.25)', borderRadius: '14px', padding: '10px' }}>
                    <strong style={{ fontSize: '12px' }}>Pagos con corrección</strong>
                    <div style={{ marginTop: '8px', maxHeight: '180px', overflowY: 'auto' }}>
                      {(qualityDetailResult.pagosConCorreccion || []).slice(0, 8).map((p) => (
                        <div key={`qp-${p.id}`} style={{ marginBottom: '8px', fontSize: '12px' }}>
                          <div style={{ fontWeight: '700' }}>Pago #{p.id} · ${Number(p.monto_total_pagado || 0).toLocaleString('es-CL')}</div>
                          <div style={{ color: 'var(--texto-secundario)' }}>{p.rut_jugador || 'Sin RUT'} · {p.meses_correspondientes || 'Sin meses'}</div>
                          <div style={{ color: '#b36200', fontWeight: '700' }}>{p.notas_tesoreria || 'Sin nota'}</div>
                        </div>
                      ))}
                      {(qualityDetailResult.pagosConCorreccion || []).length === 0 && <div style={{ fontSize: '12px', color: 'var(--texto-secundario)' }}>Sin observaciones.</div>}
                    </div>
                  </div>
                </div>

                <div style={{ marginTop: '10px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <button className="btn-secondary" onClick={() => setVistaAdmin('usuarios')}>Ir a cuentas</button>
                  <button className="btn-secondary" onClick={() => setVistaAdmin('usuarios')}>Ir a jugadores</button>
                  <button className="btn-secondary" onClick={() => setVistaAdmin('pagos')}>Ir a pagos</button>
                </div>
              </div>
            )}

            {jugadoresConflictsResult && (
              <div className="card" style={{ marginTop: '12px', borderRadius: '20px', borderLeft: '4px solid #FF9500' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                  <h4 className="form-subtitle" style={{ marginBottom: 0 }}><AlertTriangle size={16} /> Conflictos RUT en hoja jugadores</h4>
                  <span style={{ fontSize: '11px', fontWeight: '800', color: '#b36200', background: 'rgba(255,149,0,0.12)', padding: '5px 10px', borderRadius: '999px' }}>
                    Conflictos: {jugadoresConflictsResult?.totalConflictos ?? 0} · Filas hoja: {jugadoresConflictsResult?.totalFilas ?? 0}
                  </span>
                </div>

                <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {(jugadoresConflictsResult.conflictos || []).map((conflicto, idx) => (
                    <div key={`conf-rut-${conflicto.rutNormalizado || idx}`} style={{ border: '1px solid rgba(255,149,0,0.25)', borderRadius: '14px', padding: '10px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <strong style={{ fontSize: '13px' }}>RUT en conflicto: {conflicto.rut || conflicto.rutNormalizado}</strong>
                        <span style={{ fontSize: '11px', fontWeight: '800', color: '#b36200' }}>Filas repetidas: {conflicto.totalFilas}</span>
                      </div>

                      {conflicto.jugadorActual && (
                        <div style={{ marginTop: '6px', fontSize: '12px', color: 'var(--texto-secundario)' }}>
                          Jugador actual en sistema: {(conflicto.jugadorActual.nombres || '').trim()} {(conflicto.jugadorActual.apellido_paterno || '').trim()} · {conflicto.jugadorActual.rama || 'Sin rama'} · {conflicto.jugadorActual.categoria || 'Sin categoría'}
                        </div>
                      )}

                      <div style={{ marginTop: '8px', display: 'grid', gap: '8px' }}>
                        {(conflicto.filas || []).map((fila, filaIdx) => (
                          <div key={`conf-fila-${conflicto.rutNormalizado || idx}-${fila.filaSheet || filaIdx}`} style={{ background: 'rgba(255,149,0,0.08)', borderRadius: '10px', padding: '8px' }}>
                            <div style={{ fontSize: '12px', fontWeight: '700' }}>
                              Fila {fila.filaSheet}: {(fila.nombres || '').trim()} {(fila.apellido_paterno || '').trim()} {(fila.apellido_materno || '').trim()}
                            </div>
                            <div style={{ fontSize: '11px', color: 'var(--texto-secundario)' }}>
                              Correo apoderado: {fila.correo_apoderado || 'Sin correo'} · Rama: {fila.rama || 'Sin rama'} · Categoría: {fila.categoria || 'Sin categoría'}
                            </div>
                            <div style={{ marginTop: '6px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                              <button className="btn-secondary" onClick={() => prepararJugadorCorregidoDesdeConflicto(fila)}>Crear ficha corregida</button>
                              <button
                                className="btn-secondary"
                                onClick={() => resolverConflictoRut(conflicto, fila)}
                                disabled={resolviendoConflictoRut === `${conflicto.rutNormalizado || conflicto.rut}-${fila.filaSheet}`}
                              >
                                {resolviendoConflictoRut === `${conflicto.rutNormalizado || conflicto.rut}-${fila.filaSheet}` ? 'Registrando...' : 'Resolver conflicto'}
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}

                  {(jugadoresConflictsResult.conflictos || []).length === 0 && (
                    <div style={{ fontSize: '12px', color: 'var(--texto-secundario)', fontWeight: '700' }}>
                      No hay conflictos de RUT repetido en la hoja JUGADORES.
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="card text-center admin-panel-card mb-5" style={{ borderRadius: '28px', background: 'linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(248,250,255,0.96) 100%)', border: '1px solid rgba(255,255,255,0.72)', boxShadow: '0 14px 34px rgba(15,23,42,0.08)' }}>
            <h4 className="form-subtitle" style={{ justifyContent: 'center', fontSize: '15px', fontWeight: '900' }}>Recaudación Global — Jul 2026</h4>
            <div className="radial-progress-container mt-10 mb-10" style={{ position: 'relative', width: '130px', height: '130px', margin: '0 auto' }}>
              <svg viewBox="0 0 100 100" style={{ transform: 'rotate(-90deg)', width: '100%', height: '100%' }}>
                <circle cx="50" cy="50" r="45" fill="transparent" stroke="var(--borde-suave)" strokeWidth="10" />
                <circle cx="50" cy="50" r="45" fill="transparent" stroke="url(#gradG)" strokeWidth="10" strokeDasharray={`${pctGlobal * 2.82} 300`} strokeLinecap="round" style={{ transition: 'stroke-dasharray 1s ease' }} />
                <defs><linearGradient id="gradG" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stopColor="var(--azul-electrico)" /><stop offset="100%" stopColor="var(--verde-victoria)" /></linearGradient></defs>
              </svg>
              <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', textAlign: 'center' }}>
                <h2 style={{ margin: 0, fontSize: '22px' }}>{pctGlobal}%</h2>
                <span style={{ fontSize: '9px', fontWeight: 'bold', color: 'var(--texto-secundario)' }}>LOGRADO</span>
              </div>
            </div>
            <h3 style={{ margin: '0 0 4px', fontSize: '20px', color: 'var(--texto-principal)' }}>${(af.recaudadoSocios + af.recaudadoDeportistas).toLocaleString('es-CL')}</h3>
            <span style={{ fontSize: '12px', color: 'var(--texto-secundario)', fontWeight: 'bold' }}>Meta mensual: ${(af.metaSocios + af.metaDeportistas).toLocaleString('es-CL')}</span>
          </div>

          <h3 className="section-title mt-20">Socios del Club</h3>
          <div className="caja-triple-grid mb-15">
            <div className="admin-stat-pill verde"><span>Al Día</span><h2>{af.sociosAlDia}</h2></div>
            <div className="admin-stat-pill rojo"><span>Morosos</span><h2>{af.sociosMorosos}</h2></div>
            <div className="admin-stat-pill azul"><span>Total</span><h2>{af.totalSocios}</h2></div>
          </div>
          <div className="card mb-20" style={{ borderLeft: '4px solid var(--azul-electrico)', borderRadius: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', fontWeight: '800', color: 'var(--texto-secundario)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Recaudación Socios</span>
              <span style={{ fontWeight: '900', color: 'var(--azul-electrico)', fontSize: '14px' }}>{pctSocios}%</span>
            </div>
            <div className="recaud-bar mt-10"><div className="recaud-bar-fill" style={{ width: `${pctSocios}%`, background: 'linear-gradient(90deg, var(--azul-electrico), var(--verde-victoria))' }} /></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px' }}>
              <span style={{ fontSize: '12px', color: 'var(--verde-victoria)', fontWeight: '800' }}>✓ ${af.recaudadoSocios.toLocaleString('es-CL')}</span>
              <span style={{ fontSize: '12px', color: 'var(--rojo-alerta)', fontWeight: '800' }}>✗ ${(af.metaSocios - af.recaudadoSocios).toLocaleString('es-CL')} pendiente</span>
            </div>
          </div>

          <h3 className="section-title">Deportistas Inscritos</h3>
          <div className="caja-triple-grid mb-15">
            <div className="admin-stat-pill verde"><span>Al Día</span><h2>{af.deportistasAlDia}</h2></div>
            <div className="admin-stat-pill rojo"><span>Morosos</span><h2>{af.deportistasMorosos}</h2></div>
            <div className="admin-stat-pill azul"><span>Total</span><h2>{af.totalDeportistas}</h2></div>
          </div>
          <div className="card mb-20" style={{ borderLeft: '4px solid #FF9500', borderRadius: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', fontWeight: '800', color: 'var(--texto-secundario)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Recaudación Deportistas</span>
              <span style={{ fontWeight: '900', color: '#FF9500', fontSize: '14px' }}>{pctDep}%</span>
            </div>
            <div className="recaud-bar mt-10"><div className="recaud-bar-fill" style={{ width: `${pctDep}%`, background: 'linear-gradient(90deg, #FF9500, var(--verde-victoria))' }} /></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px' }}>
              <span style={{ fontSize: '12px', color: 'var(--verde-victoria)', fontWeight: '800' }}>✓ ${af.recaudadoDeportistas.toLocaleString('es-CL')}</span>
              <span style={{ fontSize: '12px', color: 'var(--rojo-alerta)', fontWeight: '800' }}>✗ ${(af.metaDeportistas - af.recaudadoDeportistas).toLocaleString('es-CL')} pendiente</span>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h3 className="section-title" style={{ margin: 0 }}>Morosos</h3>
            <button className="btn-notificar" style={{ background: 'var(--rojo-alerta)', color: 'white', borderColor: 'var(--rojo-alerta)', boxShadow: '0 4px 12px rgba(255,59,48,0.3)' }} onClick={() => alert(`Notificación masiva enviada a ${(morososAdmin || []).length} deudores.`)}>
              <Bell size={13} /> Notificar Todos
            </button>
          </div>
          <div className="filter-chips mb-15">
            <button className={`filter-chip ${filtroMorosos === 'todos' ? 'active' : ''}`} onClick={() => setFiltroMorosos('todos')}>Todos ({(morososAdmin || []).length})</button>
            <button className={`filter-chip ${filtroMorosos === 'socios' ? 'active' : ''}`} onClick={() => setFiltroMorosos('socios')}>Socios ({(morososAdmin || []).filter(m => m.tipo === 'socio' || m.tipo === 'socio-apoderado').length})</button>
            <button className={`filter-chip ${filtroMorosos === 'apoderados' ? 'active' : ''}`} onClick={() => setFiltroMorosos('apoderados')}>Apoderados ({(morososAdmin || []).filter(m => m.tipo === 'apoderado' || m.tipo === 'socio-apoderado').length})</button>
          </div>
          {[...morososFiltrados].sort((a, b) => b.mesesDeuda - a.mesesDeuda).map(m => {
            const gravedad = m.mesesDeuda >= 3 ? 'var(--rojo-alerta)' : m.mesesDeuda === 2 ? '#FF9500' : '#DDAA00';
            const { bg, color } = colorTipo(m.tipo);
            const labelTipo = m.tipo === 'socio' ? 'Socio' : m.tipo === 'apoderado' ? 'Apoderado' : 'Socio / Apod.';
            return (
              <div key={m.id} className="moroso-row" style={{ borderLeft: `4px solid ${gravedad}`, borderRadius: '20px', background: 'rgba(255,255,255,0.72)' }}>
                <div className="moroso-info">
                  <span className="moroso-nombre">{m.nombre}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '5px', flexWrap: 'wrap' }}>
                    <span className="moroso-tipo-badge" style={{ background: bg, color }}>{labelTipo}</span>
                    {m.pupilos.length > 0 && <span style={{ fontSize: '11px', color: 'var(--texto-secundario)', fontWeight: '700' }}>👤 {m.pupilos.join(' · ')}</span>}
                  </div>
                  <span style={{ fontSize: '11px', color: 'var(--texto-secundario)', marginTop: '4px', display: 'block', fontWeight: '700' }}>📞 {m.contacto}</span>
                </div>
                <div className="moroso-deuda">
                  <span className="moroso-monto">${m.montoDeuda.toLocaleString('es-CL')}</span>
                  <span className="moroso-meses" style={{ color: gravedad }}>{m.mesesDeuda} {m.mesesDeuda === 1 ? 'mes' : 'meses'}</span>
                </div>
                <button className="btn-notificar" onClick={() => alert(`Notificación enviada a ${m.nombre}\n📞 ${m.contacto}`)}>
                  <Bell size={13} /> Avisar
                </button>
              </div>
            );
          })}
        </div>
      )}

      {vistaAdmin === 'usuarios' && (
        <div className="fade-in">
          <h3 className="section-title">Gestión de Usuarios y Cuentas</h3>
          <p style={{ fontSize: '13px', color: 'var(--texto-secundario)', marginBottom: '12px' }}>
            Esta es la vista unificada de trabajo. Aquí se gestionan cuentas, usuarios relacionados y jugadores sin volver al flujo antiguo separado.
          </p>
          <div className="card">
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '10px' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Buscar</label>
                <div style={{ position: 'relative' }}>
                  <Search size={15} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--texto-secundario)' }} />
                  <input
                    className="form-input"
                    style={{ paddingLeft: '32px' }}
                    placeholder="Nombre, correo, RUT, rol o categoría"
                    value={filtroUsuariosTexto}
                    onChange={(e) => setFiltroUsuariosTexto(e.target.value)}
                  />
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Tipo de perfil</label>
                <select className="form-input" value={filtroTipoPerfil} onChange={(e) => setFiltroTipoPerfil(e.target.value)}>
                  <option value="todos">Todos</option>
                  <option value="jugador">Jugador</option>
                  <option value="apoderado">Apoderado</option>
                    <option value="socio">Socio</option>
                    <option value="socio_apoderado">Socio / Apoderado</option>
                    <option value="directiva">Directiva</option>
                  <option value="staff">Staff</option>
                  <option value="admin">Admin</option>
                  <option value="super_admin">Super Admin</option>
                </select>
              </div>
            </div>

            {filtroTipoPerfil === 'jugador' && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px', marginTop: '8px' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Rama</label>
                  <select className="form-input" value={filtroRamaJugadores} onChange={(e) => setFiltroRamaJugadores(e.target.value)}>
                    <option value="todas">Todas</option>
                    <option value="masculina">Masculina</option>
                    <option value="femenina">Femenina</option>
                    <option value="mixta">Mixta</option>
                  </select>
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Categoría</label>
                  <select className="form-input" value={filtroCategoriaJugadores} onChange={(e) => setFiltroCategoriaJugadores(e.target.value)}>
                    <option value="todas">Todas</option>
                    {categoriasUnicas.map((cat) => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            <div style={{ marginTop: '12px', maxHeight: '320px', overflowY: 'auto' }}>
              {usuariosFiltrados.length === 0 && (
                <p className="text-muted" style={{ fontStyle: 'italic' }}>No hay resultados con los filtros actuales.</p>
              )}

              {usuariosFiltrados.map((u) => (
                <div key={u.id} className="card" style={{ marginBottom: '10px', borderLeft: `4px solid ${u.tipo === 'jugador' ? 'var(--azul-electrico)' : '#FF9500'}`, borderRadius: '22px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
                    <div>
                      <strong style={{ fontSize: '14px' }}>{u.nombre}</strong>
                      <div style={{ fontSize: '12px', color: 'var(--texto-secundario)', marginTop: '4px' }}>
                        {u.tipo === 'jugador'
                          ? `${u.raw.rut_jugador || '-'} · ${u.raw.rama || 'Sin rama'} · ${u.raw.categoria || 'Sin categoría'}`
                          : `${u.raw.correo || '-'} · ${u.raw.rut || '-'} · ${(u.raw.rol || 'sin rol').toUpperCase()}`}
                      </div>
                    </div>
                    <button className="btn-modificar" onClick={() => iniciarEdicion(u)}>
                      Modificar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {editandoTipo === 'cuenta' && cuentaAdminEdit && (
            <div ref={edicionCuentaRef} className="card" style={{ borderRadius: '24px' }}>
              <h4 className="form-subtitle">Editar Cuenta #{cuentaAdminEdit.id}</h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px' }}>
                <div className="form-group"><label>Correo</label><input className="form-input" value={cuentaAdminEdit.correo || ''} onChange={(e) => setCuentaAdminEdit((p) => ({ ...p, correo: e.target.value }))} /></div>
                <div className="form-group"><label>RUT</label><input className="form-input" value={cuentaAdminEdit.rut || ''} onChange={(e) => setCuentaAdminEdit((p) => ({ ...p, rut: e.target.value }))} /></div>
                <div className="form-group"><label>Nombres</label><input className="form-input" value={cuentaAdminEdit.nombres || ''} onChange={(e) => setCuentaAdminEdit((p) => ({ ...p, nombres: e.target.value }))} /></div>
                <div className="form-group"><label>Apellido Paterno</label><input className="form-input" value={cuentaAdminEdit.apellido_paterno || ''} onChange={(e) => setCuentaAdminEdit((p) => ({ ...p, apellido_paterno: e.target.value }))} /></div>
                <div className="form-group"><label>Apellido Materno</label><input className="form-input" value={cuentaAdminEdit.apellido_materno || ''} onChange={(e) => setCuentaAdminEdit((p) => ({ ...p, apellido_materno: e.target.value }))} /></div>
                <div className="form-group"><label>Teléfono</label><input className="form-input" value={cuentaAdminEdit.telefono || ''} onChange={(e) => setCuentaAdminEdit((p) => ({ ...p, telefono: e.target.value }))} /></div>
                <div className="form-group"><label>Dirección</label><input className="form-input" value={cuentaAdminEdit.direccion || ''} onChange={(e) => setCuentaAdminEdit((p) => ({ ...p, direccion: e.target.value }))} /></div>
                <div className="form-group"><label>Comuna</label><input className="form-input" value={cuentaAdminEdit.comuna || ''} onChange={(e) => setCuentaAdminEdit((p) => ({ ...p, comuna: e.target.value }))} /></div>
                <div className="form-group"><label>Rol de acceso</label><select className="form-input" value={cuentaAdminEdit.rol || 'apoderado'} onChange={(e) => setCuentaAdminEdit((p) => ({ ...p, rol: e.target.value }))}><option value="apoderado">Apoderado</option><option value="staff">Staff</option><option value="admin">Admin</option><option value="super_admin">Super Admin</option></select></div>
                <div className="form-group"><label>Perfil principal</label><select className="form-input" value={cuentaAdminEdit.perfil_principal || 'apoderado'} onChange={(e) => actualizarCuentaAdminEdit({ perfil_principal: e.target.value })}>{PERFIL_PRINCIPAL_OPTIONS.map((opt) => <option key={`perfil-edit-${opt.value}`} value={opt.value}>{opt.label}</option>)}</select></div>
                <div className="form-group"><label>Cargo directiva</label><select className="form-input" value={cuentaAdminEdit.cargo_directiva || ''} onChange={(e) => setCuentaAdminEdit((p) => ({ ...p, cargo_directiva: e.target.value }))}>{CARGO_DIRECTIVA_OPTIONS.map((opt) => <option key={`directiva-edit-${opt.value || 'none'}`} value={opt.value}>{opt.label}</option>)}</select></div>
                <div className="form-group"><label>Nivel de acceso</label><select className="form-input" value={cuentaAdminEdit.acceso_nivel || 'estandar'} onChange={(e) => setCuentaAdminEdit((p) => ({ ...p, acceso_nivel: e.target.value }))}>{ACCESO_NIVEL_OPTIONS.map((opt) => <option key={`acceso-edit-${opt.value}`} value={opt.value}>{opt.label}</option>)}</select></div>
                <div className="form-group"><label>Estado</label><select className="form-input" value={cuentaAdminEdit.estado || 'activo'} onChange={(e) => setCuentaAdminEdit((p) => ({ ...p, estado: e.target.value }))}><option value="activo">Activo</option><option value="inactivo">Inactivo</option></select></div>
                <div className="form-group"><label>Valor UTM referencia</label><input type="number" min="1" className="form-input" value={cuentaAdminEdit.utm_valor_referencia || 68000} onChange={(e) => actualizarCuentaAdminEdit({ utm_valor_referencia: e.target.value })} /></div>
                <div className="form-group"><label>Mensualidad base automática (0,3 UTM)</label><input type="number" className="form-input" value={esCuentaCatalogadaSocio(cuentaAdminEdit) ? (cuentaAdminEdit.monto_mensual_base || 0) : 0} disabled /></div>
                <div className="form-group"><label>Mensualidad deportistas acordada (opcional)</label><input type="number" className="form-input" value={cuentaAdminEdit.monto_mensual_override || ''} onChange={(e) => setCuentaAdminEdit((p) => ({ ...p, monto_mensual_override: e.target.value }))} placeholder="Ej: 18000" /></div>
                <div className="form-group"><label>Fecha corte UTM (mes anterior)</label><input type="date" className="form-input" value={cuentaAdminEdit.fecha_corte_utm || ''} onChange={(e) => setCuentaAdminEdit((p) => ({ ...p, fecha_corte_utm: e.target.value }))} /></div>
                <div className="form-group"><label>Condiciones de pago</label><textarea className="form-input" rows="2" value={cuentaAdminEdit.condiciones_pago || ''} onChange={(e) => setCuentaAdminEdit((p) => ({ ...p, condiciones_pago: e.target.value }))}></textarea></div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '8px', marginBottom: '10px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
                  <input type="checkbox" checked={Boolean(esCuentaCatalogadaSocio(cuentaAdminEdit))} disabled />
                  Es socio (automático por perfil)
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
                  <input type="checkbox" checked={Boolean(cuentaAdminEdit.socio_admin)} onChange={(e) => setCuentaAdminEdit((p) => ({ ...p, socio_admin: e.target.checked }))} />
                  Admin entre socios
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
                  <input type="checkbox" checked={Boolean(cuentaAdminEdit.aprobado_superadmin)} onChange={(e) => setCuentaAdminEdit((p) => ({ ...p, aprobado_superadmin: e.target.checked }))} />
                  Aprobado por SuperAdmin
                </label>
              </div>

              {renderPermisosCuenta({
                cuenta: cuentaAdminEdit,
                titulo: 'Permisos y accesos de la cuenta',
              })}

              <div style={{ display: 'flex', gap: '8px' }}>
                <button className="btn-electric" onClick={guardarEdicionActual} disabled={guardandoUsuario}>Guardar cambios</button>
                <button className="btn-secondary" onClick={cancelarEdicion}>Cancelar</button>
              </div>

              <div className="card" style={{ marginTop: '12px', borderRadius: '16px', border: '1px solid rgba(0,122,255,0.16)' }}>
                <h4 className="form-subtitle" style={{ marginBottom: '8px' }}><Users size={15} /> Pupilos del apoderado</h4>
                <p style={{ fontSize: '12px', color: 'var(--texto-secundario)', marginTop: 0 }}>
                  Asigna o corrige manualmente los hijos/pupilos para esta cuenta usando el correo del apoderado.
                </p>

                {!String(cuentaPupilosActiva?.correo || '').trim() && (
                  <div style={{ fontSize: '12px', color: '#b36200', fontWeight: '800', background: 'rgba(255,149,0,0.12)', border: '1px solid rgba(255,149,0,0.35)', borderRadius: '10px', padding: '8px 10px', marginBottom: '10px' }}>
                    Guarda un correo válido en la cuenta antes de asignar pupilos.
                  </div>
                )}

                <div style={{ marginBottom: '10px' }}>
                  <strong style={{ fontSize: '12px' }}>Pupilos actualmente asociados ({pupilosAsignadosCuenta.length})</strong>
                  <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {pupilosAsignadosCuenta.map((j) => (
                      <div key={`pupilo-asig-${j.rut_jugador}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', background: 'rgba(0,122,255,0.07)', border: '1px solid rgba(0,122,255,0.14)', borderRadius: '10px', padding: '8px' }}>
                        <div>
                          <div style={{ fontSize: '12px', fontWeight: '800' }}>{`${j.nombres || ''} ${j.apellido_paterno || ''}`.trim()}</div>
                          <div style={{ fontSize: '11px', color: 'var(--texto-secundario)' }}>{j.rut_jugador || 'Sin RUT'} · {j.categoria || 'Sin categoría'}</div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                          <select
                            className="form-input"
                            style={{ width: '220px', padding: '7px 9px' }}
                            value={destinoApoderadoPorRut[j.rut_jugador] || ''}
                            onChange={(e) => setDestinoApoderadoPorRut((prev) => ({ ...prev, [j.rut_jugador]: e.target.value }))}
                            disabled={procesandoPupiloRut === String(j.rut_jugador || '')}
                          >
                            <option value="">Mover a apoderado...</option>
                            {cuentasApoderadoDisponibles
                              .filter((c) => String(c.correo || '').trim().toLowerCase() !== String(cuentaPupilosActiva?.correo || '').trim().toLowerCase())
                              .map((c) => (
                                <option key={`dest-${j.rut_jugador}-${c.correo}`} value={c.correo}>{c.nombre} · {c.correo}</option>
                              ))}
                          </select>
                          <button
                            className="btn-pill"
                            style={{ width: 'auto', padding: '7px 10px' }}
                            onClick={() => moverPupiloAOtroApoderado(j, destinoApoderadoPorRut[j.rut_jugador])}
                            disabled={procesandoPupiloRut === String(j.rut_jugador || '') || !String(destinoApoderadoPorRut[j.rut_jugador] || '').trim()}
                          >
                            {procesandoPupiloRut === String(j.rut_jugador || '') ? 'Moviendo...' : 'Mover'}
                          </button>
                          <button
                            className="btn-secondary"
                            style={{ width: 'auto', padding: '7px 10px' }}
                            onClick={() => quitarPupiloDeCuenta(j)}
                            disabled={procesandoPupiloRut === String(j.rut_jugador || '')}
                          >
                            {procesandoPupiloRut === String(j.rut_jugador || '') ? 'Quitando...' : 'Quitar'}
                          </button>
                        </div>
                      </div>
                    ))}
                    {pupilosAsignadosCuenta.length === 0 && <span style={{ fontSize: '12px', color: 'var(--texto-secundario)' }}>Sin pupilos asociados.</span>}
                  </div>
                </div>

                <div>
                  <strong style={{ fontSize: '12px' }}>Buscar y asignar pupilo</strong>
                  <input
                    className="form-input"
                    placeholder="Buscar por nombre, RUT, rama o categoría"
                    value={filtroPupiloManual}
                    onChange={(e) => setFiltroPupiloManual(e.target.value)}
                    style={{ marginTop: '6px', marginBottom: '8px' }}
                  />

                  <div style={{ maxHeight: '220px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {jugadoresDisponiblesAsignacion.map((j) => (
                      <div key={`pupilo-disp-${j.rut_jugador}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', border: '1px dashed rgba(0,0,0,0.15)', borderRadius: '10px', padding: '8px' }}>
                        <div>
                          <div style={{ fontSize: '12px', fontWeight: '800' }}>{`${j.nombres || ''} ${j.apellido_paterno || ''}`.trim()}</div>
                          <div style={{ fontSize: '11px', color: 'var(--texto-secundario)' }}>{j.rut_jugador || 'Sin RUT'} · {j.rama || 'Sin rama'} · {j.categoria || 'Sin categoría'}</div>
                        </div>
                        <button
                          className="btn-secondary"
                          style={{ width: 'auto', padding: '7px 10px' }}
                          onClick={() => asignarPupiloACuenta(j)}
                          disabled={procesandoPupiloRut === String(j.rut_jugador || '') || !String(cuentaPupilosActiva?.correo || '').trim()}
                        >
                          {procesandoPupiloRut === String(j.rut_jugador || '') ? 'Asignando...' : 'Asignar'}
                        </button>
                      </div>
                    ))}
                    {jugadoresDisponiblesAsignacion.length === 0 && <span style={{ fontSize: '12px', color: 'var(--texto-secundario)' }}>No hay jugadores disponibles con el filtro actual.</span>}
                  </div>
                </div>
              </div>
            </div>
          )}

          {editandoTipo === 'jugador' && jugadorAdminEdit && (
            <div ref={edicionJugadorRef} className="card">
              <h4 className="form-subtitle">Editar Jugador {jugadorAdminEdit.rut_jugador}</h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px' }}>
                <div className="form-group"><label>RUT Jugador</label><input className="form-input" value={jugadorAdminEdit.rut_jugador || ''} onChange={(e) => setJugadorAdminEdit((p) => ({ ...p, rut_jugador: e.target.value }))} /></div>
                <div className="form-group"><label>Correo Apoderado</label><input className="form-input" value={jugadorAdminEdit.correo_apoderado || ''} onChange={(e) => setJugadorAdminEdit((p) => ({ ...p, correo_apoderado: e.target.value }))} /></div>
                <div className="form-group"><label>Nombres</label><input className="form-input" value={jugadorAdminEdit.nombres || ''} onChange={(e) => setJugadorAdminEdit((p) => ({ ...p, nombres: e.target.value }))} /></div>
                <div className="form-group"><label>Apellido Paterno</label><input className="form-input" value={jugadorAdminEdit.apellido_paterno || ''} onChange={(e) => setJugadorAdminEdit((p) => ({ ...p, apellido_paterno: e.target.value }))} /></div>
                <div className="form-group"><label>Apellido Materno</label><input className="form-input" value={jugadorAdminEdit.apellido_materno || ''} onChange={(e) => setJugadorAdminEdit((p) => ({ ...p, apellido_materno: e.target.value }))} /></div>
                <div className="form-group"><label>Rama</label><select className="form-input" value={jugadorAdminEdit.rama || 'MASCULINA'} onChange={(e) => setJugadorAdminEdit((p) => ({ ...p, rama: e.target.value }))}><option value="MASCULINA">Masculina</option><option value="FEMENINA">Femenina</option><option value="MIXTA">Mixta</option></select></div>
                <div className="form-group"><label>Categoría</label><input className="form-input" value={jugadorAdminEdit.categoria || ''} onChange={(e) => setJugadorAdminEdit((p) => ({ ...p, categoria: e.target.value }))} /></div>
                <div className="form-group"><label>Foto jugador (URL)</label><input className="form-input" value={jugadorAdminEdit.foto_jugador || ''} onChange={(e) => setJugadorAdminEdit((p) => ({ ...p, foto_jugador: e.target.value }))} /></div>
                <div className="form-group"><label>Subir foto desde galería</label><input type="file" className="form-input" accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml" onChange={(e) => subirFotoJugadorDesdeGaleria(e.target.files?.[0] || null, 'edit')} /></div>
                <div className="form-group"><label>Estado</label><select className="form-input" value={jugadorAdminEdit.estado || 'ACTIVO'} onChange={(e) => setJugadorAdminEdit((p) => ({ ...p, estado: e.target.value }))}><option value="ACTIVO">Activo</option><option value="INACTIVO">Inactivo</option><option value="BAJA">Baja</option></select></div>
              </div>
              {subiendoFotoJugadorEdit && <p style={{ fontSize: '12px', color: 'var(--texto-secundario)', marginTop: '4px' }}>Subiendo foto...</p>}

              {renderPermisosCuenta({
                cuenta: cuentaAsociadaJugadorEdit,
                titulo: 'Permisos y accesos de la cuenta asociada',
                descripcion: 'Si este jugador depende de una cuenta/apoderado, puedes gestionar aquí los módulos que tendrá disponibles esa cuenta.',
                emptyMessage: 'Este jugador no tiene una cuenta asociada por correo_apoderado. Guarda o corrige esa relación para poder administrar permisos desde aquí.',
              })}

              <div style={{ display: 'flex', gap: '8px' }}>
                <button className="btn-electric" onClick={guardarEdicionActual} disabled={guardandoUsuario}>Guardar cambios</button>
                <button className="btn-secondary" onClick={cancelarEdicion}>Cancelar</button>
              </div>
            </div>
          )}

          <div className="card" style={{ borderRadius: '24px' }}>
            <h4 className="form-subtitle"><Plus size={16} /> Agregar Nuevo Registro</h4>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
              <button className="btn-secondary" style={{ background: tipoNuevoUsuario === 'cuenta' ? 'var(--azul-electrico)' : undefined, color: tipoNuevoUsuario === 'cuenta' ? 'white' : undefined }} onClick={() => setTipoNuevoUsuario('cuenta')}>Cuenta</button>
              <button className="btn-secondary" style={{ background: tipoNuevoUsuario === 'jugador' ? 'var(--azul-electrico)' : undefined, color: tipoNuevoUsuario === 'jugador' ? 'white' : undefined }} onClick={() => setTipoNuevoUsuario('jugador')}>Jugador</button>
            </div>

            {tipoNuevoUsuario === 'cuenta' ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px' }}>
                <div className="form-group"><label>Correo *</label><input className="form-input" value={nuevaCuenta.correo} onChange={(e) => setNuevaCuenta((p) => ({ ...p, correo: e.target.value }))} /></div>
                <div className="form-group"><label>RUT *</label><input className="form-input" value={nuevaCuenta.rut} onChange={(e) => setNuevaCuenta((p) => ({ ...p, rut: e.target.value }))} /></div>
                <div className="form-group"><label>Password inicial</label><input className="form-input" value={nuevaCuenta.password} onChange={(e) => setNuevaCuenta((p) => ({ ...p, password: e.target.value }))} /></div>
                <div className="form-group"><label>Rol de acceso *</label><select className="form-input" value={nuevaCuenta.rol} onChange={(e) => setNuevaCuenta((p) => ({ ...p, rol: e.target.value }))}><option value="apoderado">Apoderado</option><option value="staff">Staff</option><option value="admin">Admin</option><option value="super_admin">Super Admin</option></select></div>
                <div className="form-group"><label>Perfil principal *</label><select className="form-input" value={nuevaCuenta.perfil_principal || 'apoderado'} onChange={(e) => actualizarNuevaCuenta({ perfil_principal: e.target.value })}>{PERFIL_PRINCIPAL_OPTIONS.map((opt) => <option key={`perfil-new-${opt.value}`} value={opt.value}>{opt.label}</option>)}</select></div>
                <div className="form-group"><label>Cargo directiva</label><select className="form-input" value={nuevaCuenta.cargo_directiva || ''} onChange={(e) => setNuevaCuenta((p) => ({ ...p, cargo_directiva: e.target.value }))}>{CARGO_DIRECTIVA_OPTIONS.map((opt) => <option key={`directiva-new-${opt.value || 'none'}`} value={opt.value}>{opt.label}</option>)}</select></div>
                <div className="form-group"><label>Nivel de acceso</label><select className="form-input" value={nuevaCuenta.acceso_nivel || 'estandar'} onChange={(e) => setNuevaCuenta((p) => ({ ...p, acceso_nivel: e.target.value }))}>{ACCESO_NIVEL_OPTIONS.map((opt) => <option key={`acceso-new-${opt.value}`} value={opt.value}>{opt.label}</option>)}</select></div>
                <div className="form-group"><label>Nombres</label><input className="form-input" value={nuevaCuenta.nombres} onChange={(e) => setNuevaCuenta((p) => ({ ...p, nombres: e.target.value }))} /></div>
                <div className="form-group"><label>Apellido Paterno</label><input className="form-input" value={nuevaCuenta.apellido_paterno} onChange={(e) => setNuevaCuenta((p) => ({ ...p, apellido_paterno: e.target.value }))} /></div>
                <div className="form-group"><label>Apellido Materno</label><input className="form-input" value={nuevaCuenta.apellido_materno} onChange={(e) => setNuevaCuenta((p) => ({ ...p, apellido_materno: e.target.value }))} /></div>
                <div className="form-group"><label>Teléfono</label><input className="form-input" value={nuevaCuenta.telefono} onChange={(e) => setNuevaCuenta((p) => ({ ...p, telefono: e.target.value }))} /></div>
                <div className="form-group"><label>Dirección</label><input className="form-input" value={nuevaCuenta.direccion} onChange={(e) => setNuevaCuenta((p) => ({ ...p, direccion: e.target.value }))} /></div>
                <div className="form-group"><label>Comuna</label><input className="form-input" value={nuevaCuenta.comuna} onChange={(e) => setNuevaCuenta((p) => ({ ...p, comuna: e.target.value }))} /></div>
                <div className="form-group"><label>Valor UTM referencia</label><input type="number" min="1" className="form-input" value={nuevaCuenta.utm_valor_referencia || 68000} onChange={(e) => actualizarNuevaCuenta({ utm_valor_referencia: e.target.value })} /></div>
                <div className="form-group"><label>Mensualidad base automática (0,3 UTM)</label><input type="number" className="form-input" value={esCuentaCatalogadaSocio(nuevaCuenta) ? (nuevaCuenta.monto_mensual_base || 0) : 0} disabled /></div>
                <div className="form-group"><label>Mensualidad deportistas acordada (opcional)</label><input type="number" className="form-input" value={nuevaCuenta.monto_mensual_override || ''} onChange={(e) => setNuevaCuenta((p) => ({ ...p, monto_mensual_override: e.target.value }))} placeholder="Ej: 18000" /></div>
                <div className="form-group"><label>Fecha corte UTM (mes anterior)</label><input type="date" className="form-input" value={nuevaCuenta.fecha_corte_utm || ''} onChange={(e) => setNuevaCuenta((p) => ({ ...p, fecha_corte_utm: e.target.value }))} /></div>
                <div className="form-group"><label>Condiciones de pago</label><textarea className="form-input" rows="2" value={nuevaCuenta.condiciones_pago || ''} onChange={(e) => setNuevaCuenta((p) => ({ ...p, condiciones_pago: e.target.value }))}></textarea></div>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px' }}>
                <div className="form-group"><label>RUT Jugador *</label><input className="form-input" value={nuevoJugador.rut_jugador} onChange={(e) => setNuevoJugador((p) => ({ ...p, rut_jugador: e.target.value }))} /></div>
                <div className="form-group"><label>Correo Apoderado</label><input className="form-input" value={nuevoJugador.correo_apoderado} onChange={(e) => setNuevoJugador((p) => ({ ...p, correo_apoderado: e.target.value }))} /></div>
                <div className="form-group"><label>Nombres *</label><input className="form-input" value={nuevoJugador.nombres} onChange={(e) => setNuevoJugador((p) => ({ ...p, nombres: e.target.value }))} /></div>
                <div className="form-group"><label>Apellido Paterno *</label><input className="form-input" value={nuevoJugador.apellido_paterno} onChange={(e) => setNuevoJugador((p) => ({ ...p, apellido_paterno: e.target.value }))} /></div>
                <div className="form-group"><label>Apellido Materno</label><input className="form-input" value={nuevoJugador.apellido_materno} onChange={(e) => setNuevoJugador((p) => ({ ...p, apellido_materno: e.target.value }))} /></div>
                <div className="form-group"><label>Rama *</label><select className="form-input" value={nuevoJugador.rama} onChange={(e) => setNuevoJugador((p) => ({ ...p, rama: e.target.value }))}><option value="MASCULINA">Masculina</option><option value="FEMENINA">Femenina</option><option value="MIXTA">Mixta</option></select></div>
                <div className="form-group"><label>Categoría *</label><input className="form-input" value={nuevoJugador.categoria} onChange={(e) => setNuevoJugador((p) => ({ ...p, categoria: e.target.value }))} /></div>
                <div className="form-group"><label>Logo / imagen</label><input className="form-input" value={nuevoJugador.foto_jugador} onChange={(e) => setNuevoJugador((p) => ({ ...p, foto_jugador: e.target.value }))} placeholder="URL interna cargada desde galería" /></div>
                <div className="form-group"><label>Subir foto desde galería</label><input type="file" className="form-input" accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml" onChange={(e) => subirFotoJugadorDesdeGaleria(e.target.files?.[0] || null, 'nuevo')} /></div>
                <div className="form-group"><label>Estado</label><select className="form-input" value={nuevoJugador.estado} onChange={(e) => setNuevoJugador((p) => ({ ...p, estado: e.target.value }))}><option value="ACTIVO">Activo</option><option value="INACTIVO">Inactivo</option></select></div>
              </div>
            )}

            {subiendoFotoJugadorNuevo && <p style={{ fontSize: '12px', color: 'var(--texto-secundario)', marginTop: '4px' }}>Subiendo foto...</p>}

            {tipoNuevoUsuario === 'cuenta' && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '8px', marginBottom: '12px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
                  <input type="checkbox" checked={Boolean(esCuentaCatalogadaSocio(nuevaCuenta))} disabled />
                  Es socio (automático por perfil)
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
                  <input type="checkbox" checked={Boolean(nuevaCuenta.socio_admin)} onChange={(e) => setNuevaCuenta((p) => ({ ...p, socio_admin: e.target.checked }))} />
                  Admin entre socios
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
                  <input type="checkbox" checked={Boolean(nuevaCuenta.aprobado_superadmin)} onChange={(e) => setNuevaCuenta((p) => ({ ...p, aprobado_superadmin: e.target.checked }))} />
                  Aprobado por SuperAdmin
                </label>
              </div>
            )}

            {tipoNuevoUsuario === 'cuenta' && (
              <div className="card" style={{ marginTop: '12px', borderRadius: '16px', border: '1px solid rgba(0,122,255,0.16)' }}>
                <h4 className="form-subtitle" style={{ marginBottom: '8px' }}><ShieldCheck size={15} /> Permisos iniciales</h4>
                <p style={{ fontSize: '12px', color: 'var(--texto-secundario)', marginTop: 0, marginBottom: '10px' }}>
                  La cuenta nueva tomará los permisos base según el rol de acceso seleccionado. Después de guardar, podrás ajustar módulos específicos en esta misma vista unificada.
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {MODULOS_ACCESO.filter((modulo) => modulo.id !== 'mesa_publica' && obtenerPermisosBasePorRol(nuevaCuenta.rol || 'apoderado')[modulo.id]).map((modulo) => (
                    <span key={`nuevo-perm-${modulo.id}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '5px 8px', borderRadius: '999px', background: 'rgba(0,122,255,0.08)', color: 'var(--azul-electrico)', fontSize: '11px', fontWeight: '800' }}>
                      <ShieldCheck size={11} /> {modulo.etiqueta}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <button className="btn-electric" onClick={guardarNuevoUsuario} disabled={guardandoUsuario}>
              {guardandoUsuario ? 'Guardando...' : 'Guardar nuevo usuario'}
            </button>
          </div>
        </div>
      )}

      {vistaAdmin === 'activos' && (
        <div className="fade-in">
          <h3 className="section-title">Activos Visuales</h3>
          <div className="card" style={{ borderLeft: '4px solid var(--verde-victoria)', marginBottom: '15px', borderRadius: '24px' }}>
            <h4 className="form-subtitle"><Image size={16} /> Subida de logos y activos visuales</h4>
            <p style={{ margin: '0 0 12px 0', fontSize: '12px', color: 'var(--texto-secundario)', fontWeight: '700' }}>
              Sube logos de clubes, torneos o campeonatos. El archivo se guardará en /public/logos con nombre normalizado para reutilizarlo por nombre o slug.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px', alignItems: 'end' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Nombre del activo *</label>
                <input className="form-input" value={logoAssetForm.nombre} onChange={(e) => setLogoAssetForm((p) => ({ ...p, nombre: e.target.value }))} placeholder="Club, torneo o campeonato" />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Tipo</label>
                <select className="form-input" value={logoAssetForm.tipo} onChange={(e) => setLogoAssetForm((p) => ({ ...p, tipo: e.target.value }))}>
                  <option value="club">Club</option>
                  <option value="torneo">Torneo</option>
                  <option value="campeonato">Campeonato</option>
                  <option value="competencia">Competencia</option>
                </select>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Aplicar a</label>
                <select className="form-input" value={logoAssetForm.objetivo} onChange={(e) => setLogoAssetForm((p) => ({ ...p, objetivo: e.target.value }))}>
                  <option value="jugador">Jugador / Invitado</option>
                  <option value="cuenta">Cuenta / Usuario</option>
                  <option value="invitado">Jugador invitado</option>
                </select>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Archivo de imagen *</label>
                <input type="file" className="form-input" accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml" onChange={(e) => setLogoAssetForm((p) => ({ ...p, archivo: e.target.files?.[0] || null }))} />
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '12px', flexWrap: 'wrap' }}>
              <button className="btn-electric" onClick={subirLogoAsset} disabled={subiendoLogoAsset}>{subiendoLogoAsset ? 'Subiendo...' : 'Subir logo'}</button>
              {logoAssetUrl && <LogoAvatar nombre={logoAssetForm.nombre || 'Logo guardado'} logoUrl={logoAssetUrl} size={44} borderRadius="14px" />}
              {logoAssetUrl && <span style={{ fontSize: '12px', color: 'var(--texto-secundario)', fontWeight: '700' }}>{logoAssetUrl}</span>}
            </div>
          </div>
        </div>
      )}

      {vistaAdmin === 'demo' && (
        <div className="fade-in">
          <h3 className="section-title">Cuentas Demo por Perfil</h3>
          <div className="card" style={{ marginBottom: '15px' }}>
            <p style={{ margin: 0, fontSize: '12px', color: 'var(--texto-secundario)', lineHeight: '1.5' }}>
              Esta vista muestra las credenciales de prueba y los accesos que trae cada perfil por defecto. El superadmin puede ampliar o restringir accesos desde el módulo de configuraciones de usuario y permisos.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '12px' }}>
            {cuentasDemoEnriquecidas.map((cuenta) => (
              <div key={cuenta.perfil} className="card" style={{ borderLeft: `4px solid ${cuenta.perfil === 'super_admin' ? '#FF9500' : 'var(--azul-electrico)'}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
                  <div>
                    <strong style={{ display: 'block', fontSize: '15px' }}>{cuenta.etiqueta}</strong>
                    <span style={{ fontSize: '11px', color: 'var(--texto-secundario)', fontWeight: '800', textTransform: 'uppercase' }}>{normalizarRol(cuenta.perfil)}</span>
                  </div>
                  <LogoAvatar nombre={cuenta.etiqueta} size={38} borderRadius="12px" />
                </div>

                <div style={{ marginTop: '12px', fontSize: '12px', color: 'var(--texto-principal)', lineHeight: '1.6' }}>
                  <div><strong>Correo:</strong> {cuenta.correo}</div>
                  <div><strong>RUT:</strong> {cuenta.rut}</div>
                  <div><strong>Password:</strong> {cuenta.password}</div>
                </div>

                <div style={{ marginTop: '12px' }}>
                  <div style={{ fontSize: '11px', color: 'var(--texto-secundario)', fontWeight: '800', marginBottom: '8px' }}>Acceso por defecto</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {cuenta.modulosBase.map((modulo) => (
                      <span key={modulo.id} style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '5px 8px', borderRadius: '999px', background: 'rgba(0,122,255,0.08)', color: 'var(--azul-electrico)', fontSize: '11px', fontWeight: '800' }}>
                        <ShieldCheck size={11} /> {modulo.etiqueta}
                      </span>
                    ))}
                  </div>
                </div>

                <div style={{ marginTop: '12px' }}>
                  <div style={{ fontSize: '11px', color: 'var(--texto-secundario)', fontWeight: '800', marginBottom: '8px' }}>
                    Acceso actual {cuenta.permisoReal ? '· editable por superadmin' : '· sin cuenta real detectada'}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {cuenta.modulosBase.map((modulo) => {
                      const habilitado = Boolean(cuenta.permisoReal?.permisos?.[modulo.id]);
                      return (
                        <button
                          key={modulo.id}
                          onClick={() => cuenta.cuentaReal && togglePermiso(cuenta.cuentaReal.id, modulo.id)}
                          disabled={!cuenta.cuentaReal || cuenta.perfil === 'super_admin'}
                          style={{
                            padding: '6px 9px',
                            borderRadius: '999px',
                            border: habilitado ? '1px solid var(--verde-victoria)' : '1px solid var(--borde-suave)',
                            background: habilitado ? 'rgba(52,199,89,0.16)' : 'var(--fondo-app)',
                            color: habilitado ? 'var(--verde-victoria)' : 'var(--texto-secundario)',
                            fontSize: '11px',
                            fontWeight: '800',
                            cursor: cuenta.cuentaReal && cuenta.perfil !== 'super_admin' ? 'pointer' : 'not-allowed',
                          }}
                          title={cuenta.cuentaReal ? 'Clic para agregar o quitar este acceso' : 'No se encontró la cuenta real'}
                        >
                          {habilitado ? '✓' : '✕'} {modulo.etiqueta}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="card mt-15">
            <h4 className="form-subtitle">Matriz rápida de validación</h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' }}>
              {MODULOS_ACCESO.filter((modulo) => modulo.id !== 'mesa_publica').map((modulo) => (
                <div key={modulo.id} style={{ padding: '10px 12px', borderRadius: '12px', border: '1px solid var(--borde-suave)', background: 'var(--fondo-app)' }}>
                  <strong style={{ display: 'block', fontSize: '13px' }}>{modulo.etiqueta}</strong>
                  <span style={{ fontSize: '11px', color: 'var(--texto-secundario)' }}>{modulo.categoria}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {vistaAdmin === 'pagos' && (
        <div className="fade-in">
          <h3 className="section-title">Bandeja de Validación</h3>

          {/* Pagos reales con comprobante */}
          <h4 className="form-subtitle" style={{ marginBottom: '8px' }}>
            Comprobantes enviados ({pagosPendientesReales.length})
          </h4>
          {pagosPendientesReales.length === 0
            ? <p className="text-muted text-center italic mt-20" style={{ marginBottom: '24px' }}>Sin comprobantes pendientes.</p>
            : null}
          {pagosPendientesReales.map((pago) => (
            <div key={pago.id} className="card" style={{ borderLeft: '4px solid var(--azul-electrico)', marginBottom: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h4 style={{ margin: 0, color: 'var(--texto-heading)', fontSize: '16px' }}>
                    {`${pago.nombres || 'Jugador'} ${pago.apellido_paterno || ''}`.trim() || `Pago #${pago.id}`}
                  </h4>
                  <span style={{ fontSize: '11px', color: 'var(--texto-secundario)' }}>
                    ID pago: #{pago.id} · RUT: {pago.rut_jugador || 'N/A'}
                  </span>
                </div>
                <span style={{ fontWeight: '900', fontSize: '20px', color: 'var(--azul-electrico)' }}>
                  ${Number(pago.monto_total_pagado || 0).toLocaleString('es-CL')}
                </span>
              </div>
              <p style={{ fontSize: '13px', margin: '15px 0', color: 'var(--texto-principal)' }}>
                <strong>Detalle:</strong> {pago.concepto_pago || 'Mensualidad'} · {pago.meses_correspondientes || 'Sin meses indicados'}
              </p>
              <div className="foto-upload-box mb-15" style={{ padding: '15px', background: 'rgba(0,122,255,0.05)', borderColor: 'rgba(0,122,255,0.2)' }}>
                <FileText size={24} color="var(--azul-electrico)" />
                <span style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--azul-electrico)' }}>
                  {pago.comprobante_url ? `Comprobante: ${pago.comprobante_url}` : 'Sin comprobante adjunto'}
                </span>
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  style={{ flex: 1, padding: '12px', background: 'var(--verde-victoria)', color: 'white', border: 'none', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}
                  onClick={async () => { await validarPagoMensualidad(pago.id, 'aprobado'); alert('Pago aprobado correctamente.'); }}
                >
                  <CheckSquare size={16} /> Aprobar
                </button>
                <button
                  style={{ flex: 1, padding: '12px', background: '#FF3B30', color: 'white', border: 'none', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}
                  onClick={async () => { await validarPagoMensualidad(pago.id, 'rechazado'); alert('Pago rechazado correctamente.'); }}
                >
                  <XSquare size={16} /> Rechazar
                </button>
              </div>
            </div>
          ))}

          {/* Pagos migrados pendientes de revisión */}
          <div style={{ borderTop: '1px dashed rgba(0,0,0,0.12)', paddingTop: '16px', marginTop: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <div>
                <h4 className="form-subtitle" style={{ marginBottom: '4px' }}>
                  <AlertTriangle size={14} style={{ marginRight: '6px', color: '#b36200', verticalAlign: 'middle' }} />
                  Pagos migrados pendientes de revisión ({pagosMigradosPendientes.length})
                </h4>
                <p style={{ fontSize: '12px', color: 'var(--texto-secundario)', margin: 0 }}>
                  Estos registros vienen de la hoja de migración. Puedes editarlos, aprobarlos o rechazarlos.
                </p>
              </div>
              <button
                onClick={() => {
                  setMostrarFormularioPago(true);
                  setPagoEditandoId(null);
                }}
                style={{
                  padding: '10px 16px',
                  background: 'var(--azul-electrico)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontWeight: '600',
                  fontSize: '12px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  whiteSpace: 'nowrap'
                }}
              >
                <Plus size={14} /> Nuevo Pago
              </button>
            </div>

            {pagosMigradosPendientes.length === 0 && (
              <p className="text-muted italic">No hay pagos migrados pendientes.</p>
            )}

            {pagosMigradosPendientes.length > 0 && (
              <>
                {(() => {
                  const inicio = (paginaPagosMigrados - 1) * itemsPorPaginaPagos;
                  const fin = inicio + itemsPorPaginaPagos;
                  const pagosPaginados = pagosMigradosPendientes.slice(inicio, fin);
                  const totalPaginas = Math.ceil(pagosMigradosPendientes.length / itemsPorPaginaPagos);

                  return (
                    <>
                      {pagosPaginados.map((pago) => {
                        const notasVisibles = String(pago.notas_tesoreria || '')
                          .replace(/Migrado desde \w+\s*\|?\s*/gi, '')
                          .replace(/Legacy ID:\s*\d+\s*\|?\s*/gi, '')
                          .replace(/^\s*\|\s*|\s*\|\s*$/g, '')
                          .trim();

                        return (
                          <div key={pago.id} className="card" style={{ marginBottom: '8px', borderLeft: '4px solid #FF9500', borderRadius: '18px', background: 'rgba(255,149,0,0.04)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', flexWrap: 'wrap' }}>
                              <div style={{ flex: 1 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                  <strong style={{ fontSize: '13px' }}>{`${pago.nombres || ''} ${pago.apellido_paterno || ''}`.trim() || '—'}</strong>
                                  <span style={{ fontSize: '11px', color: 'var(--texto-secundario)' }}>{pago.rut_jugador || 'Sin RUT'}</span>
                                </div>
                                <div style={{ fontSize: '12px', color: 'var(--texto-secundario)', marginTop: '3px' }}>
                                  {pago.meses_correspondientes || 'Sin mes'} · ${Number(pago.monto_total_pagado || 0).toLocaleString('es-CL')}
                                </div>
                                {notasVisibles && (
                                  <div style={{ fontSize: '11px', color: '#b36200', marginTop: '4px', fontStyle: 'italic' }}>{notasVisibles}</div>
                                )}
                              </div>
                              <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                                <button
                                  style={{ padding: '7px 10px', background: '#007AFF', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '700', fontSize: '11px', cursor: 'pointer' }}
                                  onClick={() => {
                                    setPagoEditandoId(pago.id);
                                    setMostrarFormularioPago(true);
                                  }}
                                  title="Editar"
                                >
                                  ✎
                                </button>
                                <button
                                  style={{ padding: '7px 10px', background: 'var(--verde-victoria)', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '700', fontSize: '11px', cursor: 'pointer' }}
                                  onClick={async () => { await validarPagoMensualidad(pago.id, 'aprobado'); }}
                                  title="Aprobar"
                                >
                                  <CheckSquare size={13} />
                                </button>
                                <button
                                  style={{ padding: '7px 10px', background: '#FF3B30', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '700', fontSize: '11px', cursor: 'pointer' }}
                                  onClick={async () => { await validarPagoMensualidad(pago.id, 'rechazado'); }}
                                  title="Rechazar"
                                >
                                  <XSquare size={13} />
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}

                      {totalPaginas > 1 && (
                        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', marginTop: '16px', padding: '12px', background: 'var(--gris-fondo)', borderRadius: '8px' }}>
                          <button
                            onClick={() => setPaginaPagosMigrados(Math.max(1, paginaPagosMigrados - 1))}
                            disabled={paginaPagosMigrados === 1}
                            style={{
                              padding: '6px 10px',
                              background: paginaPagosMigrados === 1 ? 'var(--gris-deshabilitado)' : 'var(--azul-electrico)',
                              color: 'white',
                              border: 'none',
                              borderRadius: '6px',
                              cursor: paginaPagosMigrados === 1 ? 'not-allowed' : 'pointer',
                              fontSize: '12px',
                              fontWeight: '600'
                            }}
                          >
                            ← Anterior
                          </button>
                          <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--texto-principal)' }}>
                            Página {paginaPagosMigrados} de {totalPaginas}
                          </span>
                          <button
                            onClick={() => setPaginaPagosMigrados(Math.min(totalPaginas, paginaPagosMigrados + 1))}
                            disabled={paginaPagosMigrados === totalPaginas}
                            style={{
                              padding: '6px 10px',
                              background: paginaPagosMigrados === totalPaginas ? 'var(--gris-deshabilitado)' : 'var(--azul-electrico)',
                              color: 'white',
                              border: 'none',
                              borderRadius: '6px',
                              cursor: paginaPagosMigrados === totalPaginas ? 'not-allowed' : 'pointer',
                              fontSize: '12px',
                              fontWeight: '600'
                            }}
                          >
                            Siguiente →
                          </button>
                        </div>
                      )}
                    </>
                  );
                })()}
              </>
            )}
          </div>
        </div>
      )}

      {vistaAdmin === 'auditoria' && (
        <div className="fade-in card">
          <h4 className="form-subtitle"><History size={16} /> Log de Movimientos</h4>
          <p style={{ fontSize: '12px', color: 'var(--texto-secundario)', marginBottom: '20px' }}>Registro inmutable de acciones críticas del sistema.</p>
          {logAuditoria.map(log => (
            <div key={log.id} style={{ borderBottom: '1px dashed rgba(0,0,0,0.1)', paddingBottom: '12px', marginBottom: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><strong style={{ fontSize: '14px', color: 'var(--texto-heading)' }}>{log.accion}</strong><span style={{ fontSize: '12px', color: 'var(--azul-electrico)', fontWeight: 'bold' }}>{log.hora}</span></div>
              <div style={{ fontSize: '13px', color: 'var(--texto-principal)', margin: '5px 0' }}>{log.detalle}</div>
              <span style={{ fontSize: '11px', color: 'var(--texto-secundario)', fontWeight: 'bold' }}>👤 Usuario Auth: {log.usuario}</span>
            </div>
          ))}
        </div>
      )}

      {vistaAdmin === 'citaciones' && (
        <div className="fade-in">
          <h3 className="section-title">Creador de Convocatorias</h3>
          <div className="card mt-15">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
              <h4 className="form-subtitle" style={{ margin: 0 }}>Nómina FIBA (Tope 12)</h4>
              <span style={{ background: cuposCitados >= 12 ? '#FF3B30' : 'var(--verde-victoria)', color: 'white', padding: '6px 12px', borderRadius: '10px', fontSize: '12px', fontWeight: '900' }}>
                {cuposCitados}/12 Cupos
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px', marginBottom: '15px' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Tipo de competencia</label>
                <select className="form-input" value={citaForm.tipo_competencia} onChange={(e) => setCitaForm((p) => ({ ...p, tipo_competencia: e.target.value }))}>
                  <option value="Liga">Liga</option>
                  <option value="Campeonato">Campeonato</option>
                  <option value="Copa">Copa</option>
                  <option value="Amistoso">Amistoso</option>
                </select>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Competencia / torneo</label>
                <input className="form-input" value={citaForm.competencia_nombre} onChange={(e) => setCitaForm((p) => ({ ...p, competencia_nombre: e.target.value }))} placeholder="Ej: Liga ARBAM U15" />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Logo competencia (URL)</label>
                <input className="form-input" value={citaForm.competencia_logo_url} onChange={(e) => setCitaForm((p) => ({ ...p, competencia_logo_url: e.target.value }))} placeholder="Opcional" />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Día citación</label>
                <input type="date" className="form-input" value={citaForm.dia_citacion} onChange={(e) => setCitaForm((p) => ({ ...p, dia_citacion: e.target.value }))} />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Hora citación</label>
                <input type="time" className="form-input" value={citaForm.hora_citacion} onChange={(e) => setCitaForm((p) => ({ ...p, hora_citacion: e.target.value }))} />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Hora presentación / llegada</label>
                <input type="time" className="form-input" value={citaForm.hora_presentacion} onChange={(e) => setCitaForm((p) => ({ ...p, hora_presentacion: e.target.value }))} />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Equipo rival</label>
                <input className="form-input" value={citaForm.rival_nombre} onChange={(e) => setCitaForm((p) => ({ ...p, rival_nombre: e.target.value }))} placeholder="Ej: Club Deportivo X" />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Logo rival (URL)</label>
                <input className="form-input" value={citaForm.rival_logo_url} onChange={(e) => setCitaForm((p) => ({ ...p, rival_logo_url: e.target.value }))} placeholder="Opcional" />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px', marginBottom: '15px' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Rama</label>
                <select className="form-input" value={citaRama} onChange={(e) => setCitaRama(e.target.value)}>
                  <option value="todas">Todas</option>
                  <option value="masculina">Masculina</option>
                  <option value="femenina">Femenina</option>
                  <option value="mixta">Mixta</option>
                </select>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Categoría base</label>
                <select className="form-input" value={citaCategoria} onChange={(e) => setCitaCategoria(e.target.value)}>
                  <option value="todas">Todas</option>
                  {categoriasUnicas.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ marginBottom: '12px' }}>
              <label style={{ fontSize: '12px', fontWeight: '800', color: 'var(--texto-secundario)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Citar jugadoras de otras categorías
              </label>
              <div style={{ marginTop: '8px', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {categoriasUnicas.map((cat) => {
                  const activa = categoriasExtraCitacion.includes(cat);
                  return (
                    <button
                      key={`cat-extra-${cat}`}
                      type="button"
                      className="filter-chip"
                      style={{
                        border: '1px solid rgba(0,122,255,0.24)',
                        background: activa ? 'var(--azul-electrico)' : 'rgba(0,122,255,0.08)',
                        color: activa ? 'white' : 'var(--azul-electrico)',
                        fontWeight: '800',
                      }}
                      onClick={() => toggleCategoriaExtraCitacion(cat)}
                    >
                      {cat}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="card" style={{ marginBottom: '12px', borderRadius: '16px', border: '1px solid rgba(0,122,255,0.16)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <LogoAvatar nombre={citaForm.competencia_nombre || 'Competencia'} logoUrl={citaForm.competencia_logo_url || '/logos/club-logo.png'} size={30} borderRadius="999px" />
                  <span style={{ fontWeight: '800', fontSize: '12px' }}>{citaForm.tipo_competencia}: {citaForm.competencia_nombre || 'Sin definir'}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <LogoAvatar nombre={citaForm.rival_nombre || 'Rival'} logoUrl={citaForm.rival_logo_url || '/logos/club-logo.png'} size={30} borderRadius="999px" />
                  <span style={{ fontWeight: '800', fontSize: '12px' }}>vs {citaForm.rival_nombre || 'Sin rival'}</span>
                </div>
              </div>
              <div style={{ marginTop: '8px', fontSize: '12px', color: 'var(--texto-secundario)', fontWeight: '700' }}>
                Día {citaForm.dia_citacion} · Citación {citaForm.hora_citacion} · Presentación {citaForm.hora_presentacion} · Rama {citaRama} · Base {citaCategoria}
              </div>
            </div>

            <button className="btn-secondary mb-15" style={{ fontSize: '13px', padding: '12px' }}>
              <User size={16} /> Lista conectada a datos actuales
            </button>

            {jugadorasCitacion.length === 0 && (
              <p className="text-muted text-center italic mt-20">No hay jugadoras/jugadores para los filtros seleccionados.</p>
            )}

            {jugadorasCitacion.map((jugador) => {
              const moroso = (morososAdmin || []).find((m) => m.rut === jugador.rut_jugador);
              const requiereAutorizacion = Boolean(moroso);
              const autorizado = Boolean(autorizacionMorosos[jugador.rut_jugador]);

              return (
              <div key={jugador.rut_jugador} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px', background: 'var(--fondo-app)', border: `1px solid ${requiereAutorizacion ? 'rgba(255,149,0,0.45)' : 'rgba(0,0,0,0.05)'}`, borderRadius: '12px', marginBottom: '10px' }}>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <strong style={{ fontSize: '15px', color: 'var(--texto-principal)' }}>{`${jugador.nombres || ''} ${jugador.apellido_paterno || ''}`.trim()}</strong>
                  <span style={{ fontSize: '12px', color: 'var(--texto-secundario)', marginTop: '4px', fontWeight: 'bold' }}>
                    RUT: {jugador.rut_jugador} | Rama: {jugador.rama || 'N/A'} | Cat: {jugador.categoria || 'N/A'}
                  </span>

                  {requiereAutorizacion && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(255,149,0,0.14)', color: '#b36200', border: '1px solid rgba(255,149,0,0.45)', borderRadius: '999px', padding: '4px 9px', fontSize: '11px', fontWeight: '800' }}>
                        <AlertTriangle size={12} /> Moroso
                      </span>
                      {!autorizado ? (
                        <button
                          style={{ border: 'none', borderRadius: '999px', padding: '7px 12px', background: 'linear-gradient(180deg, #ffb347 0%, #FF9500 100%)', color: 'white', fontSize: '11px', fontWeight: '800', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                          onClick={() => setAutorizacionMorosos((prev) => ({ ...prev, [jugador.rut_jugador]: true }))}
                        >
                          <ShieldCheck size={12} /> Autorizar citacion
                        </button>
                      ) : (
                        <span style={{ fontSize: '11px', color: 'var(--verde-victoria)', fontWeight: '800' }}>Autorización concedida</span>
                      )}
                    </div>
                  )}
                </div>

                <input
                  type="checkbox"
                  style={{ width: '24px', height: '24px', accentColor: 'var(--azul-electrico)' }}
                  checked={Boolean(seleccionCitacion[jugador.rut_jugador])}
                  disabled={
                    (!seleccionCitacion[jugador.rut_jugador] && cuposCitados >= 12)
                    || (requiereAutorizacion && !autorizado)
                  }
                  onChange={() => {
                    setSeleccionCitacion((prev) => ({
                      ...prev,
                      [jugador.rut_jugador]: !prev[jugador.rut_jugador],
                    }));
                  }}
                />
              </div>
            );})}
            <button className="btn-electric mt-20" onClick={crearCitacion}>CONFIRMAR Y CITAR</button>
          </div>

          {(nominaCita || []).length > 0 && (
            <div className="card mt-15">
              <h4 className="form-subtitle" style={{ marginBottom: '10px' }}>Estado de citaciones enviadas</h4>
              {(nominaCita || []).map((cita) => {
                const total = (cita.convocados || []).length;
                const confirmados = (cita.convocados || []).filter((x) => x.respuesta === 'si').length;
                const noAsisten = (cita.convocados || []).filter((x) => x.respuesta === 'no').length;
                const justificados = (cita.convocados || []).filter((x) => x.respuesta === 'justificado').length;
                const respondidos = confirmados + noAsisten + justificados;
                const progreso = total > 0 ? Math.round((respondidos / total) * 100) : 0;
                const abierta = citacionActivaId === cita.id;

                return (
                  <div key={`cita-status-${cita.id}`} style={{ border: '1px solid rgba(0,122,255,0.14)', borderRadius: '14px', padding: '12px', marginBottom: '10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <strong style={{ fontSize: '13px' }}>{cita.tipo_competencia} · {cita.competencia_nombre} · vs {cita.rival_nombre}</strong>
                      <button className="btn-secondary" style={{ width: 'auto', padding: '8px 12px' }} onClick={() => setCitacionActivaId(abierta ? null : cita.id)}>
                        {abierta ? 'Ocultar detalle' : 'Ver detalle'}
                      </button>
                    </div>
                    <div style={{ marginTop: '8px', fontSize: '12px', color: 'var(--texto-secundario)', fontWeight: '700' }}>
                      {cita.dia_citacion} · Citación {cita.hora_citacion} · Presentación {cita.hora_presentacion}
                    </div>
                    <div className="recaud-bar mt-10"><div className="recaud-bar-fill" style={{ width: `${progreso}%`, background: 'linear-gradient(90deg, var(--azul-electrico), var(--verde-victoria))' }} /></div>
                    <div style={{ marginTop: '6px', fontSize: '12px', color: 'var(--texto-secundario)', fontWeight: '700' }}>
                      {progreso}% respondida · Asisten {confirmados} · No asisten {noAsisten} · Justificados {justificados} · Pendientes {Math.max(total - respondidos, 0)}
                    </div>

                    {abierta && (
                      <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {(cita.convocados || []).map((conv) => (
                          <div key={`conv-${cita.id}-${conv.rut_jugador}`} style={{ background: 'var(--fondo-app)', border: '1px solid rgba(0,0,0,0.06)', borderRadius: '10px', padding: '8px' }}>
                            <div style={{ fontSize: '12px', fontWeight: '800' }}>{conv.nombre} · {conv.rama} · {conv.categoria}</div>
                            <div style={{ fontSize: '11px', color: 'var(--texto-secundario)' }}>{conv.correo_apoderado || 'Sin correo apoderado'}</div>
                            {conv.requiere_excepcion_morosidad && (
                              <div style={{ marginTop: '5px', fontSize: '11px', color: '#b36200', fontWeight: '800' }}>
                                Moroso: requiere excepción · Estado: {conv.estado_excepcion === 'solicitada' ? 'solicitada' : conv.estado_excepcion === 'aprobada' ? 'aprobada' : 'pendiente'}
                              </div>
                            )}
                            <div style={{ marginTop: '6px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                              <button className="btn-secondary" style={{ width: 'auto', padding: '7px 10px', background: conv.respuesta === 'si' ? 'rgba(52,199,89,0.2)' : undefined }} onClick={() => actualizarRespuestaConvocado(cita.id, conv.rut_jugador, { respuesta: 'si', justificacion: '' })}>Asiste</button>
                              <button className="btn-secondary" style={{ width: 'auto', padding: '7px 10px', background: conv.respuesta === 'no' ? 'rgba(255,59,48,0.2)' : undefined }} onClick={() => actualizarRespuestaConvocado(cita.id, conv.rut_jugador, { respuesta: 'no' })}>No asiste</button>
                              <button className="btn-secondary" style={{ width: 'auto', padding: '7px 10px', background: conv.respuesta === 'justificado' ? 'rgba(255,149,0,0.2)' : undefined }} onClick={() => actualizarRespuestaConvocado(cita.id, conv.rut_jugador, { respuesta: 'justificado' })}>Justifica</button>
                            </div>
                            {(conv.respuesta === 'no' || conv.respuesta === 'justificado') && (
                              <input className="form-input" style={{ marginTop: '6px' }} placeholder="Motivo / justificación" value={conv.justificacion || ''} onChange={(e) => actualizarRespuestaConvocado(cita.id, conv.rut_jugador, { justificacion: e.target.value })} />
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {vistaAdmin === 'invitados' && (
        <div className="fade-in">
          <h3 className="section-title">Jugadores de Equipos Invitados</h3>
          <div className="card" style={{ borderRadius: '24px' }}>
            <h4 className="form-subtitle"><Plus size={16} /> Registrar jugador invitado</h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '10px' }}>
              <div className="form-group"><label>RUT invitado *</label><input className="form-input" value={nuevoJugadorVisita.rut_visita} onChange={(e) => setNuevoJugadorVisita((p) => ({ ...p, rut_visita: e.target.value }))} /></div>
              <div className="form-group"><label>Nombres *</label><input className="form-input" value={nuevoJugadorVisita.nombres} onChange={(e) => setNuevoJugadorVisita((p) => ({ ...p, nombres: e.target.value }))} /></div>
              <div className="form-group"><label>Apellido paterno *</label><input className="form-input" value={nuevoJugadorVisita.apellido_paterno} onChange={(e) => setNuevoJugadorVisita((p) => ({ ...p, apellido_paterno: e.target.value }))} /></div>
              <div className="form-group"><label>Apellido materno</label><input className="form-input" value={nuevoJugadorVisita.apellido_materno} onChange={(e) => setNuevoJugadorVisita((p) => ({ ...p, apellido_materno: e.target.value }))} /></div>
              <div className="form-group"><label>Club de procedencia</label><input className="form-input" value={nuevoJugadorVisita.club_procedencia} onChange={(e) => setNuevoJugadorVisita((p) => ({ ...p, club_procedencia: e.target.value }))} /></div>
              <div className="form-group"><label>Rama</label><select className="form-input" value={nuevoJugadorVisita.rama} onChange={(e) => setNuevoJugadorVisita((p) => ({ ...p, rama: e.target.value }))}><option value="MASCULINA">Masculina</option><option value="FEMENINA">Femenina</option><option value="MIXTA">Mixta</option></select></div>
              <div className="form-group"><label>Categoría</label><input className="form-input" value={nuevoJugadorVisita.categoria} onChange={(e) => setNuevoJugadorVisita((p) => ({ ...p, categoria: e.target.value }))} /></div>
              <div className="form-group"><label>Posición</label><input className="form-input" value={nuevoJugadorVisita.posicion} onChange={(e) => setNuevoJugadorVisita((p) => ({ ...p, posicion: e.target.value }))} /></div>
              <div className="form-group"><label>Contacto apoderado</label><input className="form-input" value={nuevoJugadorVisita.contacto_apoderado} onChange={(e) => setNuevoJugadorVisita((p) => ({ ...p, contacto_apoderado: e.target.value }))} /></div>
              <div className="form-group"><label>Teléfono contacto</label><input className="form-input" value={nuevoJugadorVisita.telefono_contacto} onChange={(e) => setNuevoJugadorVisita((p) => ({ ...p, telefono_contacto: e.target.value }))} /></div>
            </div>
            <button className="btn-electric" onClick={guardarNuevoJugadorVisita} disabled={guardandoVisita}>
              {guardandoVisita ? 'Guardando...' : 'Registrar invitado'}
            </button>
          </div>

          <div className="card mt-15">
            <h4 className="form-subtitle">Listado de invitados ({(jugadoresVisitaAdmin || []).length})</h4>
            {(jugadoresVisitaAdmin || []).length === 0 && (
              <p className="text-muted" style={{ fontStyle: 'italic' }}>Aún no hay jugadores invitados registrados.</p>
            )}

            {(jugadoresVisitaAdmin || []).map((j) => (
              <div key={j.id_visita || `${j.rut_visita}-${j.nombres}`} className="card" style={{ marginBottom: '10px', borderLeft: '4px solid #00C7BE' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', alignItems: 'flex-start' }}>
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                    <div style={{ width: '58px', height: '58px', borderRadius: '18px', background: 'linear-gradient(135deg, rgba(0,122,255,0.12), rgba(52,199,89,0.12))', border: '1px solid rgba(0,0,0,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
                      {j.club_logo_url ? (
                        <img src={j.club_logo_url} alt={`Logo de ${j.club_procedencia || 'club invitado'}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <span style={{ fontSize: '15px', fontWeight: '900', color: 'var(--azul-electrico)' }}>
                          {(j.club_procedencia || 'CI').split(' ').filter(Boolean).slice(0, 2).map((parte) => parte[0]).join('').toUpperCase() || 'CI'}
                        </span>
                      )}
                    </div>
                    <div>
                      <strong>{`${j.nombres || ''} ${j.apellido_paterno || ''}`.trim()}</strong>
                      <div style={{ fontSize: '12px', color: 'var(--texto-secundario)', marginTop: '4px' }}>
                        {j.rut_visita || 'Sin RUT'} · {j.club_procedencia || 'Sin club'} · {j.rama || 'Sin rama'} {j.categoria ? `· ${j.categoria}` : ''}
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--texto-secundario)', marginTop: '4px' }}>
                        Evaluación: {(j.resultado_prueba || 'pendiente').toUpperCase()} · Reclutado: {j.reclutado ? 'Sí' : 'No'}
                      </div>
                    </div>
                  </div>
                  <button className="btn-notificar" onClick={() => setJugadorVisitaEdit({ ...j })}>Seguimiento</button>
                </div>
              </div>
            ))}
          </div>

          {jugadorVisitaEdit && (
            <div className="card mt-15" style={{ border: '1px solid var(--azul-electrico)' }}>
              <h4 className="form-subtitle">Seguimiento Invitado #{jugadorVisitaEdit.id_visita}</h4>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', fontSize: '13px' }}>
                <input type="checkbox" checked={Boolean(jugadorVisitaEdit.prueba_realizada)} onChange={(e) => setJugadorVisitaEdit((p) => ({ ...p, prueba_realizada: e.target.checked }))} />
                Prueba realizada
              </label>
              <div className="form-group"><label>Resultado</label><select className="form-input" value={jugadorVisitaEdit.resultado_prueba || 'pendiente'} onChange={(e) => setJugadorVisitaEdit((p) => ({ ...p, resultado_prueba: e.target.value }))}><option value="pendiente">Pendiente</option><option value="aprobado">Aprobado</option><option value="observado">Observado</option><option value="rechazado">Rechazado</option></select></div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', fontSize: '13px' }}>
                <input type="checkbox" checked={Boolean(jugadorVisitaEdit.reclutado)} onChange={(e) => setJugadorVisitaEdit((p) => ({ ...p, reclutado: e.target.checked }))} />
                Reclutado
              </label>
              <div className="form-group"><label>Observaciones</label><textarea className="form-input" rows="3" value={jugadorVisitaEdit.observaciones || ''} onChange={(e) => setJugadorVisitaEdit((p) => ({ ...p, observaciones: e.target.value }))}></textarea></div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button className="btn-electric" onClick={guardarEdicionJugadorVisita} disabled={guardandoVisita}>{guardandoVisita ? 'Guardando...' : 'Guardar seguimiento'}</button>
                <button className="btn-secondary" onClick={() => setJugadorVisitaEdit(null)}>Cancelar</button>
              </div>
            </div>
          )}
        </div>
      )}

      {vistaAdmin === 'reportes' && (
        <ReportesPanel
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
        />
      )}

      {vistaAdmin === 'publicar' && (
        <div className="fade-in">
          <h3 className="section-title"><Megaphone size={18} style={{ marginRight: '8px', verticalAlign: 'middle' }} />Publicar Anuncio / Noticia</h3>
          <p style={{ fontSize: '13px', color: 'var(--texto-secundario)', marginBottom: '16px' }}>
            Crea comunicaciones visibles en el Muro del club. Elige el tipo, urgencia, rama y audiencia antes de publicar.
          </p>
          <div className="card" style={{ borderRadius: '24px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px', marginBottom: '12px' }}>
              <div className="form-group">
                <label>Título *</label>
                <input
                  className="form-input"
                  value={formPublicacion.titulo}
                  onChange={(e) => setFormPublicacion((p) => ({ ...p, titulo: e.target.value }))}
                  placeholder="Ej: Suspensión de entrenamiento viernes"
                />
              </div>
              <div className="form-group">
                <label>Tipo</label>
                <select className="form-input" value={formPublicacion.tipo} onChange={(e) => setFormPublicacion((p) => ({ ...p, tipo: e.target.value }))}>
                  <option>Aviso</option>
                  <option>Noticia</option>
                  <option>Evento</option>
                  <option>Suspension</option>
                  <option>Asamblea</option>
                  <option>Tesoreria</option>
                  <option>Rendimiento</option>
                  <option>Citación</option>
                </select>
              </div>
              <div className="form-group">
                <label>Urgencia</label>
                <select className="form-input" value={formPublicacion.urgencia} onChange={(e) => setFormPublicacion((p) => ({ ...p, urgencia: e.target.value }))}>
                  <option>Baja</option>
                  <option>Media</option>
                  <option>Alta</option>
                  <option>Critica</option>
                </select>
              </div>
              <div className="form-group">
                <label>Rama</label>
                <select className="form-input" value={formPublicacion.rama} onChange={(e) => setFormPublicacion((p) => ({ ...p, rama: e.target.value }))}>
                  <option>General</option>
                  <option>Femenina</option>
                  <option>Masculina</option>
                </select>
              </div>
              <div className="form-group">
                <label>Categoría</label>
                <select className="form-input" value={formPublicacion.categoria} onChange={(e) => setFormPublicacion((p) => ({ ...p, categoria: e.target.value }))}>
                  <option>General</option>
                  <option>U13</option>
                  <option>U15</option>
                  <option>U17</option>
                  <option>Adultos</option>
                </select>
              </div>
            </div>
            <div className="form-group" style={{ marginBottom: '12px' }}>
              <label>Mensaje / Descripción *</label>
              <textarea
                className="form-input"
                rows={4}
                value={formPublicacion.mensaje}
                onChange={(e) => setFormPublicacion((p) => ({ ...p, mensaje: e.target.value }))}
                placeholder="Escribe el cuerpo del anuncio o noticia..."
              />
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', marginBottom: '16px' }}>
              <input
                type="checkbox"
                checked={formPublicacion.solicita_asistencia}
                onChange={(e) => setFormPublicacion((p) => ({ ...p, solicita_asistencia: e.target.checked }))}
              />
              Solicitar confirmación de asistencia (RSVP)
            </label>
            <button className="btn-electric" onClick={publicarAnuncio} disabled={publicandoForm}>
              <Megaphone size={15} /> {publicandoForm ? 'Guardando...' : (publicacionEditandoId ? 'Actualizar publicación' : 'Publicar en el Muro')}
            </button>
            {publicacionEditandoId && (
              <button className="btn-secondary" onClick={cancelarEdicionPublicacion} style={{ marginLeft: '8px' }}>
                Cancelar edición
              </button>
            )}
          </div>

          <div className="card" style={{ borderRadius: '24px', marginTop: '14px' }}>
            <h4 className="form-subtitle" style={{ marginBottom: '10px' }}>Avisos y comunicados registrados</h4>
            {(comunicaciones || []).length === 0 && (
              <p style={{ fontSize: '13px', color: 'var(--texto-secundario)', margin: 0 }}>No hay publicaciones registradas todavía.</p>
            )}
            {(comunicaciones || []).length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {(comunicaciones || []).slice(0, 20).map((com) => (
                  <div key={`com-admin-${com.id}`} style={{ border: '1px solid rgba(0,0,0,0.08)', borderRadius: '14px', padding: '10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <strong style={{ fontSize: '13px' }}>{com.TITULO || 'Sin título'}</strong>
                      <span style={{ fontSize: '11px', color: 'var(--texto-secundario)', fontWeight: '700' }}>{com.FECHA || 'Sin fecha'}</span>
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--texto-secundario)', marginTop: '4px' }}>
                      Tipo: {com.TIPO_COMUNICADO || 'Aviso'} · Rama: {com.rama || 'General'} · Categoría: {com.categoria || 'General'} · Urgencia: {com.urgencia || 'Media'}
                    </div>
                    <p style={{ margin: '8px 0', fontSize: '12px', color: 'var(--texto-principal)' }}>{String(com.CUERPO_TEXTO || '').slice(0, 200)}</p>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      <button className="btn-secondary" style={{ width: 'auto', padding: '8px 12px' }} onClick={() => editarPublicacion(com)}>
                        Editar
                      </button>
                      <button className="btn-secondary" style={{ width: 'auto', padding: '8px 12px', borderColor: 'rgba(255,59,48,0.35)', color: '#b91c1c' }} onClick={() => borrarPublicacion(com)}>
                        Borrar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {vistaAdmin === 'resultados' && (
        <div className="fade-in">
          <h3 className="section-title"><Trophy size={18} style={{ marginRight: '8px', verticalAlign: 'middle' }} />Registrar Resultado de Partido</h3>
          <p style={{ fontSize: '13px', color: 'var(--texto-secundario)', marginBottom: '16px' }}>
            Ingresa el marcador final y el partido quedará publicado en el fixture del club.
          </p>

          {/* Preview visual del marcador */}
          <div className="card" style={{ borderRadius: '24px', marginBottom: '16px', background: 'linear-gradient(180deg, rgba(15,23,42,0.96) 0%, rgba(28,44,76,0.92) 100%)', color: 'white' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '20px', padding: '12px 0' }}>
              {/* Torneo */}
              {formResultado.torneo_nombre && (
                <div style={{ position: 'absolute', top: '12px', left: '50%', transform: 'translateX(-50%)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <LogoAvatar nombre={formResultado.torneo_nombre} logoUrl={formResultado.torneo_logo_url} size={18} borderRadius="999px" />
                  <span style={{ fontSize: '11px', fontWeight: '800', opacity: 0.8 }}>{formResultado.torneo_nombre}</span>
                </div>
              )}
              {/* Local */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', flex: 1, textAlign: 'center' }}>
                <LogoAvatar nombre={formResultado.equipo_local || 'Local'} logoUrl={formResultado.logo_local_url} size={52} borderRadius="14px" />
                <span style={{ fontSize: '12px', fontWeight: '800', opacity: 0.9 }}>{formResultado.equipo_local || 'Equipo Local'}</span>
              </div>
              {/* Marcador */}
              <div style={{ textAlign: 'center', minWidth: '80px' }}>
                <div style={{ fontSize: '32px', fontWeight: '900', letterSpacing: '4px' }}>
                  {formResultado.pts_local !== '' ? formResultado.pts_local : '–'}
                  &nbsp;:&nbsp;
                  {formResultado.pts_visitante !== '' ? formResultado.pts_visitante : '–'}
                </div>
                <div style={{ fontSize: '11px', opacity: 0.7, fontWeight: '700', textTransform: 'uppercase', marginTop: '4px' }}>
                  {`${formResultado.rama} · ${formResultado.categoria}`}
                </div>
              </div>
              {/* Visitante */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', flex: 1, textAlign: 'center' }}>
                <LogoAvatar nombre={formResultado.equipo_visitante || 'Visitante'} logoUrl={formResultado.logo_visitante_url} size={52} borderRadius="14px" />
                <span style={{ fontSize: '12px', fontWeight: '800', opacity: 0.9 }}>{formResultado.equipo_visitante || 'Equipo Visitante'}</span>
              </div>
            </div>
          </div>

          {/* Formulario */}
          <div className="card" style={{ borderRadius: '24px', marginBottom: '16px' }}>
            <h4 className="form-subtitle" style={{ marginBottom: '12px' }}>Datos del partido</h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px', marginBottom: '12px' }}>
              <LogoPicker
                label="Equipo local"
                nombre={formResultado.equipo_local}
                onNombre={(v) => setFormResultado((p) => ({ ...p, equipo_local: v }))}
                logoUrl={formResultado.logo_local_url}
                onLogoUrl={(v) => setFormResultado((p) => ({ ...p, logo_local_url: v }))}
                tipo="club"
                placeholder="Nombre equipo local"
                extraOptions={[{ nombre: 'Centro de Cultura Física', logoUrl: '/logos/club-logo.png' }]}
              />
              <LogoPicker
                label="Equipo visitante *"
                nombre={formResultado.equipo_visitante}
                onNombre={(v) => setFormResultado((p) => ({ ...p, equipo_visitante: v }))}
                logoUrl={formResultado.logo_visitante_url}
                onLogoUrl={(v) => setFormResultado((p) => ({ ...p, logo_visitante_url: v }))}
                tipo="club"
                placeholder="Nombre equipo visitante"
              />
              <div className="form-group">
                <label>Puntos local *</label>
                <input type="number" min="0" className="form-input" value={formResultado.pts_local} onChange={(e) => setFormResultado((p) => ({ ...p, pts_local: e.target.value }))} placeholder="0" />
              </div>
              <div className="form-group">
                <label>Puntos visitante *</label>
                <input type="number" min="0" className="form-input" value={formResultado.pts_visitante} onChange={(e) => setFormResultado((p) => ({ ...p, pts_visitante: e.target.value }))} placeholder="0" />
              </div>
              <LogoPicker
                label="Competencia / Torneo"
                nombre={formResultado.torneo_nombre}
                onNombre={(v) => setFormResultado((p) => ({ ...p, torneo_nombre: v }))}
                logoUrl={formResultado.torneo_logo_url}
                onLogoUrl={(v) => setFormResultado((p) => ({ ...p, torneo_logo_url: v }))}
                tipo="torneo"
                placeholder="Nombre competencia o torneo"
              />
              <div className="form-group">
                <label>Rama</label>
                <select className="form-input" value={formResultado.rama} onChange={(e) => {
                  const nuevaRama = e.target.value;
                  const nuevaCategoria = categoriasDisponibles[nuevaRama]?.[0] || 'SUB-13';
                  setFormResultado((p) => ({ ...p, rama: nuevaRama, categoria: nuevaCategoria }));
                }}>
                  <option>Mixta</option>
                  <option>Femenina</option>
                  <option>Masculina</option>
                  <option>Adulto</option>
                </select>
              </div>
              <div className="form-group">
                <label>Sub (Categoría)</label>
                <select className="form-input" value={formResultado.categoria} onChange={(e) => setFormResultado((p) => ({ ...p, categoria: e.target.value }))}>
                  {categoriasDisponibles[formResultado.rama]?.map((cat) => (
                    <option key={cat}>{cat}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Cancha / Sede</label>
                <input className="form-input" value={formResultado.cancha_sede} onChange={(e) => setFormResultado((p) => ({ ...p, cancha_sede: e.target.value }))} placeholder="Ej: Gimnasio CCF" />
              </div>
              <div className="form-group">
                <label>Fecha</label>
                <input type="date" className="form-input" value={formResultado.fecha_hora} onChange={(e) => setFormResultado((p) => ({ ...p, fecha_hora: e.target.value }))} />
              </div>
            </div>
            <button className="btn-electric" onClick={guardarResultado} disabled={guardandoResultado}>
              <Trophy size={15} /> {guardandoResultado ? 'Guardando...' : (partidoEditandoId ? 'Actualizar resultado' : 'Registrar resultado')}
            </button>
            {partidoEditandoId && (
              <button className="btn-secondary" onClick={resetFormResultado} style={{ marginLeft: '8px' }}>
                Cancelar edición
              </button>
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', marginTop: '20px' }}>
            <h4 className="section-title" style={{ margin: 0 }}>Últimos partidos registrados</h4>
            <button className="btn-secondary" onClick={borrarPartidosPrueba}>
              Borrar partidos de prueba
            </button>
          </div>
          {cargandoPartidos && <p style={{ fontSize: '13px', color: 'var(--texto-secundario)' }}>Cargando...</p>}
          {!cargandoPartidos && partidosAdmin.length === 0 && (
            <p style={{ fontSize: '13px', color: 'var(--texto-secundario)', fontStyle: 'italic' }}>No hay partidos registrados todavía.</p>
          )}
          {!cargandoPartidos && partidosAdmin.length > 0 && (
            <ResultadosCards 
              partidos={partidosAdmin.slice(0, 15).map(p => ({
                id: p.id_partido || p.id,
                rama: p.rama || ((p.categoria_rama || '').toLowerCase().includes('femen') ? 'Femenina' : 'Masculina'),
                categoria: p.categoria || p.categoria_rama || 'General',
                torneo: p.torneo_nombre || 'Torneo',
                torneoLogoUrl: p.torneo_logo_url || '',
                fecha: p.fecha_hora ? new Date(p.fecha_hora).toLocaleDateString('es-CL') : 'Sin fecha',
                ubicacion: p.cancha_sede || 'Cancha CCF',
                miEquipo: Number(p.pts_local || 0),
                rival: Number(p.pts_visitante || 0),
                equipoLocalNombre: p.equipo_local || 'Centro de Cultura Física',
                equipoLocalLogoUrl: p.logo_local_url || '/logos/club-logo.png',
                nombreRival: p.equipo_visitante || 'Rival',
                rivalLogoUrl: p.logo_visitante_url || '',
              }))}
              puedeEditar={true}
              onEditar={(partido) => {
                const p = partidosAdmin.find(x => (x.id_partido || x.id) === partido.id);
                if (p) {
                  setPartidoEditandoId(p.id_partido || p.id);
                  setFormResultado({
                    equipo_local: p.equipo_local,
                    equipo_visitante: p.equipo_visitante,
                    logo_local_url: p.logo_local_url,
                    logo_visitante_url: p.logo_visitante_url,
                    torneo_nombre: p.torneo_nombre,
                    torneo_logo_url: p.torneo_logo_url,
                    pts_local: String(p.pts_local || ''),
                    pts_visitante: String(p.pts_visitante || ''),
                    rama: p.rama || ((p.categoria_rama || '').toLowerCase().includes('femen') ? 'Femenina' : 'Masculina'),
                    categoria: p.categoria || p.categoria_rama || 'General',
                    cancha_sede: p.cancha_sede || '',
                    fecha_hora: p.fecha_hora ? new Date(p.fecha_hora).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
                  });
                  setVistaAdmin('resultados');
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }
              }}
              onBorrar={async (partidoId) => {
                if (window.confirm('¿Confirmas que quieres borrar este partido?')) {
                  try {
                    await api.partidosLiveAPI.delete(partidoId);
                    await cargarPartidosAdmin();
                    if (typeof onPartidosChanged === 'function') {
                      await onPartidosChanged();
                    }
                    alert('Partido borrado correctamente.');
                  } catch (err) {
                    alert(`No se pudo borrar: ${err.message}`);
                  }
                }
              }}
            />
          )}
        </div>
      )}

      {vistaAdmin === 'cuentas_legacy' && (
        <div className="fade-in">
          <h3 className="section-title">Cuentas por Actualizar</h3>
          <p style={{ fontSize: '13px', color: 'var(--texto-secundario)', marginBottom: '12px' }}>
            Completa los datos faltantes y valida RUT chileno antes de guardar.
          </p>

          {cuentasIncompletas.length === 0 && (
            <div className="card text-center" style={{ fontWeight: '700', color: 'var(--verde-victoria)' }}>
              Todo bien: no hay cuentas pendientes de completar.
            </div>
          )}

          {!cuentaEditando && cuentasIncompletas.map((c) => (
            <div key={c.id} className="card" style={{ marginBottom: '10px', borderLeft: '4px solid #FF9500' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <div>
                  <strong style={{ fontSize: '14px' }}>{`${c.nombres || 'Sin nombre'} ${c.apellido_paterno || ''}`.trim()}</strong>
                  <div style={{ fontSize: '12px', color: 'var(--texto-secundario)', marginTop: '4px' }}>
                    {c.correo || 'Sin correo'} · {c.rut || 'Sin RUT'}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '8px' }}>
                    {(c.campos_faltantes || []).map((f) => (
                      <span key={f} style={{ fontSize: '11px', background: 'rgba(255,149,0,0.14)', color: '#b36200', padding: '4px 8px', borderRadius: '999px', fontWeight: '800' }}>
                        Falta: {f}
                      </span>
                    ))}
                  </div>
                </div>
                <button className="btn-pill btn-success cuenta-completar-btn" onClick={() => abrirEdicionCuenta(c)}>
                  Completar
                </button>
              </div>
            </div>
          ))}

          {cuentaEditando && (
            <div className="card cuenta-edit-screen" style={{ marginTop: '14px', border: '1px solid var(--azul-electrico)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <h4 className="form-subtitle" style={{ marginBottom: 0 }}>Editar Cuenta #{cuentaEditando.id}</h4>
                <button className="btn-secondary" style={{ width: 'auto', padding: '9px 14px' }} onClick={() => setCuentaEditando(null)}>Salir</button>
              </div>
              <div style={{ marginTop: '8px', marginBottom: '8px', fontSize: '12px', fontWeight: '800', color: 'var(--texto-secundario)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Identidad</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px' }}>
              <div className="form-group"><label>Correo</label><input className="form-input" value={cuentaEditando.correo} onChange={(e) => actualizarCampoCuenta('correo', e.target.value)} /></div>
              <div className="form-group"><label>RUT</label><input className="form-input" value={cuentaEditando.rut} onChange={(e) => actualizarCampoCuenta('rut', e.target.value)} style={{ borderColor: cuentaEditando.rut && !api.validarRutChileno(cuentaEditando.rut) ? '#FF3B30' : undefined }} /></div>
              {cuentaEditando.rut && !api.validarRutChileno(cuentaEditando.rut) && <p style={{ fontSize: '12px', color: '#FF3B30', marginTop: '-6px' }}>RUT invalido</p>}
              <div className="form-group"><label>Nombres</label><input className="form-input" value={cuentaEditando.nombres} onChange={(e) => actualizarCampoCuenta('nombres', e.target.value)} /></div>
              <div className="form-group"><label>Apellido Paterno</label><input className="form-input" value={cuentaEditando.apellido_paterno} onChange={(e) => actualizarCampoCuenta('apellido_paterno', e.target.value)} /></div>
              <div className="form-group"><label>Apellido Materno</label><input className="form-input" value={cuentaEditando.apellido_materno} onChange={(e) => actualizarCampoCuenta('apellido_materno', e.target.value)} /></div>
              <div style={{ marginTop: '10px', marginBottom: '8px', fontSize: '12px', fontWeight: '800', color: 'var(--texto-secundario)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Contacto</div>
              <div className="form-group"><label>Telefono</label><input className="form-input" value={cuentaEditando.telefono} onChange={(e) => actualizarCampoCuenta('telefono', e.target.value)} /></div>
              <div className="form-group"><label>Direccion</label><input className="form-input" value={cuentaEditando.direccion} onChange={(e) => actualizarCampoCuenta('direccion', e.target.value)} /></div>
              <div className="form-group"><label>Comuna</label><input className="form-input" value={cuentaEditando.comuna} onChange={(e) => actualizarCampoCuenta('comuna', e.target.value)} /></div>
              <div style={{ marginTop: '10px', marginBottom: '8px', fontSize: '12px', fontWeight: '800', color: 'var(--texto-secundario)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Gestión</div>
              <div className="form-group"><label>Rol de acceso</label><select className="form-input" value={cuentaEditando.rol || 'apoderado'} onChange={(e) => actualizarCampoCuenta('rol', e.target.value)}><option value="apoderado">Apoderado</option><option value="staff">Staff</option><option value="admin">Admin</option><option value="super_admin">Super Admin</option></select></div>
              <div className="form-group"><label>Perfil principal</label><select className="form-input" value={cuentaEditando.perfil_principal || 'apoderado'} onChange={(e) => actualizarCampoCuenta('perfil_principal', e.target.value)}>{PERFIL_PRINCIPAL_OPTIONS.map((opt) => <option key={`perfil-cuenta-${opt.value}`} value={opt.value}>{opt.label}</option>)}</select></div>
              <div className="form-group"><label>Cargo directiva</label><select className="form-input" value={cuentaEditando.cargo_directiva || ''} onChange={(e) => actualizarCampoCuenta('cargo_directiva', e.target.value)}>{CARGO_DIRECTIVA_OPTIONS.map((opt) => <option key={`cargo-cuenta-${opt.value || 'none'}`} value={opt.value}>{opt.label}</option>)}</select></div>
              <div className="form-group"><label>Nivel de acceso</label><select className="form-input" value={cuentaEditando.acceso_nivel || 'estandar'} onChange={(e) => actualizarCampoCuenta('acceso_nivel', e.target.value)}>{ACCESO_NIVEL_OPTIONS.map((opt) => <option key={`acceso-cuenta-${opt.value}`} value={opt.value}>{opt.label}</option>)}</select></div>
              <div className="form-group"><label>Estado Civil</label><input className="form-input" value={cuentaEditando.estado_civil} onChange={(e) => actualizarCampoCuenta('estado_civil', e.target.value)} /></div>
              <div className="form-group"><label>Profesion u Oficio</label><input className="form-input" value={cuentaEditando.profesion_oficio} onChange={(e) => actualizarCampoCuenta('profesion_oficio', e.target.value)} /></div>
              <div className="form-group"><label>Segundo Contacto</label><input className="form-input" value={cuentaEditando.nombre_segundo_contacto} onChange={(e) => actualizarCampoCuenta('nombre_segundo_contacto', e.target.value)} /></div>
              <div className="form-group"><label>Parentesco Segundo Contacto</label><input className="form-input" value={cuentaEditando.parentesco_segundo_contacto} onChange={(e) => actualizarCampoCuenta('parentesco_segundo_contacto', e.target.value)} /></div>
              <div className="form-group"><label>Numero Segundo Contacto</label><input className="form-input" value={cuentaEditando.num_segundo_contacto} onChange={(e) => actualizarCampoCuenta('num_segundo_contacto', e.target.value)} /></div>
              <div className="form-group"><label>Dia Pago Acordado</label><input className="form-input" type="number" min="1" max="31" value={cuentaEditando.dia_pago_acordado} onChange={(e) => actualizarCampoCuenta('dia_pago_acordado', e.target.value)} /></div>
              <div className="form-group"><label>Valor UTM referencia</label><input className="form-input" type="number" min="1" value={cuentaEditando.utm_valor_referencia || 68000} onChange={(e) => actualizarCampoCuenta('utm_valor_referencia', e.target.value)} /></div>
              <div className="form-group"><label>Mensualidad base (0,3 UTM)</label><input className="form-input" type="number" value={cuentaEditando.monto_mensual_base || ''} onChange={(e) => actualizarCampoCuenta('monto_mensual_base', e.target.value)} /></div>
              <div className="form-group"><label>Mensualidad corregida por SuperAdmin</label><input className="form-input" type="number" value={cuentaEditando.monto_mensual_override || ''} onChange={(e) => actualizarCampoCuenta('monto_mensual_override', e.target.value)} /></div>
              <div className="form-group"><label>Fecha corte UTM (mes anterior)</label><input className="form-input" type="date" value={cuentaEditando.fecha_corte_utm || ''} onChange={(e) => actualizarCampoCuenta('fecha_corte_utm', e.target.value)} /></div>
              <div className="form-group"><label>Condiciones de pago</label><textarea className="form-input" rows="2" value={cuentaEditando.condiciones_pago || ''} onChange={(e) => actualizarCampoCuenta('condiciones_pago', e.target.value)}></textarea></div>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', fontSize: '13px' }}>
                <input type="checkbox" checked={Boolean(cuentaEditando.es_socio)} onChange={(e) => actualizarCampoCuenta('es_socio', e.target.checked)} />
                Es socio
              </label>
              <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', marginBottom: '12px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
                  <input type="checkbox" checked={Boolean(cuentaEditando.socio_admin)} onChange={(e) => actualizarCampoCuenta('socio_admin', e.target.checked)} />
                  Admin entre socios
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
                  <input type="checkbox" checked={Boolean(cuentaEditando.aprobado_superadmin)} onChange={(e) => actualizarCampoCuenta('aprobado_superadmin', e.target.checked)} />
                  Aprobado por SuperAdmin
                </label>
                <button
                  className="btn-secondary"
                  style={{ width: 'auto', padding: '8px 12px' }}
                  onClick={() => {
                    const siguiente = aplicarReglaMensualidad({ ...cuentaEditando, fecha_corte_utm: calcularFechaCorteMesAnterior() });
                    Object.entries(siguiente).forEach(([k, v]) => actualizarCampoCuenta(k, v));
                  }}
                >
                  Recalcular 0,3 UTM
                </button>
              </div>

              <div className="card" style={{ marginTop: '12px', borderRadius: '16px', border: '1px solid rgba(0,122,255,0.16)' }}>
                <h4 className="form-subtitle" style={{ marginBottom: '8px' }}><Users size={15} /> Pupilos del apoderado</h4>
                <p style={{ fontSize: '12px', color: 'var(--texto-secundario)', marginTop: 0 }}>
                  Asigna o corrige manualmente los hijos/pupilos para esta cuenta usando el correo del apoderado.
                </p>

                {!String(cuentaEditando.correo || '').trim() && (
                  <div style={{ fontSize: '12px', color: '#b36200', fontWeight: '800', background: 'rgba(255,149,0,0.12)', border: '1px solid rgba(255,149,0,0.35)', borderRadius: '10px', padding: '8px 10px', marginBottom: '10px' }}>
                    Guarda un correo válido en la cuenta antes de asignar pupilos.
                  </div>
                )}

                <div style={{ marginBottom: '10px' }}>
                  <strong style={{ fontSize: '12px' }}>Pupilos actualmente asociados ({pupilosAsignadosCuenta.length})</strong>
                  <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {pupilosAsignadosCuenta.map((j) => (
                      <div key={`pupilo-asig-${j.rut_jugador}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', background: 'rgba(0,122,255,0.07)', border: '1px solid rgba(0,122,255,0.14)', borderRadius: '10px', padding: '8px' }}>
                        <div>
                          <div style={{ fontSize: '12px', fontWeight: '800' }}>{`${j.nombres || ''} ${j.apellido_paterno || ''}`.trim()}</div>
                          <div style={{ fontSize: '11px', color: 'var(--texto-secundario)' }}>{j.rut_jugador || 'Sin RUT'} · {j.categoria || 'Sin categoría'}</div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                          <select
                            className="form-input"
                            style={{ width: '220px', padding: '7px 9px' }}
                            value={destinoApoderadoPorRut[j.rut_jugador] || ''}
                            onChange={(e) => setDestinoApoderadoPorRut((prev) => ({ ...prev, [j.rut_jugador]: e.target.value }))}
                            disabled={procesandoPupiloRut === String(j.rut_jugador || '')}
                          >
                            <option value="">Mover a apoderado...</option>
                            {cuentasApoderadoDisponibles
                              .filter((c) => String(c.correo || '').trim().toLowerCase() !== String(cuentaEditando?.correo || '').trim().toLowerCase())
                              .map((c) => (
                                <option key={`dest-${j.rut_jugador}-${c.correo}`} value={c.correo}>{c.nombre} · {c.correo}</option>
                              ))}
                          </select>
                          <button
                            className="btn-pill"
                            style={{ width: 'auto', padding: '7px 10px' }}
                            onClick={() => moverPupiloAOtroApoderado(j, destinoApoderadoPorRut[j.rut_jugador])}
                            disabled={procesandoPupiloRut === String(j.rut_jugador || '') || !String(destinoApoderadoPorRut[j.rut_jugador] || '').trim()}
                          >
                            {procesandoPupiloRut === String(j.rut_jugador || '') ? 'Moviendo...' : 'Mover'}
                          </button>
                          <button
                            className="btn-secondary"
                            style={{ width: 'auto', padding: '7px 10px' }}
                            onClick={() => quitarPupiloDeCuenta(j)}
                            disabled={procesandoPupiloRut === String(j.rut_jugador || '')}
                          >
                            {procesandoPupiloRut === String(j.rut_jugador || '') ? 'Quitando...' : 'Quitar'}
                          </button>
                        </div>
                      </div>
                    ))}
                    {pupilosAsignadosCuenta.length === 0 && <span style={{ fontSize: '12px', color: 'var(--texto-secundario)' }}>Sin pupilos asociados.</span>}
                  </div>
                </div>

                <div>
                  <strong style={{ fontSize: '12px' }}>Buscar y asignar pupilo</strong>
                  <input
                    className="form-input"
                    style={{ marginTop: '8px' }}
                    placeholder="Buscar por nombre, RUT, rama o categoría"
                    value={filtroPupiloManual}
                    onChange={(e) => setFiltroPupiloManual(e.target.value)}
                  />
                  <div style={{ marginTop: '8px', maxHeight: '220px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {jugadoresDisponiblesAsignacion.slice(0, 30).map((j) => (
                      <div key={`pupilo-disp-${j.rut_jugador}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', background: 'var(--fondo-app)', border: '1px solid rgba(0,0,0,0.06)', borderRadius: '10px', padding: '8px' }}>
                        <div>
                          <div style={{ fontSize: '12px', fontWeight: '800' }}>{`${j.nombres || ''} ${j.apellido_paterno || ''}`.trim()}</div>
                          <div style={{ fontSize: '11px', color: 'var(--texto-secundario)' }}>{j.rut_jugador || 'Sin RUT'} · {j.rama || 'Sin rama'} · {j.categoria || 'Sin categoría'}</div>
                        </div>
                        <button
                          className="btn-pill btn-success"
                          style={{ width: 'auto', padding: '7px 11px' }}
                          onClick={() => asignarPupiloACuenta(j)}
                          disabled={procesandoPupiloRut === String(j.rut_jugador || '') || !String(cuentaEditando.correo || '').trim()}
                        >
                          {procesandoPupiloRut === String(j.rut_jugador || '') ? 'Asignando...' : 'Asignar'}
                        </button>
                      </div>
                    ))}
                    {jugadoresDisponiblesAsignacion.length === 0 && <span style={{ fontSize: '12px', color: 'var(--texto-secundario)' }}>No hay jugadores para asignar con ese filtro.</span>}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button className="btn-electric" onClick={guardarCuentaPendiente} disabled={guardandoCuenta || !api.validarRutChileno(cuentaEditando.rut)}>
                  {guardandoCuenta ? 'Guardando...' : 'Guardar'}
                </button>
                <button className="btn-secondary" onClick={() => setCuentaEditando(null)}>Salir</button>
              </div>
            </div>
          )}
        </div>
      )}

      {vistaAdmin === 'salud' && (
        <div className="fade-in">
          {(() => {
            const reportes = calcularReportes();
            const scoreActual = calcularScoreDeCliente();
            const engagementTotal = reportes.totalComentarios + reportes.totalReacciones;

            return (
              <>
          <div className="scroll-horizontal-menu mb-15">
            <div className="segment-control" style={{ minWidth: '300px' }}>
              <div className={`segment-btn ${vistaSaludTab === 'dashboard' ? 'active' : ''}`} onClick={() => setVistaSaludTab('dashboard')}>Dashboard</div>
              <div className={`segment-btn ${vistaSaludTab === 'alertas' ? 'active' : ''}`} onClick={() => setVistaSaludTab('alertas')}>Alertas</div>
              <div className={`segment-btn ${vistaSaludTab === 'timeline' ? 'active' : ''}`} onClick={() => setVistaSaludTab('timeline')}>Timeline</div>
            </div>
          </div>

          {vistaSaludTab === 'dashboard' && (
            <SaludDashboardPanel
              scoreActual={scoreActual}
              saludDelSistema={saludDelSistema}
              comunicacionesCount={comunicacionesCount}
              engagementTotal={engagementTotal}
              alertasCount={alertas.length}
            />
          )}
          {vistaSaludTab === 'alertas' && <SaludAlertasPanel alertas={alertas} />}
          {vistaSaludTab === 'timeline' && <SaludTimelinePanel />}
              </>
            );
          })()}
        </div>
      )}

      {vistaAdmin === 'permisos' && (
        <div className="fade-in card">
          <h4 className="form-subtitle">Permisos de Sistema</h4>
          <p>Gestión de permisos activa. Configura accesos por rol y módulo según políticas del club.</p>
        </div>
      )}

      {mostrarFormularioPago && (
        <PagoForm
          pago={pagoEditandoId ? pagosPendientesAdmin?.find(p => p.id === Number(pagoEditandoId)) : null}
          jugadores={jugadoresAdmin || []}
          cuentas={cuentasAdmin || []}
          onClose={() => {
            setMostrarFormularioPago(false);
            setPagoEditandoId(null);
          }}
          onSave={() => {
            setMostrarFormularioPago(false);
            setPagoEditandoId(null);
            // Recargar pagos
            window.location.reload();
          }}
        />
      )}
    </div>
  );
}

export default SuperAdminPanel;
