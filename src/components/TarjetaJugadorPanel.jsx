import { QrCode, Shirt, Target, User } from 'lucide-react';
import PupiloSelector from './PupiloSelector';
import { mockJugador, mockTesoreriaDB } from '../data/mockData';

function TarjetaJugadorPanel({
  pupiloActivo,
  setPupiloActivo,
  rolUsuario,
}) {
  let claseRareza = 'holo-bronce';
  let textoRareza = 'BRONCE';
  const nivelActual = rolUsuario === 'visita' ? 'MAX' : pupiloActivo.nivel;
  const nombreDisplay = rolUsuario === 'visita' ? 'Invitado' : pupiloActivo.nombre.split(' ')[0];
  const apellidoDisplay = rolUsuario === 'visita' ? 'TORNEO' : pupiloActivo.nombre.split(' ')[1]?.toUpperCase() || '';

  if (nivelActual > 10 && nivelActual <= 20) {
    claseRareza = 'holo-plata';
    textoRareza = 'PLATA';
  } else if (nivelActual > 20) {
    claseRareza = 'holo-oro';
    textoRareza = 'ORO';
  }

  if (rolUsuario === 'visita') {
    claseRareza = 'holo-visita';
    textoRareza = 'VISITA';
  }

  return (
    <div className="fade-in player-screen-shell">
      <PupiloSelector
        pupilos={mockTesoreriaDB.pupilos}
        pupiloActivo={pupiloActivo}
        rolUsuario={rolUsuario}
        onChangePupilo={setPupiloActivo}
      />

      <div className="holographic-wrapper horizontal-holo">
        <div className={`holographic-card horizontal ${claseRareza}`}>
          <div className="holo-glare"></div>
          <div className="holo-header">
            <div className="holo-club-logo">🏀</div>
            <div className="holo-season">SEASON 2026</div>
            <div className="holo-rarity-badge">{textoRareza}</div>
          </div>
          <div className="holo-center-content">
            <div className="holo-foto-marco"><User size={50} color="white" /></div>
            <div className="holo-jugador-info">
              <h2>{nombreDisplay}</h2>
              <h1>{apellidoDisplay}</h1>
              <div className="holo-dorsal">#{rolUsuario === 'visita' ? '00' : mockJugador.NUMERO_CAMISETA}</div>
            </div>
          </div>
          <div className="holo-bottom-bar">
            <div className="holo-stats">
              <div><span>POS</span><strong>{rolUsuario === 'visita' ? 'N/A' : mockJugador.POSICION_DE_JUEGO}</strong></div>
              <div><span>CAT</span><strong>{rolUsuario === 'visita' ? 'Open' : pupiloActivo.categoria}</strong></div>
              <div><span>LVL</span><strong>{nivelActual}</strong></div>
            </div>
            <div className="holo-qr-zone"><QrCode size={40} color="black" /></div>
          </div>
        </div>
      </div>
      <p className="text-center mt-5" style={{ fontSize: '11px', color: 'var(--texto-secundario)', fontWeight: 'bold' }}>Escanea este QR en porteria para asistencia.</p>

      {rolUsuario !== 'visita' && (
        <>
          <h3 className="section-title mt-20">Ficha Atletica e Indumentaria</h3>
          <div className="caja-doble-grid mb-15">
            <div className="card sub-caja-card metric-card" style={{ padding: '15px' }}>
              <h5 className="sub-caja-title" style={{ fontSize: '11px' }}><Target size={14} /> Biometria</h5>
              <div className="desglose-row"><span>Estatura:</span><strong>{mockJugador.ESTATURA}</strong></div>
              <div className="desglose-row"><span>Peso:</span><strong>{mockJugador.PESO}</strong></div>
              <div className="desglose-row"><span>Mano Habil:</span><strong>{mockJugador.MANO_HABIL}</strong></div>
            </div>

            <div className="card sub-caja-card metric-card" style={{ padding: '15px' }}>
              <h5 className="sub-caja-title" style={{ fontSize: '11px' }}><Shirt size={14} /> Tallas</h5>
              <div className="desglose-row"><span>Camiseta:</span><strong>{mockJugador.TALLA_CAMISETA}</strong></div>
              <div className="desglose-row"><span>Short:</span><strong>{mockJugador.TALLA_SHORT}</strong></div>
              <div className="desglose-row mt-10 text-center">
                <span className="badge-urgente" style={{ background: mockJugador.POLERA_ENTREGADA ? 'var(--verde-victoria)' : '#FF3B30', width: '100%', display: 'block', padding: '8px 0' }}>
                  {mockJugador.POLERA_ENTREGADA ? 'ROPA ENTREGADA ✓' : 'FALTA ENTREGA'}
                </span>
              </div>
            </div>
          </div>

          <div className="card history-card" style={{ background: 'linear-gradient(135deg, #1A222D, #0B1017)', color: 'white', border: 'none' }}>
            <h4 className="form-subtitle" style={{ color: '#00C7BE', margin: '0 0 15px 0' }}>📊 Historial Deportivo</h4>
            <div className="desglose-row"><span>Asistencia Entrenamientos:</span><strong style={{ color: 'var(--verde-victoria)' }}>{mockJugador.ASISTENCIA}</strong></div>
            <div className="desglose-row"><span>Estado del Jugador:</span><strong style={{ color: '#00C7BE' }}>{mockJugador.ESTADO_DEPORTIVO}</strong></div>
            <div className="desglose-row"><span>Beca Asignada:</span><strong>{mockJugador.BECA}</strong></div>
          </div>
        </>
      )}
    </div>
  );
}

export default TarjetaJugadorPanel;
