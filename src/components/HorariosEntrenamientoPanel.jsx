import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, Plus, Trash2 } from 'lucide-react';
import * as api from '../api/client';
import { showToast } from '../utils/toast';
import { confirmAction } from '../utils/confirmDialog';
import { colorBarraPorRama } from '../utils/coloresRama';
import CalendarioGrilla from './CalendarioGrilla';

const DIAS_SEMANA_CORTO = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const DIAS_MES = Array.from({ length: 31 }, (_, i) => i + 1);

// Describe el patrón de recurrencia de un horario para mostrarlo en listas y
// selects, sin repetir esta lógica en cada lugar que lo necesita.
const describirRecurrencia = (h) => {
  if (h.tipo_recurrencia === 'mensual') {
    const dias = Array.isArray(h.dias_mes) ? h.dias_mes : [];
    return dias.length ? `Día${dias.length > 1 ? 's' : ''} ${dias.join(', ')} de cada mes` : 'Mensual';
  }
  const dias = Array.isArray(h.dias_semana) ? h.dias_semana : [];
  return dias.length ? dias.map((d) => DIAS_SEMANA_CORTO[d]).join(', ') : 'Semanal';
};

const describirVigencia = (h) => {
  const ini = h.fecha_inicio ? String(h.fecha_inicio).slice(0, 10) : null;
  const fin = h.fecha_fin ? String(h.fecha_fin).slice(0, 10) : null;
  if (ini && fin) return `Vigente ${ini} a ${fin}`;
  if (ini) return `Vigente desde ${ini}`;
  if (fin) return `Vigente hasta ${fin}`;
  return '';
};

const HORARIO_FORM_VACIO = {
  rama: 'Mixta',
  categoria: '',
  tipo_recurrencia: 'semanal',
  dias_semana: [1],
  dias_mes: [],
  fecha_inicio: '',
  fecha_fin: '',
  hora_inicio: '18:00',
  hora_fin: '19:30',
  lugar: '',
  entrenador_a_cargo: '',
};

const EXCEPCION_FORM_VACIO = {
  fecha: new Date().toISOString().slice(0, 10),
  tipo: 'cancelado',
  hora_inicio_nueva: '',
  hora_fin_nueva: '',
  lugar_nuevo: '',
  motivo: '',
};

