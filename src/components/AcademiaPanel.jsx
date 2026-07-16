import { useMemo, useState } from 'react';
import { Brain, FileText, Image, Link2, PlayCircle, Save, Star, Upload, Video } from 'lucide-react';
import { showToast } from '../utils/toast';
import * as api from '../api/client';
import PupiloSelector from './PupiloSelector';
import PizarraTacticaCanvas from './PizarraTacticaCanvas';

const RAMAS = ['General', 'Masculina', 'Femenina', 'Mixta'];

const esUrlYoutube = (url = '') => /youtube\.com\/watch\?v=|youtu\.be\//.test(url);
const esUrlVimeo = (url = '') => /vimeo\.com\//.test(url);
const esVideoInterno = (url = '') => /academia-videos\/file\//.test(url);

const obtenerIdYoutube = (url = '') => {
  const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)/);
  return match ? match[1] : null;
};
const obtenerIdVimeo = (url = '') => {
  const match = url.match(/vimeo\.com\/(\d+)/);
  return match ? match[1] : null;
};

const resolverUrlVideo = (cuerpoTexto = '') => (
  esVideoInterno(cuerpoTexto) ? `${api.API_BASE_URL_CONFIG}/${cuerpoTexto}` : cuerpoTexto
);

function ReproductorMaterial({ material }) {
  const url = String(material.CUERPO_TEXTO || '').trim();
  const esVideo = (material.TIPO_COMUNICADO || '').toLowerCase().includes('video');

  if (esVideo && esUrlYoutube(url)) {
    const id = obtenerIdYoutube(url);
    if (id) {
      return (
        <div style={{ borderRadius: '16px', overflow: 'hidden', aspectRatio: '16/9', marginBottom: '8px' }}>
          <iframe
            src={`https://www.youtube.com/embed/${id}`}
            title={material.TITULO}
            style={{ width: '100%', height: '100%', border: 'none' }}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      );
    }
  }

  if (esVideo && esUrlVimeo(url)) {
    const id = obtenerIdVimeo(url);
    if (id) {
      return (
        <div style={{ borderRadius: '16px', overflow: 'hidden', aspectRatio: '16/9', marginBottom: '8px' }}>
          <iframe
            src={`https://player.vimeo.com/video/${id}`}
            title={material.TITULO}
            style={{ width: '100%', height: '100%', border: 'none' }}
            allow="autoplay; fullscreen; picture-in-picture"
            allowFullScreen
          />
        </div>
      );
    }
  }

  if (esVideo && esVideoInterno(url)) {
    return (
      <video controls preload="metadata" style={{ width: '100%', borderRadius: '16px', marginBottom: '8px', background: '#000' }}>
        <source src={resolverUrlVideo(url)} />
        Tu navegador no soporta reproducción de video.
      </video>
    );
  }

  const Icono = (material.TIPO_COMUNICADO || '').toLowerCase().includes('imagen') ? Image : (material.TIPO_COMUNICADO || '').toLowerCase().includes('documento') ? FileText : Link2;
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      style={{
        display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none', color: 'var(--texto-principal)',
        border: '1px solid var(--borde-suave)', borderRadius: '18px', padding: '10px 12px',
        background: 'rgba(255,255,255,0.86)', boxShadow: '0 8px 18px rgba(15,23,42,0.04)',
      }}
    >
      <Icono size={16} color="var(--gris-secundario)" strokeWidth={1.5} />
      <strong style={{ fontSize: '13px' }}>{material.TITULO}</strong>
    </a>
  );
}

