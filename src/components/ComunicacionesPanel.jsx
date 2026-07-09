import { CheckCircle, FileDown, MapPin, ShieldAlert, XSquare } from 'lucide-react';
import { nextId } from '../utils/runtimeId';
import ResultadosCards from './ResultadosCards';

function ComunicacionesPanel({
  rolUsuario,
  mostrarFormComunicaciones,
  setMostrarFormComunicaciones,
  renderFormularioComunicaciones,
  vistaMuro,
  setVistaMuro,
  alertasPublicadas,
  respuestaCitacion,
  setRespuestaCitacion,
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
  partidosPrueba,
}) {
  const emojisReacciones = ['👍', '❤️', '😂', '😮', '😢', '😡'];

  const addReaccion = (comId, emoji) => {
    setComunicaciones(comunicaciones.map(c => {
      if (c.id === comId) {
        const nuevasReacciones = { ...c.reacciones };
        nuevasReacciones[emoji] = (nuevasReacciones[emoji] || 0) + 1;
        return { ...c, reacciones: nuevasReacciones };
      }
      return c;
    }));
  };

  const addRSVP = (comId, respuesta) => {
    setComunicaciones(comunicaciones.map(c => {
      if (c.id === comId) {
        return { ...c, asistencias: [...c.asistencias, { respuesta, timestamp: new Date() }] };
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
            style={{ flex: 1, padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--borde-suave)', fontSize: '13px' }}
          />
          <button
            onClick={() => addComentario(comId, formComentario[comId] || '')}
            style={{ padding: '8px 12px', background: 'var(--azul-electrico)', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: '700' }}
          >
            ↩️
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {comentarios.map(com => (
            <div key={com.id} style={{ background: 'rgba(0,0,0,0.02)', padding: '10px', borderRadius: '6px', borderLeft: '2px solid var(--azul-electrico)' }}>
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
                    <div key={resp.id} style={{ background: 'rgba(0,122,255,0.03)', padding: '8px', borderRadius: '4px', marginBottom: '6px' }}>
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
                    onKeyPress={e => e.key === 'Enter' && (addComentario(comId, formComentario[`${comId}_resp_${com.id}`] || '', com.id), setMostrarFormComentario(prev => ({ ...prev, [`${comId}_resp_${com.id}`]: false })))}
                    style={{ flex: 1, padding: '6px 8px', borderRadius: '4px', border: '1px solid var(--borde-suave)', fontSize: '12px' }}
                  />
                  <button
                    onClick={() => (addComentario(comId, formComentario[`${comId}_resp_${com.id}`] || '', com.id), setMostrarFormComentario(prev => ({ ...prev, [`${comId}_resp_${com.id}`]: false })))}
                    style={{ padding: '6px 10px', background: 'var(--azul-electrico)', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', fontWeight: '700' }}
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
        <button onClick={() => setMostrarFormComunicaciones(!mostrarFormComunicaciones)} className="btn-electric" style={{ width: '100%', padding: '12px', marginBottom: '15px', borderRadius: '8px', border: 'none', color: 'white', fontWeight: '700', cursor: 'pointer', fontSize: '14px' }}>
          📢 {mostrarFormComunicaciones ? 'Cerrar' : 'Nueva Comunicación'}
        </button>
      )}

      {mostrarFormComunicaciones && renderFormularioComunicaciones()}

      {rolUsuario === 'visita' && (
        <div className="card mb-20 fade-in panel-surface" style={{ background: 'linear-gradient(135deg, var(--azul-marino), #1a2a42)', color: 'white', border: 'none' }}>
          <h4 style={{ margin: '0 0 10px 0', display: 'flex', alignItems: 'center', gap: '8px' }}><FileDown size={18} /> Fixture y Documentos</h4>
          <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.7)' }}>Descarga las bases del torneo y revisa los horarios oficiales de tu equipo.</p>
          <button className="btn-secondary mt-10" style={{ background: 'rgba(255,255,255,0.1)', color: 'white' }}>Descargar PDF Bases 2026</button>
        </div>
      )}

      <div className="segment-control mb-20">
        <div className={`segment-btn ${vistaMuro === 'noticias' ? 'active' : ''}`} onClick={() => setVistaMuro('noticias')}>
          📢 Comunicaciones
        </div>
        <div className={`segment-btn ${vistaMuro === 'resultados' ? 'active' : ''}`} onClick={() => setVistaMuro('resultados')}>
          🏆 Resultados
        </div>
        <div className={`segment-btn ${vistaMuro === 'encuestas' ? 'active' : ''}`} onClick={() => setVistaMuro('encuestas')}>
          📊 Encuestas
        </div>
      </div>

      {vistaMuro === 'noticias' ? (
        <>
          {alertasPublicadas.map((alerta, i) => (
            <div key={i} className="card citacion-card fade-in" style={{ borderColor: '#FF3B30', background: '#fff0f0' }}>
              <div className="citacion-header">
                <span className="badge-urgente" style={{ backgroundColor: '#FF3B30' }}>
                  <ShieldAlert size={12} /> ALERTA DEL CLUB
                </span>
              </div>
              <h4 style={{ color: '#FF3B30', margin: 0 }}>{alerta}</h4>
            </div>
          ))}

          {(rolUsuario === 'jugador' || rolUsuario === 'visita') && (
            <div className="card citacion-card fade-in">
              <div className="citacion-header">
                <span className="badge-urgente">ACCIÓN REQUERIDA</span>
              </div>
              <h4 className="titulo-citacion">🏀 Convocatoria Oficial</h4>
              <div className="info-citacion">
                <p><strong>Rival:</strong> {rolUsuario === 'visita' ? 'Local CCF' : 'Sportiva Italiana'}</p>
                <p><strong>Fecha:</strong> Sábado 10:00 hrs</p>
                <p className="ubicacion-texto"><MapPin size={14} /> Gimnasio Arlegui, Viña del Mar</p>
              </div>

              {!respuestaCitacion ? (
                <div className="botones-asistencia mt-10">
                  <button className="btn-confirmar" onClick={() => setRespuestaCitacion('confirmada')}>Confirmar Asistencia</button>
                  <button className="btn-ausente" onClick={() => setRespuestaCitacion('ausente')}>Avisar Ausencia</button>
                </div>
              ) : respuestaCitacion === 'confirmada' ? (
                <div className="asistencia-confirmada mt-10">
                  <div className="mensaje-exito"><CheckCircle size={18} /> Asistencia Confirmada</div>
                  {rolUsuario !== 'visita' && (
                    <div className="transporte-selector mt-10">
                      <label>Logística de Transporte:</label>
                      <select className="form-input mt-5">
                        <option>Llego directo a la cancha</option>
                        <option>Necesito un cupo en auto</option>
                        <option>🚗 Ofrezco 1 cupo en auto</option>
                      </select>
                    </div>
                  )}
                </div>
              ) : (
                <div className="asistencia-ausente mt-10">
                  <span className="mensaje-error"><XSquare size={18} /> Ausencia Informada.</span>
                  <p style={{ fontSize: '12px', marginTop: '5px' }}>El cuerpo técnico ha sido notificado.</p>
                </div>
              )}
            </div>
          )}

          {comunicaciones.map(c => (
            <div key={c.id} className="ios-rrss-card fade-in" style={{ borderLeft: `4px solid ${c.urgencia === 'Crítica' ? '#8B0000' : c.urgencia === 'Alta' ? '#FF3B30' : c.urgencia === 'Media' ? '#FF9500' : '#34C759'}` }}>
              <div className="ios-rrss-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <span className="badge-tipo" style={{ background: c.urgencia === 'Crítica' ? '#8B0000' : c.urgencia === 'Alta' ? '#FF3B30' : c.urgencia === 'Media' ? '#FF9500' : '#34C759', color: 'white', padding: '4px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '700' }}>
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
                <div style={{ background: 'rgba(0, 122, 255, 0.08)', padding: '10px', borderRadius: '8px', marginBottom: '12px', marginTop: '10px' }}>
                  <p style={{ margin: '0 0 8px 0', fontSize: '12px', fontWeight: '600', color: 'var(--texto-principal)' }}>¿Vas a asistir?</p>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={() => addRSVP(c.id, 'si')} className="btn-confirmar" style={{ flex: 1, padding: '8px', fontSize: '13px', borderRadius: '6px', border: 'none', background: '#34C759', color: 'white', cursor: 'pointer', fontWeight: '600' }}>✓ Sí</button>
                    <button onClick={() => addRSVP(c.id, 'no')} className="btn-ausente" style={{ flex: 1, padding: '8px', fontSize: '13px', borderRadius: '6px', border: 'none', background: '#FF3B30', color: 'white', cursor: 'pointer', fontWeight: '600' }}>✕ No</button>
                    <button onClick={() => addRSVP(c.id, 'quizas')} style={{ flex: 1, padding: '8px', fontSize: '13px', borderRadius: '6px', border: '1px solid var(--borde-suave)', background: 'var(--blanco-tarjeta)', color: 'var(--texto-principal)', cursor: 'pointer', fontWeight: '600' }}>❓ Quiz</button>
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginBottom: '10px', paddingBottom: '10px', borderBottom: '1px solid var(--borde-suave)' }}>
                {emojisReacciones.map(emoji => (
                  <button key={emoji} onClick={() => addReaccion(c.id, emoji)} style={{ padding: '6px 12px', borderRadius: '20px', background: Object.keys(c.reacciones || {}).includes(emoji) ? 'rgba(0, 122, 255, 0.2)' : 'rgba(0,0,0,0.05)', border: 'none', cursor: 'pointer', fontSize: '16px', display: 'flex', alignItems: 'center', gap: '4px', transition: '0.2s' }}>
                    {emoji} {(c.reacciones || {})[emoji] > 0 && <span style={{ fontSize: '11px', fontWeight: '700' }}>{(c.reacciones || {})[emoji]}</span>}
                  </button>
                ))}
              </div>

              {c.asistencias && c.asistencias.length > 0 && (
                <div style={{ fontSize: '12px', color: 'var(--texto-secundario)', marginTop: '8px', padding: '8px', background: 'rgba(0,0,0,0.02)', borderRadius: '6px' }}>
                  ✓ <strong>{c.asistencias.filter(a => a.respuesta === 'si').length}</strong> confirmados •
                  <strong>{c.asistencias.filter(a => a.respuesta === 'no').length}</strong> rechazaron
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
              <div key={enc.id} className="card mb-15" style={{ padding: '15px', background: 'linear-gradient(135deg, rgba(52, 199, 89, 0.05), rgba(0, 122, 255, 0.05))' }}>
                <h5 style={{ color: 'var(--texto-principal)', margin: '0 0 15px 0', fontWeight: '700' }}>{enc.titulo}</h5>
                {enc.opciones.map(opcion => {
                  const votos = enc.votos[opcion] || 0;
                  const porcentaje = totalVotos > 0 ? (votos / totalVotos) * 100 : 0;
                  return (
                    <div key={opcion} style={{ marginBottom: '12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                        <span style={{ fontSize: '13px', fontWeight: '500' }}>{opcion}</span>
                        <span style={{ fontSize: '12px', color: 'var(--texto-secundario)', fontWeight: '600' }}>{votos} votos ({porcentaje.toFixed(0)}%)</span>
                      </div>
                      <div style={{ width: '100%', height: '20px', background: 'rgba(0,0,0,0.08)', borderRadius: '10px', overflow: 'hidden' }}>
                        <div style={{ width: `${porcentaje}%`, height: '100%', background: 'linear-gradient(90deg, #007AFF, #34C759)', transition: 'width 0.3s' }}></div>
                      </div>
                      {!enc.respondio && (
                        <button onClick={() => voteEncuesta(enc.id, opcion)} style={{ marginTop: '6px', padding: '6px 10px', fontSize: '12px', background: 'var(--azul-electrico)', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', width: '100%' }}>
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
          <h4 className="rama-title femenina">🏀 Rama Femenina</h4>
          <ResultadosCards partidos={partidosPrueba.filter(p => p.rama === 'Femenina')} />
          <h4 className="rama-title masculina mt-20">🏀 Rama Masculina</h4>
          <ResultadosCards partidos={partidosPrueba.filter(p => p.rama === 'Masculina')} />
        </div>
      )}
    </div>
  );
}

export default ComunicacionesPanel;
