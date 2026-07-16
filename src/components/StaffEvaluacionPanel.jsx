import { useMemo, useState } from 'react';
import { FileText, Save } from 'lucide-react';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from 'recharts';
import { showToast } from '../utils/toast';
import * as api from '../api/client';

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

  const dataEvalLive = [
    { subject: 'Tiro', score: evalTiro, fullMark: 100 },
    { subject: 'Defensa', score: evalDefensa, fullMark: 100 },
    { subject: 'Físico', score: evalFisico, fullMark: 100 },
    { subject: 'Táctica', score: evalTactico, fullMark: 100 },
  ];

  const handleEmitirEvaluacion = async () => {
    if (!jugadorSeleccionado) {
      showToast({ message: 'Selecciona un jugador antes de emitir la evaluación.', type: 'error' });
      return;
    }

    try {
      setGuardando(true);
      await api.evaluacionesAPI.create({
        rut_jugador: jugadorSeleccionado.rut_jugador,
        evaluador_rut: usuarioAutenticado?.rut || null,
        tipo_evaluacion: 'Evaluación Staff',
        puntaje_tecnica: Number(evalTiro),
        puntaje_actitud: Number(evalDefensa),
        puntaje_condicion: Number(evalFisico),
        puntaje_mental: Number(evalTactico),
        comentarios: `Fortaleza: ${notasEvaluacion.fortaleza || '-'}\nA mejorar: ${notasEvaluacion.mejora || '-'}\nMetas (1 mes): ${notasEvaluacion.metas || '-'}`,
      });
      showToast({ message: `Evaluación guardada para ${jugadorSeleccionado.nombres} ${jugadorSeleccionado.apellido_paterno}.`, type: 'success' });
      setNotasEvaluacion({ fortaleza: '', mejora: '', metas: '' });
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
          onChange={(e) => setRutJugadorSeleccionado(e.target.value)}
        >
          <option value="">Selecciona un jugador desde el roster activo</option>
          {jugadoresFiltrados.map((j) => (
            <option key={j.rut_jugador} value={j.rut_jugador}>
              {j.nombres} {j.apellido_paterno} · {j.rama} {j.categoria}
            </option>
          ))}
        </select>
      </div>

      <div className="card grafico-card-dark" style={{ background: '#1a2a42', borderRadius: '20px', overflow: 'hidden' }}>
        <h4 style={{ color: 'white', textAlign: 'center', margin: '20px 0 0 0' }}>Radar Biomecánico</h4>
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
    </div>
  );
}

export default StaffEvaluacionPanel;
