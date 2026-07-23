import { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import * as api from '../api/client';
import { showToast } from '../utils/toast';
import { confirmAction } from '../utils/confirmDialog';
import { RAMAS_DISPONIBLES, categoriasDeRama } from '../utils/categoriasDeportivas';
import { useHorasOcupadasEnFecha } from '../utils/useHorasOcupadasEnFecha';
import { describirRecurrencia, describirVigencia } from '../utils/horariosEntrenamientoTexto';
import CanchaEntrenamientosOcupacion from './CanchaEntrenamientosOcupacion';

const DIAS_SEMANA_CORTO = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const DIAS_MES = Array.from({ length: 31 }, (_, i) => i + 1);
const LUGAR_DEFECTO = 'Gimnasio CCF';

const nombreCompletoStaff = (s) => [s.nombres, s.apellido_paterno, s.apellido_materno].filter(Boolean).join(' ').trim();

const HORARIO_FORM_VACIO = {
  rama: 'Mixta',
  categorias: [],
  tipo_recurrencia: 'semanal',
  dias_semana: [1],
  dias_mes: [],
  fecha_inicio: '',
  fecha_fin: '',
  hora_inicio: '18:00',
  hora_fin: '19:30',
  lugarModo: 'gimnasio',
  lugarOtro: '',
  entrenadores: [],
};

function CanchaEntrenamientosHorarioForm({ onCambio }) {
  const [horarios, setHorarios] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [staff, setStaff] = useState([]);

  const [mostrarForm, setMostrarForm] = useState(false);
  const [horarioForm, setHorarioForm] = useState(HORARIO_FORM_VACIO);
  const [editandoId, setEditandoId] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [ultimaAdvertencia, setUltimaAdvertencia] = useState(null);

  const { ocupaciones, cargando: cargandoOcupacion } = useHorasOcupadasEnFecha(horarioForm.fecha_inicio || new Date().toISOString().slice(0, 10));

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
    (async () => {
      await cargarHorarios();
      try {
        const datos = await api.staffAPI.getAll();
        setStaff(Array.isArray(datos) ? datos.filter((s) => nombreCompletoStaff(s)) : []);
      } catch {
        setStaff([]);
      }
    })();
  }, []);

  const resetHorarioForm = () => {
    setHorarioForm(HORARIO_FORM_VACIO);
    setEditandoId(null);
    setMostrarForm(false);
    setUltimaAdvertencia(null);
  };

  const iniciarEdicionHorario = (h) => {
    const esGimnasio = !h.lugar || h.lugar === LUGAR_DEFECTO;
    setHorarioForm({
      rama: h.rama,
      categorias: Array.isArray(h.categorias) ? h.categorias : [],
      tipo_recurrencia: h.tipo_recurrencia === 'mensual' ? 'mensual' : 'semanal',
      dias_semana: Array.isArray(h.dias_semana) ? h.dias_semana : [],
      dias_mes: Array.isArray(h.dias_mes) ? h.dias_mes : [],
      fecha_inicio: h.fecha_inicio ? String(h.fecha_inicio).slice(0, 10) : '',
      fecha_fin: h.fecha_fin ? String(h.fecha_fin).slice(0, 10) : '',
      hora_inicio: h.hora_inicio?.slice(0, 5) || '18:00',
      hora_fin: h.hora_fin?.slice(0, 5) || '19:30',
      lugarModo: esGimnasio ? 'gimnasio' : 'otro',
      lugarOtro: esGimnasio ? '' : h.lugar,
      entrenadores: Array.isArray(h.entrenadores) ? h.entrenadores : [],
    });
    setEditandoId(h.id_horario);
    setMostrarForm(true);
    setUltimaAdvertencia(null);
  };

  const cambiarRama = (nuevaRama) => {
    setHorarioForm((p) => ({
      ...p,
      rama: nuevaRama,
      categorias: p.categorias.filter((c) => categoriasDeRama(nuevaRama).includes(c)),
    }));
  };

  const toggleCategoria = (cat) => {
    setHorarioForm((p) => {
      const set = new Set(p.categorias);
      if (set.has(cat)) set.delete(cat); else set.add(cat);
      return { ...p, categorias: [...set] };
    });
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

  const toggleEntrenador = (nombre) => {
    setHorarioForm((p) => {
      const set = new Set(p.entrenadores);
      if (set.has(nombre)) set.delete(nombre); else set.add(nombre);
      return { ...p, entrenadores: [...set] };
    });
  };

  const guardarHorario = async () => {
    if (horarioForm.categorias.length === 0) {
      showToast({ message: 'Elige al menos una categoría.', type: 'error' });
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
    const lugar = horarioForm.lugarModo === 'gimnasio' ? LUGAR_DEFECTO : horarioForm.lugarOtro.trim();
    if (horarioForm.lugarModo === 'otro' && !lugar) {
      showToast({ message: 'Indica el lugar (elegiste "Otro").', type: 'error' });
      return;
    }
    const payload = {
      rama: horarioForm.rama,
      categorias: horarioForm.categorias,
      tipo_recurrencia: horarioForm.tipo_recurrencia,
      dias_semana: horarioForm.dias_semana,
      dias_mes: horarioForm.dias_mes,
      fecha_inicio: horarioForm.fecha_inicio || null,
      fecha_fin: horarioForm.fecha_fin || null,
      hora_inicio: horarioForm.hora_inicio,
      hora_fin: horarioForm.hora_fin,
      lugar,
      entrenadores: horarioForm.entrenadores,
    };
    setGuardando(true);
    try {
      const resultado = editandoId
        ? await api.horariosEntrenamientoAPI.update(editandoId, payload)
        : await api.horariosEntrenamientoAPI.create(payload);
      showToast({ message: editandoId ? 'Horario actualizado.' : 'Horario creado.', type: 'success' });
      if (resultado?.advertenciasChoque?.length > 0) {
        setUltimaAdvertencia(resultado.advertenciasChoque);
      } else {
        resetHorarioForm();
      }
      await cargarHorarios();
      onCambio && onCambio();
    } catch (error) {
      showToast({ message: error.message || 'No se pudo guardar el horario.', type: 'error' });
    } finally {
      setGuardando(false);
    }
  };

  const borrarHorario = async (h) => {
    if (!(await confirmAction({ title: 'Borrar horario', message: `¿Confirmas borrar el horario de ${h.rama} ${(h.categorias || []).join(', ')} (${describirRecurrencia(h)})? También se borran sus excepciones.`, danger: true }))) return;
    try {
      await api.horariosEntrenamientoAPI.remove(h.id_horario);
      showToast({ message: 'Horario borrado.', type: 'success' });
      await cargarHorarios();
      onCambio && onCambio();
    } catch (error) {
      showToast({ message: error.message || 'No se pudo borrar el horario.', type: 'error' });
    }
  };

  return (
    <div className="fade-in">
      <button type="button" className="btn-electric mb-15" onClick={() => (mostrarForm ? resetHorarioForm() : setMostrarForm(true))}>
        <Plus size={16} /> {mostrarForm ? 'Cancelar' : 'Nuevo horario'}
      </button>

      {mostrarForm && (
        <div className="card mb-15" style={{ borderRadius: '18px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '10px' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Rama</label>
              <select className="form-input" value={horarioForm.rama} onChange={(e) => cambiarRama(e.target.value)}>
                {RAMAS_DISPONIBLES.map((r) => <option key={r}>{r}</option>)}
              </select>
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
              <select className="form-input" value={horarioForm.lugarModo} onChange={(e) => setHorarioForm((p) => ({ ...p, lugarModo: e.target.value }))}>
                <option value="gimnasio">{LUGAR_DEFECTO}</option>
                <option value="otro">Otro...</option>
              </select>
            </div>
            {horarioForm.lugarModo === 'otro' && (
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Detalle del lugar</label>
                <input className="form-input" value={horarioForm.lugarOtro} onChange={(e) => setHorarioForm((p) => ({ ...p, lugarOtro: e.target.value }))} placeholder="Ej: Cancha externa" />
              </div>
            )}
          </div>

          <label style={{ display: 'block', margin: '12px 0 6px' }}>Categorías (elige una o varias)</label>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {categoriasDeRama(horarioForm.rama).map((cat) => (
              <button
                key={cat}
                type="button"
                className={`segment-btn ${horarioForm.categorias.includes(cat) ? 'active' : ''}`}
                onClick={() => toggleCategoria(cat)}
              >
                {cat}
              </button>
            ))}
          </div>

          <label style={{ display: 'block', margin: '12px 0 6px' }}>Entrenador(es) a cargo</label>
          {staff.length === 0 ? (
            <p className="text-muted italic" style={{ fontSize: '12px', margin: 0 }}>No hay staff cargado todavía.</p>
          ) : (
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {staff.map((s) => {
                const nombre = nombreCompletoStaff(s);
                return (
                  <button
                    key={s.id_staff}
                    type="button"
                    className={`segment-btn ${horarioForm.entrenadores.includes(nombre) ? 'active' : ''}`}
                    onClick={() => toggleEntrenador(nombre)}
                  >
                    {nombre}{s.cargo ? ` · ${s.cargo}` : ''}
                  </button>
                );
              })}
            </div>
          )}

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

          <div style={{ marginTop: '10px' }}>
            <CanchaEntrenamientosOcupacion ocupaciones={ocupaciones} cargando={cargandoOcupacion} />
          </div>

          {ultimaAdvertencia?.length > 0 && (
            <div className="card mt-10" style={{ borderLeft: '4px solid #FF9500', borderRadius: '16px', background: 'rgba(255,149,0,0.08)' }}>
              <strong style={{ fontSize: '12px', color: '#b36200' }}>Este horario quedó guardado, pero choca con arriendos ya reservados:</strong>
              <ul style={{ margin: '8px 0 0', paddingLeft: '18px', fontSize: '12px' }}>
                {ultimaAdvertencia.map((a) => (
                  <li key={`${a.fecha}-${a.hora_inicio}`}>{a.fecha}: {a.nombre_arrendatario} ({a.hora_inicio?.slice(0, 5)}-{a.hora_fin?.slice(0, 5)})</li>
                ))}
              </ul>
              <button type="button" className="btn-secondary mt-10" style={{ width: 'auto', padding: '6px 12px', fontSize: '11px' }} onClick={resetHorarioForm}>Entendido</button>
            </div>
          )}

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
              <strong style={{ fontSize: '13px' }}>{h.rama} {(h.categorias || []).join(', ')}</strong>
              <div style={{ fontSize: '11px', color: 'var(--texto-secundario)', fontWeight: '700', marginTop: '3px' }}>
                {describirRecurrencia(h)} · {h.hora_inicio?.slice(0, 5)}-{h.hora_fin?.slice(0, 5)}
                {h.lugar && ` · ${h.lugar}`}
                {(h.entrenadores || []).length > 0 && ` · Prof. ${h.entrenadores.join(', ')}`}
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
  );
}

export default CanchaEntrenamientosHorarioForm;
