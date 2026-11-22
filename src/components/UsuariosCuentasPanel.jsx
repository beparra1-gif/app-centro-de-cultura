import { useMemo, useState } from 'react';
import { Eye, FileText, History, Link2, Lock, Megaphone, Plus, Search, ShieldCheck, User, Users } from 'lucide-react';
import * as api from '../api/client';
import { showToast } from '../utils/toast';
import { confirmAction } from '../utils/confirmDialog';
import VincularApoderadosPanel from './VincularApoderadosPanel';
import RevisionPadronPanel from './RevisionPadronPanel';
import AvisoWhatsappLista from './AvisoWhatsappLista';
import ImportarJugadoresPlanilla from './ImportarJugadoresPlanilla';
import SelectorOrden from './SelectorOrden';
import BotonVolverAdmin from './BotonVolverAdmin';
import { cambioDeEstado, estaActivo } from '../utils/estadoActivo';
import { descargarExcel, descargarPdf, listadoCuentas, listadoDeportistas } from '../utils/exportarDeportistas';
import { hoyLocalISO } from '../utils/fechas';
import { hermanosDe } from '../utils/hermanos';
import { ordenarPersonas } from '../utils/ordenarPersonas';
import usePreferenciaLocal, { esOrdenValido } from '../utils/usePreferenciaLocal';

