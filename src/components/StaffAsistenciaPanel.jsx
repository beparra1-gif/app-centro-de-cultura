import { useMemo, useState } from 'react';
import { useSwipeable } from 'react-swipeable';
import {
  Save, Check, X, LayoutGrid, List, Search,
  Trash2, Pencil, ChevronDown, ChevronUp, Calendar, Loader2,
} from 'lucide-react';
import { showToast } from '../utils/toast';
import { confirmAction } from '../utils/confirmDialog';
import * as api from '../api/client';
import LogoAvatar from './LogoAvatar';

const ESTADO_COLOR = {
  presente: { bg: 'var(--verde-victoria)', bgSoft: 'rgba(52,199,89,0.10)' },
  ausente: { bg: 'var(--rojo-alerta)', bgSoft: 'rgba(255,59,48,0.10)' },
  justificado: { bg: '#FF9500', bgSoft: 'rgba(255,149,0,0.10)' },
  pendiente: { bg: 'var(--texto-secundario)', bgSoft: 'rgba(15,23,42,0.06)' },
};

const etiquetaEstado = (estado) => (estado === 'presente' ? 'Presente' : estado === 'ausente' ? 'Ausente' : estado === 'justificado' ? 'Justificado' : 'Pendiente');

function FilaJugadorSwipe({ jugador, onPresente, onAusente }) {
  const [dragX, setDragX] = useState(0);
  const handlers = useSwipeable({
    onSwiping: (e) => setDragX(Math.max(-110, Math.min(110, e.deltaX))),
    onSwiped: () => setDragX(0),
    onSwipedRight: () => onPresente(jugador),
    onSwipedLeft: () => onAusente(jugador),
    trackMouse: true,
    delta: 45,
  });

  const estado = jugador.estadoAsistencia || 'pendiente';
  const colores = ESTADO_COLOR[estado] || ESTADO_COLOR.pendiente;

  return (
    <div style={{ position: 'relative', borderRadius: '16px', overflow: 'hidden', marginBottom: '10px' }}>
      <div style={{
        position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
        justifyContent: dragX > 0 ? 'flex-start' : 'flex-end', padding: '0 18px',
        background: dragX > 0 ? 'var(--verde-victoria)' : dragX < 0 ? 'var(--rojo-alerta)' : 'transparent',
        color: 'white', fontWeight: '900', fontSize: '13px',
      }}>
        {dragX > 6 && <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}><Check size={16} /> PRESENTE</span>}
        {dragX < -6 && <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>AUSENTE <X size={16} /></span>}
      </div>
      <div
        {...handlers}
        style={{
          position: 'relative', display: 'flex', flexDirection: 'column', gap: '8px',
          padding: '14px', borderRadius: '16px', background: 'var(--blanco-tarjeta)',
          borderLeft: `4px solid ${colores.bg}`,
          transform: `translateX(${dragX}px)`, transition: dragX === 0 ? 'transform 0.25s ease' : 'none',
          touchAction: 'pan-y', cursor: 'grab', boxShadow: '0 2px 8px rgba(15,23,42,0.05)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
          <div>
            <strong style={{ fontSize: '14px', color: 'var(--texto-principal)' }}>{jugador.nombre}</strong>
            <div style={{ fontSize: '11px', color: 'var(--texto-secundario)', fontWeight: '700' }}>{jugador.rama || 'Sin rama'} · {jugador.categoria || 'Sin categoría'}</div>
          </div>
          <span style={{ fontSize: '10px', fontWeight: '900', padding: '4px 9px', borderRadius: '999px', background: colores.bgSoft, color: colores.bg, textTransform: 'uppercase' }}>
            {etiquetaEstado(estado)}
          </span>
        </div>
        <div style={{ display: 'flex', gap: '6px' }}>
          <button onClick={() => onPresente(jugador)} style={{ flex: 1, padding: '8px', border: 'none', borderRadius: '10px', fontWeight: '800', fontSize: '10px', background: estado === 'presente' ? 'var(--verde-victoria)' : 'rgba(52,199,89,0.10)', color: estado === 'presente' ? 'white' : 'var(--texto-secundario)' }}>PRESENTE</button>
          <button onClick={() => onAusente(jugador)} style={{ flex: 1, padding: '8px', border: 'none', borderRadius: '10px', fontWeight: '800', fontSize: '10px', background: (estado === 'ausente' || estado === 'justificado') ? colores.bg : 'rgba(255,59,48,0.08)', color: (estado === 'ausente' || estado === 'justificado') ? 'white' : 'var(--texto-secundario)' }}>AUSENTE</button>
        </div>
        <span style={{ fontSize: '9px', color: 'var(--texto-secundario)', textAlign: 'center', fontWeight: '700' }}>Desliza la tarjeta → presente · ← ausente</span>
      </div>
    </div>
  );
}

function TarjetaJugadorGrid({ jugador, onPresente, onAusente }) {
  const estado = jugador.estadoAsistencia || 'pendiente';
  const colores = ESTADO_COLOR[estado] || ESTADO_COLOR.pendiente;
  return (
    <div style={{ borderRadius: '16px', padding: '12px', background: 'var(--blanco-tarjeta)', borderTop: `4px solid ${colores.bg}`, boxShadow: '0 2px 8px rgba(15,23,42,0.05)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <div style={{ textAlign: 'center' }}>
        <strong style={{ fontSize: '12px', display: 'block', color: 'var(--texto-principal)' }}>{jugador.nombre}</strong>
        <span style={{ fontSize: '10px', color: 'var(--texto-secundario)', fontWeight: '700' }}>{jugador.categoria || 'Sin categoría'}</span>
      </div>
      <span style={{ fontSize: '9px', fontWeight: '900', padding: '3px 8px', borderRadius: '999px', background: colores.bgSoft, color: colores.bg, textTransform: 'uppercase', textAlign: 'center' }}>
        {etiquetaEstado(estado)}
      </span>
      <div style={{ display: 'flex', gap: '5px' }}>
        <button onClick={() => onPresente(jugador)} style={{ flex: 1, padding: '7px', border: 'none', borderRadius: '9px', fontWeight: '800', fontSize: '9px', background: estado === 'presente' ? 'var(--verde-victoria)' : 'rgba(52,199,89,0.10)', color: estado === 'presente' ? 'white' : 'var(--texto-secundario)' }}><Check size={11} /></button>
        <button onClick={() => onAusente(jugador)} style={{ flex: 1, padding: '7px', border: 'none', borderRadius: '9px', fontWeight: '800', fontSize: '9px', background: (estado === 'ausente' || estado === 'justificado') ? colores.bg : 'rgba(255,59,48,0.08)', color: (estado === 'ausente' || estado === 'justificado') ? 'white' : 'var(--texto-secundario)' }}><X size={11} /></button>
      </div>
    </div>
  );
}

function StaffAsistenciaPanel({
  usuarioAutenticado,
  vistaStaff,
  setVistaStaff,
  filtroRamaStaff,
  setFiltroRamaStaff,
  rosterEquipo,
  setRosterEquipo,
}) {
  const [fechaLista, setFechaLista] = useState(() => new Date().toISOString().slice(0, 10));
  const [horaInicio, setHoraInicio] = useState('18:00');
  const [horaFin, setHoraFin] = useState('19:30');
  const [categoriasSeleccionadas, setCategoriasSeleccionadas] = useState([]);
  const [modoVista, setModoVista] = useState('lista');
  const [guardandoSesion, setGuardandoSesion] = useState(false);

  const [sesiones, setSesiones] = useState([]);
  const [cargandoSesiones, setCargandoSesiones] = useState(false);
  const [sesionExpandidaId, setSesionExpandidaId] = useState(null);
  const [detalleSesion, setDetalleSesion] = useState([]);
  const [cargandoDetalle, setCargandoDetalle] = useState(false);
  const [editandoRegistroId, setEditandoRegistroId] = useState(null);

  const [filtroResumenRama, setFiltroResumenRama] = useState('todas');
  const [filtroResumenCategoria, setFiltroResumenCategoria] = useState('');
  const [filtroResumenProfesor, setFiltroResumenProfesor] = useState('');
  const [filtroResumenDesde, setFiltroResumenDesde] = useState('');
  const [filtroResumenHasta, setFiltroResumenHasta] = useState('');
  const [resumenSesiones, setResumenSesiones] = useState([]);
  const [cargandoResumen, setCargandoResumen] = useState(false);

  const nombreEntrenador = `${usuarioAutenticado?.nombres || ''} ${usuarioAutenticado?.apellido_paterno || ''}`.trim() || usuarioAutenticado?.correo || 'Staff';

  const categoriasDisponibles = useMemo(() => {
    const setCategorias = new Set(
      (rosterEquipo || []).map((j) => String(j.categoria || '').trim()).filter(Boolean)
    );
    return Array.from(setCategorias).sort((a, b) => a.localeCompare(b, 'es'));
  }, [rosterEquipo]);

  const rosterFiltrado = useMemo(() => {
    return (rosterEquipo || []).filter((j) => {
      const rama = String(j.rama || '').toLowerCase();
      const categoria = String(j.categoria || '').trim();
      const coincideRama = filtroRamaStaff === 'todas' || rama === String(filtroRamaStaff || '').toLowerCase();
      const coincideCategoria = categoriasSeleccionadas.length === 0 || categoriasSeleccionadas.includes(categoria);
      return coincideRama && coincideCategoria;
    });
  }, [rosterEquipo, filtroRamaStaff, categoriasSeleccionadas]);

  const presentes = rosterFiltrado.filter(j => j.estadoAsistencia === 'presente').length;
  const ausentes = rosterFiltrado.filter(j => j.estadoAsistencia === 'ausente').length;
  const justificados = rosterFiltrado.filter(j => j.estadoAsistencia === 'justificado').length;
  const totalLista = rosterFiltrado.length;
  const baseAsistencia = Math.max(totalLista - justificados, 1);
  const porcentaje = totalLista > 0 ? Math.round((presentes / baseAsistencia) * 100) : 0;

  const cambiarEstado = (id, nuevoEstado) => {
    setRosterEquipo(rosterEquipo.map(j => j.id === id ? { ...j, estadoAsistencia: nuevoEstado } : j));
  };

  const marcarPresente = (jugador) => cambiarEstado(jugador.id, 'presente');

  const marcarAusente = async (jugador) => {
    const justificada = await confirmAction({
      title: 'Registrar ausencia',
      message: `¿La ausencia de ${jugador.nombre} está justificada (licencia médica, aviso previo, etc.)?`,
      confirmText: 'Sí, justificada',
      cancelText: 'No, sin aviso',
    });
    cambiarEstado(jugador.id, justificada ? 'justificado' : 'ausente');
  };

  const toggleCategoria = (categoria) => {
    setCategoriasSeleccionadas((prev) => (
      prev.includes(categoria)
        ? prev.filter((c) => c !== categoria)
        : [...prev, categoria]
    ));
  };

  const guardarSesionAsistencia = async () => {
    if (rosterFiltrado.length === 0) {
      showToast({ message: 'No hay jugadores para guardar en esta lista.', type: 'error' });
      return;
    }
    if (!(await confirmAction({
      title: 'Cerrar asistencia',
      message: '¿Estás seguro de cerrar la asistencia de esta sesión? Se guardará y la lista quedará lista para una nueva.',
      confirmText: 'Confirmar y guardar',
    }))) {
      return;
    }
    setGuardandoSesion(true);
    try {
      await api.asistenciaAPI.crearSesion({
        fecha: fechaLista,
        rama: filtroRamaStaff === 'todas' ? null : filtroRamaStaff,
        hora_inicio: horaInicio,
        hora_fin: horaFin,
        entrenador_cargo: nombreEntrenador,
        registros: rosterFiltrado.map((j) => ({
          rut_jugador: j.rut_jugador || j.rut || null,
          nombre_jugador: j.nombre,
          categoria: j.categoria || '',
          estado_asistencia: j.estadoAsistencia || 'pendiente',
          observacion: j.estadoAsistencia === 'justificado' ? 'Justificada' : null,
        })),
      });
      showToast({ message: `Asistencia guardada: ${presentes} presentes, ${ausentes} ausentes, ${justificados} justificados.`, type: 'success' });
      setRosterEquipo(rosterEquipo.map((j) => ({ ...j, estadoAsistencia: 'pendiente' })));
      setFechaLista(new Date().toISOString().slice(0, 10));
      setHoraInicio('18:00');
      setHoraFin('19:30');
      setCategoriasSeleccionadas([]);
      cargarSesiones();
    } catch (error) {
      showToast({ message: error.message || 'No se pudo guardar la asistencia.', type: 'error' });
    } finally {
      setGuardandoSesion(false);
    }
  };

  const cargarSesiones = async () => {
    setCargandoSesiones(true);
    try {
      const datos = await api.asistenciaAPI.getSesiones();
      setSesiones(Array.isArray(datos) ? datos : []);
    } catch (error) {
      showToast({ message: error.message || 'No se pudo cargar el historial.', type: 'error' });
    } finally {
      setCargandoSesiones(false);
    }
  };

  const cargarResumen = async () => {
    setCargandoResumen(true);
    try {
      const datos = await api.asistenciaAPI.getSesiones({
        rama: filtroResumenRama !== 'todas' ? filtroResumenRama : undefined,
        categoria: filtroResumenCategoria || undefined,
        entrenador: filtroResumenProfesor || undefined,
        desde: filtroResumenDesde || undefined,
        hasta: filtroResumenHasta || undefined,
      });
      setResumenSesiones(Array.isArray(datos) ? datos : []);
    } catch (error) {
      showToast({ message: error.message || 'No se pudo cargar el resumen.', type: 'error' });
    } finally {
      setCargandoResumen(false);
    }
  };

  const irAHistorial = () => {
    setVistaStaff('historial');
    cargarSesiones();
  };

  const irAResumen = () => {
    setVistaStaff('resumen');
    cargarResumen();
  };

  const expandirSesion = async (sesionId) => {
    if (sesionExpandidaId === sesionId) {
      setSesionExpandidaId(null);
      setDetalleSesion([]);
      return;
    }
    setSesionExpandidaId(sesionId);
    setCargandoDetalle(true);
    try {
      const datos = await api.asistenciaAPI.getSesion(sesionId);
      setDetalleSesion(Array.isArray(datos) ? datos : []);
    } catch (error) {
      showToast({ message: error.message || 'No se pudo cargar el detalle.', type: 'error' });
    } finally {
      setCargandoDetalle(false);
    }
  };

  const guardarEdicionRegistro = async (registro, nuevoEstado) => {
    try {
      const actualizado = await api.asistenciaAPI.actualizarRegistro(registro.id_asistencia, { estado_asistencia: nuevoEstado });
      setDetalleSesion((prev) => prev.map((r) => (r.id_asistencia === registro.id_asistencia ? actualizado : r)));
      cargarSesiones();
      setEditandoRegistroId(null);
      showToast({ message: 'Registro actualizado.', type: 'success' });
    } catch (error) {
      showToast({ message: error.message || 'No se pudo editar el registro.', type: 'error' });
    }
  };

  const borrarRegistro = async (registro) => {
    if (!(await confirmAction({ title: 'Quitar registro', message: `¿Quitar a ${registro.nombre_jugador} de esta sesión?`, danger: true }))) return;
    try {
      await api.asistenciaAPI.borrarRegistro(registro.id_asistencia);
      setDetalleSesion((prev) => prev.filter((r) => r.id_asistencia !== registro.id_asistencia));
      showToast({ message: 'Registro eliminado.', type: 'success' });
      cargarSesiones();
    } catch (error) {
      showToast({ message: error.message || 'No se pudo eliminar el registro.', type: 'error' });
    }
  };

  const borrarSesionCompleta = async (sesion) => {
    if (!(await confirmAction({ title: 'Borrar sesión completa', message: `¿Borrar toda la lista del ${sesion.fecha ? String(sesion.fecha).slice(0, 10) : ''}? Se eliminarán los ${sesion.total} registros.`, danger: true }))) return;
    try {
      await api.asistenciaAPI.borrarSesion(sesion.sesion_id);
      setSesiones((prev) => prev.filter((s) => s.sesion_id !== sesion.sesion_id));
      if (sesionExpandidaId === sesion.sesion_id) { setSesionExpandidaId(null); setDetalleSesion([]); }
      showToast({ message: 'Sesión eliminada.', type: 'success' });
    } catch (error) {
      showToast({ message: error.message || 'No se pudo eliminar la sesión.', type: 'error' });
    }
  };

  const totalesResumen = useMemo(() => {
    return resumenSesiones.reduce((acc, s) => ({
      sesiones: acc.sesiones + 1,
      total: acc.total + Number(s.total || 0),
      presentes: acc.presentes + Number(s.presentes || 0),
      ausentes: acc.ausentes + Number(s.ausentes || 0),
      justificados: acc.justificados + Number(s.justificados || 0),
    }), { sesiones: 0, total: 0, presentes: 0, ausentes: 0, justificados: 0 });
  }, [resumenSesiones]);
  const porcentajeResumen = totalesResumen.total > 0 ? Math.round((totalesResumen.presentes / totalesResumen.total) * 100) : 0;

  return (
    <div className="mt-20 fade-in">
      <div className="segment-control mb-20">
        <button type="button" className={`segment-btn ${vistaStaff === 'asistencia' ? 'active' : ''}`} onClick={() => setVistaStaff('asistencia')}>Pasar Lista</button>
        <button type="button" className={`segment-btn ${vistaStaff === 'historial' ? 'active' : ''}`} onClick={irAHistorial}>Historial</button>
        <button type="button" className={`segment-btn ${vistaStaff === 'resumen' ? 'active' : ''}`} onClick={irAResumen}>Resumen</button>
      </div>

      {vistaStaff === 'asistencia' && (
        <div className="card" style={{ borderRadius: '24px' }}>
          <h4 className="form-subtitle" style={{ fontWeight: '900' }}>Configurar Entrenamiento</h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '10px' }} className="mb-15">
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Rama</label>
              <select className="form-input" value={filtroRamaStaff} onChange={(e) => setFiltroRamaStaff(e.target.value)}>
                <option value="todas">Todas</option>
                <option value="masculina">Masculina</option>
                <option value="femenina">Femenina</option>
                <option value="mixta">Mixta</option>
              </select>
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Fecha</label>
              <input type="date" className="form-input" value={fechaLista} onChange={(e) => setFechaLista(e.target.value)} />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Hora inicio</label>
              <input type="time" className="form-input" value={horaInicio} onChange={(e) => setHoraInicio(e.target.value)} />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Hora fin</label>
              <input type="time" className="form-input" value={horaFin} onChange={(e) => setHoraFin(e.target.value)} />
            </div>
          </div>

          <div className="mb-15">
            <label style={{ fontSize: '12px', fontWeight: '800', color: 'var(--texto-secundario)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
              Categorías del entrenamiento
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '8px' }}>
              {categoriasDisponibles.map((cat) => {
                const activa = categoriasSeleccionadas.includes(cat);
                return (
                  <button
                    key={`cat-staff-${cat}`}
                    type="button"
                    className="filter-chip"
                    style={{
                      border: '1px solid rgba(0,122,255,0.24)',
                      background: activa ? 'var(--azul-electrico)' : 'rgba(0,122,255,0.08)',
                      color: activa ? 'white' : 'var(--azul-electrico)',
                      fontWeight: '800',
                    }}
                    onClick={() => toggleCategoria(cat)}
                  >
                    {cat}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="staff-header-info mb-15" style={{ borderBottom: '1px solid rgba(0,0,0,0.05)', paddingBottom: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <LogoAvatar nombre={`${categoriasSeleccionadas.join(' / ') || 'Todas'} ${filtroRamaStaff}`} size={38} borderRadius="12px" />
              <div>
                <h4 style={{ margin: '0 0 5px 0', color: 'var(--texto-heading)' }}>
                  Nómina: {filtroRamaStaff === 'todas' ? 'Todas las ramas' : filtroRamaStaff} · {categoriasSeleccionadas.length > 0 ? categoriasSeleccionadas.join(', ') : 'Todas las categorías'}
                </h4>
                <span style={{ fontSize: '11px', color: 'var(--texto-secundario)', fontWeight: '700' }}>
                  Fecha: {fechaLista} · Horario: {horaInicio} - {horaFin} · A cargo: {nombreEntrenador}
                </span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '4px', background: 'var(--fondo-input)', borderRadius: '12px', padding: '4px' }}>
              <button type="button" onClick={() => setModoVista('lista')} style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '7px 11px', borderRadius: '9px', border: 'none', fontSize: '11px', fontWeight: '800', background: modoVista === 'lista' ? 'var(--blanco-tarjeta)' : 'transparent', color: modoVista === 'lista' ? 'var(--texto-principal)' : 'var(--texto-secundario)', boxShadow: modoVista === 'lista' ? '0 2px 6px rgba(0,0,0,0.08)' : 'none' }}><List size={13} /> Lista</button>
              <button type="button" onClick={() => setModoVista('cuadricula')} style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '7px 11px', borderRadius: '9px', border: 'none', fontSize: '11px', fontWeight: '800', background: modoVista === 'cuadricula' ? 'var(--blanco-tarjeta)' : 'transparent', color: modoVista === 'cuadricula' ? 'var(--texto-principal)' : 'var(--texto-secundario)', boxShadow: modoVista === 'cuadricula' ? '0 2px 6px rgba(0,0,0,0.08)' : 'none' }}><LayoutGrid size={13} /> Cuadrícula</button>
            </div>
          </div>

          {modoVista === 'lista' ? (
            <div className="roster-list">
              {rosterFiltrado.map(jugador => (
                <FilaJugadorSwipe key={jugador.id} jugador={jugador} onPresente={marcarPresente} onAusente={marcarAusente} />
              ))}
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '10px' }}>
              {rosterFiltrado.map(jugador => (
                <TarjetaJugadorGrid key={jugador.id} jugador={jugador} onPresente={marcarPresente} onAusente={marcarAusente} />
              ))}
            </div>
          )}
          {rosterFiltrado.length === 0 && (
            <p className="text-center text-muted" style={{ fontSize: '13px', fontStyle: 'italic', margin: '16px 0' }}>
              No hay jugadores para los filtros seleccionados.
            </p>
          )}

          <div className="mt-20" style={{ background: 'rgba(0,122,255,0.05)', borderRadius: '22px', padding: '20px' }}>
            <h5 style={{ margin: '0 0 15px 0', fontSize: '15px', color: 'var(--texto-heading)' }}>Resumen a Guardar:</h5>
            <div className="desglose-row"><span>Asistencia Efectiva:</span><strong style={{ color: porcentaje > 70 ? 'var(--verde-victoria)' : 'var(--rojo-alerta)', fontSize: '16px' }}>{porcentaje}%</strong></div>
            <div className="desglose-row"><span>Presentes en Cancha:</span><strong>{presentes}</strong></div>
            <div className="desglose-row"><span>Ausentes (Sin aviso):</span><strong style={{ color: 'var(--rojo-alerta)' }}>{ausentes}</strong></div>
            <div className="desglose-row"><span>Con Licencia Médica:</span><strong style={{ color: '#FF9500' }}>{justificados}</strong></div>
          </div>

          <button className="btn-electric mt-20" onClick={guardarSesionAsistencia} disabled={guardandoSesion}>
            {guardandoSesion ? <Loader2 size={18} className="spin" /> : <Save size={18} />} {guardandoSesion ? 'Guardando...' : 'Confirmar y Guardar Asistencia'}
          </button>
        </div>
      )}

      {vistaStaff === 'historial' && (
        <div className="card fade-in" style={{ borderRadius: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h4 className="form-subtitle" style={{ fontWeight: '900', margin: 0 }}><Calendar size={16} /> Registros Anteriores</h4>
            {cargandoSesiones && <Loader2 size={16} className="spin" />}
          </div>

          {!cargandoSesiones && sesiones.length === 0 && (
            <p className="text-center text-muted" style={{ fontStyle: 'italic', fontSize: '13px' }}>Todavía no hay listas de asistencia guardadas.</p>
          )}

          {sesiones.map((sesion) => {
            const abierta = sesionExpandidaId === sesion.sesion_id;
            const pct = Number(sesion.total) > 0 ? Math.round((Number(sesion.presentes) / Number(sesion.total)) * 100) : 0;
            return (
              <div key={sesion.sesion_id} style={{ border: '1px solid rgba(0,0,0,0.06)', borderRadius: '16px', padding: '12px', marginBottom: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <div>
                    <strong style={{ fontSize: '13px' }}>{sesion.fecha ? String(sesion.fecha).slice(0, 10) : 'Sin fecha'} · {sesion.rama || 'Sin rama'}</strong>
                    <div style={{ fontSize: '11px', color: 'var(--texto-secundario)', fontWeight: '700', marginTop: '3px' }}>
                      {(sesion.categorias || []).join(', ') || 'Todas las categorías'} · {sesion.entrenador_cargo || 'Sin entrenador'} · {sesion.hora_inicio || '--'}-{sesion.hora_fin || '--'}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '11px', fontWeight: '900', color: pct >= 70 ? 'var(--verde-victoria)' : 'var(--rojo-alerta)' }}>{pct}%</span>
                    <button className="btn-secondary" style={{ width: 'auto', padding: '7px 10px' }} onClick={() => expandirSesion(sesion.sesion_id)}>
                      {abierta ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                    <button className="btn-secondary" style={{ width: 'auto', padding: '7px 10px', borderColor: 'rgba(255,59,48,0.35)', color: '#b91c1c' }} onClick={() => borrarSesionCompleta(sesion)}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                <div style={{ marginTop: '8px', fontSize: '11px', color: 'var(--texto-secundario)', fontWeight: '700' }}>
                  Presentes {sesion.presentes} · Ausentes {sesion.ausentes} · Justificados {sesion.justificados} · Total {sesion.total}
                </div>

                {abierta && (
                  <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {cargandoDetalle && <Loader2 size={16} className="spin" />}
                    {!cargandoDetalle && detalleSesion.map((registro) => {
                      const colores = ESTADO_COLOR[registro.estado_asistencia] || ESTADO_COLOR.pendiente;
                      const editando = editandoRegistroId === registro.id_asistencia;
                      return (
                        <div key={registro.id_asistencia} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', background: 'var(--fondo-app)', borderRadius: '10px', padding: '8px', flexWrap: 'wrap' }}>
                          <div>
                            <div style={{ fontSize: '12px', fontWeight: '800' }}>{registro.nombre_jugador}</div>
                            <div style={{ fontSize: '10px', color: 'var(--texto-secundario)' }}>{registro.categoria}</div>
                          </div>
                          {editando ? (
                            <div style={{ display: 'flex', gap: '5px' }}>
                              {['presente', 'ausente', 'justificado'].map((opcion) => (
                                <button key={opcion} onClick={() => guardarEdicionRegistro(registro, opcion)} style={{ padding: '5px 8px', borderRadius: '8px', border: 'none', fontSize: '9px', fontWeight: '800', background: (ESTADO_COLOR[opcion] || {}).bgSoft, color: (ESTADO_COLOR[opcion] || {}).bg }}>
                                  {etiquetaEstado(opcion)}
                                </button>
                              ))}
                            </div>
                          ) : (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span style={{ fontSize: '9px', fontWeight: '900', padding: '3px 8px', borderRadius: '999px', background: colores.bgSoft, color: colores.bg }}>{etiquetaEstado(registro.estado_asistencia)}</span>
                              <button onClick={() => setEditandoRegistroId(registro.id_asistencia)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: 'var(--texto-secundario)' }}><Pencil size={13} /></button>
                              <button onClick={() => borrarRegistro(registro)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: '#b91c1c' }}><Trash2 size={13} /></button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {vistaStaff === 'resumen' && (
        <div className="card fade-in" style={{ borderRadius: '24px' }}>
          <h4 className="form-subtitle" style={{ fontWeight: '900' }}><Search size={16} /> Resumen de Asistencia</h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '10px' }} className="mb-15">
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Rama</label>
              <select className="form-input" value={filtroResumenRama} onChange={(e) => setFiltroResumenRama(e.target.value)}>
                <option value="todas">Todas</option>
                <option value="masculina">Masculina</option>
                <option value="femenina">Femenina</option>
                <option value="mixta">Mixta</option>
              </select>
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Categoría</label>
              <input className="form-input" placeholder="Ej: U15" value={filtroResumenCategoria} onChange={(e) => setFiltroResumenCategoria(e.target.value)} />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Profesor / entrenador</label>
              <input className="form-input" placeholder="Nombre..." value={filtroResumenProfesor} onChange={(e) => setFiltroResumenProfesor(e.target.value)} />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Desde</label>
              <input type="date" className="form-input" value={filtroResumenDesde} onChange={(e) => setFiltroResumenDesde(e.target.value)} />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Hasta</label>
              <input type="date" className="form-input" value={filtroResumenHasta} onChange={(e) => setFiltroResumenHasta(e.target.value)} />
            </div>
          </div>
          <button className="btn-electric mb-15" style={{ width: 'auto', padding: '10px 18px' }} onClick={cargarResumen} disabled={cargandoResumen}>
            <Search size={15} /> {cargandoResumen ? 'Buscando...' : 'Buscar'}
          </button>

          {cargandoResumen ? (
            <Loader2 size={18} className="spin" />
          ) : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '8px' }} className="mb-15">
                <div className="admin-stat-pill azul"><span>Sesiones</span><h2>{totalesResumen.sesiones}</h2></div>
                <div className="admin-stat-pill verde"><span>% Asistencia</span><h2>{porcentajeResumen}%</h2></div>
                <div className="admin-stat-pill verde"><span>Presentes</span><h2>{totalesResumen.presentes}</h2></div>
                <div className="admin-stat-pill rojo"><span>Ausentes</span><h2>{totalesResumen.ausentes}</h2></div>
                <div className="admin-stat-pill"><span>Justificados</span><h2>{totalesResumen.justificados}</h2></div>
              </div>

              {resumenSesiones.length === 0 && (
                <p className="text-center text-muted" style={{ fontStyle: 'italic', fontSize: '13px' }}>Sin resultados para estos filtros.</p>
              )}
              {resumenSesiones.map((sesion) => (
                <div key={sesion.sesion_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', padding: '10px', borderBottom: '1px solid rgba(0,0,0,0.05)', flexWrap: 'wrap' }}>
                  <div>
                    <strong style={{ fontSize: '12px' }}>{sesion.fecha ? String(sesion.fecha).slice(0, 10) : 'Sin fecha'} · {sesion.rama || 'Sin rama'}</strong>
                    <div style={{ fontSize: '11px', color: 'var(--texto-secundario)' }}>{(sesion.categorias || []).join(', ') || 'Todas'} · {sesion.entrenador_cargo || 'Sin entrenador'}</div>
                  </div>
                  <span style={{ fontSize: '11px', fontWeight: '800', color: 'var(--texto-secundario)' }}>{sesion.presentes}/{sesion.total} presentes</span>
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default StaffAsistenciaPanel;
