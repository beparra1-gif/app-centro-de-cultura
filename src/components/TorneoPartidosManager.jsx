import { useState } from 'react';
import { Plus } from 'lucide-react';
import { showToast } from '../utils/toast';
import * as api from '../api/client';

const hoyISO = () => new Date().toISOString().slice(0, 10);

// Carga partidos y resultados directamente desde Torneos, sin pasar por
// Mesa de Control — pensado para torneos donde solo interesa dejar
// registrada la tabla de posiciones, no transmitir un marcador en vivo.
function TorneoPartidosManager({ idTorneo, torneo, equipos = [], partidosPendientes = [], onPartidosChanged }) {
  const [idEquipoLocal, setIdEquipoLocal] = useState('');
  const [idEquipoVisitante, setIdEquipoVisitante] = useState('');
  const [fecha, setFecha] = useState(hoyISO());
  const [hora, setHora] = useState('10:00');
  const [cargarResultadoAhora, setCargarResultadoAhora] = useState(false);
  const [ptsLocal, setPtsLocal] = useState('');
  const [ptsVisitante, setPtsVisitante] = useState('');
  const [publicarEnMuro, setPublicarEnMuro] = useState(torneo?.tipo !== 'externo');
  const [guardando, setGuardando] = useState(false);

  const [cargandoResultadoId, setCargandoResultadoId] = useState(null);
  const [resultadosPendientes, setResultadosPendientes] = useState({});

  const crearPartido = async () => {
    if (!idEquipoLocal || !idEquipoVisitante) {
      showToast({ message: 'Elige equipo local y visitante.', type: 'error' });
      return;
    }
    if (idEquipoLocal === idEquipoVisitante) {
      showToast({ message: 'El equipo local y visitante no pueden ser el mismo.', type: 'error' });
      return;
    }
    const equipoLocal = equipos.find((eq) => String(eq.id_equipo) === String(idEquipoLocal));
    const equipoVisitante = equipos.find((eq) => String(eq.id_equipo) === String(idEquipoVisitante));
    if (!equipoLocal || !equipoVisitante) return;

    setGuardando(true);
    try {
      await api.partidosLiveAPI.create({
        fecha_hora: `${fecha}T${hora}:00`,
        rama: torneo?.rama || 'Mixta',
        categoria: torneo?.categoria || 'SUB-13',
        equipo_local: equipoLocal.nombre_equipo,
        equipo_visitante: equipoVisitante.nombre_equipo,
        logo_local_url: equipoLocal.logo_url || null,
        logo_visitante_url: equipoVisitante.logo_url || null,
        id_equipo_local: equipoLocal.id_equipo,
        id_equipo_visitante: equipoVisitante.id_equipo,
        id_torneo: idTorneo,
        torneo_nombre: torneo?.nombre_torneo || null,
        estado_juego: cargarResultadoAhora ? 'finalizado' : 'pendiente',
        pts_local: cargarResultadoAhora ? Number(ptsLocal) || 0 : 0,
        pts_visitante: cargarResultadoAhora ? Number(ptsVisitante) || 0 : 0,
        publicado: publicarEnMuro,
      });
      showToast({ message: 'Partido agregado al torneo.', type: 'success' });
      setIdEquipoLocal('');
      setIdEquipoVisitante('');
      setPtsLocal('');
      setPtsVisitante('');
      setCargarResultadoAhora(false);
      if (onPartidosChanged) await onPartidosChanged();
    } catch (error) {
      showToast({ message: error.message || 'No se pudo agregar el partido.', type: 'error' });
    } finally {
      setGuardando(false);
    }
  };

  const guardarResultadoPendiente = async (partido) => {
    const valores = resultadosPendientes[partido.id_partido] || {};
    if (valores.pts_local === undefined || valores.pts_visitante === undefined || valores.pts_local === '' || valores.pts_visitante === '') {
      showToast({ message: 'Ingresa el marcador de ambos equipos.', type: 'error' });
      return;
    }
    setCargandoResultadoId(partido.id_partido);
    try {
      await api.partidosLiveAPI.updateScore(partido.id_partido, {
        pts_local: Number(valores.pts_local) || 0,
        pts_visitante: Number(valores.pts_visitante) || 0,
        estado_juego: 'finalizado',
      });
      showToast({ message: 'Resultado cargado.', type: 'success' });
      if (onPartidosChanged) await onPartidosChanged();
    } catch (error) {
      showToast({ message: error.message || 'No se pudo cargar el resultado.', type: 'error' });
    } finally {
      setCargandoResultadoId(null);
    }
  };

  return (
    <div>
      <h5 style={{ margin: '0 0 10px', fontSize: '13px' }}>Agregar partido</h5>
      {equipos.length < 2 ? (
        <p className="text-muted italic" style={{ fontSize: '12px' }}>Agrega al menos 2 equipos para poder crear partidos.</p>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '8px' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Equipo local</label>
              <select className="form-input" value={idEquipoLocal} onChange={(e) => setIdEquipoLocal(e.target.value)}>
                <option value="">Elegir...</option>
                {equipos.map((eq) => <option key={eq.id_equipo} value={eq.id_equipo}>{eq.nombre_equipo}</option>)}
              </select>
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Equipo visitante</label>
              <select className="form-input" value={idEquipoVisitante} onChange={(e) => setIdEquipoVisitante(e.target.value)}>
                <option value="">Elegir...</option>
                {equipos.map((eq) => <option key={eq.id_equipo} value={eq.id_equipo}>{eq.nombre_equipo}</option>)}
              </select>
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Fecha</label>
              <input type="date" className="form-input" value={fecha} onChange={(e) => setFecha(e.target.value)} />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Hora</label>
              <input type="time" className="form-input" value={hora} onChange={(e) => setHora(e.target.value)} />
            </div>
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '10px', fontSize: '12px', fontWeight: '700' }}>
            <input type="checkbox" checked={cargarResultadoAhora} onChange={(e) => setCargarResultadoAhora(e.target.checked)} />
            Cargar resultado ahora
          </label>

          {cargarResultadoAhora && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '8px', marginTop: '8px' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Puntos local</label>
                <input type="number" min="0" className="form-input" value={ptsLocal} onChange={(e) => setPtsLocal(e.target.value)} />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Puntos visitante</label>
                <input type="number" min="0" className="form-input" value={ptsVisitante} onChange={(e) => setPtsVisitante(e.target.value)} />
              </div>
            </div>
          )}

          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '10px', fontSize: '12px', fontWeight: '700' }}>
            <input type="checkbox" checked={publicarEnMuro} onChange={(e) => setPublicarEnMuro(e.target.checked)} />
            Publicar en el muro
          </label>

          <button className="btn-secondary mt-10" style={{ width: 'auto', padding: '10px 14px' }} onClick={crearPartido} disabled={guardando}>
            <Plus size={14} /> {guardando ? 'Guardando...' : 'Agregar partido'}
          </button>
        </>
      )}

      {partidosPendientes.length > 0 && (
        <>
          <h5 style={{ margin: '18px 0 8px', fontSize: '13px' }}>Cargar resultado de próximos partidos</h5>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {partidosPendientes.map((p) => {
              const valores = resultadosPendientes[p.id_partido] || {};
              return (
                <div key={p.id_partido} style={{ border: '1px dashed var(--borde-suave)', borderRadius: '12px', padding: '8px 10px' }}>
                  <div style={{ fontSize: '12px', fontWeight: '700', marginBottom: '6px' }}>{p.equipo_local} vs {p.equipo_visitante}</div>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <input
                      type="number" min="0" className="form-input" placeholder="Local"
                      style={{ maxWidth: '90px' }}
                      value={valores.pts_local ?? ''}
                      onChange={(e) => setResultadosPendientes((prev) => ({ ...prev, [p.id_partido]: { ...prev[p.id_partido], pts_local: e.target.value } }))}
                    />
                    <span>-</span>
                    <input
                      type="number" min="0" className="form-input" placeholder="Visitante"
                      style={{ maxWidth: '90px' }}
                      value={valores.pts_visitante ?? ''}
                      onChange={(e) => setResultadosPendientes((prev) => ({ ...prev, [p.id_partido]: { ...prev[p.id_partido], pts_visitante: e.target.value } }))}
                    />
                    <button
                      className="btn-secondary"
                      style={{ width: 'auto', padding: '8px 12px', fontSize: '12px' }}
                      onClick={() => guardarResultadoPendiente(p)}
                      disabled={cargandoResultadoId === p.id_partido}
                    >
                      {cargandoResultadoId === p.id_partido ? 'Guardando...' : 'Cargar resultado'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

export default TorneoPartidosManager;