function SelectorRamaCategoria({ form, setForm, toggleCategoria, categoriasDisponibles }) {
  return (
    <>
      <div className="input-group mb-10">
        <label style={{ fontSize: '12px', fontWeight: '800' }}>Rama</label>
        <select className="form-input mt-5" value={form.rama} onChange={(e) => setForm((prev) => ({ ...prev, rama: e.target.value }))}>
          {RAMAS.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
      </div>
      <div className="input-group mb-10">
        <label style={{ fontSize: '12px', fontWeight: '800' }}>Categoría(s) destinatarias (vacío = todas)</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '6px' }}>
          {categoriasDisponibles.map((cat) => {
            const activa = form.categorias.includes(cat);
            return (
              <button
                key={cat}
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
    </>
  );
}

function AcademiaPanel({
  pupiloActivo,
  setPupiloActivo,
  pupilosDisponibles,
  jugadoresAdmin,
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
  subirVideoAcademia,
  crearQuizAcademia,
  guardarPizarraAcademia,
}) {
  const esProfesor = rolUsuario === 'staff' || rolUsuario === 'super_admin';
  const [origenMaterial, setOrigenMaterial] = useState('enlace');
  const [materialForm, setMaterialForm] = useState({ tipo: 'video', titulo: '', url: '', rama: 'General', categorias: [] });
  const [archivoVideo, setArchivoVideo] = useState(null);
  const [subiendoVideo, setSubiendoVideo] = useState(false);
  const [progresoVideo, setProgresoVideo] = useState(0);
  const [quizForm, setQuizForm] = useState({
    titulo: '',
    pregunta: '',
    opcionA: '',
    opcionB: '',
    opcionC: '',
    respuestaCorrecta: 'A',
  });
  const [pizarraForm, setPizarraForm] = useState({ nombre_tactica: '', descripcion: '', rama: 'General', categorias: [] });
  const [imagenPizarra, setImagenPizarra] = useState(null);
  const [guardandoPizarra, setGuardandoPizarra] = useState(false);

  const categoriasDisponibles = useMemo(() => {
    const set = new Set((jugadoresAdmin || []).map((j) => String(j.categoria || '').trim()).filter(Boolean));
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'es'));
  }, [jugadoresAdmin]);

  const toggleCategoriaMaterial = (cat) => {
    setMaterialForm((prev) => ({
      ...prev,
      categorias: prev.categorias.includes(cat) ? prev.categorias.filter((c) => c !== cat) : [...prev.categorias, cat],
    }));
  };

  const toggleCategoriaPizarra = (cat) => {
    setPizarraForm((prev) => ({
      ...prev,
      categorias: prev.categorias.includes(cat) ? prev.categorias.filter((c) => c !== cat) : [...prev.categorias, cat],
    }));
  };

  // El material sin categorías objetivo es visible para todos (comportamiento
  // previo). Con categorías, solo lo ven quienes calzan rama+categoría del
  // pupilo activo. Staff/admin siempre ven todo para poder gestionarlo.
  const materialesVisibles = useMemo(() => {
    if (esProfesor) return materialesAcademia || [];
    const ramaPupilo = String(pupiloActivo?.rama || '').toLowerCase();
    const categoriaPupilo = String(pupiloActivo?.categoria || '').toLowerCase();
    return (materialesAcademia || []).filter((m) => {
      const ramaMaterial = String(m.rama || 'General').toLowerCase();
      const ramaCoincide = ramaMaterial === 'general' || ramaMaterial === ramaPupilo;
      if (!ramaCoincide) return false;
      const categoriasObjetivo = Array.isArray(m.categorias_objetivo) ? m.categorias_objetivo.map((c) => String(c).toLowerCase()) : [];
      if (categoriasObjetivo.length === 0) return true;
      return categoriasObjetivo.includes(categoriaPupilo);
    });
  }, [materialesAcademia, esProfesor, pupiloActivo]);

  if (!pupiloActivo) {
    return <div className="mt-20 fade-in">Cargando datos de academia...</div>;
  }

  const handlePublicarMaterial = async () => {
    if (!materialForm.titulo.trim() || !materialForm.url.trim()) {
      showToast({ message: 'Completa título y enlace del material.', type: 'error' });
      return;
    }

    try {
      await publicarMaterialAcademia({
        titulo: materialForm.titulo.trim(),
        url: materialForm.url.trim(),
        tipo: materialForm.tipo,
        rama: materialForm.rama,
        categorias: materialForm.categorias,
      });
      setMaterialForm({ tipo: 'video', titulo: '', url: '', rama: 'General', categorias: [] });
      showToast({ message: 'Material publicado en Academia.', type: 'success' });
    } catch (error) {
      showToast({ message: `No se pudo publicar el material: ${error.message}`, type: 'error' });
    }
  };

  const handleSubirVideo = async () => {
    if (!materialForm.titulo.trim() || !archivoVideo) {
      showToast({ message: 'Completa el título y selecciona un video.', type: 'error' });
      return;
    }
    setSubiendoVideo(true);
    setProgresoVideo(0);
    try {
      await subirVideoAcademia(
        { titulo: materialForm.titulo.trim(), archivo: archivoVideo, rama: materialForm.rama, categorias: materialForm.categorias },
        { onProgress: setProgresoVideo }
      );
      setMaterialForm({ tipo: 'video', titulo: '', url: '', rama: 'General', categorias: [] });
      setArchivoVideo(null);
      showToast({ message: 'Video subido y publicado en Academia.', type: 'success' });
    } catch (error) {
      showToast({ message: `No se pudo subir el video: ${error.message}`, type: 'error' });
    } finally {
      setSubiendoVideo(false);
      setProgresoVideo(0);
    }
  };

  const handleCrearQuiz = async () => {
    if (!quizForm.titulo.trim() || !quizForm.pregunta.trim() || !quizForm.opcionA.trim() || !quizForm.opcionB.trim() || !quizForm.opcionC.trim()) {
      showToast({ message: 'Completa todos los campos del quiz.', type: 'error' });
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
      showToast({ message: 'Quiz táctico creado correctamente.', type: 'success' });
    } catch (error) {
      showToast({ message: `No se pudo crear el quiz: ${error.message}`, type: 'error' });
    }
  };

  const handleGuardarPizarra = async () => {
    if (!pizarraForm.nombre_tactica.trim()) {
      showToast({ message: 'Ponle un nombre a la táctica antes de guardar.', type: 'error' });
      return;
    }
    setGuardandoPizarra(true);
    try {
      await guardarPizarraAcademia({
        nombre_tactica: pizarraForm.nombre_tactica.trim(),
        descripcion: pizarraForm.descripcion.trim(),
        rama: pizarraForm.rama,
        categorias: pizarraForm.categorias,
        imagenBlob: imagenPizarra,
      });
      setPizarraForm({ nombre_tactica: '', descripcion: '', rama: 'General', categorias: [] });
      setImagenPizarra(null);
      showToast({ message: 'Pizarra táctica guardada correctamente.', type: 'success' });
    } catch (error) {
      showToast({ message: `No se pudo guardar la pizarra: ${error.message}`, type: 'error' });
    } finally {
      setGuardandoPizarra(false);
    }
  };

  const handleResponderQuiz = (opcion) => {
    if (quizCompletado) return;
    setOpcionSeleccionada(opcion);
    setQuizCompletado(true);

    if (opcion === quizActivo.respuestaCorrecta) {
      setAnimacionXP(true);
      setTimeout(() => setAnimacionXP(false), 2000);

      if (pupiloActivo?.rut) {
        api.gamificacionAPI.create({
          rut_jugador: pupiloActivo.rut,
          tipo_logro: 'quiz_correcto',
          puntos_obtenidos: 50,
          descripcion: `Respuesta correcta: ${quizActivo.titulo || quizActivo.pregunta || 'Quiz'}`,
        }).catch(() => {
          // Los puntos son un extra cosmetico; si falla el guardado no bloqueamos el quiz.
        });
      }
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
            <Star size={34} color="var(--gris-secundario)" strokeWidth={1.5} />
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
          <Video size={40} color="var(--gris-secundario)" strokeWidth={1.5} />
          <div className="play-button"><PlayCircle size={35} color="var(--gris-secundario)" strokeWidth={1.5} /></div>
        </div>
        <div className="video-info">
          <span className="badge-video" style={{ borderRadius: '999px', padding: '6px 10px' }}>NUEVO VIDEO</span>
          <h4 style={{ margin: '10px 0 0 0', fontSize: '16px', fontWeight: '900' }}>Análisis Zonal 2-3</h4>
        </div>
      </div>

      {materialesVisibles.length > 0 && (
        <div className="card mt-15" style={{ borderRadius: '24px' }}>
          <h4 className="form-subtitle" style={{ marginBottom: '12px', fontWeight: '900' }}>Materiales de Academia</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {materialesVisibles.slice(0, 6).map((mat, idx) => (
              <div key={mat.id || `${mat.TITULO || 'material'}-${idx}`}>
                <ReproductorMaterial material={mat} />
                <strong style={{ fontSize: '13px', display: 'block', marginTop: '4px' }}>{mat.TITULO}</strong>
                <span style={{ fontSize: '11px', color: 'var(--texto-secundario)', fontWeight: '700' }}>
                  {mat.rama || 'General'} · {(Array.isArray(mat.categorias_objetivo) && mat.categorias_objetivo.length > 0) ? mat.categorias_objetivo.join(', ') : 'Todas las categorías'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <h3 className="section-title mt-20">Desafío Semanal</h3>
      <div className="card academia-card" style={{ border: '2px solid #FF9500', borderRadius: '26px', boxShadow: '0 14px 34px rgba(15,23,42,0.08)' }}>
        <div className="academia-header">
          <span className="badge-academia" style={{ background: '#FF9500', color: 'white', borderRadius: '999px', padding: '6px 10px' }}><Brain size={12} color="var(--gris-secundario)" strokeWidth={1.5} /> QUIZ TÁCTICO</span>
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

          <div style={{ display: 'flex', gap: '6px', marginBottom: '12px' }}>
            <button type="button" className="btn-secondary" style={{ width: 'auto', padding: '8px 14px', background: origenMaterial === 'enlace' ? 'var(--azul-electrico)' : undefined, color: origenMaterial === 'enlace' ? 'white' : undefined }} onClick={() => setOrigenMaterial('enlace')}>
              <Link2 size={13} /> Enlace
            </button>
            <button type="button" className="btn-secondary" style={{ width: 'auto', padding: '8px 14px', background: origenMaterial === 'archivo' ? 'var(--azul-electrico)' : undefined, color: origenMaterial === 'archivo' ? 'white' : undefined }} onClick={() => setOrigenMaterial('archivo')}>
              <Upload size={13} /> Subir video corto
            </button>
          </div>

          {origenMaterial === 'enlace' ? (
            <div className="input-group mb-10">
              <label style={{ fontSize: '12px', fontWeight: '800' }}>Tipo de material</label>
              <select className="form-input mt-5" value={materialForm.tipo} onChange={(e) => setMaterialForm((prev) => ({ ...prev, tipo: e.target.value }))}>
                <option value="video">Video (YouTube / Vimeo / otro enlace)</option>
                <option value="imagen">Imagen de pizarra</option>
                <option value="documento">Documento</option>
              </select>
            </div>
          ) : (
            <div className="input-group mb-10">
              <label style={{ fontSize: '12px', fontWeight: '800' }}>Archivo de video (máx. 25MB, para no recargar la app)</label>
              <input type="file" accept="video/mp4,video/webm,video/quicktime" className="form-input mt-5" onChange={(e) => setArchivoVideo(e.target.files?.[0] || null)} />
            </div>
          )}

          <div className="input-group mb-10">
            <label style={{ fontSize: '12px', fontWeight: '800' }}>Título</label>
            <input className="form-input mt-5" value={materialForm.titulo} onChange={(e) => setMaterialForm((prev) => ({ ...prev, titulo: e.target.value }))} placeholder="Ej: Lecturas defensivas desde lado débil" />
          </div>

          {origenMaterial === 'enlace' && (
            <div className="input-group mb-15">
              <label style={{ fontSize: '12px', fontWeight: '800' }}>Enlace (YouTube, Vimeo, Drive, imagen o PDF)</label>
              <input className="form-input mt-5" value={materialForm.url} onChange={(e) => setMaterialForm((prev) => ({ ...prev, url: e.target.value }))} placeholder="https://..." />
            </div>
          )}

          <SelectorRamaCategoria form={materialForm} setForm={setMaterialForm} toggleCategoria={toggleCategoriaMaterial} categoriasDisponibles={categoriasDisponibles} />

          {origenMaterial === 'enlace' ? (
            <button className="btn-electric" onClick={handlePublicarMaterial}><Save size={16} color="var(--gris-secundario)" strokeWidth={1.5} /> Publicar material</button>
          ) : (
            <>
              <button className="btn-electric" onClick={handleSubirVideo} disabled={subiendoVideo}>
                <Upload size={16} /> {subiendoVideo ? `Subiendo... ${progresoVideo}%` : 'Subir y publicar video'}
              </button>
              {subiendoVideo && (
                <div style={{ marginTop: '8px', height: '8px', borderRadius: '999px', background: 'rgba(15,23,42,0.08)', overflow: 'hidden' }}>
                  <div style={{ width: `${progresoVideo}%`, height: '100%', background: 'var(--azul-electrico)', transition: 'width 0.2s ease' }} />
                </div>
              )}
            </>
          )}

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

          <PizarraTacticaCanvas onCapturar={setImagenPizarra} />
          {imagenPizarra && (
            <p style={{ textAlign: 'center', fontSize: '11px', color: 'var(--verde-victoria)', fontWeight: '800', marginTop: '6px' }}>
              Pizarra capturada. Completa la rama/categoría y guarda para publicarla.
            </p>
          )}

          <div className="mt-10">
            <SelectorRamaCategoria form={pizarraForm} setForm={setPizarraForm} toggleCategoria={toggleCategoriaPizarra} categoriasDisponibles={categoriasDisponibles} />
          </div>
          <button className="btn-secondary mt-10" onClick={handleGuardarPizarra} disabled={guardandoPizarra}>
            {guardandoPizarra ? 'Guardando...' : 'Guardar pizarra'}
          </button>
        </div>
      )}

      {Array.isArray(pizarrasAcademia) && pizarrasAcademia.length > 0 && (
        <div className="card mt-15" style={{ borderRadius: '24px' }}>
          <h4 className="form-subtitle" style={{ fontWeight: '900' }}>Últimas pizarras tácticas</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {pizarrasAcademia.slice(0, 5).map((pz, idx) => (
              <div key={pz.id || `${pz.nombre_tactica || 'tactica'}-${idx}`} style={{ border: '1px solid rgba(120,120,128,0.14)', borderRadius: '18px', padding: '12px', background: 'rgba(255,255,255,0.84)' }}>
                {pz.imagen_filename && (
                  <img
                    src={`${api.API_BASE_URL_CONFIG}/academia-pizarras/imagen/${pz.id}`}
                    alt={pz.nombre_tactica || 'Pizarra táctica'}
                    style={{ width: '100%', borderRadius: '12px', marginBottom: '8px' }}
                  />
                )}
                <strong style={{ display: 'block', fontSize: '13px' }}>{pz.nombre_tactica || 'Táctica sin nombre'}</strong>
                <span style={{ fontSize: '12px', color: 'var(--texto-secundario)' }}>
                  {pz.rama || 'General'} · {(Array.isArray(pz.categorias_objetivo) && pz.categorias_objetivo.length > 0) ? pz.categorias_objetivo.join(', ') : 'Todas las categorías'}
                </span>
                {pz.descripcion && <p style={{ margin: '6px 0 0 0', fontSize: '12px', color: 'var(--texto-secundario)' }}>{pz.descripcion}</p>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default AcademiaPanel;
