import { useMemo, useState } from 'react';
import { Brain, FileText, Image, Link2, ListChecks, PenSquare, Save, Star, Trash2, Upload } from 'lucide-react';
import { showToast } from '../utils/toast';
import { confirmAction } from '../utils/confirmDialog';
import * as api from '../api/client';
import PupiloSelector from './PupiloSelector';
import PizarraTacticaCanvas from './PizarraTacticaCanvas';
import { filtraPorRamaCategoria } from '../utils/academia';

const normalizarRutAcademia = (rut = '') => String(rut || '').replace(/\./g, '').replace(/-/g, '').trim().toUpperCase();

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
  rutUsuarioAutenticado,
  animacionXP,
  setAnimacionXP,
  respuestasQuiz,
  setRespuestasQuiz,
  quizList,
  materialesAcademia,
  pizarrasAcademia,
  publicarMaterialAcademia,
  subirVideoAcademia,
  crearQuizAcademia,
  guardarPizarraAcademia,
  actualizarMaterialAcademia,
  eliminarMaterialAcademia,
  actualizarVideoAcademia,
  eliminarVideoAcademia,
  actualizarPizarraAcademia,
  eliminarPizarraAcademia,
  actualizarQuizAcademia,
  eliminarQuizAcademia,
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
    rama: 'General',
    categorias: [],
  });
  const [pizarraForm, setPizarraForm] = useState({ nombre_tactica: '', descripcion: '', rama: 'General', categorias: [] });
  const [imagenPizarra, setImagenPizarra] = useState(null);
  const [guardandoPizarra, setGuardandoPizarra] = useState(false);

  // "Mis Publicaciones": panel de gestión del staff (ver/editar/borrar/publicar
  // lo que él mismo subió, en los 4 tipos de contenido).
  const [vistaDocente, setVistaDocente] = useState('publicar');
  const [itemEnEdicion, setItemEnEdicion] = useState(null); // `${tipo}-${id}` o null
  const [editForm, setEditForm] = useState({ titulo: '', url: '', nombre_tactica: '', descripcion: '', pregunta: '', opcionA: '', opcionB: '', opcionC: '', respuestaCorrecta: 'A', rama: 'General', categorias: [] });

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

  const toggleCategoriaQuiz = (cat) => {
    setQuizForm((prev) => ({
      ...prev,
      categorias: prev.categorias.includes(cat) ? prev.categorias.filter((c) => c !== cat) : [...prev.categorias, cat],
    }));
  };

  const toggleCategoriaEdit = (cat) => {
    setEditForm((prev) => ({
      ...prev,
      categorias: prev.categorias.includes(cat) ? prev.categorias.filter((c) => c !== cat) : [...prev.categorias, cat],
    }));
  };

  // Mismo criterio para los 3 tipos de contenido (rama 'General' o sin
  // categorias_objetivo = visible para toda la rama; con categorias_objetivo,
  // el pupilo debe calzar). Staff/admin siempre ven todo para poder gestionarlo.
  const materialesVisibles = useMemo(
    () => (esProfesor ? (materialesAcademia || []) : filtraPorRamaCategoria(materialesAcademia, pupiloActivo)),
    [materialesAcademia, esProfesor, pupiloActivo]
  );
  const pizarrasVisibles = useMemo(
    () => (esProfesor ? (pizarrasAcademia || []) : filtraPorRamaCategoria(pizarrasAcademia, pupiloActivo)),
    [pizarrasAcademia, esProfesor, pupiloActivo]
  );
  const quizVisibles = useMemo(
    () => (esProfesor ? (quizList || []) : filtraPorRamaCategoria(quizList, pupiloActivo)),
    [quizList, esProfesor, pupiloActivo]
  );

  const rutStaffActual = normalizarRutAcademia(rutUsuarioAutenticado);
  const misMateriales = useMemo(
    () => (materialesAcademia || []).filter((m) => normalizarRutAcademia(m.creado_por) === rutStaffActual),
    [materialesAcademia, rutStaffActual]
  );
  const misPizarras = useMemo(
    () => (pizarrasAcademia || []).filter((p) => normalizarRutAcademia(p.creado_por) === rutStaffActual),
    [pizarrasAcademia, rutStaffActual]
  );
  const misQuiz = useMemo(
    () => (quizList || []).filter((q) => normalizarRutAcademia(q.creado_por) === rutStaffActual),
    [quizList, rutStaffActual]
  );

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
        rama: quizForm.rama,
        categorias: quizForm.categorias,
      });
      setQuizForm({ titulo: '', pregunta: '', opcionA: '', opcionB: '', opcionC: '', respuestaCorrecta: 'A', rama: 'General', categorias: [] });
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

  const handleResponderQuiz = (quiz, opcion) => {
    if (respuestasQuiz[quiz.id]?.completado) return;
    setRespuestasQuiz((prev) => ({ ...prev, [quiz.id]: { opcionSeleccionada: opcion, completado: true } }));

    if (opcion === quiz.respuestaCorrecta) {
      setAnimacionXP(true);
      setTimeout(() => setAnimacionXP(false), 2000);

      if (pupiloActivo?.rut) {
        api.gamificacionAPI.create({
          rut_jugador: pupiloActivo.rut,
          tipo_logro: 'quiz_correcto',
          puntos_obtenidos: 50,
          descripcion: `Respuesta correcta: ${quiz.titulo || quiz.pregunta || 'Quiz'}`,
        }).catch(() => {
          // Los puntos son un extra cosmetico; si falla el guardado no bloqueamos el quiz.
        });
      }
    }
  };

  // --- "Mis Publicaciones": editar/borrar/publicar los 4 tipos de contenido ---

  const iniciarEdicion = (tipo, item) => {
    setItemEnEdicion(`${tipo}-${item.id}`);
    setEditForm({
      titulo: item.TITULO || item.titulo || '',
      url: item.CUERPO_TEXTO || '',
      nombre_tactica: item.nombre_tactica || '',
      descripcion: item.descripcion || '',
      pregunta: item.pregunta || '',
      opcionA: item.opciones?.[0] || '',
      opcionB: item.opciones?.[1] || '',
      opcionC: item.opciones?.[2] || '',
      respuestaCorrecta: item.respuestaCorrecta || 'A',
      rama: item.rama || 'General',
      categorias: Array.isArray(item.categorias_objetivo) ? item.categorias_objetivo : [],
    });
  };

  const cancelarEdicion = () => {
    setItemEnEdicion(null);
  };

  // Un material subido como archivo de video tiene academia_video_id: su
  // edición/borrado va contra la fila real de academia_videos (con su propio
  // id), no contra la comunicación que solo lo enlaza. resolverTipoEId
  // centraliza esa distinción para que el resto del código no la repita.
  const resolverTipoEId = (tipo, item) => (
    tipo === 'material' && item.academia_video_id
      ? { tipoReal: 'video', id: item.academia_video_id }
      : { tipoReal: tipo, id: item.id }
  );

  const guardarEdicion = async (tipo, item) => {
    const { tipoReal, id } = resolverTipoEId(tipo, item);
    try {
      if (tipoReal === 'material') {
        await actualizarMaterialAcademia({ id, titulo: editForm.titulo.trim(), url: editForm.url.trim(), rama: editForm.rama, categorias: editForm.categorias });
      } else if (tipoReal === 'video') {
        await actualizarVideoAcademia({ id, titulo: editForm.titulo.trim(), rama: editForm.rama, categorias: editForm.categorias });
      } else if (tipoReal === 'pizarra') {
        await actualizarPizarraAcademia({ id, nombre_tactica: editForm.nombre_tactica.trim(), descripcion: editForm.descripcion.trim(), rama: editForm.rama, categorias: editForm.categorias });
      } else if (tipoReal === 'quiz') {
        await actualizarQuizAcademia({
          id, titulo: editForm.titulo.trim(), pregunta: editForm.pregunta.trim(),
          opciones: [editForm.opcionA.trim(), editForm.opcionB.trim(), editForm.opcionC.trim()],
          respuestaCorrecta: editForm.respuestaCorrecta, rama: editForm.rama, categorias: editForm.categorias,
        });
      }
      setItemEnEdicion(null);
      showToast({ message: 'Cambios guardados.', type: 'success' });
    } catch (error) {
      showToast({ message: `No se pudo guardar: ${error.message}`, type: 'error' });
    }
  };

  const togglePublicado = async (tipo, item) => {
    const { tipoReal, id } = resolverTipoEId(tipo, item);
    const activo = item.activo === false;
    try {
      if (tipoReal === 'material') await actualizarMaterialAcademia({ id, activo });
      else if (tipoReal === 'video') await actualizarVideoAcademia({ id, activo });
      else if (tipoReal === 'pizarra') await actualizarPizarraAcademia({ id, activo });
      else if (tipoReal === 'quiz') await actualizarQuizAcademia({ id, activo });
      showToast({ message: activo ? 'Publicado.' : 'Despublicado.', type: 'success' });
    } catch (error) {
      showToast({ message: `No se pudo actualizar: ${error.message}`, type: 'error' });
    }
  };

  const eliminarItem = async (tipo, item) => {
    const { tipoReal, id } = resolverTipoEId(tipo, item);
    const etiqueta = item.TITULO || item.titulo || item.nombre_tactica || 'este contenido';
    if (!(await confirmAction({ title: 'Eliminar contenido', message: `¿Eliminar "${etiqueta}" de Academia? Esta acción no se puede deshacer.`, danger: true, confirmText: 'Eliminar' }))) return;
    try {
      if (tipoReal === 'material') await eliminarMaterialAcademia(id);
      else if (tipoReal === 'video') await eliminarVideoAcademia(id);
      else if (tipoReal === 'pizarra') await eliminarPizarraAcademia(id);
      else if (tipoReal === 'quiz') await eliminarQuizAcademia(id);
      showToast({ message: 'Eliminado.', type: 'success' });
    } catch (error) {
      showToast({ message: `No se pudo eliminar: ${error.message}`, type: 'error' });
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

      {quizVisibles.length > 0 && (
        <>
          <h3 className="section-title mt-20">Desafío{quizVisibles.length > 1 ? 's' : ''} Semanal{quizVisibles.length > 1 ? 'es' : ''}</h3>
          {quizVisibles.map((quiz) => {
            const respuesta = respuestasQuiz[quiz.id] || {};
            return (
              <div key={quiz.id} className="card academia-card mt-10" style={{ border: '2px solid #FF9500', borderRadius: '26px', boxShadow: '0 14px 34px rgba(15,23,42,0.08)' }}>
                <div className="academia-header">
                  <span className="badge-academia" style={{ background: '#FF9500', color: 'white', borderRadius: '999px', padding: '6px 10px' }}><Brain size={12} color="var(--gris-secundario)" strokeWidth={1.5} /> QUIZ TÁCTICO</span>
                  <span className="xp-recompensa">+50 XP</span>
                </div>
                <h4 className="titulo-leccion">{quiz.titulo}</h4>

                <div className="quiz-container mt-15">
                  <p className="pregunta-texto">{quiz.pregunta}</p>
                  <div className="opciones-quiz">
                    <button className={`btn-opcion ${respuesta.opcionSeleccionada === 'A' ? (quiz.respuestaCorrecta === 'A' ? 'correcta' : 'incorrecta') : ''}`} onClick={() => handleResponderQuiz(quiz, 'A')} disabled={respuesta.completado}>A) {quiz.opciones?.[0] || '-'}</button>
                    <button className={`btn-opcion ${respuesta.opcionSeleccionada === 'B' ? (quiz.respuestaCorrecta === 'B' ? 'correcta' : 'incorrecta') : ''}`} onClick={() => handleResponderQuiz(quiz, 'B')} disabled={respuesta.completado}>B) {quiz.opciones?.[1] || '-'}</button>
                    <button className={`btn-opcion ${respuesta.opcionSeleccionada === 'C' ? (quiz.respuestaCorrecta === 'C' ? 'correcta' : 'incorrecta') : ''}`} onClick={() => handleResponderQuiz(quiz, 'C')} disabled={respuesta.completado}>C) {quiz.opciones?.[2] || '-'}</button>
                  </div>
                  {respuesta.completado && (
                    <div className={`explicacion-box mt-15 ${respuesta.opcionSeleccionada === quiz.respuestaCorrecta ? 'exito' : 'fallo'}`}>
                      <strong style={{ fontSize: '14px' }}>{respuesta.opcionSeleccionada === quiz.respuestaCorrecta ? 'Correcto. Sumas XP' : 'Casi... pero no.'}</strong>
                      <p style={{ margin: '8px 0 0 0', fontSize: '13px' }}>{quiz.explicacion}</p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </>
      )}

      {esProfesor && (
        <div className="card mt-20" style={{ border: '2px solid rgba(0,122,255,0.22)', borderRadius: '24px' }}>
          <h4 className="form-subtitle" style={{ marginBottom: '10px', fontWeight: '900' }}>Panel Docente</h4>

          <div style={{ display: 'flex', gap: '6px', marginBottom: '16px' }}>
            <button type="button" className="btn-secondary" style={{ width: 'auto', padding: '8px 14px', background: vistaDocente === 'publicar' ? 'var(--azul-electrico)' : undefined, color: vistaDocente === 'publicar' ? 'white' : undefined }} onClick={() => setVistaDocente('publicar')}>
              <Upload size={13} /> Publicar
            </button>
            <button type="button" className="btn-secondary" style={{ width: 'auto', padding: '8px 14px', background: vistaDocente === 'gestionar' ? 'var(--azul-electrico)' : undefined, color: vistaDocente === 'gestionar' ? 'white' : undefined }} onClick={() => setVistaDocente('gestionar')}>
              <ListChecks size={13} /> Mis Publicaciones
            </button>
          </div>

          {vistaDocente === 'publicar' && (
          <>
          <h5 style={{ margin: '0 0 10px 0', fontSize: '14px' }}>Publicación de Contenidos</h5>

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
          <SelectorRamaCategoria form={quizForm} setForm={setQuizForm} toggleCategoria={toggleCategoriaQuiz} categoriasDisponibles={categoriasDisponibles} />
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
          </>
          )}

          {vistaDocente === 'gestionar' && (
          <div>
            <h5 style={{ margin: '0 0 4px 0', fontSize: '14px' }}>Lo que has publicado</h5>
            <p className="text-muted" style={{ marginTop: 0, marginBottom: '14px', fontSize: '12px' }}>
              Editar, publicar/despublicar o eliminar tus materiales, videos, pizarras y quiz.
            </p>

            {misMateriales.length === 0 && misPizarras.length === 0 && misQuiz.length === 0 && (
              <p className="text-muted text-center italic">Todavía no has publicado nada.</p>
            )}

            {misMateriales.length > 0 && (
              <div className="mb-15">
                <h6 style={{ margin: '0 0 8px 0', fontSize: '12px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--texto-secundario)' }}>
                  Materiales ({misMateriales.length})
                </h6>
                {misMateriales.map((mat) => {
                  const claveEdicion = `material-${mat.id}`;
                  const editando = itemEnEdicion === claveEdicion;
                  return (
                    <div key={claveEdicion} style={{ border: '1px solid rgba(120,120,128,0.14)', borderRadius: '14px', padding: '10px', marginBottom: '8px', background: mat.activo === false ? 'rgba(255,59,48,0.05)' : 'rgba(255,255,255,0.84)' }}>
                      {editando ? (
                        <>
                          <input className="form-input mb-10" placeholder="Título" value={editForm.titulo} onChange={(e) => setEditForm((p) => ({ ...p, titulo: e.target.value }))} />
                          <input className="form-input mb-10" placeholder="Enlace" value={editForm.url} onChange={(e) => setEditForm((p) => ({ ...p, url: e.target.value }))} />
                          <SelectorRamaCategoria form={editForm} setForm={setEditForm} toggleCategoria={toggleCategoriaEdit} categoriasDisponibles={categoriasDisponibles} />
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button className="btn-electric" style={{ width: 'auto', padding: '8px 14px' }} onClick={() => guardarEdicion('material', mat)}>Guardar</button>
                            <button className="btn-secondary" style={{ width: 'auto', padding: '8px 14px' }} onClick={cancelarEdicion}>Cancelar</button>
                          </div>
                        </>
                      ) : (
                        <>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                            <strong style={{ fontSize: '13px' }}>{mat.TITULO}</strong>
                            <span style={{ fontSize: '10px', fontWeight: '800', padding: '3px 8px', borderRadius: '999px', background: mat.activo === false ? 'rgba(255,59,48,0.14)' : 'rgba(52,199,89,0.14)', color: mat.activo === false ? '#b91c1c' : '#15803d' }}>
                              {mat.activo === false ? 'Despublicado' : 'Publicado'}
                            </span>
                          </div>
                          <span style={{ fontSize: '11px', color: 'var(--texto-secundario)', fontWeight: '700' }}>
                            {mat.rama || 'General'} · {(Array.isArray(mat.categorias_objetivo) && mat.categorias_objetivo.length > 0) ? mat.categorias_objetivo.join(', ') : 'Todas las categorías'}
                          </span>
                          <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
                            <button className="btn-secondary" style={{ width: 'auto', padding: '6px 10px', fontSize: '11px' }} onClick={() => iniciarEdicion('material', mat)}><PenSquare size={12} /> Editar</button>
                            <button className="btn-secondary" style={{ width: 'auto', padding: '6px 10px', fontSize: '11px' }} onClick={() => togglePublicado('material', mat)}>{mat.activo === false ? 'Publicar' : 'Despublicar'}</button>
                            <button className="btn-secondary" style={{ width: 'auto', padding: '6px 10px', fontSize: '11px', borderColor: 'rgba(255,59,48,0.35)', color: '#b91c1c' }} onClick={() => eliminarItem('material', mat)}><Trash2 size={12} /> Eliminar</button>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {misPizarras.length > 0 && (
              <div className="mb-15">
                <h6 style={{ margin: '0 0 8px 0', fontSize: '12px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--texto-secundario)' }}>
                  Pizarras tácticas ({misPizarras.length})
                </h6>
                {misPizarras.map((pz) => {
                  const claveEdicion = `pizarra-${pz.id}`;
                  const editando = itemEnEdicion === claveEdicion;
                  return (
                    <div key={claveEdicion} style={{ border: '1px solid rgba(120,120,128,0.14)', borderRadius: '14px', padding: '10px', marginBottom: '8px', background: pz.activo === false ? 'rgba(255,59,48,0.05)' : 'rgba(255,255,255,0.84)' }}>
                      {editando ? (
                        <>
                          <input className="form-input mb-10" placeholder="Nombre de la táctica" value={editForm.nombre_tactica} onChange={(e) => setEditForm((p) => ({ ...p, nombre_tactica: e.target.value }))} />
                          <textarea className="form-input mb-10" rows="2" placeholder="Descripción" value={editForm.descripcion} onChange={(e) => setEditForm((p) => ({ ...p, descripcion: e.target.value }))}></textarea>
                          <SelectorRamaCategoria form={editForm} setForm={setEditForm} toggleCategoria={toggleCategoriaEdit} categoriasDisponibles={categoriasDisponibles} />
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button className="btn-electric" style={{ width: 'auto', padding: '8px 14px' }} onClick={() => guardarEdicion('pizarra', pz)}>Guardar</button>
                            <button className="btn-secondary" style={{ width: 'auto', padding: '8px 14px' }} onClick={cancelarEdicion}>Cancelar</button>
                          </div>
                        </>
                      ) : (
                        <>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                            <strong style={{ fontSize: '13px' }}>{pz.nombre_tactica || 'Táctica sin nombre'}</strong>
                            <span style={{ fontSize: '10px', fontWeight: '800', padding: '3px 8px', borderRadius: '999px', background: pz.activo === false ? 'rgba(255,59,48,0.14)' : 'rgba(52,199,89,0.14)', color: pz.activo === false ? '#b91c1c' : '#15803d' }}>
                              {pz.activo === false ? 'Despublicado' : 'Publicado'}
                            </span>
                          </div>
                          <span style={{ fontSize: '11px', color: 'var(--texto-secundario)', fontWeight: '700' }}>
                            {pz.rama || 'General'} · {(Array.isArray(pz.categorias_objetivo) && pz.categorias_objetivo.length > 0) ? pz.categorias_objetivo.join(', ') : 'Todas las categorías'}
                          </span>
                          <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
                            <button className="btn-secondary" style={{ width: 'auto', padding: '6px 10px', fontSize: '11px' }} onClick={() => iniciarEdicion('pizarra', pz)}><PenSquare size={12} /> Editar</button>
                            <button className="btn-secondary" style={{ width: 'auto', padding: '6px 10px', fontSize: '11px' }} onClick={() => togglePublicado('pizarra', pz)}>{pz.activo === false ? 'Publicar' : 'Despublicar'}</button>
                            <button className="btn-secondary" style={{ width: 'auto', padding: '6px 10px', fontSize: '11px', borderColor: 'rgba(255,59,48,0.35)', color: '#b91c1c' }} onClick={() => eliminarItem('pizarra', pz)}><Trash2 size={12} /> Eliminar</button>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {misQuiz.length > 0 && (
              <div className="mb-15">
                <h6 style={{ margin: '0 0 8px 0', fontSize: '12px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--texto-secundario)' }}>
                  Quiz ({misQuiz.length})
                </h6>
                {misQuiz.map((quiz) => {
                  const claveEdicion = `quiz-${quiz.id}`;
                  const editando = itemEnEdicion === claveEdicion;
                  return (
                    <div key={claveEdicion} style={{ border: '1px solid rgba(120,120,128,0.14)', borderRadius: '14px', padding: '10px', marginBottom: '8px', background: quiz.activo === false ? 'rgba(255,59,48,0.05)' : 'rgba(255,255,255,0.84)' }}>
                      {editando ? (
                        <>
                          <input className="form-input mb-10" placeholder="Título" value={editForm.titulo} onChange={(e) => setEditForm((p) => ({ ...p, titulo: e.target.value }))} />
                          <textarea className="form-input mb-10" rows="2" placeholder="Pregunta" value={editForm.pregunta} onChange={(e) => setEditForm((p) => ({ ...p, pregunta: e.target.value }))}></textarea>
                          <input className="form-input mb-10" placeholder="Opción A" value={editForm.opcionA} onChange={(e) => setEditForm((p) => ({ ...p, opcionA: e.target.value }))} />
                          <input className="form-input mb-10" placeholder="Opción B" value={editForm.opcionB} onChange={(e) => setEditForm((p) => ({ ...p, opcionB: e.target.value }))} />
                          <input className="form-input mb-10" placeholder="Opción C" value={editForm.opcionC} onChange={(e) => setEditForm((p) => ({ ...p, opcionC: e.target.value }))} />
                          <select className="form-input mb-10" value={editForm.respuestaCorrecta} onChange={(e) => setEditForm((p) => ({ ...p, respuestaCorrecta: e.target.value }))}>
                            <option value="A">Respuesta correcta: A</option>
                            <option value="B">Respuesta correcta: B</option>
                            <option value="C">Respuesta correcta: C</option>
                          </select>
                          <SelectorRamaCategoria form={editForm} setForm={setEditForm} toggleCategoria={toggleCategoriaEdit} categoriasDisponibles={categoriasDisponibles} />
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button className="btn-electric" style={{ width: 'auto', padding: '8px 14px' }} onClick={() => guardarEdicion('quiz', quiz)}>Guardar</button>
                            <button className="btn-secondary" style={{ width: 'auto', padding: '8px 14px' }} onClick={cancelarEdicion}>Cancelar</button>
                          </div>
                        </>
                      ) : (
                        <>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                            <strong style={{ fontSize: '13px' }}>{quiz.titulo}</strong>
                            <span style={{ fontSize: '10px', fontWeight: '800', padding: '3px 8px', borderRadius: '999px', background: quiz.activo === false ? 'rgba(255,59,48,0.14)' : 'rgba(52,199,89,0.14)', color: quiz.activo === false ? '#b91c1c' : '#15803d' }}>
                              {quiz.activo === false ? 'Despublicado' : 'Publicado'}
                            </span>
                          </div>
                          <span style={{ fontSize: '11px', color: 'var(--texto-secundario)', fontWeight: '700' }}>
                            {quiz.rama || 'General'} · {(Array.isArray(quiz.categorias_objetivo) && quiz.categorias_objetivo.length > 0) ? quiz.categorias_objetivo.join(', ') : 'Todas las categorías'}
                          </span>
                          <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
                            <button className="btn-secondary" style={{ width: 'auto', padding: '6px 10px', fontSize: '11px' }} onClick={() => iniciarEdicion('quiz', quiz)}><PenSquare size={12} /> Editar</button>
                            <button className="btn-secondary" style={{ width: 'auto', padding: '6px 10px', fontSize: '11px' }} onClick={() => togglePublicado('quiz', quiz)}>{quiz.activo === false ? 'Publicar' : 'Despublicar'}</button>
                            <button className="btn-secondary" style={{ width: 'auto', padding: '6px 10px', fontSize: '11px', borderColor: 'rgba(255,59,48,0.35)', color: '#b91c1c' }} onClick={() => eliminarItem('quiz', quiz)}><Trash2 size={12} /> Eliminar</button>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          )}
        </div>
      )}

      {pizarrasVisibles.length > 0 && (
        <div className="card mt-15" style={{ borderRadius: '24px' }}>
          <h4 className="form-subtitle" style={{ fontWeight: '900' }}>Últimas pizarras tácticas</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {pizarrasVisibles.slice(0, 5).map((pz, idx) => (
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