// Vista "Usuarios y Cuentas" (Deportistas, Cuentas, Vincular, Altas y bajas,
// Registrar), separada de SuperAdminPanel. Se monta siempre y solo se oculta
// con `visible`, para que filtros y selección sobrevivan al cambiar de
// pantalla del Panel (igual que cuando el estado vivía en SuperAdminPanel).
// El formulario de Registrar y los modales de edición siguen en el panel
// (comparten estado con guardarNuevoUsuario / iniciarEdicion) y llegan como
// `formularioRegistrar` y `children`.
export default function UsuariosCuentasPanel({
  visible,
  esAdmin,
  esSuperAdmin,
  jugadoresAdmin,
  jugadoresAdminTodos,
  cuentasAdmin,
  cuentasAdminTodas,
  jugadoresIncompletos,
  jugadoresSinApoderado,
  cuentasIncompletas,
  categoriasUnicas,
  cuentaPropiaPorRutJugador,
  normalizarRutUsuarios,
  recargarUsuariosAdmin,
  guardarJugadorAdmin,
  onSheetsSyncComplete,
  setVistaAdmin,
  setFichaPersona,
  iniciarEdicion,
  cambiarPerfilRapido,
  perfilBaseParaSelector,
  PERFIL_UNICO_OPTIONS,
  resetearClaveDesdeLista,
  reseteandoClaveId,
  eliminarUsuarioDefinitivo,
  eliminandoUsuarioId,
  formularioRegistrar,
  children,
}) {
  // Deportistas (tabla jugadores) y Cuentas (tabla cuentas: apoderados, socios,
  // staff, admins, y también jugadores con login propio) son dos entidades
  // distintas que antes vivían mezcladas en una sola lista/filtro — separadas
  // en dos pestañas para que cada una tenga sus propios filtros relevantes.
  const [vistaUsuarios, setVistaUsuarios] = useState('deportistas');
  const [filtroUsuariosTexto, setFiltroUsuariosTexto] = useState('');
  const [filtroCuentasTexto, setFiltroCuentasTexto] = useState('');
  // Se recuerda en este dispositivo.
  const [ordenUsuarios, setOrdenUsuarios] = usePreferenciaLocal('usuarios.orden', { orden: 'apellido', dir: 'asc' }, esOrdenValido(['deuda', 'apellido', 'nombre', 'nacimiento', 'edad', 'categoria']));
  const [filtroTipoPerfil, setFiltroTipoPerfil] = useState('todos');
  const [filtroEstadoUsuarios, setFiltroEstadoUsuarios] = useState('activos');
  const [filtroRamaJugadores, setFiltroRamaJugadores] = useState('todas');
  const [filtroCategoriaJugadores, setFiltroCategoriaJugadores] = useState('todas');
  const [filtroApoderadoJugadores, setFiltroApoderadoJugadores] = useState('todos');
  const [asignandoApoderadoRut, setAsignandoApoderadoRut] = useState(null);
  const [correoApoderadoParaAsignar, setCorreoApoderadoParaAsignar] = useState('');
  const [guardandoAsignacionApoderado, setGuardandoAsignacionApoderado] = useState(false);

  const rutsJugadoresIncompletos = useMemo(
    () => new Set(jugadoresIncompletos.map((j) => String(j.rut_jugador || ''))),
    [jugadoresIncompletos]
  );
  const idsCuentasIncompletas = useMemo(
    () => new Set((cuentasIncompletas || []).map((c) => String(c.id))),
    [cuentasIncompletas]
  );
  const rutsJugadoresSinApoderado = useMemo(
    () => new Set(jugadoresSinApoderado.map((j) => String(j.rut_jugador || ''))),
    [jugadoresSinApoderado]
  );

  // Sin ignorar tildes, "Theza" (cuenta) y "Thezá" (jugador) no matchean
  // pese a ser el mismo apellido — apellidos con tilde son comunes acá.
  const normalizarApellido = (texto = '') => String(texto || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');

  const cuentasApoderadoParaAsignar = useMemo(() => {
    return (cuentasAdmin || [])
      .filter((c) => String(c.correo || '').trim())
      .map((c) => ({
        correo: c.correo,
        rut: c.rut || '',
        nombre: `${c.nombres || ''} ${c.apellido_paterno || ''}`.trim() || c.correo,
        apellidoPaterno: normalizarApellido(c.apellido_paterno || ''),
      }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [cuentasAdmin]);

  // Mismas cuentas de arriba, pero con las que comparten apellido con ESTE
  // jugador puestas primero — acelera vincular a un apoderado sin tener que
  // buscarlo a mano en 100+ opciones cuando el apellido ya da una pista
  // fuerte de cuál es. Sigue siendo el admin quien confirma con el clic, no
  // se vincula nada solo.
  const ordenarCandidatosApoderado = (jugador) => {
    const apellidoJugador = normalizarApellido(jugador?.apellido_paterno || '');
    if (!apellidoJugador) return cuentasApoderadoParaAsignar;
    const coinciden = cuentasApoderadoParaAsignar.filter((c) => c.apellidoPaterno && c.apellidoPaterno === apellidoJugador);
    const resto = cuentasApoderadoParaAsignar.filter((c) => !(c.apellidoPaterno && c.apellidoPaterno === apellidoJugador));
    return [...coinciden.map((c) => ({ ...c, sugerido: true })), ...resto];
  };

  const asignarApoderadoAJugador = async (jugador) => {
    const cuenta = cuentasApoderadoParaAsignar.find((c) => c.correo === correoApoderadoParaAsignar);
    if (!cuenta) {
      showToast({ message: 'Selecciona un apoderado de la lista.', type: 'error' });
      return;
    }
    setGuardandoAsignacionApoderado(true);
    try {
      await guardarJugadorAdmin({
        rut_jugador: jugador.rut_jugador,
        rut_apoderado: cuenta.rut || null,
        correo_apoderado: cuenta.correo,
      }, jugador.rut_jugador);
      // Hermanos agrupados a mano (grupo_familiar) que aún no tienen
      // apoderado: nunca se asigna solo; se pregunta y el admin decide.
      const candidatosHermanos = hermanosDe(jugador, jugadoresAdminTodos || [])
        .filter((h) => !String(h.rut_apoderado || '').trim() && !String(h.correo_apoderado || '').includes('@'));
      const tambienHermanos = candidatosHermanos.length > 0 && await confirmAction({
        title: 'Asignar también a sus hermanos',
        message: `${jugador.nombres || jugador.rut_jugador} está agrupado con ${candidatosHermanos.map((h) => h.nombres).join(', ')}, que no ${candidatosHermanos.length === 1 ? 'tiene' : 'tienen'} apoderado. ¿Asignar a ${cuenta.nombre} también como su apoderado?`,
        confirmText: 'Sí, a todos',
        cancelText: 'Solo a este deportista',
      });
      const hermanosSinApoderado = tambienHermanos ? candidatosHermanos : [];
      for (const h of hermanosSinApoderado) {
        await guardarJugadorAdmin({ rut_jugador: h.rut_jugador, rut_apoderado: cuenta.rut || null, correo_apoderado: cuenta.correo }, h.rut_jugador);
      }
      if (onSheetsSyncComplete) await onSheetsSyncComplete();
      showToast({ message: `${cuenta.nombre} asignado como apoderado de ${jugador.nombres || jugador.rut_jugador}${hermanosSinApoderado.length ? ` y ${hermanosSinApoderado.length === 1 ? 'su hermano/a' : `sus ${hermanosSinApoderado.length} hermanos`}` : ''}.`, type: 'success' });
      setAsignandoApoderadoRut(null);
      setCorreoApoderadoParaAsignar('');
    } catch (error) {
      showToast({ message: error.message || 'No se pudo asignar el apoderado.', type: 'error' });
    } finally {
      setGuardandoAsignacionApoderado(false);
    }
  };

  const listadoUsuarios = useMemo(() => {
    const cuentas = (cuentasAdminTodas || []).map((c) => ({
      id: `cuenta-${c.id}`,
      tipo: 'cuenta',
      perfil: (() => {
        const perfil = String(c.perfil_principal || c.rol || 'apoderado').toLowerCase();
        return perfil === 'deportista' ? 'jugador' : perfil;
      })(),
      nombre: `${c.nombres || ''} ${c.apellido_paterno || ''}`.trim() || String(c.correo || c.rut || 'Sin nombre'),
      busqueda: `${c.nombres || ''} ${c.apellido_paterno || ''} ${c.apellido_materno || ''} ${c.correo || ''} ${c.rut || ''} ${c.rol || ''} ${c.perfil_principal || ''} ${c.cargo_directiva || ''}`.toLowerCase(),
      rama: null,
      categoria: null,
      raw: c,
    }));

    const jugadores = (jugadoresAdminTodos || []).map((j) => ({
      id: `jugador-${j.rut_jugador}`,
      tipo: 'jugador',
      perfil: 'jugador',
      nombre: `${j.nombres || ''} ${j.apellido_paterno || ''}`.trim() || String(j.rut_jugador || 'Sin nombre'),
      busqueda: `${j.nombres || ''} ${j.apellido_paterno || ''} ${j.apellido_materno || ''} ${j.rut_jugador || ''} ${j.rama || ''} ${j.categoria || ''}`.toLowerCase(),
      rama: (j.rama || '').toLowerCase(),
      categoria: (j.categoria || '').toLowerCase(),
      raw: j,
    }));

    return [...cuentas, ...jugadores];
  }, [cuentasAdminTodas, jugadoresAdminTodos]);

  // Datos para "Ordenar por" (apellido, nombre, nacimiento, edad, categoría).
  const accesoOrdenUsuario = (u) => ({
    nombre: u.raw.nombres || u.nombre,
    apellido: `${u.raw.apellido_paterno || ''} ${u.raw.apellido_materno || ''}`.trim(),
    fechaNacimiento: u.raw.fecha_nacimiento || '',
    categoria: u.raw.categoria || '',
  });

  const deportistasFiltrados = useMemo(() => {
    const q = filtroUsuariosTexto.trim().toLowerCase();
    const lista = listadoUsuarios
      .filter((u) => {
        if (u.tipo !== 'jugador') return false;
        if (filtroEstadoUsuarios === 'activos' && !estaActivo(u.raw)) return false;
        if (filtroEstadoUsuarios === 'inactivos' && estaActivo(u.raw)) return false;
        if (q && !u.busqueda.includes(q)) return false;
        if (filtroRamaJugadores !== 'todas' && u.rama !== filtroRamaJugadores.toLowerCase()) return false;
        if (filtroCategoriaJugadores !== 'todas' && u.categoria !== filtroCategoriaJugadores.toLowerCase()) return false;
        const sinApoderado = rutsJugadoresSinApoderado.has(String(u.raw.rut_jugador || ''));
        if (filtroApoderadoJugadores === 'sin' && !sinApoderado) return false;
        if (filtroApoderadoJugadores === 'con' && sinApoderado) return false;
        return true;
      });
    return ordenarPersonas(lista, ordenUsuarios, accesoOrdenUsuario);
  }, [
    ordenUsuarios,
    listadoUsuarios,
    filtroUsuariosTexto,
    filtroRamaJugadores,
    filtroCategoriaJugadores,
    filtroApoderadoJugadores,
    rutsJugadoresSinApoderado,
    filtroEstadoUsuarios,
  ]);

  const cuentasUsuariosFiltradas = useMemo(() => {
    const q = filtroCuentasTexto.trim().toLowerCase();
    const lista = listadoUsuarios.filter((u) => {
      if (u.tipo !== 'cuenta') return false;
      if (filtroEstadoUsuarios === 'activos' && !estaActivo(u.raw)) return false;
      if (filtroEstadoUsuarios === 'inactivos' && estaActivo(u.raw)) return false;
      if (filtroTipoPerfil !== 'todos' && u.perfil !== filtroTipoPerfil) return false;
      if (q && !u.busqueda.includes(q)) return false;
      return true;
    });
    return ordenarPersonas(lista, ordenUsuarios, accesoOrdenUsuario);
  }, [listadoUsuarios, filtroCuentasTexto, filtroTipoPerfil, filtroEstadoUsuarios, ordenUsuarios]);

  // Tarjeta compartida por Deportistas y Cuentas — misma estructura, evita
  // duplicar ~90 líneas de JSX entre las dos pestañas.
  // Selección múltiple en Usuarios y Cuentas: desactivar/reactivar varios de
  // una vez (ej. después de revisar el listado exportado).
  const [seleccionUsuarios, setSeleccionUsuarios] = useState(() => new Set());
  const [aplicandoEstadoMasivo, setAplicandoEstadoMasivo] = useState(false);

  const aplicarEstadoMasivo = async (items, activar) => {
    const confirmado = await confirmAction({
      title: activar ? 'Reactivar seleccionados' : 'Desactivar seleccionados',
      message: activar
        ? `${items.length} vuelven a estar activos y aparecen de nuevo en cobros, citaciones y listados.`
        : `${items.length} quedarán inactivos: salen de cobros, citaciones, pasar lista e informes, y las cuentas no podrán ingresar. Se pueden reactivar después.`,
      confirmText: activar ? 'Reactivar' : 'Desactivar',
    });
    if (!confirmado) return;
    setAplicandoEstadoMasivo(true);
    let fallidos = 0;
    for (const u of items) {
      try {
        const cambio = cambioDeEstado(u.tipo, activar, hoyLocalISO());
        if (u.tipo === 'jugador') await api.jugadoresAPI.update(u.raw.rut_jugador, cambio);
        else await api.cuentasAPI.update(u.raw.id, cambio);
      } catch {
        fallidos += 1;
      }
    }
    await recargarUsuariosAdmin?.();
    setSeleccionUsuarios(new Set());
    setAplicandoEstadoMasivo(false);
    showToast({
      message: fallidos ? `${items.length - fallidos} actualizados, ${fallidos} con error (revisa la conexión y reintenta).` : `${items.length} actualizados.`,
      type: fallidos ? 'error' : 'success',
    });
  };

  const [exportandoListado, setExportandoListado] = useState('');
  const [avisoWsp, setAvisoWsp] = useState(null);
  // Un destinatario por teléfono de apoderado (hermanos juntos); sin cuenta
  // de apoderado o con la cuenta inactiva no se incluye.
  const destinatariosApoderados = (lista) => {
    const porTelefono = new Map();
    listadoDeportistas(lista.map((u) => u.raw), cuentasAdminTodas || []).filas.forEach((f) => {
      if (!f.telApoderado || f.estadoCuenta === 'Inactiva') return;
      const clave = f.telApoderado.replace(/\D/g, '');
      const previo = porTelefono.get(clave);
      porTelefono.set(clave, previo
        ? { ...previo, detalle: `${previo.detalle}, ${f.nombres} (${f.categoria})` }
        : { clave, nombre: f.apoderado, telefono: f.telApoderado, detalle: `${f.nombres} (${f.categoria})` });
    });
    return [...porTelefono.values()];
  };
  const ETIQUETA_FILTRO_ESTADO = { activos: 'Solo activos', inactivos: 'Solo inactivos / baja', todos: 'Activos e inactivos' };
  const botonesExportar = ({ cantidad, archivo, armar, titulo, subtitulo }) => {
    const exportar = async (formato) => {
      setExportandoListado(formato);
      try {
        if (formato === 'excel') await descargarExcel(`${archivo}.xlsx`, armar(), titulo);
        else await descargarPdf(`${archivo}.pdf`, armar(), titulo, subtitulo);
      } catch (error) {
        showToast({ message: `No se pudo exportar: ${error.message}`, type: 'error' });
      } finally {
        setExportandoListado('');
      }
    };
    return (
      <span className="uc-exportar" role="group" aria-label={`Exportar ${cantidad} en Excel o PDF`}>
        <span className="uc-exportar-etiqueta"><FileText size={13} /> Exportar {cantidad}:</span>
        <button type="button" className="btn-secondary tc-btn" disabled={!cantidad || Boolean(exportandoListado)} onClick={() => exportar('excel')}>
          {exportandoListado === 'excel' ? 'Generando…' : 'Excel'}
        </button>
        <button type="button" className="btn-secondary tc-btn" disabled={!cantidad || Boolean(exportandoListado)} onClick={() => exportar('pdf')}>
          {exportandoListado === 'pdf' ? 'Generando…' : 'PDF'}
        </button>
      </span>
    );
  };

  const barraSeleccionUsuarios = (lista) => {
    if (!(esAdmin || esSuperAdmin) || lista.length === 0) return null;
    const elegidos = lista.filter((u) => seleccionUsuarios.has(u.id));
    const todosElegidos = elegidos.length === lista.length;
    return (
      <div className="uc-barra-seleccion" role="group" aria-label="Acciones con seleccionados">
        <label className="checkbox-label-row">
          <input
            type="checkbox"
            checked={todosElegidos}
            onChange={() => setSeleccionUsuarios((prev) => {
              const sig = new Set(prev);
              lista.forEach((u) => (todosElegidos ? sig.delete(u.id) : sig.add(u.id)));
              return sig;
            })}
          />
          {elegidos.length ? `${elegidos.length} seleccionados` : `Seleccionar los ${lista.length}`}
        </label>
        {elegidos.length > 0 && (
          <>
            <button type="button" className="btn-secondary tc-btn" disabled={aplicandoEstadoMasivo} onClick={() => aplicarEstadoMasivo(elegidos, false)}>
              {aplicandoEstadoMasivo ? 'Guardando…' : 'Desactivar'}
            </button>
            <button type="button" className="btn-secondary tc-btn" disabled={aplicandoEstadoMasivo} onClick={() => aplicarEstadoMasivo(elegidos, true)}>
              Reactivar
            </button>
            <button type="button" className="btn-secondary tc-btn" disabled={aplicandoEstadoMasivo} onClick={() => setSeleccionUsuarios(new Set())}>
              Limpiar
            </button>
          </>
        )}
      </div>
    );
  };

  const renderTarjetaUsuario = (u) => {
    const esIncompleta = u.tipo === 'jugador'
      ? rutsJugadoresIncompletos.has(String(u.raw.rut_jugador || ''))
      : idsCuentasIncompletas.has(String(u.raw.id));
    const sinApoderado = u.tipo === 'jugador' && rutsJugadoresSinApoderado.has(String(u.raw.rut_jugador || ''));
    const mostrandoAsignar = asignandoApoderadoRut === u.raw.rut_jugador;
    const cuentaPropiaJugador = u.tipo === 'jugador'
      ? cuentaPropiaPorRutJugador.get(normalizarRutUsuarios(u.raw.rut_jugador))
      : null;

    return (
      <div
        key={u.id}
        className="card"
        style={{
          marginBottom: '10px',
          borderLeft: `4px solid ${sinApoderado ? 'var(--rojo-alerta)' : (u.tipo === 'jugador' ? 'var(--azul-electrico)' : '#FF9500')}`,
          borderRadius: 'var(--radius-lg)',
          background: sinApoderado ? 'rgba(255,59,48,0.05)' : undefined,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px', flexWrap: 'wrap' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              {(esAdmin || esSuperAdmin) && (
                <input
                  type="checkbox"
                  className="uc-seleccion"
                  checked={seleccionUsuarios.has(u.id)}
                  onChange={() => setSeleccionUsuarios((prev) => {
                    const sig = new Set(prev);
                    if (sig.has(u.id)) sig.delete(u.id); else sig.add(u.id);
                    return sig;
                  })}
                  aria-label={`Seleccionar a ${u.nombre}`}
                />
              )}
              <button type="button" className="fp-nombre-link" onClick={() => setFichaPersona({ tipo: u.tipo, raw: u.raw })} title="Ver ficha completa">
                {u.nombre}
              </button>
              <span style={{ fontSize: '10px', fontWeight: '800', padding: '3px 8px', borderRadius: 'var(--radius-pill)', color: esIncompleta ? '#8A4B00' : '#1c7a3d', background: esIncompleta ? 'rgba(255,149,0,0.14)' : 'rgba(52,199,89,0.14)' }}>
                {esIncompleta ? 'Incompleta' : 'Completa'}
              </span>
              {sinApoderado && (
                <span style={{ fontSize: '10px', fontWeight: '800', padding: '3px 8px', borderRadius: 'var(--radius-pill)', color: '#b00020', background: 'rgba(255,59,48,0.12)' }}>
                  Sin apoderado
                </span>
              )}
              {!estaActivo(u.raw) && <span className="tc-perfil alerta">{String(u.raw.estado || 'Inactivo').toUpperCase()}</span>}
            </div>
            <div className="text-caption">
              {u.tipo === 'jugador'
                ? `${u.raw.rut_jugador || '-'} · ${u.raw.rama || 'Sin rama'} · ${u.raw.categoria || 'Sin categoría'}`
                : `${u.raw.correo || '-'} · ${u.raw.rut || '-'} · ${(u.raw.rol || 'sin rol').toUpperCase()}`}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {sinApoderado && (
              <button
                className="btn-secondary"
                style={{ width: 'auto' }}
                onClick={() => {
                  setAsignandoApoderadoRut(mostrandoAsignar ? null : u.raw.rut_jugador);
                  setCorreoApoderadoParaAsignar('');
                }}
              >
                {mostrandoAsignar ? 'Cancelar' : 'Asignar apoderado'}
              </button>
            )}
            {u.tipo === 'cuenta' && (esAdmin || esSuperAdmin) && (
              <select
                className="form-input uc-perfil-rapido"
                aria-label={`Perfil de ${u.nombre}`}
                value={perfilBaseParaSelector(u.raw.rol || u.raw.perfil_principal)}
                onChange={(e) => cambiarPerfilRapido(u.raw, e.target.value)}
              >
                {PERFIL_UNICO_OPTIONS.filter((o) => esSuperAdmin || o.value !== 'super_admin').map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            )}
            <button type="button" className="btn-secondary" style={{ width: 'auto' }} onClick={() => setFichaPersona({ tipo: u.tipo, raw: u.raw })}>
              <Eye size={13} /> Ver ficha
            </button>
            <button className="btn-modificar" onClick={() => iniciarEdicion(u)}>
              Modificar
            </button>
            {u.tipo === 'cuenta' && (esAdmin || esSuperAdmin) && (
              <button
                className="btn-secondary"
                style={{ width: 'auto' }}
                onClick={() => resetearClaveDesdeLista(u.raw)}
                disabled={reseteandoClaveId === u.raw.id}
              >
                <Lock size={13} /> {reseteandoClaveId === u.raw.id ? 'Generando...' : 'Código de acceso'}
              </button>
            )}
            {u.tipo === 'jugador' && (esAdmin || esSuperAdmin) && (
              cuentaPropiaJugador ? (
                <button
                  className="btn-secondary"
                  style={{ width: 'auto' }}
                  onClick={() => resetearClaveDesdeLista(cuentaPropiaJugador)}
                  disabled={reseteandoClaveId === cuentaPropiaJugador.id}
                >
                  <Lock size={13} /> {reseteandoClaveId === cuentaPropiaJugador.id ? 'Generando...' : 'Código de acceso'}
                </button>
              ) : (
                <span style={{ fontSize: '10px', fontWeight: '800', padding: '3px 8px', borderRadius: 'var(--radius-pill)', color: 'var(--texto-secundario)', background: 'rgba(120,120,128,0.12)' }}>
                  Sin cuenta propia
                </span>
              )
            )}
            {esSuperAdmin && (
              <button
                className="btn-secondary"
                style={{
                  width: 'auto',
                  background: 'rgba(255,59,48,0.12)',
                  borderColor: 'rgba(255,59,48,0.36)',
                  color: '#b00020',
                  fontWeight: '800',
                }}
                onClick={() => eliminarUsuarioDefinitivo(u)}
                disabled={eliminandoUsuarioId === u.id}
              >
                {eliminandoUsuarioId === u.id ? 'Borrando...' : 'Borrar definitivo'}
              </button>
            )}
          </div>
        </div>

        {mostrandoAsignar && (
          <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px dashed var(--borde-suave)', display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
            <select
              className="form-input"
              style={{ flex: '1 1 240px' }}
              value={correoApoderadoParaAsignar}
              onChange={(e) => setCorreoApoderadoParaAsignar(e.target.value)}
            >
              <option value="">Selecciona un apoderado/socio...</option>
              {ordenarCandidatosApoderado(u.raw).map((c) => (
                <option key={c.correo} value={c.correo}>{c.sugerido ? '⭐ ' : ''}{c.nombre} · {c.correo}{c.sugerido ? ' (mismo apellido)' : ''}</option>
              ))}
            </select>
            <button
              className="btn-electric"
              style={{ width: 'auto' }}
              disabled={!correoApoderadoParaAsignar || guardandoAsignacionApoderado}
              onClick={() => asignarApoderadoAJugador(u.raw)}
            >
              {guardandoAsignacionApoderado ? 'Guardando...' : 'Confirmar asignación'}
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      {visible && (
        <div className="fade-in">
          <BotonVolverAdmin onVolver={() => setVistaAdmin('inicio')} />
          <div className="tesoreria-cabecera">
            <h2>Usuarios y Cuentas</h2>
            <button type="button" className="btn-electric tesoreria-btn-pago" onClick={() => setVistaUsuarios('registrar')}>
              <Plus size={15} /> Registrar
            </button>
          </div>
          <p className="uc-ayuda">
            <b>Deportistas</b>: fichas deportivas. <b>Cuentas</b>: quienes ingresan a la app (apoderados, socios, staff y admins). Toca un nombre para ver su ficha completa.
          </p>

          <div className="tesoreria-tabs-wrap"><div className="segment-control tesoreria-tabs" role="group" aria-label="Secciones de Usuarios y Cuentas" style={{ gap: '6px' }}>
            <button type="button" className={`segment-btn ${vistaUsuarios === 'deportistas' ? 'active' : ''}`} onClick={() => setVistaUsuarios('deportistas')}>
              <Users size={14} /> Deportistas ({jugadoresAdminTodos.length})
            </button>
            <button type="button" className={`segment-btn ${vistaUsuarios === 'cuentas' ? 'active' : ''}`} onClick={() => setVistaUsuarios('cuentas')}>
              <User size={14} /> Cuentas ({cuentasAdminTodas.length})
            </button>
            <button type="button" className={`segment-btn ${vistaUsuarios === 'vincular' ? 'active' : ''}`} onClick={() => setVistaUsuarios('vincular')}>
              <Link2 size={14} /> Vincular apoderados
              {jugadoresSinApoderado.filter(estaActivo).length > 0 && <span className="tesoreria-tab-badge">{jugadoresSinApoderado.filter(estaActivo).length}</span>}
            </button>
            {(esAdmin || esSuperAdmin) && (
              <button type="button" className={`segment-btn ${vistaUsuarios === 'padron' ? 'active' : ''}`} onClick={() => setVistaUsuarios('padron')}>
                <History size={14} /> Altas y bajas
              </button>
            )}
            <button type="button" className={`segment-btn ${vistaUsuarios === 'registrar' ? 'active' : ''}`} onClick={() => setVistaUsuarios('registrar')}>
              <Plus size={14} /> Registrar nuevo
            </button>
            {/* Permisos individuales: antes solo en el engranaje (panel chico)
                o escondidos en Sistema; ahora junto a las cuentas que afectan. */}
            <button type="button" className="segment-btn" onClick={() => setVistaAdmin('permisos')}>
              <ShieldCheck size={14} /> Permisos
            </button>
          </div></div>

          {(vistaUsuarios === 'deportistas' || vistaUsuarios === 'cuentas') && (
            <SelectorOrden
              className="mb-10"
              valor={ordenUsuarios}
              onCambiar={setOrdenUsuarios}
              opciones={vistaUsuarios === 'deportistas' ? ['apellido', 'nombre', 'nacimiento', 'edad', 'categoria'] : ['apellido', 'nombre', 'nacimiento', 'edad']}
            />
          )}
          {(vistaUsuarios === 'deportistas' || vistaUsuarios === 'cuentas') && (
            <div className="filter-chips mb-15" role="group" aria-label="Estado">
              {[
                ['activos', 'Activos'],
                ['inactivos', 'Inactivos / baja'],
                ['todos', 'Todos'],
              ].map(([valor, etiqueta]) => (
                <button key={valor} type="button" className={`filter-chip ${filtroEstadoUsuarios === valor ? 'active' : ''}`} onClick={() => setFiltroEstadoUsuarios(valor)}>
                  {etiqueta} ({(() => {
                    const base = (vistaUsuarios === 'deportistas' ? jugadoresAdminTodos : cuentasAdminTodas) || [];
                    if (valor === 'todos') return base.length;
                    const activos = base.filter(estaActivo).length;
                    return valor === 'activos' ? activos : base.length - activos;
                  })()})
                </button>
              ))}
            </div>
          )}

          {vistaUsuarios === 'deportistas' && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '8px', marginBottom: '12px' }}>
                <div className="admin-stat-pill verde"><span>Completos</span><h2>{jugadoresAdminTodos.length - jugadoresIncompletos.length}</h2></div>
                <div className="admin-stat-pill" style={{ background: 'rgba(255,149,0,0.1)' }}><span>Incompletos</span><h2 style={{ color: '#8A4B00' }}>{jugadoresIncompletos.length}</h2></div>
                <div className="admin-stat-pill rojo"><span>Sin apoderado</span><h2>{jugadoresSinApoderado.length}</h2></div>
              </div>

              <div className="card">
                <div className="grid-auto-220">
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label>Buscar</label>
                    <div style={{ position: 'relative' }}>
                      <Search size={15} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--texto-secundario)' }} />
                      <input
                        className="form-input"
                        style={{ paddingLeft: '32px' }}
                        placeholder="Nombre, RUT, rama o categoría"
                        value={filtroUsuariosTexto}
                        onChange={(e) => setFiltroUsuariosTexto(e.target.value)}
                      />
                    </div>
                  </div>
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

                <div className="filter-chips" style={{ marginTop: '10px' }}>
                  <button className={`filter-chip ${filtroApoderadoJugadores === 'todos' ? 'active' : ''}`} onClick={() => setFiltroApoderadoJugadores('todos')}>Todos ({jugadoresAdminTodos.length})</button>
                  <button className={`filter-chip ${filtroApoderadoJugadores === 'sin' ? 'active' : ''}`} onClick={() => setFiltroApoderadoJugadores('sin')}>Sin apoderado ({jugadoresSinApoderado.length})</button>
                  <button className={`filter-chip ${filtroApoderadoJugadores === 'con' ? 'active' : ''}`} onClick={() => setFiltroApoderadoJugadores('con')}>Con apoderado ({jugadoresAdminTodos.length - jugadoresSinApoderado.length})</button>
                  {botonesExportar({
                    cantidad: deportistasFiltrados.length,
                    archivo: `deportistas-${[filtroRamaJugadores, filtroCategoriaJugadores, filtroEstadoUsuarios].filter((f) => f !== 'todas' && f !== 'todos').join('-')}-${hoyLocalISO()}`,
                    armar: () => listadoDeportistas(deportistasFiltrados.map((u) => u.raw), cuentasAdminTodas || []),
                    titulo: 'Deportistas y apoderados',
                    subtitulo: [filtroRamaJugadores !== 'todas' && `Rama ${filtroRamaJugadores}`, filtroCategoriaJugadores !== 'todas' && `Categoría ${filtroCategoriaJugadores}`, ETIQUETA_FILTRO_ESTADO[filtroEstadoUsuarios]].filter(Boolean).join(' · '),
                  })}
                  {(esAdmin || esSuperAdmin) && (
                    <button type="button" className="btn-secondary tc-btn" disabled={!deportistasFiltrados.length} onClick={() => setAvisoWsp({ titulo: `WhatsApp a apoderados (${deportistasFiltrados.length} deportistas)`, destinatarios: destinatariosApoderados(deportistasFiltrados) })}>
                      <Megaphone size={13} /> WhatsApp apoderados
                    </button>
                  )}
                </div>

                {barraSeleccionUsuarios(deportistasFiltrados)}
                <div style={{ marginTop: '12px', maxHeight: '420px', overflowY: 'auto' }}>
                  {deportistasFiltrados.length === 0 && (
                    <p className="text-muted" style={{ fontStyle: 'italic' }}>No hay deportistas con los filtros actuales.</p>
                  )}
                  {deportistasFiltrados.map(renderTarjetaUsuario)}
                </div>
              </div>
            </>
          )}
          {vistaUsuarios === 'cuentas' && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '8px', marginBottom: '12px' }}>
                <div className="admin-stat-pill verde"><span>Completas</span><h2>{cuentasAdminTodas.length - cuentasIncompletas.length}</h2></div>
                <div className="admin-stat-pill" style={{ background: 'rgba(255,149,0,0.1)' }}><span>Incompletas</span><h2 style={{ color: '#8A4B00' }}>{cuentasIncompletas.length}</h2></div>
                <div className="admin-stat-pill azul"><span>Total</span><h2>{cuentasAdminTodas.length}</h2></div>
              </div>

              <div className="card">
                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '10px' }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label>Buscar</label>
                    <div style={{ position: 'relative' }}>
                      <Search size={15} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--texto-secundario)' }} />
                      <input
                        className="form-input"
                        style={{ paddingLeft: '32px' }}
                        placeholder="Nombre, correo, RUT o rol"
                        value={filtroCuentasTexto}
                        onChange={(e) => setFiltroCuentasTexto(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label>Tipo de perfil</label>
                    <select className="form-input" value={filtroTipoPerfil} onChange={(e) => setFiltroTipoPerfil(e.target.value)}>
                      <option value="todos">Todos</option>
                      <option value="apoderado">Apoderado</option>
                      <option value="socio">Socio</option>
                      <option value="socio_apoderado">Socio / Apoderado</option>
                      <option value="directiva">Directiva</option>
                      <option value="staff">Staff</option>
                      <option value="admin">Admin</option>
                      <option value="super_admin">Super Admin</option>
                      <option value="jugador">Deportista con login propio</option>
                    </select>
                  </div>
                </div>

                <div className="filter-chips" style={{ marginTop: '10px' }}>
                  {botonesExportar({
                    cantidad: cuentasUsuariosFiltradas.length,
                    archivo: `cuentas-${[filtroTipoPerfil, filtroEstadoUsuarios].filter((f) => f !== 'todos').join('-')}-${hoyLocalISO()}`,
                    armar: () => listadoCuentas(cuentasUsuariosFiltradas.map((u) => u.raw), jugadoresAdminTodos || []),
                    titulo: 'Cuentas y pupilos',
                    subtitulo: [filtroTipoPerfil !== 'todos' && `Perfil ${filtroTipoPerfil}`, ETIQUETA_FILTRO_ESTADO[filtroEstadoUsuarios]].filter(Boolean).join(' · '),
                  })}
                  {(esAdmin || esSuperAdmin) && (
                    <button type="button" className="btn-secondary tc-btn" disabled={!cuentasUsuariosFiltradas.length} onClick={() => setAvisoWsp({
                      titulo: `WhatsApp a ${cuentasUsuariosFiltradas.length} cuentas`,
                      destinatarios: cuentasUsuariosFiltradas.map((u) => ({ clave: u.id, nombre: u.nombre, telefono: u.raw.telefono ? `${u.raw.prefijo_tel || '+56'} ${u.raw.telefono}` : '', detalle: u.raw.perfil_principal || u.raw.rol || '' })),
                    })}>
                      <Megaphone size={13} /> WhatsApp
                    </button>
                  )}
                </div>
                {barraSeleccionUsuarios(cuentasUsuariosFiltradas)}
                <div style={{ marginTop: '12px', maxHeight: '420px', overflowY: 'auto' }}>
                  {cuentasUsuariosFiltradas.length === 0 && (
                    <p className="text-muted" style={{ fontStyle: 'italic' }}>No hay cuentas con los filtros actuales.</p>
                  )}
                  {cuentasUsuariosFiltradas.map(renderTarjetaUsuario)}
                </div>
              </div>
            </>
          )}

          {vistaUsuarios === 'padron' && (esAdmin || esSuperAdmin) && (
            <RevisionPadronPanel
              jugadores={jugadoresAdminTodos || []}
              cuentas={cuentasAdminTodas || []}
              onRecargar={recargarUsuariosAdmin}
              onVerFicha={(j) => setFichaPersona({ tipo: 'jugador', raw: j })}
            />
          )}
          {vistaUsuarios === 'vincular' && esSuperAdmin && (
            <ImportarJugadoresPlanilla onAplicado={recargarUsuariosAdmin} />
          )}
          {vistaUsuarios === 'vincular' && (
            <VincularApoderadosPanel
              jugadores={jugadoresAdmin}
              cuentas={cuentasAdmin}
              onRecargar={recargarUsuariosAdmin}
              onVerFicha={(j) => setFichaPersona({ tipo: 'jugador', raw: j })}
            />
          )}

          {vistaUsuarios === 'registrar' && formularioRegistrar}
          {children}
        </div>
      )}

      {avisoWsp && <AvisoWhatsappLista titulo={avisoWsp.titulo} destinatarios={avisoWsp.destinatarios} onCerrar={() => setAvisoWsp(null)} />}
    </>
  );
}
