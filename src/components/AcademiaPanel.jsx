import { useState } from 'react';
import { Brain, Image, Link2, PlayCircle, Save, Star, Video } from 'lucide-react';
import PupiloSelector from './PupiloSelector';

function AcademiaPanel({
  pupiloActivo,
  setPupiloActivo,
  pupilosDisponibles,
  rolUsuario,
  animacionXP,
  setAnimacionXP,
  quizCompletado,
  setQuizCompletado,
  opcionSeleccionada,
  setOpcionSeleccionada,
  quizActivo,
  materialesAcademia,
  pizarrasAcademia,
  publicarMaterialAcademia,
  crearQuizAcademia,
  guardarPizarraAcademia,
}) {
  const esProfesor = rolUsuario === 'staff' || rolUsuario === 'super_admin';
  const [materialForm, setMaterialForm] = useState({ tipo: 'video', titulo: '', url: '' });
  const [quizForm, setQuizForm] = useState({
    titulo: '',
    pregunta: '',
    opcionA: '',
    opcionB: '',
    opcionC: '',
    respuestaCorrecta: 'A',
  });
  const [pizarraForm, setPizarraForm] = useState({
    nombre_tactica: '',
    descripcion: '',
    formacion: '2-1-2',
    zona_defensa: '2-3',
    zona_ataque: 'Perimetral',
  });

  if (!pupiloActivo) {
    return <div className="mt-20 fade-in">Cargando datos de academia...</div>;
  }

  const handlePublicarMaterial = async () => {
    if (!materialForm.titulo.trim() || !materialForm.url.trim()) {
      alert('Completa título y enlace del material.');
      return;
    }

    try {
      await publicarMaterialAcademia({
        titulo: materialForm.titulo.trim(),
        url: materialForm.url.trim(),
        tipo: materialForm.tipo,
      });
      setMaterialForm({ tipo: 'video', titulo: '', url: '' });
      alert('Material publicado en Academia.');
    } catch (error) {
      alert(`No se pudo publicar el material: ${error.message}`);
    }
  };

  const handleCrearQuiz = async () => {
    if (!quizForm.titulo.trim() || !quizForm.pregunta.trim() || !quizForm.opcionA.trim() || !quizForm.opcionB.trim() || !quizForm.opcionC.trim()) {
      alert('Completa todos los campos del quiz.');
      return;
    }

    try {
      await crearQuizAcademia({
        titulo: quizForm.titulo.trim(),
        pregunta: quizForm.pregunta.trim(),
        opciones: [quizForm.opcionA.trim(), quizForm.opcionB.trim(), quizForm.opcionC.trim()],
        respuestaCorrecta: quizForm.respuestaCorrecta,
      });
      setQuizForm({ titulo: '', pregunta: '', opcionA: '', opcionB: '', opcionC: '', respuestaCorrecta: 'A' });
      alert('Quiz táctico creado correctamente.');
    } catch (error) {
      alert(`No se pudo crear el quiz: ${error.message}`);
    }
  };

  const handleGuardarPizarra = async () => {
    if (!pizarraForm.nombre_tactica.trim() || !pizarraForm.descripcion.trim()) {
      alert('Completa nombre y descripción de la táctica.');
      return;
    }

    try {
      await guardarPizarraAcademia(pizarraForm);
      setPizarraForm({
        nombre_tactica: '',
        descripcion: '',
        formacion: '2-1-2',
        zona_defensa: '2-3',
        zona_ataque: 'Perimetral',
      });
      alert('Pizarra táctica guardada correctamente.');
    } catch (error) {
      alert(`No se pudo guardar la pizarra: ${error.message}`);
    }
  };

  const handleResponderQuiz = (opcion) => {
    if (quizCompletado) return;
    setOpcionSeleccionada(opcion);
    setQuizCompletado(true);

    if (opcion === quizActivo.respuestaCorrecta) {
      setAnimacionXP(true);
      setTimeout(() => setAnimacionXP(false), 2000);
    }
  };

  return (
    <div className="mt-20 fade-in">
      <PupiloSelector
        pupilos={pupilosDisponibles}
        pupiloActivo={pupiloActivo}
        rolUsuario={rolUsuario}
        onChangePupilo={setPupiloActivo}
      />

      <div className={`card academy-hero-card gamificacion-card mb-20 ${animacionXP ? 'xp-boost-anim' : ''}`} style={{ background: 'linear-gradient(180deg, rgba(11,29,58,0.98) 0%, rgba(0,122,255,0.92) 55%, rgba(0,199,190,0.90) 100%)', color: 'white', border: 'none', position: 'relative', overflow: 'hidden', borderRadius: '28px', boxShadow: '0 18px 40px rgba(0,0,0,0.18)' }}>
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
        <div className="admin-progress-bg mt-15" style={{ background: 'rgba(255,255,255,0.2)', height: '14px', borderRadius: '999px' }}>
          <div className="admin-progress-fill" style={{ width: '65%', background: '#00C7BE', height: '100%', borderRadius: '999px' }}></div>
        </div>
        <p style={{ textAlign: 'right', margin: '8px 0 0 0', fontSize: '11px', fontWeight: '800' }}>Faltan 150 XP para Lvl {pupiloActivo.nivel + 1}</p>
      </div>

      <h3 className="section-title">Video Análisis</h3>
      <div className="card video-card" style={{ borderRadius: '24px', boxShadow: '0 14px 34px rgba(15,23,42,0.08)' }}>
        <div className="video-placeholder" style={{ borderRadius: '20px' }}>
          <Video size={40} color="white" />
          <div className="play-button"><PlayCircle size={35} color="var(--azul-marino)" fill="white" /></div>
        </div>
        <div className="video-info">
          <span className="badge-video" style={{ borderRadius: '999px', padding: '6px 10px' }}>NUEVO VIDEO</span>
          <h4 style={{ margin: '10px 0 0 0', fontSize: '16px', fontWeight: '900' }}>Análisis Zonal 2-3</h4>
        </div>
      </div>

      {Array.isArray(materialesAcademia) && materialesAcademia.length > 0 && (
        <div className="card mt-15" style={{ borderRadius: '24px' }}>
          <h4 className="form-subtitle" style={{ marginBottom: '12px', fontWeight: '900' }}>Materiales de Academia</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {materialesAcademia.slice(0, 6).map((mat, idx) => (
              <a
                key={mat.id || `${mat.TITULO || 'material'}-${idx}`}
                href={mat.CUERPO_TEXTO}
                target="_blank"
                rel="noreferrer"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  textDecoration: 'none',
                  color: 'var(--texto-principal)',
                  border: '1px solid var(--borde-suave)',
                  borderRadius: '18px',
                  padding: '10px 12px',
                  background: 'rgba(255,255,255,0.86)',
                  boxShadow: '0 8px 18px rgba(15,23,42,0.04)'
                }}
              >
                {(mat.TIPO_COMUNICADO || '').toLowerCase().includes('imagen') ? <Image size={16} /> : <Link2 size={16} />}
                <strong style={{ fontSize: '13px' }}>{mat.TITULO}</strong>
              </a>
            ))}
          </div>
        </div>
      )}

      <h3 className="section-title mt-20">Desafío Semanal</h3>
      <div className="card academia-card" style={{ border: '2px solid #FF9500', borderRadius: '26px', boxShadow: '0 14px 34px rgba(15,23,42,0.08)' }}>
        <div className="academia-header">
          <span className="badge-academia" style={{ background: '#FF9500', color: 'white', borderRadius: '999px', padding: '6px 10px' }}><Brain size={12} /> QUIZ TÁCTICO</span>
          <span className="xp-recompensa">+50 XP</span>
        </div>
        <h4 className="titulo-leccion">{quizActivo.titulo}</h4>

        <div className="quiz-container mt-15">
          <p className="pregunta-texto">{quizActivo.pregunta}</p>
          <div className="opciones-quiz">
            <button className={`btn-opcion ${opcionSeleccionada === 'A' ? (quizActivo.respuestaCorrecta === 'A' ? 'correcta' : 'incorrecta') : ''}`} onClick={() => handleResponderQuiz('A')} disabled={quizCompletado}>A) {quizActivo.opciones?.[0] || '-'}</button>
            <button className={`btn-opcion ${opcionSeleccionada === 'B' ? (quizActivo.respuestaCorrecta === 'B' ? 'correcta' : 'incorrecta') : ''}`} onClick={() => handleResponderQuiz('B')} disabled={quizCompletado}>B) {quizActivo.opciones?.[1] || '-'}</button>
            <button className={`btn-opcion ${opcionSeleccionada === 'C' ? (quizActivo.respuestaCorrecta === 'C' ? 'correcta' : 'incorrecta') : ''}`} onClick={() => handleResponderQuiz('C')} disabled={quizCompletado}>C) {quizActivo.opciones?.[2] || '-'}</button>
          </div>
          {quizCompletado && (
            <div className={`explicacion-box mt-15 ${opcionSeleccionada === quizActivo.respuestaCorrecta ? 'exito' : 'fallo'}`}>
              <strong style={{ fontSize: '14px' }}>{opcionSeleccionada === quizActivo.respuestaCorrecta ? 'Correcto. Sumas XP' : 'Casi... pero no.'}</strong>
              <p style={{ margin: '8px 0 0 0', fontSize: '13px' }}>{quizActivo.explicacion}</p>
            </div>
          )}
        </div>
      </div>

      {esProfesor && (
        <div className="card mt-20" style={{ border: '2px solid rgba(0,122,255,0.22)', borderRadius: '24px' }}>
          <h4 className="form-subtitle" style={{ marginBottom: '10px', fontWeight: '900' }}>Panel Docente: Publicación de Contenidos</h4>

          <div className="input-group mb-10">
            <label style={{ fontSize: '12px', fontWeight: '800' }}>Tipo de material</label>
            <select className="form-input mt-5" value={materialForm.tipo} onChange={(e) => setMaterialForm((prev) => ({ ...prev, tipo: e.target.value }))}>
              <option value="video">Video</option>
              <option value="imagen">Imagen de pizarra</option>
              <option value="documento">Documento</option>
            </select>
          </div>

          <div className="input-group mb-10">
            <label style={{ fontSize: '12px', fontWeight: '800' }}>Título</label>
            <input className="form-input mt-5" value={materialForm.titulo} onChange={(e) => setMaterialForm((prev) => ({ ...prev, titulo: e.target.value }))} placeholder="Ej: Lecturas defensivas desde lado débil" />
          </div>

          <div className="input-group mb-15">
            <label style={{ fontSize: '12px', fontWeight: '800' }}>Enlace (YouTube, Drive, imagen o PDF)</label>
            <input className="form-input mt-5" value={materialForm.url} onChange={(e) => setMaterialForm((prev) => ({ ...prev, url: e.target.value }))} placeholder="https://..." />
          </div>

          <button className="btn-electric" onClick={handlePublicarMaterial}><Save size={16} /> Publicar material</button>

          <hr style={{ margin: '18px 0', border: 'none', borderTop: '1px solid var(--borde-suave)' }} />

          <h5 style={{ margin: '0 0 10px 0', fontSize: '14px' }}>Crear Quiz Táctico</h5>
          <input className="form-input mb-10" placeholder="Título del quiz" value={quizForm.titulo} onChange={(e) => setQuizForm((prev) => ({ ...prev, titulo: e.target.value }))} />
          <textarea className="form-input mb-10" rows="2" placeholder="Pregunta" value={quizForm.pregunta} onChange={(e) => setQuizForm((prev) => ({ ...prev, pregunta: e.target.value }))}></textarea>
          <input className="form-input mb-10" placeholder="Opción A" value={quizForm.opcionA} onChange={(e) => setQuizForm((prev) => ({ ...prev, opcionA: e.target.value }))} />
          <input className="form-input mb-10" placeholder="Opción B" value={quizForm.opcionB} onChange={(e) => setQuizForm((prev) => ({ ...prev, opcionB: e.target.value }))} />
          <input className="form-input mb-10" placeholder="Opción C" value={quizForm.opcionC} onChange={(e) => setQuizForm((prev) => ({ ...prev, opcionC: e.target.value }))} />
          <select className="form-input mb-10" value={quizForm.respuestaCorrecta} onChange={(e) => setQuizForm((prev) => ({ ...prev, respuestaCorrecta: e.target.value }))}>
            <option value="A">Respuesta correcta: A</option>
            <option value="B">Respuesta correcta: B</option>
            <option value="C">Respuesta correcta: C</option>
          </select>
          <button className="btn-secondary" onClick={handleCrearQuiz}>Guardar quiz</button>

          <hr style={{ margin: '18px 0', border: 'none', borderTop: '1px solid var(--borde-suave)' }} />

          <h5 style={{ margin: '0 0 10px 0', fontSize: '14px' }}>Pizarra Interactiva (Táctica)</h5>
          <input className="form-input mb-10" placeholder="Nombre de la táctica" value={pizarraForm.nombre_tactica} onChange={(e) => setPizarraForm((prev) => ({ ...prev, nombre_tactica: e.target.value }))} />
          <textarea className="form-input mb-10" rows="2" placeholder="Descripción y objetivos" value={pizarraForm.descripcion} onChange={(e) => setPizarraForm((prev) => ({ ...prev, descripcion: e.target.value }))}></textarea>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
            <input className="form-input" placeholder="Formación" value={pizarraForm.formacion} onChange={(e) => setPizarraForm((prev) => ({ ...prev, formacion: e.target.value }))} />
            <input className="form-input" placeholder="Zona defensa" value={pizarraForm.zona_defensa} onChange={(e) => setPizarraForm((prev) => ({ ...prev, zona_defensa: e.target.value }))} />
            <input className="form-input" placeholder="Zona ataque" value={pizarraForm.zona_ataque} onChange={(e) => setPizarraForm((prev) => ({ ...prev, zona_ataque: e.target.value }))} />
          </div>
          <button className="btn-secondary mt-10" onClick={handleGuardarPizarra}>Guardar pizarra</button>
        </div>
      )}

      {Array.isArray(pizarrasAcademia) && pizarrasAcademia.length > 0 && (
        <div className="card mt-15" style={{ borderRadius: '24px' }}>
          <h4 className="form-subtitle" style={{ fontWeight: '900' }}>Últimas pizarras tácticas</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {pizarrasAcademia.slice(0, 5).map((pz, idx) => (
              <div key={pz.id || `${pz.nombre_tactica || 'tactica'}-${idx}`} style={{ border: '1px solid rgba(120,120,128,0.14)', borderRadius: '18px', padding: '12px', background: 'rgba(255,255,255,0.84)' }}>
                <strong style={{ display: 'block', fontSize: '13px' }}>{pz.nombre_tactica || 'Táctica sin nombre'}</strong>
                <span style={{ fontSize: '12px', color: 'var(--texto-secundario)' }}>
                  Formación: {pz.formacion || '-'} · Defensa: {pz.zona_defensa || '-'} · Ataque: {pz.zona_ataque || '-'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default AcademiaPanel;
