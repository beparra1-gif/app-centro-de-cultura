import { FileText, Save } from 'lucide-react';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from 'recharts';
import { showToast } from '../utils/toast';

function StaffEvaluacionPanel({
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
  const dataEvalLive = [
    { subject: 'Tiro', score: evalTiro, fullMark: 100 },
    { subject: 'Defensa', score: evalDefensa, fullMark: 100 },
    { subject: 'Físico', score: evalFisico, fullMark: 100 },
    { subject: 'Táctica', score: evalTactico, fullMark: 100 },
  ];

  return (
    <div className="mt-20 fade-in">
      <div className="card mb-15">
        <h4 className="form-subtitle">Selección de Jugador</h4>
        <div style={{ display: 'flex', gap: '10px' }} className="mb-10">
          <select className="form-input"><option>Femenina</option><option>Masculina</option></select>
          <select className="form-input"><option>U15</option></select>
        </div>
        <select className="form-input" style={{ background: 'rgba(0,122,255,0.05)', borderColor: 'var(--azul-electrico)', color: 'var(--texto-heading)', fontWeight: '800' }}>
          <option>Selecciona un jugador desde el roster activo</option>
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

        <button className="btn-electric" onClick={() => showToast({ message: 'Evaluación guardada. Se ha enviado la alerta al Apoderado para firmar el Acuse de Recibo.', type: 'success' })}>
          <Save size={18} /> Emitir Evaluación Formal
        </button>
      </div>
    </div>
  );
}

export default StaffEvaluacionPanel;
