import { ShieldAlert, MessageCircle, Trophy, BarChart3, Heart, ThumbsUp, Frown } from 'lucide-react';
import { nextId } from '../utils/runtimeId';
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

  const addRSVP = (comId, respuesta) => {
    const rutUsuario = String(usuarioAutenticado?.rut || pupiloActivo?.rut || '').trim();
    const correoUsuario = String(usuarioAutenticado?.correo || pupiloActivo?.correo_apoderado || '').trim().toLowerCase();
    const actorId = rutUsuario || correoUsuario || `anon-${Date.now()}`;
    const esApoderado = esApoderadoRol;
    const justificacion = (respuesta === 'no' || respuesta === 'justificado')
      ? (window.prompt('Agrega una justificación breve (opcional):', '') || '').trim()
      : '';

    setComunicaciones(comunicaciones.map(c => {
      if (c.id === comId) {
        const citacionVinculada = (nominaCita || []).find((cita) => cita.id === c.citacion_id);
        const convocados = Array.isArray(citacionVinculada?.convocados) ? citacionVinculada.convocados : [];
        const convocadosActor = convocados.filter((conv) => {
          const correoConv = String(conv.correo_apoderado || '').trim().toLowerCase();
          const rutConv = String(conv.rut_jugador || '').trim();
          return (rutUsuario && rutConv && rutConv === rutUsuario) || (correoUsuario && correoConv && correoConv === correoUsuario);
        });

        if (c.citacion_id && convocadosActor.length === 0) {
          alert('No estás en la nómina de esta citación.');
          return c;
        }

        const convocadoPrincipal = convocadosActor[0] || null;
        const requiereExcepcion = Boolean(convocadoPrincipal?.requiere_excepcion_morosidad);
        if (requiereExcepcion && !esApoderado) {
          alert('Tu apoderado debe gestionar la excepción de citación por tesorería.');
          return c;
        }

        const solicitaExcepcion = requiereExcepcion
          ? window.confirm('Este deportista presenta morosidad. ¿Solicitar excepción de citación para revisión administrativa?')
          : false;

        const asistencias = Array.isArray(c.asistencias) ? [...c.asistencias] : [];
        const idx = asistencias.findIndex((a) => String(a.actorId || '').trim() === actorId);
        const payload = {
          respuesta,
          justificacion,
          timestamp: new Date(),
          actorId,
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
        <h6 style={{ margin: '0 0 12px 0', fontSize: '13px', fontWeight: '700', color: 'var(--texto-principal)' }}>💬 Comentarios ({comentarios.length})</h6>

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
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: com.meGusta ? '#FF3B30' : 'var(--texto-secundario)', fontWeight: com.meGusta ? '700' : '500' }}
                >
                  ❤️ {com.likes > 0 ? com.likes : ''}
                </button>
                <button
                  onClick={() => setMostrarFormComentario(prev => ({ ...prev, [`${comId}_resp_${com.id}`]: !prev[`${comId}_resp_${com.id}`] }))}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--texto-secundario)' }}
                >
                  💬 Responder
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
                            <span style={{ fontSize: '10px', color: 'var(--texto-secundario)' }}>{resp.timestamp}</span>
                          </div>
                          <p style={{ margin: '2px 0 0 0', fontSize: '12px', lineHeight: '1.3' }}>{resp.texto}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => likeComentario(comId, resp.id, com.id)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: resp.meGusta ? '#FF3B30' : 'var(--texto-secundario)', fontSize: '11px', fontWeight: resp.meGusta ? '700' : '500' }}
                      >
                        ❤️ {resp.likes > 0 ? resp.likes : ''}
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

      <div className="segment-control mb-20">
        <div className={`segment-btn ${vistaMuro === 'noticias' ? 'active' : ''}`} onClick={() => setVistaMuro('noticias')}>
          <MessageCircle size={18} color="#6B7280" strokeWidth={1.5} /> Comunicaciones
        </div>
        <div className={`segment-btn ${vistaMuro === 'resultados' ? 'active' : ''}`} onClick={() => setVistaMuro('resultados')}>
          <Trophy size={18} color="#6B7280" strokeWidth={1.5} /> Resultados
        </div>
        <div className={`segment-btn ${vistaMuro === 'encuestas' ? 'active' : ''}`} onClick={() => setVistaMuro('encuestas')}>
          <BarChart3 size={18} color="#6B7280" strokeWidth={1.5} /> Encuestas
        </div>
      </div>

      {vistaMuro === 'noticias' ? (
        <>
          {alertasPublicadas.map((alerta, i) => (
            <div key={i} className="card citacion-card fade-in" style={{ borderColor: 'rgba(255,59,48,0.22)', background: 'linear-gradient(180deg, rgba(255,59,48,0.09) 0%, rgba(255,59,48,0.03) 100%)', borderRadius: '24px' }}>
              <div className="citacion-header">
                <span className="badge-urgente" style={{ backgroundColor: '#FF3B30', borderRadius: '999px', padding: '7px 12px' }}>
                  <ShieldAlert size={12} color="#6B7280" strokeWidth={1.5} /> ALERTA DEL CLUB
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
            <div key={c.id} className="ios-rrss-card fade-in" style={{ borderLeft: `4px solid ${c.urgencia === 'Crítica' ? '#8B0000' : c.urgencia === 'Alta' ? '#FF3B30' : c.urgencia === 'Media' ? '#FF9500' : '#34C759'}`, borderRadius: '24px', boxShadow: '0 12px 28px rgba(15,23,42,0.06)' }}>
              <div className="ios-rrss-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <LogoAvatar nombre={c.TITULO} logoUrl={c.logo_url || c.logoUrl} size={28} borderRadius="999px" />
                  <span className="badge-tipo" style={{ background: c.urgencia === 'Crítica' ? '#8B0000' : c.urgencia === 'Alta' ? '#FF3B30' : c.urgencia === 'Media' ? '#FF9500' : '#34C759', color: 'white', padding: '5px 10px', borderRadius: '999px', fontSize: '11px', fontWeight: '800' }}>
                    {c.TIPO_COMUNICADO}
                  </span>
                  {c.rama !== 'General' && <span style={{ fontSize: '11px', background: 'rgba(0,0,0,0.1)', padding: '2px 6px', borderRadius: '3px' }}>{c.rama}</span>}
                  {c.categoria !== 'General' && <span style={{ fontSize: '11px', background: 'rgba(0,0,0,0.1)', padding: '2px 6px', borderRadius: '3px' }}>{c.categoria}</span>}
                </div>
                <span className="fecha-comunicado">{c.FECHA}</span>
              </div>

              <h4 className="titulo-comunicado" style={{ marginBottom: '8px', color: 'var(--texto-principal)', fontWeight: '800', fontSize: '16px' }}>
                {c.TIPO_COMUNICADO === 'Evento' ? '🎉' : c.TIPO_COMUNICADO === 'Asamblea' ? '📋' : c.TIPO_COMUNICADO === 'Suspensión' ? '⚠️' : '📢'} {c.TITULO}
              </h4>
              <p className="ios-rrss-body">{c.CUERPO_TEXTO}</p>

              {c.solicita_asistencia && (
                <div style={{ background: 'rgba(0, 122, 255, 0.08)', padding: '12px', borderRadius: '18px', marginBottom: '12px', marginTop: '10px' }}>
                  {(() => {
                    const cita = (nominaCita || []).find((x) => x.id === c.citacion_id);
                    const rutUsuario = String(usuarioAutenticado?.rut || pupiloActivo?.rut || '').trim();
                    const correoUsuario = String(usuarioAutenticado?.correo || pupiloActivo?.correo_apoderado || '').trim().toLowerCase();
                    const convocado = (cita?.convocados || []).find((conv) => {
                      const correoConv = String(conv.correo_apoderado || '').trim().toLowerCase();
                      const rutConv = String(conv.rut_jugador || '').trim();
                      return (rutUsuario && rutConv && rutConv === rutUsuario) || (correoUsuario && correoConv && correoConv === correoUsuario);
                    });

                    if (!esApoderadoRol || !convocado?.requiere_excepcion_morosidad) return null;
                    return (
                      <p style={{ margin: '0 0 8px 0', fontSize: '12px', fontWeight: '800', color: '#b36200', background: 'rgba(255,149,0,0.14)', border: '1px solid rgba(255,149,0,0.35)', borderRadius: '10px', padding: '8px 10px' }}>
                        Alerta tesorería: deportista moroso. Debes solicitar excepción de citación para confirmar asistencia.
                      </p>
                    );
                  })()}
                  <p style={{ margin: '0 0 8px 0', fontSize: '12px', fontWeight: '600', color: 'var(--texto-principal)' }}>¿Vas a asistir?</p>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <button onClick={() => addRSVP(c.id, 'si')} className="btn-confirmar" style={{ flex: 1, padding: '10px', fontSize: '13px', borderRadius: '14px', border: 'none', background: '#34C759', color: 'white', cursor: 'pointer', fontWeight: '700' }}>✓ Sí</button>
                    <button onClick={() => addRSVP(c.id, 'no')} className="btn-ausente" style={{ flex: 1, padding: '10px', fontSize: '13px', borderRadius: '14px', border: 'none', background: '#FF3B30', color: 'white', cursor: 'pointer', fontWeight: '700' }}>✕ No</button>
                    <button onClick={() => addRSVP(c.id, 'justificado')} style={{ flex: 1, padding: '10px', fontSize: '13px', borderRadius: '14px', border: '1px solid var(--borde-suave)', background: 'rgba(255,255,255,0.92)', color: 'var(--texto-principal)', cursor: 'pointer', fontWeight: '700' }}>📝 Justificar</button>
                  </div>
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
                      <IconComponent size={14} color="#6B7280" strokeWidth={1.5} fill={tieneReaccion ? reaccion.color : 'none'} />
                      {contador > 0 && <span style={{ fontSize: '11px' }}>{contador}</span>}
                    </button>
                  );
                })}
              </div>

              {c.asistencias && c.asistencias.length > 0 && (
                <div style={{ fontSize: '12px', color: 'var(--texto-secundario)', marginTop: '8px', padding: '10px 12px', background: 'rgba(0,0,0,0.02)', borderRadius: '14px' }}>
                  ✓ <strong>{c.asistencias.filter(a => a.respuesta === 'si').length}</strong> confirmados •
                  <strong>{c.asistencias.filter(a => a.respuesta === 'no').length}</strong> rechazaron •
                  <strong>{c.asistencias.filter(a => a.respuesta === 'justificado').length}</strong> justificados
                </div>
              )}

              {renderComentarios(c.id)}
            </div>
          ))}
        </>
      ) : vistaMuro === 'encuestas' ? (
        <div className="fade-in">
          <h4 style={{ color: 'var(--texto-heading)', marginBottom: '15px' }}>📊 Encuestas y Sondeos</h4>
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
                {enc.respondio && <p style={{ margin: '10px 0 0 0', fontSize: '12px', color: '#34C759', fontWeight: '600' }}>✓ Ya has votado en esta encuesta</p>}
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
