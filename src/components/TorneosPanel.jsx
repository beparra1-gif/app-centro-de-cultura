import { useEffect, useState } from 'react';
import { Plus, Trophy } from 'lucide-react';
import { showToast } from '../utils/toast';
import * as api from '../api/client';
import LogoAvatar from './LogoAvatar';
import TorneoEquiposManager from './TorneoEquiposManager';
import TorneoPartidosManager from './TorneoPartidosManager';
import TorneoBracket from './TorneoBracket';

const TORNEO_FORM_VACIO = {
  nombre_torneo: '',
  rama: 'Mixta',
  categoria: 'SUB-13',
  fecha_inicio: '',
  fecha_fin: '',
  ubicacion: '',
  organizador: '',
  cantidad_equipos: '',
  tipo: 'interno',
  tipo_formato: 'liga',
  publicar_resultado_en_muro: true,
};

function TorneosPanel({ puedeGestionar = false }) {
  const [torneos, setTorneos] = useState([]);
  const [cargandoTorneos, setCargandoTorneos] = useState(false);
  const [torneoSeleccionadoId, setTorneoSeleccionadoId] = useState(null);
  const [tabla, setTabla] = useState(null);
  const [cargandoTabla, setCargandoTabla] = useState(false);
  const [equiposTorneo, setEquiposTorneo] = useState([]);
  const [mostrarFormCrear, setMostrarFormCrear] = useState(false);
  const [formTorneo, setFormTorneo] = useState(TORNEO_FORM_VACIO);
  const [creandoTorneo, setCreandoTorneo] = useState(false);
  const [generandoCuadroId, setGenerandoCuadroId] = useState(null);
  const [mostrarFinalizarId, setMostrarFinalizarId] = useState(null);
  const [ganadorFinalizar, setGanadorFinalizar] = useState('');
  const [finalizandoTorneo, setFinalizandoTorneo] = useState(false);

  const cargarTorneos = async () => {
    setCargandoTorneos(true);
    try {
      const datos = await api.torneosAPI.getAll();
      setTorneos(Array.isArray(datos) ? datos : []);
    } catch (error) {
      showToast({ message: error.message || 'No se pudo cargar la lista de torneos.', type: 'error' });
      setTorneos([]);
    } finally {
      setCargandoTorneos(false);
    }
  };

  useEffect(() => {
    (async () => { await cargarTorneos(); })();
  }, []);

  const cargarTablaYEquipos = async (idTorneo) => {
    setCargandoTabla(true);
    try {
      const [datosTabla, datosEquipos] = await Promise.all([
        api.torneosAPI.tablaPosiciones(idTorneo),
        api.torneosAPI.equipos.getAll(idTorneo),
      ]);
      setTabla(datosTabla);
      setEquiposTorneo(Array.isArray(datosEquipos) ? datosEquipos : []);
    } catch (error) {
      showToast({ message: error.message || 'No se pudo cargar la tabla de posiciones.', type: 'error' });
      setTabla(null);
      setEquiposTorneo([]);
    } finally {
      setCargandoTabla(false);
    }
  };

  const seleccionarTorneo = async (idTorneo) => {
    if (torneoSeleccionadoId === idTorneo) {
      setTorneoSeleccionadoId(null);
      setTabla(null);
      setEquiposTorneo([]);
      return;
    }
    setTorneoSeleccionadoId(idTorneo);
    await cargarTablaYEquipos(idTorneo);
  };

  const crearTorneo = async () => {
    if (!formTorneo.nombre_torneo.trim()) {
      showToast({ message: 'Ponle un nombre al torneo.', type: 'error' });
      return;
    }
    if (formTorneo.tipo === 'externo' && !formTorneo.organizador.trim()) {
      showToast({ message: 'Indica el club u organización que organiza el torneo externo.', type: 'error' });
      return;
    }
    setCreandoTorneo(true);
    try {
      await api.torneosAPI.create({
        ...formTorneo,
        cantidad_equipos: formTorneo.cantidad_equipos ? Number(formTorneo.cantidad_equipos) : null,
        fecha_inicio: formTorneo.fecha_inicio || null,
        fecha_fin: formTorneo.fecha_fin || null,
      });
      setFormTorneo(TORNEO_FORM_VACIO);
      setMostrarFormCrear(false);
      showToast({ message: 'Torneo creado correctamente.', type: 'success' });
      await cargarTorneos();
    } catch (error) {
      showToast({ message: `No se pudo crear el torneo: ${error.message}`, type: 'error' });
    } finally {
      setCreandoTorneo(false);
    }
  };

  const generarCuadro = async (idTorneo) => {
    setGenerandoCuadroId(idTorneo);
    try {
      await api.torneosAPI.generarCuadro(idTorneo);
      showToast({ message: 'Cuadro generado.', type: 'success' });
      await cargarTablaYEquipos(idTorneo);
      await cargarTorneos();
    } catch (error) {
      showToast({ message: error.message || 'No se pudo generar el cuadro.', type: 'error' });
    } finally {
      setGenerandoCuadroId(null);
    }
  };

  const abrirFinalizarTorneo = (idTorneo, ganadorSugerido) => {
    setMostrarFinalizarId(idTorneo);
    setGanadorFinalizar(ganadorSugerido || '');
  };

  const finalizarTorneo = async (idTorneo) => {
    if (!ganadorFinalizar.trim()) {
      showToast({ message: 'Indica quién ganó el torneo.', type: 'error' });
      return;
    }
    setFinalizandoTorneo(true);
    try {
      await api.torneosAPI.update(idTorneo, { estado: 'finalizado', ganador: ganadorFinalizar.trim() });
      showToast({ message: 'Torneo finalizado.', type: 'success' });
      setMostrarFinalizarId(null);
      await cargarTorneos();
    } catch (error) {
      showToast({ message: error.message || 'No se pudo finalizar el torneo.', type: 'error' });
    } finally {
      setFinalizandoTorneo(false);
    }
  };

  return (
    <div className="mt-20 fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
        <h3 className="section-title" style={{ margin: 0 }}>Torneos</h3>
        {puedeGestionar && (
          <button type="button" className="btn-electric" style={{ width: 'auto', padding: '10px 16px' }} onClick={() => setMostrarFormCrear((v) => !v)}>
            <Plus size={16} /> {mostrarFormCrear ? 'Cancelar' : 'Crear torneo'}
          </button>
        )}
      </div>

      {mostrarFormCrear && puedeGestionar && (
        <div className="card mb-15" style={{ borderRadius: '20px' }}>
          <h4 className="form-subtitle">Nuevo torneo</h4>
          <div className="segment-control mb-15" style={{ gap: '6px' }}>
            <button type="button" className={`segment-btn ${formTorneo.tipo === 'interno' ? 'active' : ''}`} onClick={() => setFormTorneo((p) => ({ ...p, tipo: 'interno' }))}>
              Interno (armado por el club)
            </button>
            <button type="button" className={`segment-btn ${formTorneo.tipo === 'externo' ? 'active' : ''}`} onClick={() => setFormTorneo((p) => ({ ...p, tipo: 'externo' }))}>
              Externo
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Nombre *</label>
              <input className="form-input" value={formTorneo.nombre_torneo} onChange={(e) => setFormTorneo((p) => ({ ...p, nombre_torneo: e.target.value }))} placeholder="Ej: Copa Verano 2026" />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Rama</label>
              <select className="form-input" value={formTorneo.rama} onChange={(e) => setFormTorneo((p) => ({ ...p, rama: e.target.value }))}>
                <option>Mixta</option>
                <option>Femenina</option>
                <option>Masculina</option>
              </select>
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Categoría</label>
              <input className="form-input" value={formTorneo.categoria} onChange={(e) => setFormTorneo((p) => ({ ...p, categoria: e.target.value }))} placeholder="Ej: SUB-15" />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Fecha inicio</label>
              <input type="date" className="form-input" value={formTorneo.fecha_inicio} onChange={(e) => setFormTorneo((p) => ({ ...p, fecha_inicio: e.target.value }))} />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Fecha fin</label>
              <input type="date" className="form-input" value={formTorneo.fecha_fin} onChange={(e) => setFormTorneo((p) => ({ ...p, fecha_fin: e.target.value }))} />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Ubicación</label>
              <input className="form-input" value={formTorneo.ubicacion} onChange={(e) => setFormTorneo((p) => ({ ...p, ubicacion: e.target.value }))} placeholder="Ej: Gimnasio CCF" />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>{formTorneo.tipo === 'externo' ? 'Club/organización organizadora *' : 'Organizador'}</label>
              <input className="form-input" value={formTorneo.organizador} onChange={(e) => setFormTorneo((p) => ({ ...p, organizador: e.target.value }))} placeholder={formTorneo.tipo === 'externo' ? 'Ej: Liga Regional de Básquetbol' : 'Centro de Cultura Física'} />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Cantidad de equipos</label>
              <input type="number" min="2" className="form-input" value={formTorneo.cantidad_equipos} onChange={(e) => setFormTorneo((p) => ({ ...p, cantidad_equipos: e.target.value }))} />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Formato</label>
              <div className="segment-control" style={{ gap: '6px' }}>
                <button type="button" className={`segment-btn ${formTorneo.tipo_formato === 'liga' ? 'active' : ''}`} onClick={() => setFormTorneo((p) => ({ ...p, tipo_formato: 'liga' }))}>
                  Liga
                </button>
                <button type="button" className={`segment-btn ${formTorneo.tipo_formato === 'eliminacion_directa' ? 'active' : ''}`} onClick={() => setFormTorneo((p) => ({ ...p, tipo_formato: 'eliminacion_directa' }))}>
                  Eliminación directa
                </button>
              </div>
            </div>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '10px', fontSize: '12px', fontWeight: '700' }}>
            <input type="checkbox" checked={formTorneo.publicar_resultado_en_muro} onChange={(e) => setFormTorneo((p) => ({ ...p, publicar_resultado_en_muro: e.target.checked }))} />
            Publicar resultado final en el Muro (quién sale campeón)
          </label>
          <button className="btn-electric mt-15" onClick={crearTorneo} disabled={creandoTorneo}>
            {creandoTorneo ? 'Creando...' : 'Guardar torneo'}
          </button>
        </div>
      )}

      {cargandoTorneos && <p className="text-muted">Cargando torneos...</p>}
      {!cargandoTorneos && torneos.length === 0 && (
        <p className="text-muted text-center italic">Todavía no hay torneos creados.</p>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {torneos.map((t) => {
          const abierto = torneoSeleccionadoId === t.id_torneo;
          return (
            <div key={t.id_torneo} className="card" style={{ borderRadius: '20px', padding: 0, overflow: 'hidden' }}>
              <button
                type="button"
                onClick={() => seleccionarTorneo(t.id_torneo)}
                style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', padding: '14px 16px', background: abierto ? 'rgba(0,122,255,0.06)' : 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left' }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Trophy size={18} color="var(--azul-electrico)" strokeWidth={1.5} />
                  <span>
                    <strong style={{ display: 'block', fontSize: '14px' }}>{t.nombre_torneo}</strong>
                    <span style={{ fontSize: '11px', color: 'var(--texto-secundario)', fontWeight: '700' }}>
                      {t.rama || 'General'} · {t.categoria || 'General'} · {t.estado || 'activo'} · {t.tipo === 'externo' ? `Externo (${t.organizador || 'sin organizador'})` : 'Interno'}
                    </span>
                  </span>
                </span>
              </button>

              {abierto && (
                <div style={{ padding: '4px 16px 16px 16px' }}>
                  {cargandoTabla && <p className="text-muted">Cargando tabla de posiciones...</p>}

                  {!cargandoTabla && puedeGestionar && (
                    <div className="card mb-15" style={{ borderRadius: '16px', background: 'rgba(0,122,255,0.04)' }}>
                      <TorneoEquiposManager
                        idTorneo={t.id_torneo}
                        equipos={equiposTorneo}
                        onEquiposChanged={() => cargarTablaYEquipos(t.id_torneo)}
                      />
                      <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px dashed var(--borde-suave)' }}>
                        <TorneoPartidosManager
                          idTorneo={t.id_torneo}
                          torneo={t}
                          equipos={equiposTorneo}
                          partidosPendientes={tabla?.partidosPendientes || []}
                          onPartidosChanged={() => cargarTablaYEquipos(t.id_torneo)}
                        />
                      </div>

                      {t.tipo_formato === 'eliminacion_directa' && !t.bracket_generado && (
                        <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px dashed var(--borde-suave)' }}>
                          <button
                            className="btn-secondary"
                            style={{ width: 'auto', padding: '10px 14px' }}
                            onClick={() => generarCuadro(t.id_torneo)}
                            disabled={generandoCuadroId === t.id_torneo || equiposTorneo.length < 2}
                          >
                            {generandoCuadroId === t.id_torneo ? 'Generando...' : 'Generar cuadro'}
                          </button>
                          <p className="text-muted" style={{ fontSize: '11px', margin: '6px 0 0' }}>
                            Necesita una cantidad de equipos potencia de 2 (2, 4, 8, 16...). Hoy tienes {equiposTorneo.length}.
                          </p>
                        </div>
                      )}

                      {t.tipo_formato === 'liga' && t.estado !== 'finalizado' && tabla?.posiciones?.length > 0 && (
                        <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px dashed var(--borde-suave)' }}>
                          {mostrarFinalizarId !== t.id_torneo ? (
                            <button className="btn-secondary" style={{ width: 'auto', padding: '10px 14px' }} onClick={() => abrirFinalizarTorneo(t.id_torneo, tabla.posiciones[0]?.nombre)}>
                              Finalizar torneo
                            </button>
                          ) : (
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                              <div className="form-group" style={{ marginBottom: 0 }}>
                                <label style={{ fontSize: '11px' }}>Campeón</label>
                                <input className="form-input" value={ganadorFinalizar} onChange={(e) => setGanadorFinalizar(e.target.value)} />
                              </div>
                              <button className="btn-electric" style={{ width: 'auto', padding: '10px 14px' }} onClick={() => finalizarTorneo(t.id_torneo)} disabled={finalizandoTorneo}>
                                {finalizandoTorneo ? 'Guardando...' : 'Confirmar'}
                              </button>
                              <button className="btn-secondary" style={{ width: 'auto', padding: '10px 14px' }} onClick={() => setMostrarFinalizarId(null)}>
                                Cancelar
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {t.tipo_formato === 'eliminacion_directa' ? (
                    <TorneoBracket
                      partidos={[
                        ...(tabla?.partidos || []).map((p) => ({ ...p, estado_juego: 'finalizado' })),
                        ...(tabla?.partidosPendientes || []),
                      ]}
                    />
                  ) : (
                    <>
                      {!cargandoTabla && tabla && tabla.posiciones.length === 0 && (
                        <p className="text-muted text-center italic">Todavía no hay partidos finalizados asignados a este torneo.</p>
                      )}
                      {!cargandoTabla && tabla && tabla.posiciones.length > 0 && (
                        <>
                          <div style={{ overflowX: 'auto' }} className="mb-15">
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                              <thead>
                                <tr style={{ textAlign: 'left', borderBottom: '2px solid var(--borde-suave)' }}>
                                  <th style={{ padding: '6px 8px' }}>#</th>
                                  <th style={{ padding: '6px 8px' }}>Equipo</th>
                                  <th style={{ padding: '6px 8px', textAlign: 'center' }}>PJ</th>
                                  <th style={{ padding: '6px 8px', textAlign: 'center' }}>PG</th>
                                  <th style={{ padding: '6px 8px', textAlign: 'center' }}>PP</th>
                                  <th style={{ padding: '6px 8px', textAlign: 'center' }}>PF</th>
                                  <th style={{ padding: '6px 8px', textAlign: 'center' }}>PC</th>
                                  <th style={{ padding: '6px 8px', textAlign: 'center' }}>DIF</th>
                                  <th style={{ padding: '6px 8px', textAlign: 'center' }}>%</th>
                                </tr>
                              </thead>
                              <tbody>
                                {tabla.posiciones.map((fila) => (
                                  <tr key={fila.nombre} style={{ borderBottom: '1px solid var(--borde-suave)' }}>
                                    <td style={{ padding: '6px 8px', fontWeight: '900', color: 'var(--azul-electrico)' }}>{fila.posicion}</td>
                                    <td style={{ padding: '6px 8px', fontWeight: '800' }}>
                                      <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <LogoAvatar nombre={fila.nombre} logoUrl={fila.logoUrl} tipo="club" size={20} borderRadius="6px" />
                                        {fila.nombre}
                                      </span>
                                    </td>
                                    <td style={{ padding: '6px 8px', textAlign: 'center' }}>{fila.pj}</td>
                                    <td style={{ padding: '6px 8px', textAlign: 'center' }}>{fila.pg}</td>
                                    <td style={{ padding: '6px 8px', textAlign: 'center' }}>{fila.pp}</td>
                                    <td style={{ padding: '6px 8px', textAlign: 'center' }}>{fila.pf}</td>
                                    <td style={{ padding: '6px 8px', textAlign: 'center' }}>{fila.pc}</td>
                                    <td style={{ padding: '6px 8px', textAlign: 'center' }}>{fila.dif > 0 ? `+${fila.dif}` : fila.dif}</td>
                                    <td style={{ padding: '6px 8px', textAlign: 'center' }}>{Math.round(fila.pct * 100)}%</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>

                          <h5 style={{ margin: '16px 0 8px 0', fontSize: '13px' }}>Partidos jugados</h5>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            {tabla.partidos.map((p) => (
                              <div key={p.id_partido} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', border: '1px solid var(--borde-suave)', borderRadius: '12px', padding: '8px 10px', fontSize: '12px' }}>
                                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <LogoAvatar nombre={p.equipo_local} logoUrl={p.logo_local_url} tipo="club" size={18} borderRadius="6px" />
                                  {p.equipo_local} <strong>{p.pts_local}</strong> — <strong>{p.pts_visitante}</strong> {p.equipo_visitante}
                                  <LogoAvatar nombre={p.equipo_visitante} logoUrl={p.logo_visitante_url} tipo="club" size={18} borderRadius="6px" />
                                </span>
                                <span style={{ color: 'var(--texto-secundario)', fontWeight: '700' }}>
                                  {p.fecha_hora ? new Date(p.fecha_hora).toLocaleDateString('es-CL') : 'Sin fecha'}
                                </span>
                              </div>
                            ))}
                          </div>
                        </>
                      )}

                      {!cargandoTabla && tabla && tabla.partidosPendientes.length > 0 && (
                        <>
                          <h5 style={{ margin: '16px 0 8px 0', fontSize: '13px' }}>Próximos partidos</h5>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            {tabla.partidosPendientes.map((p) => (
                              <div key={p.id_partido} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', border: '1px dashed var(--borde-suave)', borderRadius: '12px', padding: '8px 10px', fontSize: '12px' }}>
                                <span>{p.equipo_local} vs {p.equipo_visitante}</span>
                                <span style={{ color: 'var(--texto-secundario)', fontWeight: '700' }}>
                                  {p.fecha_hora ? new Date(p.fecha_hora).toLocaleDateString('es-CL') : 'Sin fecha'} · {p.estado_juego === 'en_curso' ? 'En curso' : 'Programado'}
                                </span>
                              </div>
                            ))}
                          </div>
                        </>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default TorneosPanel;
