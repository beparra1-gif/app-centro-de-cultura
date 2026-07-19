import { useEffect, useState } from 'react';
import { Plus, Trophy } from 'lucide-react';
import { showToast } from '../utils/toast';
import * as api from '../api/client';

const TORNEO_FORM_VACIO = {
  nombre_torneo: '',
  rama: 'Mixta',
  categoria: 'SUB-13',
  fecha_inicio: '',
  fecha_fin: '',
  ubicacion: '',
  organizador: '',
  cantidad_equipos: '',
  formato: 'Todos contra todos',
};

function TorneosPanel() {
  const [torneos, setTorneos] = useState([]);
  const [cargandoTorneos, setCargandoTorneos] = useState(false);
  const [torneoSeleccionadoId, setTorneoSeleccionadoId] = useState(null);
  const [tabla, setTabla] = useState(null);
  const [cargandoTabla, setCargandoTabla] = useState(false);
  const [mostrarFormCrear, setMostrarFormCrear] = useState(false);
  const [formTorneo, setFormTorneo] = useState(TORNEO_FORM_VACIO);
  const [creandoTorneo, setCreandoTorneo] = useState(false);

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
    cargarTorneos();
  }, []);

  const seleccionarTorneo = async (idTorneo) => {
    if (torneoSeleccionadoId === idTorneo) {
      setTorneoSeleccionadoId(null);
      setTabla(null);
      return;
    }
    setTorneoSeleccionadoId(idTorneo);
    setCargandoTabla(true);
    try {
      const datos = await api.torneosAPI.tablaPosiciones(idTorneo);
      setTabla(datos);
    } catch (error) {
      showToast({ message: error.message || 'No se pudo cargar la tabla de posiciones.', type: 'error' });
      setTabla(null);
    } finally {
      setCargandoTabla(false);
    }
  };

  const crearTorneo = async () => {
    if (!formTorneo.nombre_torneo.trim()) {
      showToast({ message: 'Ponle un nombre al torneo.', type: 'error' });
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

  return (
    <div className="mt-20 fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
        <h3 className="section-title" style={{ margin: 0 }}>Torneos</h3>
        <button type="button" className="btn-electric" style={{ width: 'auto', padding: '10px 16px' }} onClick={() => setMostrarFormCrear((v) => !v)}>
          <Plus size={16} /> {mostrarFormCrear ? 'Cancelar' : 'Crear torneo'}
        </button>
      </div>

      {mostrarFormCrear && (
        <div className="card mb-15" style={{ borderRadius: '20px' }}>
          <h4 className="form-subtitle">Nuevo torneo</h4>
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
              <label>Organizador</label>
              <input className="form-input" value={formTorneo.organizador} onChange={(e) => setFormTorneo((p) => ({ ...p, organizador: e.target.value }))} />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Cantidad de equipos</label>
              <input type="number" min="2" className="form-input" value={formTorneo.cantidad_equipos} onChange={(e) => setFormTorneo((p) => ({ ...p, cantidad_equipos: e.target.value }))} />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Formato</label>
              <input className="form-input" value={formTorneo.formato} onChange={(e) => setFormTorneo((p) => ({ ...p, formato: e.target.value }))} placeholder="Ej: Todos contra todos" />
            </div>
          </div>
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
                      {t.rama || 'General'} · {t.categoria || 'General'} · {t.estado || 'activo'}
                    </span>
                  </span>
                </span>
              </button>

              {abierto && (
                <div style={{ padding: '4px 16px 16px 16px' }}>
                  {cargandoTabla && <p className="text-muted">Cargando tabla de posiciones...</p>}
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
                                <td style={{ padding: '6px 8px', fontWeight: '800' }}>{fila.nombre}</td>
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
                            <span>{p.equipo_local} <strong>{p.pts_local}</strong> — <strong>{p.pts_visitante}</strong> {p.equipo_visitante}</span>
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
