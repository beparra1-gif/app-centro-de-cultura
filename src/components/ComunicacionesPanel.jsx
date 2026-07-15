import { useState } from 'react';
import { ShieldAlert, MessageCircle, Trophy, BarChart3, Heart, ThumbsUp, Frown, PartyPopper, ClipboardList, AlertTriangle, Megaphone, Check, X, BarChart2 } from 'lucide-react';
import { nextId } from '../utils/runtimeId';
import { showToast } from '../utils/toast';
import { confirmAction } from '../utils/confirmDialog';
import LogoAvatar from './LogoAvatar';
import ResultadosCards from './ResultadosCards';

function ComunicacionesPanel({
  rolUsuario,
  usuarioAutenticado,
  pupiloActivo,
  mostrarFormComunicaciones,
  setMostrarFormComunicaciones,
  formularioComunicaciones,
  vistaMuro,
  setVistaMuro,
  alertasPublicadas,
  comunicaciones,
  setComunicaciones,
  comentariosUI,
  setComentariosUI,
  formComentario,
  setFormComentario,
  mostrarFormComentario,
  setMostrarFormComentario,
  encuestas,
  setEncuestas,
  partidos,
  nominaCita,
  setNominaCita,
}) {
  const reaccionesDisponibles = [
    { id: 'love', nombre: 'Me encanta', color: '#ec4899', icon: Heart },
    { id: 'great', nombre: 'Genial', color: '#10b981', icon: ThumbsUp },
    { id: 'sad', nombre: 'No me gusta', color: '#f59315', icon: Frown }
  ];
  const rolNormalizado = String(rolUsuario || '').toLowerCase();
  const esApoderadoRol = rolNormalizado === 'apoderado' || rolNormalizado === 'socio-apoderado';
  const [draftMensajesProfesor, setDraftMensajesProfesor] = useState({});

  const obtenerClaveMensaje = (comId, rut) => `${comId}-${rut}`;

  const obtenerCitacion = (comunicacion) => (nominaCita || []).find((cita) => cita.id === comunicacion.citacion_id) || null;

  const obtenerConvocadosVisibles = (comunicacion) => {
    const cita = obtenerCitacion(comunicacion);
    return Array.isArray(cita?.convocados) ? cita.convocados : [];
  };

  const obtenerConvocadosPropios = (comunicacion) => {
    const cita = obtenerCitacion(comunicacion);
    const rutUsuario = String(usuarioAutenticado?.rut || pupiloActivo?.rut || '').trim();
    const correoUsuario = String(usuarioAutenticado?.correo || pupiloActivo?.correo_apoderado || '').trim().toLowerCase();
    return (cita?.convocados || []).filter((conv) => {
      const correoConv = String(conv.correo_apoderado || '').trim().toLowerCase();
      const rutConv = String(conv.rut_jugador || '').trim();
      return (rutUsuario && rutConv === rutUsuario) || (correoUsuario && correoConv && correoConv === correoUsuario);
    });
  };

  const obtenerEstadoTexto = (respuesta) => {
    if (respuesta === 'si') return 'Confirmado';
    if (respuesta === 'no') return 'Inasistente';
    return 'Pendiente';
  };

  const obtenerColorEstado = (respuesta) => {
    if (respuesta === 'si') return { bg: 'rgba(52,199,89,0.14)', color: '#15803d' };
    if (respuesta === 'no') return { bg: 'rgba(255,59,48,0.14)', color: '#b91c1c' };
    return { bg: 'rgba(15,23,42,0.07)', color: 'var(--texto-secundario)' };
  };

  const calcularResumenCitacion = (comunicacion) => {
    const convocados = obtenerConvocadosVisibles(comunicacion);
    const total = convocados.length;
    const confirmados = convocados.filter((item) => item.respuesta === 'si').length;
    const inasistentes = convocados.filter((item) => item.respuesta === 'no').length;
    const respondidos = confirmados + inasistentes;
    const pendientes = Math.max(total - respondidos, 0);
    const progreso = total > 0 ? Math.round((respondidos / total) * 100) : 0;
    return { total, confirmados, inasistentes, pendientes, progreso };
  };

  const addReaccion = (comId, reaccionId) => {
    setComunicaciones(comunicaciones.map(c => {
      if (c.id === comId) {
        const nuevasReacciones = { ...c.reacciones };
        nuevasReacciones[reaccionId] = (nuevasReacciones[reaccionId] || 0) + 1;
        return { ...c, reacciones: nuevasReacciones };
      }
      return c;
    }));
  };

  const addRSVP = async (comId, convocado, respuesta) => {
    const rutUsuario = String(usuarioAutenticado?.rut || pupiloActivo?.rut || '').trim();
    const correoUsuario = String(usuarioAutenticado?.correo || pupiloActivo?.correo_apoderado || '').trim().toLowerCase();
    const actorId = rutUsuario || correoUsuario || `anon-${Date.now()}`;
    const esApoderado = esApoderadoRol;
    const claveMensaje = obtenerClaveMensaje(comId, convocado?.rut_jugador || actorId);
    const mensajeProfesor = String(draftMensajesProfesor[claveMensaje] ?? convocado?.mensaje_profesor ?? '').trim();
    const justificacion = respuesta === 'no'
      ? String(convocado?.justificacion || '').trim()
      : '';

    if (respuesta === 'no' && !justificacion) {
      showToast({ message: 'Debes justificar la inasistencia para registrar la respuesta.', type: 'error' });
      return;
    }

    const comunicacionObjetivo = comunicaciones.find((c) => c.id === comId);
    let solicitaExcepcion = false;
    if (comunicacionObjetivo) {
      const citacionVinculada = (nominaCita || []).find((cita) => cita.id === comunicacionObjetivo.citacion_id);
      const convocados = Array.isArray(citacionVinculada?.convocados) ? citacionVinculada.convocados : [];
      const convocadosActor = convocados.filter((conv) => {
        const correoConv = String(conv.correo_apoderado || '').trim().toLowerCase();
        const rutConv = String(conv.rut_jugador || '').trim();
        return (rutUsuario && rutConv && rutConv === rutUsuario) || (correoUsuario && correoConv && correoConv === correoUsuario);
      });

      if (comunicacionObjetivo.citacion_id && convocadosActor.length === 0) {
        showToast({ message: 'No estás en la nómina de esta citación.', type: 'error' });
        return;
      }

      const convocadoPrincipal = convocadosActor[0] || null;
      const requiereExcepcion = Boolean(convocadoPrincipal?.requiere_excepcion_morosidad);
      if (requiereExcepcion && !esApoderado) {
        showToast({ message: 'Tu apoderado debe gestionar la excepción de citación por tesorería.', type: 'error' });
        return;
      }

      solicitaExcepcion = requiereExcepcion
        ? await confirmAction({
            title: 'Excepción de citación',
            message: 'Este deportista presenta morosidad. ¿Solicitar excepción de citación para revisión administrativa?',
            confirmText: 'Solicitar',
          })
        : false;
    }

    setComunicaciones(comunicaciones.map(c => {
      if (c.id === comId) {
        const asistencias = Array.isArray(c.asistencias) ? [...c.asistencias] : [];
        const idx = asistencias.findIndex((a) => String(a.rut_jugador || a.actorId || '').trim() === String(convocado?.rut_jugador || actorId).trim());
        const payload = {
          respuesta,
          justificacion,
          mensaje_profesor: mensajeProfesor,
          timestamp: new Date(),
          actorId,
          rut_jugador: convocado?.rut_jugador || rutUsuario,
          nombre: convocado?.nombre || usuarioAutenticado?.nombres || pupiloActivo?.nombre || 'Usuario',
          excepcion_solicitada: solicitaExcepcion,
        };
        if (idx >= 0) asistencias[idx] = { ...asistencias[idx], ...payload };
        else asistencias.push(payload);

        if (c.citacion_id && typeof setNominaCita === 'function') {
          setNominaCita((prev) => (prev || []).map((cita) => {
            if (cita.id !== c.citacion_id) return cita;

            const convocados = (cita.convocados || []).map((conv) => {
              const correoConv = String(conv.correo_apoderado || '').trim().toLowerCase();
              const rutConv = String(conv.rut_jugador || '').trim();
              const match = (rutUsuario && rutConv && rutConv === rutUsuario) || (correoUsuario && correoConv && correoConv === correoUsuario);
              if (!match) return conv;
              return {
                ...conv,
                respuesta,
                justificacion,
                mensaje_profesor: mensajeProfesor,
                excepcion_solicitada: solicitaExcepcion || Boolean(conv.excepcion_solicitada),
                estado_excepcion: solicitaExcepcion ? 'solicitada' : conv.estado_excepcion,
                actualizado_en: new Date().toISOString(),
              };
            });

            return { ...cita, convocados };
          }));
        }

        return { ...c, asistencias };
      }
      return c;
    }));
  };

  const guardarMensajeProfesor = (comId, convocado) => {
    const claveMensaje = obtenerClaveMensaje(comId, convocado?.rut_jugador || 'sin-rut');
    const mensajeProfesor = String(draftMensajesProfesor[claveMensaje] ?? '').trim();
    const comunicacion = comunicaciones.find((item) => item.id === comId);
    const citacionId = comunicacion?.citacion_id || convocado?.citacion_id || null;

    setComunicaciones(comunicaciones.map((c) => {
      if (c.id !== comId) return c;
      const asistencias = Array.isArray(c.asistencias) ? [...c.asistencias] : [];
      const idx = asistencias.findIndex((a) => String(a.rut_jugador || '').trim() === String(convocado?.rut_jugador || '').trim());
      if (idx >= 0) {
        asistencias[idx] = { ...asistencias[idx], mensaje_profesor: mensajeProfesor, timestamp: new Date() };
      }
      return { ...c, asistencias };
    }));

    if (typeof setNominaCita === 'function' && convocado?.rut_jugador) {
      setNominaCita((prev) => (prev || []).map((cita) => {
        if (cita.id !== citacionId) return cita;
        return {
          ...cita,
          convocados: (cita.convocados || []).map((item) => item.rut_jugador === convocado.rut_jugador ? { ...item, mensaje_profesor: mensajeProfesor, actualizado_en: new Date().toISOString() } : item),
        };
      }));
    }

    showToast({ message: 'Mensaje al profesor actualizado.', type: 'success' });
  };

  const voteEncuesta = (encId, opcion) => {
    setEncuestas(encuestas.map(e => {
      if (e.id === encId) {
        return { ...e, votos: { ...e.votos, [opcion]: (e.votos[opcion] || 0) + 1 }, respondio: true };
      }
      return e;
    }));
  };

  const addComentario = (comId, texto, parentId = null) => {
    if (!texto.trim()) return;
    const nuevoComentario = {
      id: nextId(),
      usuario: rolUsuario === 'admin' ? 'Administrador' : rolUsuario === 'staff' ? 'Entrenador' : rolUsuario === 'socio' ? 'Socio' : 'Usuario',
      avatar: rolUsuario === 'admin' ? '👨‍💼' : rolUsuario === 'staff' ? '👨‍🏫' : rolUsuario === 'socio' ? '👤' : '👤',
      texto,
      timestamp: new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' }),
      likes: 0,
      meGusta: false,
      respuestas: [],
    };

    const key = `${comId}${parentId ? `_resp_${parentId}` : ''}`;

    if (parentId) {
      setComentariosUI(prev => ({
        ...prev,
        [comId]: prev[comId]?.map(c => c.id === parentId ? { ...c, respuestas: [...(c.respuestas || []), nuevoComentario] } : c) || [],
      }));
    } else {
      setComentariosUI(prev => ({
        ...prev,
        [comId]: [...(prev[comId] || []), nuevoComentario],
      }));
    }

    setFormComentario(prev => ({ ...prev, [key]: '' }));
  };

  const likeComentario = (comId, comentId, parentId = null) => {
    setComentariosUI(prev => {
      const comentarios = prev[comId] || [];
      if (parentId) {
        return {
          ...prev,
          [comId]: comentarios.map(c =>
            c.id === parentId
              ? { ...c, respuestas: c.respuestas.map(r => r.id === comentId ? { ...r, meGusta: !r.meGusta, likes: r.meGusta ? r.likes - 1 : r.likes + 1 } : r) }
              : c
          ),
        };
      }
      return {
        ...prev,
        [comId]: comentarios.map(c => c.id === comentId ? { ...c, meGusta: !c.meGusta, likes: c.meGusta ? c.likes - 1 : c.likes + 1 } : c),
      };
    });
  };

  const renderComentarios = (comId) => {
    const comentarios = comentariosUI[comId] || [];
    return (
      <div style={{ marginTop: '15px', paddingTop: '15px', borderTop: '1px solid var(--borde-suave)' }}>
        <h6 style={{ margin: '0 0 12px 0', fontSize: '13px', fontWeight: '700', color: 'var(--texto-principal)', display: 'flex', alignItems: 'center', gap: '6px' }}><MessageCircle size={14} /> Comentarios ({comentarios.length})</h6>

        <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
          <input
            type="text"
            placeholder="Escribe un comentario..."
            value={formComentario[comId] || ''}
            onChange={e => setFormComentario(prev => ({ ...prev, [comId]: e.target.value }))}
            onKeyPress={e => e.key === 'Enter' && addComentario(comId, formComentario[comId] || '')}
            style={{ flex: 1, padding: '8px 10px', borderRadius: '14px', border: '1px solid var(--borde-suave)', fontSize: '13px' }}
          />
          <button
            onClick={() => addComentario(comId, formComentario[comId] || '')}
            style={{ padding: '8px 12px', background: 'linear-gradient(180deg, #2f8cff 0%, var(--azul-electrico) 100%)', color: 'white', border: 'none', borderRadius: '14px', cursor: 'pointer', fontSize: '12px', fontWeight: '700' }}
          >
            ↩️
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {comentarios.map(com => (
            <div key={com.id} style={{ background: 'rgba(0,0,0,0.02)', padding: '10px', borderRadius: '14px', borderLeft: '2px solid var(--azul-electrico)' }}>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '6px' }}>
                <span style={{ fontSize: '18px' }}>{com.avatar}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: '700', fontSize: '13px', color: 'var(--texto-principal)' }}>{com.usuario}</span>
                    <span style={{ fontSize: '11px', color: 'var(--texto-secundario)' }}>{com.timestamp}</span>
                  </div>
                  <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: 'var(--texto-principal)', lineHeight: '1.4' }}>{com.texto}</p>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px', fontSize: '12px' }}>
                <button
                  onClick={() => likeComentario(comId, com.id)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: com.meGusta ? 'var(--rojo-alerta)' : 'var(--texto-secundario)', fontWeight: com.meGusta ? '700' : '500', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                >
                  <Heart size={13} fill={com.meGusta ? 'var(--rojo-alerta)' : 'none'} /> {com.likes > 0 ? com.likes : ''}
                </button>
                <button
                  onClick={() => setMostrarFormComentario(prev => ({ ...prev, [`${comId}_resp_${com.id}`]: !prev[`${comId}_resp_${com.id}`] }))}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--texto-secundario)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                >
                  <MessageCircle size={13} /> Responder
                </button>
              </div>

              {com.respuestas && com.respuestas.length > 0 && (
                <div style={{ marginTop: '10px', paddingLeft: '20px', borderLeft: '1px solid var(--borde-suave)' }}>
                  {com.respuestas.map(resp => (
                    <div key={resp.id} style={{ background: 'rgba(0,122,255,0.03)', padding: '10px', borderRadius: '14px', marginBottom: '6px' }}>
                      <div style={{ display: 'flex', gap: '6px', marginBottom: '4px' }}>
                        <span style={{ fontSize: '16px' }}>{resp.avatar}</span>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontWeight: '700', fontSize: '12px' }}>{resp.usuario}</span>
                            <span style={{ fontSize: '11px', color: 'var(--texto-secundario)' }}>{resp.timestamp}</span>
                          </div>
                          <p style={{ margin: '2px 0 0 0', fontSize: '12px', lineHeight: '1.3' }}>{resp.texto}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => likeComentario(comId, resp.id, com.id)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: resp.meGusta ? 'var(--rojo-alerta)' : 'var(--texto-secundario)', fontSize: '11px', fontWeight: resp.meGusta ? '700' : '500', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                      >
                        <Heart size={11} fill={resp.meGusta ? 'var(--rojo-alerta)' : 'none'} /> {resp.likes > 0 ? resp.likes : ''}
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {mostrarFormComentario[`${comId}_resp_${com.id}`] && (
                <div style={{ marginTop: '10px', display: 'flex', gap: '8px', paddingLeft: '20px' }}>
                  <input
                    type="text"
                    placeholder={`Responder a ${com.usuario}...`}
                    value={formComentario[`${comId}_resp_${com.id}`] || ''}
                    onChange={e => setFormComentario(prev => ({ ...prev, [`${comId}_resp_${com.id}`]: e.target.value }))}
                    onKeyPress={e => e.key === 'Enter' && (addComentario(comId, formComentario[`${comId}_resp_${com.id}`] || '', com.id), setMostrarFormComentario(prev => ({ ...prev, [`${comId}_resp_${com.id}`]: false }))) }
                    style={{ flex: 1, padding: '8px 10px', borderRadius: '16px', border: '1px solid var(--borde-suave)', fontSize: '12px' }}
                  />
                  <button
                    onClick={() => (addComentario(comId, formComentario[`${comId}_resp_${com.id}`] || '', com.id), setMostrarFormComentario(prev => ({ ...prev, [`${comId}_resp_${com.id}`]: false }))) }
                    style={{ padding: '8px 10px', background: 'linear-gradient(180deg, #2f8cff 0%, var(--azul-electrico) 100%)', color: 'white', border: 'none', borderRadius: '16px', cursor: 'pointer', fontSize: '11px', fontWeight: '700' }}
                  >
                    ↩️
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="mt-20">
      {rolUsuario === 'admin' && (
        <button onClick={() => setMostrarFormComunicaciones(!mostrarFormComunicaciones)} className="btn-electric" style={{ width: '100%', padding: '12px', marginBottom: '15px', borderRadius: '16px', border: 'none', color: 'white', fontWeight: '700', cursor: 'pointer', fontSize: '14px' }}>
          <MessageCircle size={16} color="white" strokeWidth={1.5} style={{ marginRight: '6px', display: 'inline' }} /> {mostrarFormComunicaciones ? 'Cerrar' : 'Nueva Comunicación'}
        </button>
      )}

      {mostrarFormComunicaciones && formularioComunicaciones}

      <div className="scroll-horizontal-menu mb-20">
        <div className="segment-control">
          <button type="button" className={`segment-btn ${vistaMuro === 'noticias' ? 'active' : ''}`} onClick={() => setVistaMuro('noticias')}>
            <MessageCircle size={18} color="var(--gris-secundario)" strokeWidth={1.5} /> Comunicaciones
          </button>
          <button type="button" className={`segment-btn ${vistaMuro === 'resultados' ? 'active' : ''}`} onClick={() => setVistaMuro('resultados')}>
            <Trophy size={18} color="var(--gris-secundario)" strokeWidth={1.5} /> Resultados
          </button>
          <button type="button" className={`segment-btn ${vistaMuro === 'encuestas' ? 'active' : ''}`} onClick={() => setVistaMuro('encuestas')}>
            <BarChart3 size={18} color="var(--gris-secundario)" strokeWidth={1.5} /> Encuestas
          </button>
        </div>
      </div>

      {vistaMuro === 'noticias' ? (
        <>
          {alertasPublicadas.map((alerta, i) => (
            <div key={i} className="card citacion-card fade-in" style={{ borderColor: 'rgba(255,59,48,0.22)', background: 'linear-gradient(180deg, rgba(255,59,48,0.09) 0%, rgba(255,59,48,0.03) 100%)', borderRadius: '24px' }}>
              <div className="citacion-header">
                <span className="badge-urgente" style={{ backgroundColor: 'var(--rojo-alerta)', borderRadius: '999px', padding: '7px 12px' }}>
                  <ShieldAlert size={12} color="var(--gris-secundario)" strokeWidth={1.5} /> ALERTA DEL CLUB
                </span>
              </div>
              <h4 style={{ color: '#C1121F', margin: '10px 0 0 0', fontSize: '16px', fontWeight: '900' }}>{alerta}</h4>
            </div>
          ))}

          {comunicaciones.length === 0 && alertasPublicadas.length === 0 && (
            <div className="card fade-in" style={{ borderRadius: '24px', background: 'linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(248,250,255,0.96) 100%)' }}>
              <h4 style={{ margin: '0 0 6px 0', fontWeight: '900', fontSize: '16px' }}>Sin comunicaciones publicadas</h4>
              <p style={{ margin: 0, fontSize: '13px', color: 'var(--texto-secundario)' }}>
                Aún no hay noticias ni avisos para mostrar.
              </p>
            </div>
          )}

          {comunicaciones.map(c => (
            <div key={c.id} className="ios-rrss-card fade-in" style={{ borderLeft: `4px solid ${c.urgencia === 'Crítica' ? '#8B0000' : c.urgencia === 'Alta' ? 'var(--rojo-alerta)' : c.urgencia === 'Media' ? '#FF9500' : '#34C759'}`, borderRadius: '24px', boxShadow: '0 12px 28px rgba(15,23,42,0.06)' }}>
              <div className="ios-rrss-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <LogoAvatar nombre={c.TITULO} logoUrl={c.logo_url || c.logoUrl} size={28} borderRadius="999px" />
                  <span className="badge-tipo" style={{ background: c.urgencia === 'Crítica' ? '#8B0000' : c.urgencia === 'Alta' ? 'var(--rojo-alerta)' : c.urgencia === 'Media' ? '#FF9500' : '#34C759', color: 'white', padding: '5px 10px', borderRadius: '999px', fontSize: '11px', fontWeight: '800' }}>
                    {c.TIPO_COMUNICADO}
                  </span>
                  {c.rama !== 'General' && <span style={{ fontSize: '11px', background: 'rgba(0,0,0,0.1)', padding: '2px 6px', borderRadius: '3px' }}>{c.rama}</span>}
                  {c.categoria !== 'General' && <span style={{ fontSize: '11px', background: 'rgba(0,0,0,0.1)', padding: '2px 6px', borderRadius: '3px' }}>{c.categoria}</span>}
                </div>
                <span className="fecha-comunicado">{c.FECHA}</span>
              </div>

              <h4 className="titulo-comunicado" style={{ marginBottom: '8px', color: 'var(--texto-principal)', fontWeight: '800', fontSize: '16px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                {c.TIPO_COMUNICADO === 'Evento' ? <PartyPopper size={16} /> : c.TIPO_COMUNICADO === 'Asamblea' ? <ClipboardList size={16} /> : c.TIPO_COMUNICADO === 'Suspensión' ? <AlertTriangle size={16} color="var(--naranja-aviso)" /> : <Megaphone size={16} />} {c.TITULO}
              </h4>
              <p className="ios-rrss-body">{c.CUERPO_TEXTO}</p>

              {c.solicita_asistencia && (
                <div style={{ background: 'rgba(0, 122, 255, 0.08)', padding: '12px', borderRadius: '18px', marginBottom: '12px', marginTop: '10px' }}>
                  {(() => {
                    const cita = obtenerCitacion(c);
                    const propios = obtenerConvocadosPropios(c);
                    const convocados = obtenerConvocadosVisibles(c);
                    const { confirmados, inasistentes, pendientes, progreso } = calcularResumenCitacion(c);
                    const rutUsuario = String(usuarioAutenticado?.rut || pupiloActivo?.rut || '').trim();
                    const correoUsuario = String(usuarioAutenticado?.correo || pupiloActivo?.correo_apoderado || '').trim().toLowerCase();
                    const actorId = rutUsuario || correoUsuario || 'anon';
                    const rsvpPropio = (c.asistencias || []).find((item) => String(item.rut_jugador || item.actorId || '').trim() === actorId);

                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {cita && (
                          <div style={{ background: 'rgba(255,255,255,0.72)', borderRadius: '14px', padding: '10px' }}>
                            <div style={{ fontSize: '13px', fontWeight: '800', color: 'var(--texto-principal)' }}>
                              {cita.tipo_competencia} · {cita.competencia_nombre} · vs {cita.rival_nombre}
                            </div>
                            <div style={{ marginTop: '4px', fontSize: '12px', color: 'var(--texto-secundario)' }}>
                              Día {cita.dia_citacion} · Citación {cita.hora_citacion} · Presentación {cita.hora_presentacion}
                            </div>
                            <div style={{ marginTop: '4px', fontSize: '12px', color: 'var(--texto-secundario)' }}>
                              Responsable: {cita.responsable_nombre || c.responsable_nombre || 'Administración CCF'}
                            </div>
                            <div className="recaud-bar" style={{ marginTop: '10px' }}>
                              <div className="recaud-bar-fill" style={{ width: `${progreso}%`, background: 'linear-gradient(90deg, var(--azul-electrico), var(--verde-victoria))' }} />
                            </div>
                            <div style={{ marginTop: '6px', fontSize: '12px', color: 'var(--texto-secundario)', fontWeight: '700' }}>
                              {progreso}% respondida · Confirmados {confirmados} · Inasistentes {inasistentes} · Pendientes {pendientes}
                            </div>
                          </div>
                        )}

                        {convocados.length > 0 && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {(convocados || []).map((convocado) => {
                              const esPropio = propios.some((item) => item.rut_jugador === convocado.rut_jugador);
                              const colores = obtenerColorEstado(convocado.respuesta);
                              const claveMensaje = obtenerClaveMensaje(c.id, convocado.rut_jugador);
                              const mensajeActual = draftMensajesProfesor[claveMensaje] ?? convocado.mensaje_profesor ?? '';
                              return (
                                <div key={`${c.id}-${convocado.rut_jugador}`} style={{ border: '1px solid rgba(15,23,42,0.08)', borderRadius: '14px', padding: '10px', background: 'rgba(255,255,255,0.72)' }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                    <div>
                                      <div style={{ fontSize: '13px', fontWeight: '800', color: 'var(--texto-principal)' }}>{convocado.nombre}</div>
                                      <div style={{ fontSize: '11px', color: 'var(--texto-secundario)' }}>{convocado.rama} · {convocado.categoria}</div>
                                    </div>
                                    <span style={{ padding: '5px 10px', borderRadius: '999px', background: colores.bg, color: colores.color, fontSize: '11px', fontWeight: '900' }}>
                                      {obtenerEstadoTexto(convocado.respuesta)}
                                    </span>
                                  </div>

                                  {convocado.requiere_excepcion_morosidad && esApoderadoRol && esPropio && (
                                    <p style={{ margin: '8px 0 0 0', fontSize: '12px', fontWeight: '800', color: '#b36200', background: 'rgba(255,149,0,0.14)', border: '1px solid rgba(255,149,0,0.35)', borderRadius: '10px', padding: '8px 10px' }}>
                                      Alerta tesorería: deportista moroso. Debes solicitar excepción de citación para confirmar asistencia.
                                    </p>
                                  )}

                                  {esPropio && (
                                    <>
                                      <div style={{ marginTop: '8px', fontSize: '12px', fontWeight: '700', color: 'var(--texto-principal)' }}>Selecciona una opción de asistencia</div>
                                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '8px' }}>
                                        <button onClick={() => addRSVP(c.id, convocado, 'si')} className="btn-confirmar" style={{ flex: 1, minWidth: '120px', padding: '10px', fontSize: '13px', borderRadius: '14px', border: 'none', background: convocado.respuesta === 'si' ? '#15803d' : '#34C759', color: 'white', cursor: 'pointer', fontWeight: '700', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}><Check size={14} /> Sí asiste</button>
                                        <button onClick={() => addRSVP(c.id, convocado, 'no')} className="btn-ausente" style={{ flex: 1, minWidth: '120px', padding: '10px', fontSize: '13px', borderRadius: '14px', border: 'none', background: 'var(--rojo-alerta)', color: 'white', cursor: 'pointer', fontWeight: '700', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}><X size={14} /> No asiste</button>
                                      </div>

                                      {convocado.respuesta === 'no' && (
                                        <div style={{ marginTop: '8px' }}>
                                          <input
                                            className="form-input"
                                            placeholder="Justificación obligatoria"
                                            value={convocado.justificacion || ''}
                                            onChange={(e) => {
                                              const valor = e.target.value;
                                              setNominaCita((prev) => (prev || []).map((citaItem) => citaItem.id !== c.citacion_id ? citaItem : ({
                                                ...citaItem,
                                                convocados: (citaItem.convocados || []).map((item) => item.rut_jugador === convocado.rut_jugador ? { ...item, justificacion: valor } : item),
                                              })));
                                            }}
                                          />
                                        </div>
                                      )}

                                      <div style={{ marginTop: '8px' }}>
                                        <textarea
                                          className="form-input"
                                          rows="2"
                                          placeholder="Mensaje opcional al profesor"
                                          value={mensajeActual}
                                          onChange={(e) => setDraftMensajesProfesor((prev) => ({ ...prev, [claveMensaje]: e.target.value }))}
                                        />
                                      </div>
                                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginTop: '8px' }}>
                                        <button className="btn-secondary" style={{ width: 'auto', padding: '8px 12px' }} onClick={() => guardarMensajeProfesor(c.id, { ...convocado, citacion_id: c.citacion_id })}>
                                          Guardar mensaje al profesor
                                        </button>
                                        {convocado.respuesta && (
                                          <span style={{ fontSize: '12px', fontWeight: '800', color: 'var(--texto-secundario)' }}>
                                            Información de asistencia completada: usted {convocado.respuesta === 'si' ? 'sí asiste' : 'no asiste'}.
                                          </span>
                                        )}
                                      </div>
                                    </>
                                  )}

                                  {!esPropio && convocado.justificacion && (
                                    <div style={{ marginTop: '8px', fontSize: '11px', color: 'var(--texto-secundario)' }}>
                                      Justificación: {convocado.justificacion}
                                    </div>
                                  )}
                                  {!esPropio && convocado.mensaje_profesor && (
                                    <div style={{ marginTop: '4px', fontSize: '11px', color: 'var(--texto-secundario)' }}>
                                      Mensaje al profesor: {convocado.mensaje_profesor}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {!cita && (
                          <div style={{ background: 'rgba(255,255,255,0.72)', borderRadius: '14px', padding: '10px' }}>
                            <div style={{ fontSize: '12px', fontWeight: '700', color: 'var(--texto-principal)', marginBottom: '8px' }}>Selecciona una opción de asistencia</div>
                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                              <button onClick={() => addRSVP(c.id, null, 'si')} className="btn-confirmar" style={{ flex: 1, minWidth: '120px', padding: '10px', fontSize: '13px', borderRadius: '14px', border: 'none', background: '#34C759', color: 'white', cursor: 'pointer', fontWeight: '700', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}><Check size={14} /> Sí asiste</button>
                              <button onClick={() => addRSVP(c.id, null, 'no')} className="btn-ausente" style={{ flex: 1, minWidth: '120px', padding: '10px', fontSize: '13px', borderRadius: '14px', border: 'none', background: 'var(--rojo-alerta)', color: 'white', cursor: 'pointer', fontWeight: '700', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}><X size={14} /> No asiste</button>
                            </div>
                            {rsvpPropio?.respuesta && (
                              <div style={{ marginTop: '8px', fontSize: '12px', fontWeight: '800', color: 'var(--texto-secundario)' }}>
                                Información de asistencia completada: usted {rsvpPropio.respuesta === 'si' ? 'sí asiste' : 'no asiste'}.
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              )}

              <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginBottom: '10px', paddingBottom: '10px', borderBottom: '1px solid var(--borde-suave)' }}>
                {reaccionesDisponibles.map(reaccion => {
                  const IconComponent = reaccion.icon;
                  const tieneReaccion = Object.keys(c.reacciones || {}).includes(reaccion.id);
                  const contador = (c.reacciones || {})[reaccion.id] || 0;
                  return (
                    <button 
                      key={reaccion.id} 
                      onClick={() => addReaccion(c.id, reaccion.id)} 
                      style={{ 
                        padding: '8px 12px', 
                        borderRadius: '10px', 
                        background: tieneReaccion ? `${reaccion.color}15` : 'rgba(120,120,128,0.08)', 
                        border: `1.5px solid ${tieneReaccion ? reaccion.color : '#E5E7EB'}`, 
                        cursor: 'pointer', 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '4px', 
                        transition: '0.2s',
                        fontWeight: '700',
                        fontSize: '12px',
                        color: tieneReaccion ? reaccion.color : 'var(--texto-secundario)'
                      }}
                      title={reaccion.nombre}
                    >
                      <IconComponent size={14} color="var(--gris-secundario)" strokeWidth={1.5} fill={tieneReaccion ? reaccion.color : 'none'} />
                      {contador > 0 && <span style={{ fontSize: '11px' }}>{contador}</span>}
                    </button>
                  );
                })}
              </div>

              {!c.citacion_id && c.asistencias && c.asistencias.length > 0 && (
                <div style={{ fontSize: '12px', color: 'var(--texto-secundario)', marginTop: '8px', padding: '10px 12px', background: 'rgba(0,0,0,0.02)', borderRadius: '14px', display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
                  <Check size={13} /> <strong>{c.asistencias.filter(a => a.respuesta === 'si').length}</strong> confirmados •
                  <strong>{c.asistencias.filter(a => a.respuesta === 'no').length}</strong> rechazaron •
                  Pendientes según convocatoria
                </div>
              )}

              {renderComentarios(c.id)}
            </div>
          ))}
        </>
      ) : vistaMuro === 'encuestas' ? (
        <div className="fade-in">
          <h4 style={{ color: 'var(--texto-heading)', marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '6px' }}><BarChart2 size={17} /> Encuestas y Sondeos</h4>
          {encuestas.map(enc => {
            const totalVotos = Object.values(enc.votos).reduce((a, b) => a + b, 0);
            return (
              <div key={enc.id} className="card mb-15" style={{ padding: '16px', background: 'linear-gradient(180deg, rgba(52, 199, 89, 0.06), rgba(0, 122, 255, 0.04))', borderRadius: '24px' }}>
                <h5 style={{ color: 'var(--texto-principal)', margin: '0 0 15px 0', fontWeight: '900', fontSize: '15px' }}>{enc.titulo}</h5>
                {enc.opciones.map(opcion => {
                  const votos = enc.votos[opcion] || 0;
                  const porcentaje = totalVotos > 0 ? (votos / totalVotos) * 100 : 0;
                  return (
                    <div key={opcion} style={{ marginBottom: '12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                        <span style={{ fontSize: '13px', fontWeight: '500' }}>{opcion}</span>
                        <span style={{ fontSize: '12px', color: 'var(--texto-secundario)', fontWeight: '600' }}>{votos} votos ({porcentaje.toFixed(0)}%)</span>
                      </div>
                      <div style={{ width: '100%', height: '20px', background: 'rgba(120,120,128,0.10)', borderRadius: '999px', overflow: 'hidden' }}>
                        <div style={{ width: `${porcentaje}%`, height: '100%', background: 'linear-gradient(90deg, #007AFF, #34C759)', transition: 'width 0.3s' }}></div>
                      </div>
                      {!enc.respondio && (
                        <button onClick={() => voteEncuesta(enc.id, opcion)} style={{ marginTop: '6px', padding: '10px 12px', fontSize: '12px', background: 'linear-gradient(180deg, #2f8cff 0%, var(--azul-electrico) 100%)', color: 'white', border: 'none', borderRadius: '14px', cursor: 'pointer', fontWeight: '800', width: '100%' }}>
                          Votar por {opcion}
                        </button>
                      )}
                    </div>
                  );
                })}
                {enc.respondio && <p style={{ margin: '10px 0 0 0', fontSize: '12px', color: '#34C759', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px' }}><Check size={13} /> Ya has votado en esta encuesta</p>}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="mt-20 fade-in">
          <ResultadosCards partidos={partidos} />
        </div>
      )}
    </div>
  );
}

export default ComunicacionesPanel;