function HorariosEntrenamientoPanel() {
  const [vista, setVista] = useState('horarios');
  const [horarios, setHorarios] = useState([]);
  const [cargando, setCargando] = useState(false);

  const [mostrarForm, setMostrarForm] = useState(false);
  const [horarioForm, setHorarioForm] = useState(HORARIO_FORM_VACIO);
  const [editandoId, setEditandoId] = useState(null);
  const [guardando, setGuardando] = useState(false);

  const [horarioSeleccionadoId, setHorarioSeleccionadoId] = useState(null);
  const [excepciones, setExcepciones] = useState([]);
  const [cargandoExcepciones, setCargandoExcepciones] = useState(false);
  const [excepcionForm, setExcepcionForm] = useState(EXCEPCION_FORM_VACIO);
  const [guardandoExcepcion, setGuardandoExcepcion] = useState(false);

  const [vistaCalendario, setVistaCalendario] = useState('mes');
  const [fechaFoco, setFechaFoco] = useState(new Date());
  const [rangoCalendario, setRangoCalendario] = useState({ desde: '', hasta: '' });
  const [instancias, setInstancias] = useState([]);
  const [cargandoInstancias, setCargandoInstancias] = useState(false);
  const [instanciaSeleccionada, setInstanciaSeleccionada] = useState(null);

  const cargarHorarios = async () => {
    setCargando(true);
    try {
      const datos = await api.horariosEntrenamientoAPI.getAll();
      setHorarios(Array.isArray(datos) ? datos : []);
    } catch (error) {
      showToast({ message: error.message || 'No se pudieron cargar los horarios.', type: 'error' });
      setHorarios([]);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    (async () => { await cargarHorarios(); })();
  }, []);

  useEffect(() => {
    if (vista !== 'calendario') return;
    if (!rangoCalendario.desde || !rangoCalendario.hasta) return;
    (async () => {
      setCargandoInstancias(true);
      try {
        const datos = await api.horariosEntrenamientoAPI.getInstancias({ desde: rangoCalendario.desde, hasta: rangoCalendario.hasta });
        setInstancias(Array.isArray(datos) ? datos : []);
      } catch (error) {
        showToast({ message: error.message || 'No se pudo cargar el calendario.', type: 'error' });
        setInstancias([]);
      } finally {
        setCargandoInstancias(false);
      }
    })();
  }, [vista, rangoCalendario.desde, rangoCalendario.hasta]);

  useEffect(() => {
    if (!horarioSeleccionadoId) {
      (async () => { setExcepciones([]); })();
      return;
    }
    (async () => {
      setCargandoExcepciones(true);
      try {
        const datos = await api.horariosEntrenamientoAPI.excepciones.getAll(horarioSeleccionadoId);
        setExcepciones(Array.isArray(datos) ? datos : []);
      } catch (error) {
        showToast({ message: error.message || 'No se pudieron cargar las excepciones.', type: 'error' });
        setExcepciones([]);
      } finally {
        setCargandoExcepciones(false);
      }
    })();
  }, [horarioSeleccionadoId]);

  const resetHorarioForm = () => {
    setHorarioForm(HORARIO_FORM_VACIO);
    setEditandoId(null);
    setMostrarForm(false);
  };

  const iniciarEdicionHorario = (h) => {
    setHorarioForm({
      rama: h.rama,
      categoria: h.categoria,
      tipo_recurrencia: h.tipo_recurrencia === 'mensual' ? 'mensual' : 'semanal',
      dias_semana: Array.isArray(h.dias_semana) ? h.dias_semana : [],
      dias_mes: Array.isArray(h.dias_mes) ? h.dias_mes : [],
      fecha_inicio: h.fecha_inicio ? String(h.fecha_inicio).slice(0, 10) : '',
      fecha_fin: h.fecha_fin ? String(h.fecha_fin).slice(0, 10) : '',
      hora_inicio: h.hora_inicio?.slice(0, 5) || '18:00',
      hora_fin: h.hora_fin?.slice(0, 5) || '19:30',
      lugar: h.lugar || '',
      entrenador_a_cargo: h.entrenador_a_cargo || '',
    });
    setEditandoId(h.id_horario);
    setMostrarForm(true);
  };

  const toggleDiaSemana = (idx) => {
    setHorarioForm((p) => {
      const set = new Set(p.dias_semana);
      if (set.has(idx)) set.delete(idx); else set.add(idx);
      return { ...p, dias_semana: [...set].sort((a, b) => a - b) };
    });
  };

  const toggleDiaMes = (dia) => {
    setHorarioForm((p) => {
      const set = new Set(p.dias_mes);
      if (set.has(dia)) set.delete(dia); else set.add(dia);
      return { ...p, dias_mes: [...set].sort((a, b) => a - b) };
    });
  };

  const guardarHorario = async () => {
    if (!horarioForm.categoria.trim()) {
      showToast({ message: 'Ponle una categoría al horario (ej. SUB-14).', type: 'error' });
      return;
    }
    if (horarioForm.tipo_recurrencia === 'semanal' && horarioForm.dias_semana.length === 0) {
      showToast({ message: 'Elige al menos un día de la semana.', type: 'error' });
      return;
    }
    if (horarioForm.tipo_recurrencia === 'mensual' && horarioForm.dias_mes.length === 0) {
      showToast({ message: 'Elige al menos un día del mes.', type: 'error' });
      return;
    }
    if (horarioForm.fecha_inicio && horarioForm.fecha_fin && horarioForm.fecha_fin < horarioForm.fecha_inicio) {
      showToast({ message: 'La fecha de término de vigencia debe ser posterior a la de inicio.', type: 'error' });
      return;
    }
    setGuardando(true);
    try {
      if (editandoId) {
        await api.horariosEntrenamientoAPI.update(editandoId, horarioForm);
        showToast({ message: 'Horario actualizado.', type: 'success' });
      } else {
        await api.horariosEntrenamientoAPI.create(horarioForm);
        showToast({ message: 'Horario creado.', type: 'success' });
      }
      resetHorarioForm();
      await cargarHorarios();
    } catch (error) {
      showToast({ message: error.message || 'No se pudo guardar el horario.', type: 'error' });
    } finally {
      setGuardando(false);
    }
  };

  const borrarHorario = async (h) => {
    if (!(await confirmAction({ title: 'Borrar horario', message: `¿Confirmas borrar el horario de ${h.rama} ${h.categoria} (${describirRecurrencia(h)})? También se borran sus excepciones.`, danger: true }))) return;
    try {
      await api.horariosEntrenamientoAPI.remove(h.id_horario);
      showToast({ message: 'Horario borrado.', type: 'success' });
      if (horarioSeleccionadoId === h.id_horario) setHorarioSeleccionadoId(null);
      await cargarHorarios();
    } catch (error) {
      showToast({ message: error.message || 'No se pudo borrar el horario.', type: 'error' });
    }
  };

  const crearExcepcion = async () => {
    if (!horarioSeleccionadoId) {
      showToast({ message: 'Elige un horario primero.', type: 'error' });
      return;
    }
    if (excepcionForm.tipo === 'reprogramado' && (!excepcionForm.hora_inicio_nueva || !excepcionForm.hora_fin_nueva)) {
      showToast({ message: 'Para reprogramar, indica la nueva hora de inicio y término.', type: 'error' });
      return;
    }
    setGuardandoExcepcion(true);
    try {
      await api.horariosEntrenamientoAPI.excepciones.create(horarioSeleccionadoId, excepcionForm);
      showToast({ message: 'Excepción guardada.', type: 'success' });
      setExcepcionForm(EXCEPCION_FORM_VACIO);
      const datos = await api.horariosEntrenamientoAPI.excepciones.getAll(horarioSeleccionadoId);
      setExcepciones(Array.isArray(datos) ? datos : []);
    } catch (error) {
      showToast({ message: error.message || 'No se pudo guardar la excepción.', type: 'error' });
    } finally {
      setGuardandoExcepcion(false);
    }
  };

  const borrarExcepcion = async (excepcion) => {
    if (!(await confirmAction({ title: 'Quitar excepción', message: `¿Confirmas quitar la excepción del ${excepcion.fecha}? La sesión vuelve a su horario normal.`, danger: true }))) return;
    try {
      await api.horariosEntrenamientoAPI.excepciones.remove(excepcion.id_excepcion);
      showToast({ message: 'Excepción quitada.', type: 'success' });
      setExcepciones((prev) => prev.filter((e) => e.id_excepcion !== excepcion.id_excepcion));
    } catch (error) {
      showToast({ message: error.message || 'No se pudo quitar la excepción.', type: 'error' });
    }
  };

  const eventosCalendario = useMemo(() => instancias.map((e) => ({
    id: `entreno-${e.id_horario}_${e.fecha}`,
    fecha: e.fecha,
    horaInicio: String(e.hora_inicio || '00:00').slice(0, 5),
    horaFin: String(e.hora_fin || '00:00').slice(0, 5),
    titulo: `${e.rama} ${e.categoria}`,
    subtitulo: e.entrenador_a_cargo || '',
    color: colorBarraPorRama(e.rama),
    tipo: 'entrenamiento',
    raw: e,
  })), [instancias]);

  const manejarRangoVisible = (desde, hasta) => {
    setRangoCalendario((prev) => (prev.desde === desde && prev.hasta === hasta ? prev : { desde, hasta }));
  };

  const horarioSeleccionado = horarios.find((h) => h.id_horario === horarioSeleccionadoId) || null;

  return (
    <div className="mt-20 fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', marginBottom: '14px', flexWrap: 'wrap' }}>
        <h3 className="section-title" style={{ margin: 0 }}><CalendarDays size={18} style={{ verticalAlign: '-3px', marginRight: '6px' }} />Horarios de Entrenamiento</h3>
      </div>

      <div className="segment-control mb-15" style={{ gap: '6px' }}>
        <button type="button" className={`segment-btn ${vista === 'horarios' ? 'active' : ''}`} onClick={() => setVista('horarios')}>Horarios</button>
        <button type="button" className={`segment-btn ${vista === 'excepciones' ? 'active' : ''}`} onClick={() => setVista('excepciones')}>Excepciones</button>
        <button type="button" className={`segment-btn ${vista === 'calendario' ? 'active' : ''}`} onClick={() => setVista('calendario')}>Calendario</button>
      </div>

      {vista === 'horarios' && (
        <div className="fade-in">
          <button type="button" className="btn-electric mb-15" onClick={() => (mostrarForm ? resetHorarioForm() : setMostrarForm(true))}>
            <Plus size={16} /> {mostrarForm ? 'Cancelar' : 'Nuevo horario'}
          </button>

          {mostrarForm && (
            <div className="card mb-15" style={{ borderRadius: '18px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '10px' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Rama</label>
                  <select className="form-input" value={horarioForm.rama} onChange={(e) => setHorarioForm((p) => ({ ...p, rama: e.target.value }))}>
                    <option>Mixta</option>
                    <option>Femenina</option>
                    <option>Masculina</option>
                  </select>
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Categoría *</label>
                  <input className="form-input" value={horarioForm.categoria} onChange={(e) => setHorarioForm((p) => ({ ...p, categoria: e.target.value }))} placeholder="Ej: SUB-14" />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Hora inicio</label>
                  <input type="time" className="form-input" value={horarioForm.hora_inicio} onChange={(e) => setHorarioForm((p) => ({ ...p, hora_inicio: e.target.value }))} />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Hora término</label>
                  <input type="time" className="form-input" value={horarioForm.hora_fin} onChange={(e) => setHorarioForm((p) => ({ ...p, hora_fin: e.target.value }))} />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Lugar</label>
                  <input className="form-input" value={horarioForm.lugar} onChange={(e) => setHorarioForm((p) => ({ ...p, lugar: e.target.value }))} placeholder="Ej: Gimnasio CCF" />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Entrenador a cargo</label>
                  <input className="form-input" value={horarioForm.entrenador_a_cargo} onChange={(e) => setHorarioForm((p) => ({ ...p, entrenador_a_cargo: e.target.value }))} />
                </div>
              </div>

              <label style={{ display: 'block', margin: '12px 0 6px' }}>Frecuencia</label>
              <div className="segment-control" style={{ gap: '6px', marginBottom: '10px' }}>
                <button type="button" className={`segment-btn ${horarioForm.tipo_recurrencia === 'semanal' ? 'active' : ''}`} onClick={() => setHorarioForm((p) => ({ ...p, tipo_recurrencia: 'semanal' }))}>Semanal</button>
                <button type="button" className={`segment-btn ${horarioForm.tipo_recurrencia === 'mensual' ? 'active' : ''}`} onClick={() => setHorarioForm((p) => ({ ...p, tipo_recurrencia: 'mensual' }))}>Mensual</button>
              </div>

              {horarioForm.tipo_recurrencia === 'semanal' ? (
                <>
                  <label style={{ display: 'block', margin: '0 0 6px' }}>Días de la semana (elige uno o varios)</label>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {DIAS_SEMANA_CORTO.map((label, idx) => (
                      <button
                        key={label}
                        type="button"
                        className={`segment-btn ${horarioForm.dias_semana.includes(idx) ? 'active' : ''}`}
                        onClick={() => toggleDiaSemana(idx)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <>
                  <label style={{ display: 'block', margin: '0 0 6px' }}>Días del mes (ej. 1 y 15 = dos veces al mes)</label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '5px', maxWidth: '320px' }}>
                    {DIAS_MES.map((dia) => (
                      <button
                        key={dia}
                        type="button"
                        className={`segment-btn ${horarioForm.dias_mes.includes(dia) ? 'active' : ''}`}
                        style={{ padding: '6px 0', fontSize: '11px' }}
                        onClick={() => toggleDiaMes(dia)}
                      >
                        {dia}
                      </button>
                    ))}
                  </div>
                </>
              )}

              <label style={{ display: 'block', margin: '14px 0 6px' }}>Vigencia (opcional — deja vacío para indefinido)</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '10px' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Desde</label>
                  <input type="date" className="form-input" value={horarioForm.fecha_inicio} onChange={(e) => setHorarioForm((p) => ({ ...p, fecha_inicio: e.target.value }))} />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Hasta</label>
                  <input type="date" className="form-input" value={horarioForm.fecha_fin} onChange={(e) => setHorarioForm((p) => ({ ...p, fecha_fin: e.target.value }))} />
                </div>
              </div>

              <button className="btn-electric mt-15" onClick={guardarHorario} disabled={guardando}>
                {guardando ? 'Guardando...' : editandoId ? 'Guardar cambios' : 'Crear horario'}
              </button>
            </div>
          )}

          {cargando && <p className="text-muted">Cargando horarios...</p>}
          {!cargando && horarios.length === 0 && (
            <p className="text-muted text-center italic">Todavía no hay horarios de entrenamiento definidos.</p>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {horarios.map((h) => (
              <div key={h.id_horario} className="card" style={{ borderRadius: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <div>
                  <strong style={{ fontSize: '13px' }}>{h.rama} {h.categoria}</strong>
                  <div style={{ fontSize: '11px', color: 'var(--texto-secundario)', fontWeight: '700', marginTop: '3px' }}>
                    {describirRecurrencia(h)} · {h.hora_inicio?.slice(0, 5)}-{h.hora_fin?.slice(0, 5)}
                    {h.lugar && ` · ${h.lugar}`}
                    {h.entrenador_a_cargo && ` · Prof. ${h.entrenador_a_cargo}`}
                  </div>
                  {describirVigencia(h) && (
                    <div style={{ fontSize: '10px', color: 'var(--texto-secundario)', fontWeight: '600', marginTop: '2px' }}>{describirVigencia(h)}</div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button className="btn-secondary" style={{ width: 'auto', padding: '6px 10px', fontSize: '11px' }} onClick={() => iniciarEdicionHorario(h)}>Editar</button>
                  <button
                    className="btn-secondary"
                    style={{ width: 'auto', padding: '6px 10px', fontSize: '11px', borderColor: 'rgba(255,59,48,0.35)', color: '#b91c1c' }}
                    onClick={() => borrarHorario(h)}
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {vista === 'excepciones' && (
        <div className="fade-in">
          <div className="form-group">
            <label>Horario</label>
            <select className="form-input" value={horarioSeleccionadoId || ''} onChange={(e) => setHorarioSeleccionadoId(e.target.value ? Number(e.target.value) : null)}>
              <option value="">Elige un horario...</option>
              {horarios.map((h) => (
                <option key={h.id_horario} value={h.id_horario}>{h.rama} {h.categoria} · {describirRecurrencia(h)} {h.hora_inicio?.slice(0, 5)}</option>
              ))}
            </select>
          </div>

          {horarioSeleccionado && (
            <>
              <div className="card mb-15" style={{ borderRadius: '18px' }}>
                <h5 style={{ margin: '0 0 10px', fontSize: '13px' }}>Nueva excepción</h5>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '10px' }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label>Fecha</label>
                    <input type="date" className="form-input" value={excepcionForm.fecha} onChange={(e) => setExcepcionForm((p) => ({ ...p, fecha: e.target.value }))} />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label>Tipo</label>
                    <select className="form-input" value={excepcionForm.tipo} onChange={(e) => setExcepcionForm((p) => ({ ...p, tipo: e.target.value }))}>
                      <option value="cancelado">Cancelado (no hay sesión)</option>
                      <option value="reprogramado">Reprogramado (cambia hora/lugar)</option>
                    </select>
                  </div>
                  {excepcionForm.tipo === 'reprogramado' && (
                    <>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label>Nueva hora inicio</label>
                        <input type="time" className="form-input" value={excepcionForm.hora_inicio_nueva} onChange={(e) => setExcepcionForm((p) => ({ ...p, hora_inicio_nueva: e.target.value }))} />
                      </div>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label>Nueva hora término</label>
                        <input type="time" className="form-input" value={excepcionForm.hora_fin_nueva} onChange={(e) => setExcepcionForm((p) => ({ ...p, hora_fin_nueva: e.target.value }))} />
                      </div>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label>Nuevo lugar (opcional)</label>
                        <input className="form-input" value={excepcionForm.lugar_nuevo} onChange={(e) => setExcepcionForm((p) => ({ ...p, lugar_nuevo: e.target.value }))} />
                      </div>
                    </>
                  )}
                  <div className="form-group" style={{ marginBottom: 0, gridColumn: '1 / -1' }}>
                    <label>Motivo (opcional)</label>
                    <input className="form-input" value={excepcionForm.motivo} onChange={(e) => setExcepcionForm((p) => ({ ...p, motivo: e.target.value }))} placeholder="Ej: Feriado, cancha ocupada..." />
                  </div>
                </div>
                <button className="btn-electric mt-15" onClick={crearExcepcion} disabled={guardandoExcepcion}>
                  {guardandoExcepcion ? 'Guardando...' : 'Guardar excepción'}
                </button>
              </div>

              {cargandoExcepciones && <p className="text-muted">Cargando excepciones...</p>}
              {!cargandoExcepciones && excepciones.length === 0 && (
                <p className="text-muted text-center italic">Este horario no tiene excepciones.</p>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {excepciones.map((ex) => (
                  <div key={ex.id_excepcion} className="card" style={{ borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <div style={{ fontSize: '12px' }}>
                      <strong>{ex.fecha}</strong> — {ex.tipo === 'cancelado' ? 'Cancelado' : `Reprogramado a ${ex.hora_inicio_nueva?.slice(0, 5)}-${ex.hora_fin_nueva?.slice(0, 5)}${ex.lugar_nuevo ? ` (${ex.lugar_nuevo})` : ''}`}
                      {ex.motivo && <span style={{ color: 'var(--texto-secundario)' }}> · {ex.motivo}</span>}
                    </div>
                    <button
                      className="btn-secondary"
                      style={{ width: 'auto', padding: '5px 9px', fontSize: '11px', borderColor: 'rgba(255,59,48,0.35)', color: '#b91c1c' }}
                      onClick={() => borrarExcepcion(ex)}
                    >
                      Quitar
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {vista === 'calendario' && (
        <div className="fade-in">
          {cargandoInstancias && <p className="text-muted">Cargando calendario...</p>}
          <CalendarioGrilla
            vista={vistaCalendario}
            fechaFoco={fechaFoco}
            eventos={eventosCalendario}
            onCambiarFoco={setFechaFoco}
            onCambiarVista={setVistaCalendario}
            onClickEvento={(ev) => setInstanciaSeleccionada(ev.raw)}
            onRangoVisibleChange={manejarRangoVisible}
          />
          {instanciaSeleccionada && (
            <div className="card mt-15" style={{ borderRadius: '16px', borderLeft: `4px solid ${colorBarraPorRama(instanciaSeleccionada.rama)}` }}>
              <strong style={{ fontSize: '14px' }}>
                {instanciaSeleccionada.hora_inicio?.slice(0, 5)}-{instanciaSeleccionada.hora_fin?.slice(0, 5)} · {instanciaSeleccionada.rama} {instanciaSeleccionada.categoria}
              </strong>
              <div style={{ fontSize: '11px', color: 'var(--texto-secundario)', fontWeight: '700', marginTop: '4px' }}>
                {instanciaSeleccionada.entrenador_a_cargo && <span>Profesor: {instanciaSeleccionada.entrenador_a_cargo}</span>}
                {instanciaSeleccionada.lugar && <span> · {instanciaSeleccionada.lugar}</span>}
                {instanciaSeleccionada.es_reprogramado && <span> · Reprogramado esta fecha</span>}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default HorariosEntrenamientoPanel;
