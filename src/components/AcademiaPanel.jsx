import { Brain, PlayCircle, Star, Video } from 'lucide-react';
import PupiloSelector from './PupiloSelector';
import { mockTesoreriaDB, mockQuiz } from '../data/mockData';

function AcademiaPanel({
  pupiloActivo,
  setPupiloActivo,
  rolUsuario,
  animacionXP,
  setAnimacionXP,
  quizCompletado,
  setQuizCompletado,
  opcionSeleccionada,
  setOpcionSeleccionada,
}) {
  const handleResponderQuiz = (opcion) => {
    if (quizCompletado) return;
    setOpcionSeleccionada(opcion);
    setQuizCompletado(true);

    if (opcion === mockQuiz.RESPUESTA_CORRECTA) {
      setAnimacionXP(true);
      setTimeout(() => setAnimacionXP(false), 2000);
    }
  };

  return (
    <div className="mt-20 fade-in">
      <PupiloSelector
        pupilos={mockTesoreriaDB.pupilos}
        pupiloActivo={pupiloActivo}
        rolUsuario={rolUsuario}
        onChangePupilo={setPupiloActivo}
      />

      <div className={`card academy-hero-card gamificacion-card mb-20 ${animacionXP ? 'xp-boost-anim' : ''}`} style={{ background: 'linear-gradient(135deg, #2E0B5B, #00C7BE)', color: 'white', border: 'none', position: 'relative', overflow: 'hidden' }}>
        {animacionXP && <div className="particulas-xp">✨ +50 XP ✨</div>}
        <div className="gamificacion-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="nivel-box" style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <Star size={34} color="#FFD700" fill="#FFD700" />
            <div>
              <h4 style={{ margin: 0, fontSize: '22px', fontWeight: '900' }}>Nivel {pupiloActivo.nivel}</h4>
              <span className="xp-totales" style={{ fontSize: '12px', color: 'rgba(255,255,255,0.8)', fontWeight: 'bold' }}>{pupiloActivo.xp} XP Totales</span>
            </div>
          </div>
        </div>
        <div className="admin-progress-bg mt-15" style={{ background: 'rgba(255,255,255,0.2)', height: '14px', borderRadius: '7px' }}>
          <div className="admin-progress-fill" style={{ width: '65%', background: '#00C7BE', height: '100%', borderRadius: '7px' }}></div>
        </div>
        <p style={{ textAlign: 'right', margin: '8px 0 0 0', fontSize: '11px', fontWeight: '800' }}>Faltan 150 XP para Lvl {pupiloActivo.nivel + 1}</p>
      </div>

      <h3 className="section-title">Video Analisis</h3>
      <div className="card video-card">
        <div className="video-placeholder" style={{ borderRadius: '16px' }}>
          <Video size={40} color="white" />
          <div className="play-button"><PlayCircle size={35} color="var(--azul-marino)" fill="white" /></div>
        </div>
        <div className="video-info">
          <span className="badge-video">NUEVO VIDEO</span>
          <h4 style={{ margin: '10px 0 0 0', fontSize: '16px' }}>Analisis Zonal 2-3</h4>
        </div>
      </div>

      <h3 className="section-title mt-20">Desafio Semanal</h3>
      <div className="card academia-card" style={{ border: '2px solid #FF9500' }}>
        <div className="academia-header">
          <span className="badge-academia" style={{ background: '#FF9500', color: 'white' }}><Brain size={12} /> QUIZ TACTICO</span>
          <span className="xp-recompensa">+50 XP</span>
        </div>
        <h4 className="titulo-leccion">{mockQuiz.TITULO_LECCION}</h4>

        <div className="quiz-container mt-15">
          <p className="pregunta-texto">{mockQuiz.PREGUNTA}</p>
          <div className="opciones-quiz">
            <button className={`btn-opcion ${opcionSeleccionada === 'A' ? (mockQuiz.RESPUESTA_CORRECTA === 'A' ? 'correcta' : 'incorrecta') : ''}`} onClick={() => handleResponderQuiz('A')} disabled={quizCompletado}>A) {mockQuiz.OPCION_A}</button>
            <button className={`btn-opcion ${opcionSeleccionada === 'B' ? (mockQuiz.RESPUESTA_CORRECTA === 'B' ? 'correcta' : 'incorrecta') : ''}`} onClick={() => handleResponderQuiz('B')} disabled={quizCompletado}>B) {mockQuiz.OPCION_B}</button>
            <button className={`btn-opcion ${opcionSeleccionada === 'C' ? (mockQuiz.RESPUESTA_CORRECTA === 'C' ? 'correcta' : 'incorrecta') : ''}`} onClick={() => handleResponderQuiz('C')} disabled={quizCompletado}>C) {mockQuiz.OPCION_C}</button>
          </div>
          {quizCompletado && (
            <div className={`explicacion-box mt-15 ${opcionSeleccionada === mockQuiz.RESPUESTA_CORRECTA ? 'exito' : 'fallo'}`}>
              <strong style={{ fontSize: '14px' }}>{opcionSeleccionada === mockQuiz.RESPUESTA_CORRECTA ? 'Correcto! Sumas XP' : 'Casi... pero no.'}</strong>
              <p style={{ margin: '8px 0 0 0', fontSize: '13px' }}>{mockQuiz.EXPLICACION_RESPUESTA}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default AcademiaPanel;
