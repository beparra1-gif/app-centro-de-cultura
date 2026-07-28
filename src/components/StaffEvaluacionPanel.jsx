import { useMemo, useState } from 'react';
import { FileText, Save } from 'lucide-react';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from 'recharts';
import { showToast } from '../utils/toast';
import * as api from '../api/client';

const LATERALIDAD_OPCIONES = [
  { value: '', label: 'Sin evaluar' },
  { value: 'derecha', label: 'Derecha definida' },
  { value: 'izquierda', label: 'Izquierda definida' },
  { value: 'cruzada', label: 'Cruzada' },
  { value: 'no_definida', label: 'No definida / en desarrollo' },
];

const etiquetaLateralidad = (value) => (LATERALIDAD_OPCIONES.find((op) => op.value === value)?.label) || null;

function StaffEvaluacionPanel({
  jugadoresAdmin,
  usuarioAutenticado,
  evalTiro,
  setEvalTiro,
  evalDefensa,
  setEvalDefensa,
  evalFisico,
  setEvalFisico,
  evalTactico,
  setEvalTactico,
  notasEvaluacion,
  setNotasEvaluacion,
}) {
  const [filtroRama, setFiltroRama] = useState('Todas');
  const [filtroCategoria, setFiltroCategoria] = useState('Todas');
  const [rutJugadorSeleccionado, setRutJugadorSeleccionado] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [historialEvaluaciones, setHistorialEvaluaciones] = useState([]);
  const [cargandoHistorial, setCargandoHistorial] = useState(false);
  const [tipoEvaluacionActivo, setTipoEvaluacionActivo] = useState('tecnica');

  // Evaluación psicomotriz: coordinación, equilibrio y orientación espacio-
  // temporal como puntaje 0-100 (igual que la técnica, para reusar el radar
  // y el mismo patrón de sliders); lateralidad es categórica, no un puntaje.
  const [evalCoordinacion, setEvalCoordinacion] = useState(70);
  const [evalCoordinacionOcular, setEvalCoordinacionOcular] = useState(70);
  const [evalEquilibrio, setEvalEquilibrio] = useState(70);
  const [evalOrientacion, setEvalOrientacion] = useState(70);
  const [lateralidad, setLateralidad] = useState('');
  const [notasPsicomotriz, setNotasPsicomotriz] = useState({ observaciones: '', recomendaciones: '' });

  const ramasDisponibles = useMemo(() => {
    const set = new Set((jugadoresAdmin || []).map((j) => String(j.rama || '').trim()).filter(Boolean));
    return Array.from(set).sort();
  }, [jugadoresAdmin]);

  const categoriasDisponibles = useMemo(() => {
    const base = (jugadoresAdmin || []).filter((j) => filtroRama === 'Todas' || j.rama === filtroRama);
    const set = new Set(base.map((j) => String(j.categoria || '').trim()).filter(Boolean));
    return Array.from(set).sort();
  }, [jugadoresAdmin, filtroRama]);

  const jugadoresFiltrados = useMemo(() => {
    return (jugadoresAdmin || []).filter((j) => {
      const coincideRama = filtroRama === 'Todas' || j.rama === filtroRama;
      const coincideCategoria = filtroCategoria === 'Todas' || j.categoria === filtroCategoria;
      return coincideRama && coincideCategoria;
    });
  }, [jugadoresAdmin, filtroRama, filtroCategoria]);

  const jugadorSeleccionado = jugadoresFiltrados.find((j) => j.rut_jugador === rutJugadorSeleccionado) || null;

  const cargarHistorial = async (rut) => {
    if (!rut) {
      setHistorialEvaluaciones([]);
      return;
    }
    setCargandoHistorial(true);
    try {
      const datos = await api.evaluacionesAPI.getByJugador(rut);
      setHistorialEvaluaciones(Array.isArray(datos) ? datos : []);
    } catch (error) {
      showToast({ message: error.message || 'No se pudo cargar el historial de evaluaciones.', type: 'error' });
    } finally {
      setCargandoHistorial(false);
    }
  };

  const seleccionarJugador = (rut) => {
    setRutJugadorSeleccionado(rut);
    cargarHistorial(rut);
  };

  const dataEvalLive = [
    { subject: 'Tiro', score: evalTiro, fullMark: 100 },
    { subject: 'Defensa', score: evalDefensa, fullMark: 100 },
    { subject: 'Físico', score: evalFisico, fullMark: 100 },
    { subject: 'Táctica', score: evalTactico, fullMark: 100 },
  ];

  const dataEvalPsicomotrizLive = [
    { subject: 'Coordinación', score: evalCoordinacion, fullMark: 100 },
    { subject: 'Coord. Óculo-manual', score: evalCoordinacionOcular, fullMark: 100 },
    { subject: 'Equilibrio', score: evalEquilibrio, fullMark: 100 },
    { subject: 'Orientación', score: evalOrientacion, fullMark: 100 },
  ];

  const handleEmitirEvaluacion = async () => {
    if (!jugadorSeleccionado) {
      showToast({ message: 'Selecciona un jugador antes de emitir la evaluación.', type: 'error' });
      return;
    }

    const esPsicomotriz = tipoEvaluacionActivo === 'psicomotriz';
    const payload = esPsicomotriz
      ? {
          rut_jugador: jugadorSeleccionado.rut_jugador,
          evaluador_rut: usuarioAutenticado?.rut || null,
          tipo_evaluacion: 'Evaluación Psicomotriz',
          puntaje_coordinacion: Number(evalCoordinacion),
          puntaje_coordinacion_ocular: Number(evalCoordinacionOcular),
          puntaje_equilibrio: Number(evalEquilibrio),
          puntaje_orientacion: Number(evalOrientacion),
          lateralidad: lateralidad || null,
          comentarios: notasPsicomotriz.observaciones || '',
          recomendaciones: notasPsicomotriz.recomendaciones || '',
        }
      : {
          rut_jugador: jugadorSeleccionado.rut_jugador,
          evaluador_rut: usuarioAutenticado?.rut || null,
          tipo_evaluacion: 'Evaluación Staff',
          puntaje_tecnica: Number(evalTiro),
          puntaje_actitud: Number(evalDefensa),
          puntaje_condicion: Number(evalFisico),
          puntaje_mental: Number(evalTactico),
          comentarios: `Fortaleza: ${notasEvaluacion.fortaleza || '-'}\nA mejorar: ${notasEvaluacion.mejora || '-'}\nMetas (1 mes): ${notasEvaluacion.metas || '-'}`,
        };

    try {
      setGuardando(true);
      await api.evaluacionesAPI.create(payload);
      showToast({ message: `Evaluación guardada para ${jugadorSeleccionado.nombres} ${jugadorSeleccionado.apellido_paterno}.`, type: 'success' });
      if (esPsicomotriz) {
        setNotasPsicomotriz({ observaciones: '', recomendaciones: '' });
      } else {
        setNotasEvaluacion({ fortaleza: '', mejora: '', metas: '' });
      }
      cargarHistorial(jugadorSeleccionado.rut_jugador);
    } catch (error) {
      showToast({ message: `No se pudo guardar la evaluación: ${error.message}`, type: 'error' });
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="mt-20 fade-in">
      <div className="card mb-15">
        <h4 className="form-subtitle">Selección de Jugador</h4>
        <div style={{ display: 'flex', gap: '10px' }} className="mb-10">
          <select
            className="form-input"
            value={filtroRama}
            onChange={(e) => { setFiltroRama(e.target.value); setFiltroCategoria('Todas'); setRutJugadorSeleccionado(''); }}
          >
            <option value="Todas">Todas las ramas</option>
            {ramasDisponibles.map((rama) => <option key={rama} value={rama}>{rama}</option>)}
          </select>
          <select
            className="form-input"
            value={filtroCategoria}
            onChange={(e) => { setFiltroCategoria(e.target.value); setRutJugadorSeleccionado(''); }}
          >
            <option value="Todas">Todas las categorías</option>
            {categoriasDisponibles.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
          </select>
        </div>
        <select
          className="form-input"
          style={{ background: 'rgba(0,122,255,0.05)', borderColor: 'var(--azul-electrico)', color: 'var(--texto-heading)', fontWeight: '800' }}
          value={rutJugadorSeleccionado}
          onChange={(e) => seleccionarJugador(e.target.value)}
        >
          <option value="">Selecciona un jugador desde el roster activo</option>
          {jugadoresFiltrados.map((j) => (
            <option key={j.rut_jugador} value={j.rut_jugador}>
              {j.nombres} {j.apellido_paterno} · {j.rama} {j.categoria}
            </option>
          ))}
        </select>
      </div>

      <div className="card mb-15">
        <h4 className="form-subtitle" style={{ marginBottom: '10px' }}>Tipo de Evaluación</h4>
        <div className="segment-control">
          <button type="button" className={`segment-btn ${tipoEvaluacionActivo === 'tecnica' ? 'active' : ''}`} onClick={() => setTipoEvaluacionActivo('tecnica')}>
            Técnica / Táctica
          </button>
          <button type="button" className={`segment-btn ${tipoEvaluacionActivo === 'psicomotriz' ? 'active' : ''}`} onClick={() => setTipoEvaluacionActivo('psicomotriz')}>
            Psicomotriz
          </button>
        </div>
      </div>

      {jugadorSeleccionado && (
        <div className="card mb-15">
          <h4 className="form-subtitle">Historial de Evaluaciones</h4>
          {cargandoHistorial && <p className="text-muted">Cargando historial...</p>}
          {!cargandoHistorial && historialEvaluaciones.length === 0 && (
            <p className="text-muted text-center italic">Sin evaluaciones registradas todavía para {jugadorSeleccionado.nombres}.</p>
          )}
          {!cargandoHistorial && historialEvaluaciones.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '280px', overflowY: 'auto' }}>
              {historialEvaluaciones.map((ev) => (
                <div key={ev.id_evaluacion} style={{ border: '1px solid rgba(120,120,128,0.14)', borderRadius: '14px', padding: '10px 12px', background: 'rgba(255,255,255,0.84)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <strong style={{ fontSize: '12px' }}>{ev.fecha_evaluacion ? new Date(ev.fecha_evaluacion).toLocaleDateString('es-CL') : 'Sin fecha'}</strong>
                    <span style={{ fontSize: '11px', color: 'var(--texto-secundario)', fontWeight: '700' }}>{ev.tipo_evaluacion || 'Evaluación'}</span>
                  </div>
                  {ev.tipo_evaluacion === 'Evaluación Psicomotriz' ? (
                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '6px', fontSize: '11px', fontWeight: '800' }}>
                      <span>Coordinación: {ev.puntaje_coordinacion ?? '-'}</span>
                      <span>Coord. óculo-manual: {ev.puntaje_coordinacion_ocular ?? '-'}</span>
                      <span>Equilibrio: {ev.puntaje_equilibrio ?? '-'}</span>
                      <span>Orientación: {ev.puntaje_orientacion ?? '-'}</span>
                      {etiquetaLateralidad(ev.lateralidad) && <span>Lateralidad: {etiquetaLateralidad(ev.lateralidad)}</span>}
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '6px', fontSize: '11px', fontWeight: '800' }}>
                      <span>Tiro: {ev.puntaje_tecnica ?? '-'}</span>
                      <span>Defensa: {ev.puntaje_actitud ?? '-'}</span>
                      <span>Físico: {ev.puntaje_condicion ?? '-'}</span>
                      <span>Táctica: {ev.puntaje_mental ?? '-'}</span>
                    </div>
                  )}
                  {ev.comentarios && (
                    <p style={{ margin: '6px 0 0 0', fontSize: '11px', color: 'var(--texto-secundario)', whiteSpace: 'pre-line' }}>{ev.comentarios}</p>
                  )}
                  {ev.recomendaciones && (
                    <p style={{ margin: '4px 0 0 0', fontSize: '11px', color: 'var(--azul-electrico)', whiteSpace: 'pre-line' }}><strong>Recomendaciones:</strong> {ev.recomendaciones}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="card grafico-card-dark" style={{ background: '#1a2a42', borderRadius: '20px', overflow: 'hidden' }}>
        <h4 style={{ color: 'white', textAlign: 'center', margin: '20px 0 0 0' }}>
          {tipoEvaluacionActivo === 'psicomotriz' ? 'Radar Psicomotriz' : 'Radar Biomecánico'}
        </h4>
        <ResponsiveContainer width="100%" height={250}>
          <RadarChart cx="50%" cy="50%" outerRadius="65%" data={tipoEvaluacionActivo === 'psicomotriz' ? dataEvalPsicomotrizLive : dataEvalLive}>
            <PolarGrid stroke="rgba(255,255,255,0.15)" />
            <PolarAngleAxis dataKey="subject" tick={{ fill: '#ffffff', fontSize: 12, fontWeight: 800 }} />
            <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
            <Radar dataKey="score" stroke={tipoEvaluacionActivo === 'psicomotriz' ? '#BF5AF2' : '#00C7BE'} strokeWidth={3} fill={tipoEvaluacionActivo === 'psicomotriz' ? '#BF5AF2' : '#00C7BE'} fillOpacity={0.5} />
          </RadarChart>
        </ResponsiveContainer>
      </div>

      {tipoEvaluacionActivo === 'psicomotriz' ? (
        <div className="card mt-20">
          <h4 className="form-subtitle">Ajuste de Parámetros (Sliders)</h4>
          <div className="slider-group" style={{ marginBottom: '15px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}><label style={{ fontSize: '14px', fontWeight: '800' }}>Coordinación Motora Gruesa</label><span style={{ color: 'var(--azul-electrico)', fontWeight: 'bold' }}>{evalCoordinacion}</span></div>
            <input type="range" min="0" max="100" value={evalCoordinacion} onChange={(e) => setEvalCoordinacion(e.target.value)} style={{ width: '100%' }} />
          </div>
          <div className="slider-group" style={{ marginBottom: '15px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}><label style={{ fontSize: '14px', fontWeight: '800' }}>Coordinación Óculo-Manual</label><span style={{ color: 'var(--azul-electrico)', fontWeight: 'bold' }}>{evalCoordinacionOcular}</span></div>
            <input type="range" min="0" max="100" value={evalCoordinacionOcular} onChange={(e) => setEvalCoordinacionOcular(e.target.value)} style={{ width: '100%' }} />
          </div>
          <div className="slider-group" style={{ marginBottom: '15px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}><label style={{ fontSize: '14px', fontWeight: '800' }}>Equilibrio (Estático y Dinámico)</label><span style={{ color: 'var(--azul-electrico)', fontWeight: 'bold' }}>{evalEquilibrio}</span></div>
            <input type="range" min="0" max="100" value={evalEquilibrio} onChange={(e) => setEvalEquilibrio(e.target.value)} style={{ width: '100%' }} />
          </div>
          <div className="slider-group" style={{ marginBottom: '15px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}><label style={{ fontSize: '14px', fontWeight: '800' }}>Orientación Espacio-Temporal</label><span style={{ color: 'var(--azul-electrico)', fontWeight: 'bold' }}>{evalOrientacion}</span></div>
            <input type="range" min="0" max="100" value={evalOrientacion} onChange={(e) => setEvalOrientacion(e.target.value)} style={{ width: '100%' }} />
          </div>
          <div className="input-group">
            <label style={{ fontSize: '14px', fontWeight: '800', display: 'block', marginBottom: '8px' }}>Lateralidad</label>
            <select className="form-input" value={lateralidad} onChange={(e) => setLateralidad(e.target.value)}>
              {LATERALIDAD_OPCIONES.map((op) => <option key={op.value} value={op.value}>{op.label}</option>)}
            </select>
          </div>
        </div>
      ) : (
        <div className="card mt-20">
          <h4 className="form-subtitle">Ajuste de Parámetros (Sliders)</h4>
          <div className="slider-group" style={{ marginBottom: '15px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}><label style={{ fontSize: '14px', fontWeight: '800' }}>Tiro Exterior</label><span style={{ color: 'var(--azul-electrico)', fontWeight: 'bold' }}>{evalTiro}</span></div>
            <input type="range" min="0" max="100" value={evalTiro} onChange={(e) => setEvalTiro(e.target.value)} style={{ width: '100%' }} />
          </div>
          <div className="slider-group" style={{ marginBottom: '15px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}><label style={{ fontSize: '14px', fontWeight: '800' }}>Defensa y Recuperación</label><span style={{ color: 'var(--azul-electrico)', fontWeight: 'bold' }}>{evalDefensa}</span></div>
            <input type="range" min="0" max="100" value={evalDefensa} onChange={(e) => setEvalDefensa(e.target.value)} style={{ width: '100%' }} />
          </div>
          <div className="slider-group" style={{ marginBottom: '15px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}><label style={{ fontSize: '14px', fontWeight: '800' }}>Capacidad Física</label><span style={{ color: 'var(--azul-electrico)', fontWeight: 'bold' }}>{evalFisico}</span></div>
            <input type="range" min="0" max="100" value={evalFisico} onChange={(e) => setEvalFisico(e.target.value)} style={{ width: '100%' }} />
          </div>
          <div className="slider-group" style={{ marginBottom: '15px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}><label style={{ fontSize: '14px', fontWeight: '800' }}>Inteligencia Táctica</label><span style={{ color: 'var(--azul-electrico)', fontWeight: 'bold' }}>{evalTactico}</span></div>
            <input type="range" min="0" max="100" value={evalTactico} onChange={(e) => setEvalTactico(e.target.value)} style={{ width: '100%' }} />
          </div>
        </div>
      )}

      {tipoEvaluacionActivo === 'psicomotriz' ? (
        <div className="card mt-20">
          <h4 className="form-subtitle"><FileText size={16} /> Notas de Evaluación Psicomotriz</h4>
          <div className="input-group mb-15">
            <label style={{ fontSize: '13px', fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>Observaciones</label>
            <textarea className="form-input" rows="3" placeholder="Ej: Buena disociación de movimientos, le cuesta el salto a pies juntos con giro." value={notasPsicomotriz.observaciones} onChange={(e) => setNotasPsicomotriz({ ...notasPsicomotriz, observaciones: e.target.value })}></textarea>
          </div>
          <div className="input-group mb-20">
            <label style={{ fontSize: '13px', fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>Recomendaciones / Plan de Trabajo</label>
            <textarea className="form-input" rows="3" placeholder="Ej: Reforzar ejercicios de equilibrio dinámico sobre una pierna, circuitos de coordinación óculo-manual con balón." value={notasPsicomotriz.recomendaciones} onChange={(e) => setNotasPsicomotriz({ ...notasPsicomotriz, recomendaciones: e.target.value })}></textarea>
          </div>

          <button className="btn-electric" disabled={guardando || !jugadorSeleccionado} onClick={handleEmitirEvaluacion}>
            <Save size={18} /> {guardando ? 'Guardando...' : 'Emitir Evaluación Formal'}
          </button>
        </div>
      ) : (
        <div className="card mt-20">
          <h4 className="form-subtitle"><FileText size={16} /> Notas de Evaluación (Apoderado)</h4>
          <div className="input-group mb-15">
            <label style={{ fontSize: '13px', fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>Fortaleza Principal Actual</label>
            <input type="text" className="form-input" placeholder="Ej: Excelente visión de juego perimetral" value={notasEvaluacion.fortaleza} onChange={(e) => setNotasEvaluacion({ ...notasEvaluacion, fortaleza: e.target.value })} />
          </div>
          <div className="input-group mb-15">
            <label style={{ fontSize: '13px', fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>Aspecto Crítico a Mejorar</label>
            <input type="text" className="form-input" placeholder="Ej: Transición defensiva lenta" value={notasEvaluacion.mejora} onChange={(e) => setNotasEvaluacion({ ...notasEvaluacion, mejora: e.target.value })} />
          </div>
          <div className="input-group mb-20">
            <label style={{ fontSize: '13px', fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>Metas Corto Plazo (1 Mes)</label>
            <textarea className="form-input" rows="3" placeholder="Ej: Aumentar el % de tiros libres." value={notasEvaluacion.metas} onChange={(e) => setNotasEvaluacion({ ...notasEvaluacion, metas: e.target.value })}></textarea>
          </div>

          <button className="btn-electric" disabled={guardando || !jugadorSeleccionado} onClick={handleEmitirEvaluacion}>
            <Save size={18} /> {guardando ? 'Guardando...' : 'Emitir Evaluación Formal'}
          </button>
        </div>
      )}
    </div>
  );
}

export default StaffEvaluacionPanel;
