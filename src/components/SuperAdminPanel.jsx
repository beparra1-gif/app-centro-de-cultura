import { useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Bell,
  CheckSquare,
  FileText,
  Filter,
  History,
  Image,
  Plus,
  Search,
  Shield,
  ShieldCheck,
  Stethoscope,
  RefreshCcw,
  User,
  UserPlus,
  Users,
  XSquare,
} from 'lucide-react';
import * as api from '../api/client';
import LogoAvatar from './LogoAvatar';
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
    () => (pagosPendientesAdmin || []).filter((p) => (p.estado_pago || '').toLowerCase() === 'pendiente'),
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
      perfil: (c.rol || 'apoderado').toLowerCase(),
      nombre: `${c.nombres || ''} ${c.apellido_paterno || ''}`.trim() || c.correo,
      busqueda: `${c.nombres || ''} ${c.apellido_paterno || ''} ${c.apellido_materno || ''} ${c.correo || ''} ${c.rut || ''} ${c.rol || ''}`.toLowerCase(),
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

  const iniciarEdicion = (item) => {
    if (item.tipo === 'cuenta') {
      setEditandoTipo('cuenta');
      setJugadorAdminEdit(null);
      setCuentaAdminEdit({ ...item.raw });
      return;
    }

    setEditandoTipo('jugador');
    setCuentaAdminEdit(null);
    setJugadorAdminEdit({ ...item.raw, rut_original: item.raw.rut_jugador });
  };

  const guardarEdicionActual = async () => {
    try {
      setGuardandoUsuario(true);

      if (editandoTipo === 'cuenta' && cuentaAdminEdit) {
        await guardarCuentaAdmin(cuentaAdminEdit, cuentaAdminEdit.id);
        alert('Cuenta actualizada correctamente.');
      }

      if (editandoTipo === 'jugador' && jugadorAdminEdit) {
        await guardarJugadorAdmin(jugadorAdminEdit, jugadorAdminEdit.rut_original || jugadorAdminEdit.rut_jugador);
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
        await guardarCuentaAdmin(nuevaCuenta);
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
          <div className={`segment-btn ${vistaAdmin === 'usuarios' ? 'active' : ''}`} onClick={() => setVistaAdmin('usuarios')}><Users size={14} /> Usuarios</div>
          <div className={`segment-btn ${vistaAdmin === 'activos' ? 'active' : ''}`} onClick={() => setVistaAdmin('activos')}><Image size={14} /> Activos</div>
          <div className={`segment-btn ${vistaAdmin === 'demo' ? 'active' : ''}`} onClick={() => setVistaAdmin('demo')}><ShieldCheck size={14} /> Demo</div>
          <div className={`segment-btn ${vistaAdmin === 'pagos' ? 'active' : ''}`} onClick={() => setVistaAdmin('pagos')}><CheckSquare size={14} /> Validar Pago</div>
          <div className={`segment-btn ${vistaAdmin === 'citaciones' ? 'active' : ''}`} onClick={() => setVistaAdmin('citaciones')}><UserPlus size={14} /> Citaciones</div>
          <div className={`segment-btn ${vistaAdmin === 'invitados' ? 'active' : ''}`} onClick={() => setVistaAdmin('invitados')}><Users size={14} /> Invitados</div>
          <div className={`segment-btn ${vistaAdmin === 'auditoria' ? 'active' : ''}`} onClick={() => setVistaAdmin('auditoria')}><History size={14} /> Auditoría</div>
          <div className={`segment-btn ${vistaAdmin === 'reportes' ? 'active' : ''}`} onClick={() => setVistaAdmin('reportes')}><FileText size={14} /> Reportes</div>
          <div className={`segment-btn ${vistaAdmin === 'cuentas' ? 'active' : ''}`} onClick={() => setVistaAdmin('cuentas')}><Shield size={14} /> Cuentas</div>
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
                  <button className="btn-secondary" onClick={() => setVistaAdmin('cuentas')}>Completar cuentas</button>
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
                  <button className="btn-secondary" onClick={() => setVistaAdmin('cuentas')}>Ir a cuentas</button>
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
          <h3 className="section-title">Gestión de Usuarios y Jugadores</h3>
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
                    <button className="btn-notificar" onClick={() => iniciarEdicion(u)}>
                      Modificar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {editandoTipo === 'cuenta' && cuentaAdminEdit && (
            <div className="card" style={{ borderRadius: '24px' }}>
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
                <div className="form-group"><label>Rol</label><select className="form-input" value={cuentaAdminEdit.rol || 'apoderado'} onChange={(e) => setCuentaAdminEdit((p) => ({ ...p, rol: e.target.value }))}><option value="apoderado">Apoderado</option><option value="staff">Staff</option><option value="admin">Admin</option><option value="super_admin">Super Admin</option></select></div>
                <div className="form-group"><label>Estado</label><select className="form-input" value={cuentaAdminEdit.estado || 'activo'} onChange={(e) => setCuentaAdminEdit((p) => ({ ...p, estado: e.target.value }))}><option value="activo">Activo</option><option value="inactivo">Inactivo</option></select></div>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button className="btn-electric" onClick={guardarEdicionActual} disabled={guardandoUsuario}>Guardar cambios</button>
                <button className="btn-secondary" onClick={() => { setEditandoTipo(null); setCuentaAdminEdit(null); }}>Cancelar</button>
              </div>
            </div>
          )}

          {editandoTipo === 'jugador' && jugadorAdminEdit && (
            <div className="card">
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
              <div style={{ display: 'flex', gap: '8px' }}>
                <button className="btn-electric" onClick={guardarEdicionActual} disabled={guardandoUsuario}>Guardar cambios</button>
                <button className="btn-secondary" onClick={() => { setEditandoTipo(null); setJugadorAdminEdit(null); }}>Cancelar</button>
              </div>
            </div>
          )}

          <div className="card" style={{ borderRadius: '24px' }}>
            <h4 className="form-subtitle"><Plus size={16} /> Agregar Nuevo Usuario</h4>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
              <button className="btn-secondary" style={{ background: tipoNuevoUsuario === 'cuenta' ? 'var(--azul-electrico)' : undefined, color: tipoNuevoUsuario === 'cuenta' ? 'white' : undefined }} onClick={() => setTipoNuevoUsuario('cuenta')}>Cuenta</button>
              <button className="btn-secondary" style={{ background: tipoNuevoUsuario === 'jugador' ? 'var(--azul-electrico)' : undefined, color: tipoNuevoUsuario === 'jugador' ? 'white' : undefined }} onClick={() => setTipoNuevoUsuario('jugador')}>Jugador</button>
            </div>

            {tipoNuevoUsuario === 'cuenta' ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px' }}>
                <div className="form-group"><label>Correo *</label><input className="form-input" value={nuevaCuenta.correo} onChange={(e) => setNuevaCuenta((p) => ({ ...p, correo: e.target.value }))} /></div>
                <div className="form-group"><label>RUT *</label><input className="form-input" value={nuevaCuenta.rut} onChange={(e) => setNuevaCuenta((p) => ({ ...p, rut: e.target.value }))} /></div>
                <div className="form-group"><label>Password inicial</label><input className="form-input" value={nuevaCuenta.password} onChange={(e) => setNuevaCuenta((p) => ({ ...p, password: e.target.value }))} /></div>
                <div className="form-group"><label>Rol *</label><select className="form-input" value={nuevaCuenta.rol} onChange={(e) => setNuevaCuenta((p) => ({ ...p, rol: e.target.value }))}><option value="apoderado">Apoderado</option><option value="staff">Staff</option><option value="admin">Admin</option><option value="super_admin">Super Admin</option></select></div>
                <div className="form-group"><label>Nombres</label><input className="form-input" value={nuevaCuenta.nombres} onChange={(e) => setNuevaCuenta((p) => ({ ...p, nombres: e.target.value }))} /></div>
                <div className="form-group"><label>Apellido Paterno</label><input className="form-input" value={nuevaCuenta.apellido_paterno} onChange={(e) => setNuevaCuenta((p) => ({ ...p, apellido_paterno: e.target.value }))} /></div>
                <div className="form-group"><label>Apellido Materno</label><input className="form-input" value={nuevaCuenta.apellido_materno} onChange={(e) => setNuevaCuenta((p) => ({ ...p, apellido_materno: e.target.value }))} /></div>
                <div className="form-group"><label>Teléfono</label><input className="form-input" value={nuevaCuenta.telefono} onChange={(e) => setNuevaCuenta((p) => ({ ...p, telefono: e.target.value }))} /></div>
                <div className="form-group"><label>Dirección</label><input className="form-input" value={nuevaCuenta.direccion} onChange={(e) => setNuevaCuenta((p) => ({ ...p, direccion: e.target.value }))} /></div>
                <div className="form-group"><label>Comuna</label><input className="form-input" value={nuevaCuenta.comuna} onChange={(e) => setNuevaCuenta((p) => ({ ...p, comuna: e.target.value }))} /></div>
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
          {pagosPendientesReales.length === 0 ? <p className="text-muted text-center italic mt-20">Sin comprobantes pendientes.</p> : null}
          {pagosPendientesReales.map((pago) => (
            <div key={pago.id} className="card" style={{ borderLeft: '4px solid var(--azul-electrico)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h4 style={{ margin: 0, color: 'var(--texto-heading)', fontSize: '16px' }}>
                    {`${pago.nombres || 'Jugador'} ${pago.apellido_paterno || ''}`.trim()}
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
                  onClick={async () => {
                    await validarPagoMensualidad(pago.id, 'aprobado');
                    alert('Pago aprobado correctamente.');
                  }}
                >
                  <CheckSquare size={16} /> Aprobar
                </button>
                <button
                  style={{ flex: 1, padding: '12px', background: '#FF3B30', color: 'white', border: 'none', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}
                  onClick={async () => {
                    await validarPagoMensualidad(pago.id, 'rechazado');
                    alert('Pago rechazado correctamente.');
                  }}
                >
                  <XSquare size={16} /> Rechazar
                </button>
              </div>
            </div>
          ))}
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

      {vistaAdmin === 'cuentas' && (
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
              <div className="form-group"><label>Rol</label><input className="form-input" value={cuentaEditando.rol} onChange={(e) => actualizarCampoCuenta('rol', e.target.value)} /></div>
              <div className="form-group"><label>Estado Civil</label><input className="form-input" value={cuentaEditando.estado_civil} onChange={(e) => actualizarCampoCuenta('estado_civil', e.target.value)} /></div>
              <div className="form-group"><label>Profesion u Oficio</label><input className="form-input" value={cuentaEditando.profesion_oficio} onChange={(e) => actualizarCampoCuenta('profesion_oficio', e.target.value)} /></div>
              <div className="form-group"><label>Segundo Contacto</label><input className="form-input" value={cuentaEditando.nombre_segundo_contacto} onChange={(e) => actualizarCampoCuenta('nombre_segundo_contacto', e.target.value)} /></div>
              <div className="form-group"><label>Parentesco Segundo Contacto</label><input className="form-input" value={cuentaEditando.parentesco_segundo_contacto} onChange={(e) => actualizarCampoCuenta('parentesco_segundo_contacto', e.target.value)} /></div>
              <div className="form-group"><label>Numero Segundo Contacto</label><input className="form-input" value={cuentaEditando.num_segundo_contacto} onChange={(e) => actualizarCampoCuenta('num_segundo_contacto', e.target.value)} /></div>
              <div className="form-group"><label>Dia Pago Acordado</label><input className="form-input" type="number" min="1" max="31" value={cuentaEditando.dia_pago_acordado} onChange={(e) => actualizarCampoCuenta('dia_pago_acordado', e.target.value)} /></div>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', fontSize: '13px' }}>
                <input type="checkbox" checked={Boolean(cuentaEditando.es_socio)} onChange={(e) => actualizarCampoCuenta('es_socio', e.target.checked)} />
                Es socio
              </label>

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
    </div>
  );
}

export default SuperAdminPanel;
