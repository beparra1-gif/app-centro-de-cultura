import { useEffect, useState } from 'react';
import * as api from '../api/client';
import { showToast } from '../utils/toast';
import { confirmAction } from '../utils/confirmDialog';
import { useHorasOcupadasEnFecha } from '../utils/useHorasOcupadasEnFecha';
import { describirRecurrencia } from '../utils/horariosEntrenamientoTexto';
import CanchaEntrenamientosOcupacion from './CanchaEntrenamientosOcupacion';

const EXCEPCION_FORM_VACIO = {
  fecha: new Date().toISOString().slice(0, 10),
  tipo: 'cancelado',
  hora_inicio_nueva: '',
  hora_fin_nueva: '',
  lugar_nuevo: '',
  motivo: '',
};

function CanchaEntrenamientosExcepciones({ onCambio }) {
  const [horarios, setHorarios] = useState([]);
  const [horarioSeleccionadoId, setHorarioSeleccionadoId] = useState(null);
  const [excepciones, setExcepciones] = useState([]);
  const [cargandoExcepciones, setCargandoExcepciones] = useState(false);
  const [excepcionForm, setExcepcionForm] = useState(EXCEPCION_FORM_VACIO);
  const [guardandoExcepcion, setGuardandoExcepcion] = useState(false);

  const { ocupaciones, cargando: cargandoOcupacion } = useHorasOcupadasEnFecha(excepcionForm.fecha);

  useEffect(() => {
    (async () => {
      try {
        const datos = await api.horariosEntrenamientoAPI.getAll();
        setHorarios(Array.isArray(datos) ? datos : []);
      } catch {
        setHorarios([]);
      }
    })();
  }, []);

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
      onCambio && onCambio();
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
      onCambio && onCambio();
    } catch (error) {
      showToast({ message: error.message || 'No se pudo quitar la excepción.', type: 'error' });
    }
  };

  const horarioSeleccionado = horarios.find((h) => h.id_horario === horarioSeleccionadoId) || null;

  return (
    <div className="fade-in">
      <div className="form-group">
        <label>Horario</label>
        <select className="form-input" value={horarioSeleccionadoId || ''} onChange={(e) => setHorarioSeleccionadoId(e.target.value ? Number(e.target.value) : null)}>
          <option value="">Elige un horario...</option>
          {horarios.map((h) => (
            <option key={h.id_horario} value={h.id_horario}>{h.rama} {(h.categorias || []).join(', ')} · {describirRecurrencia(h)} {h.hora_inicio?.slice(0, 5)}</option>
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

            <CanchaEntrenamientosOcupacion ocupaciones={ocupaciones} cargando={cargandoOcupacion} />

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
  );
}

export default CanchaEntrenamientosExcepciones;
