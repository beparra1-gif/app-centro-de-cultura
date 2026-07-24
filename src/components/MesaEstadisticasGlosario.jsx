import { useState } from 'react';
import { createPortal } from 'react-dom';
import { HelpCircle, X } from 'lucide-react';

const TERMINOS = [
  { sigla: 'PTS', nombre: 'Puntos', definicion: 'Puntos anotados en total.' },
  { sigla: 'REB', nombre: 'Rebotes', definicion: 'Balones recuperados tras un tiro fallado.' },
  { sigla: 'AST', nombre: 'Asistencias', definicion: 'Pases que terminan directamente en una canasta convertida.' },
  { sigla: 'STL', nombre: 'Robos', definicion: 'Balones robados al equipo rival.' },
  { sigla: 'BLK', nombre: 'Tapones', definicion: 'Bloqueos a un lanzamiento del equipo rival.' },
  { sigla: 'TO', nombre: 'Pérdidas', definicion: 'Balones perdidos sin que haya un lanzamiento (turnovers).' },
  { sigla: 'FLT', nombre: 'Faltas', definicion: 'Faltas personales cometidas.' },
  { sigla: 'TL', nombre: 'Tiros libres', definicion: 'Convertidos/intentados desde la línea de tiro libre.' },
  { sigla: 'T2', nombre: 'Tiros de 2', definicion: 'Convertidos/intentados dentro del arco de 3 puntos.' },
  { sigla: 'T3', nombre: 'Tiros de 3', definicion: 'Convertidos/intentados desde el arco de 3 puntos.' },
  { sigla: 'EFF', nombre: 'Eficiencia', definicion: '(PTS + REB + AST + STL + BLK) − TO. Resume el aporte total de un jugador en una sola cifra.' },
  { sigla: 'Clutch', nombre: 'Jugadas clutch', definicion: 'Lo que pasa en el último cuarto (o tiempo extra) con 2 minutos o menos en el reloj — el momento de mayor presión del partido.' },
];

// .ios-main tiene una transform permanente (clase screen-ready, ver
// MesaControlPanel.jsx/PagoForm.jsx) que lo convierte en containing block de
// los descendientes position:fixed, atrapando un modal normal fuera del
// viewport visible. El portal evita ese problema sin tocar la animacion
// global de .ios-main.
function MesaEstadisticasGlosario() {
  const [abierto, setAbierto] = useState(false);

  return (
    <>
      <button
        type="button"
        className="btn-secondary"
        style={{ width: 'auto', padding: '6px 10px', fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
        onClick={() => setAbierto(true)}
      >
        <HelpCircle size={13} /> Glosario
      </button>

      {abierto && createPortal(
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000, padding: '20px',
        }}>
          <div style={{
            background: 'white', borderRadius: '16px', padding: '24px', maxWidth: '480px', width: '100%',
            maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, color: 'var(--texto-heading)' }}>Glosario de estadísticas</h3>
              <button onClick={() => setAbierto(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}>
                <X size={20} />
              </button>
            </div>
            {TERMINOS.map((t) => (
              <div key={t.sigla} style={{ marginBottom: '12px', paddingBottom: '12px', borderBottom: '1px solid var(--gris-fondo)' }}>
                <div style={{ fontWeight: '800', fontSize: '13px' }}>{t.sigla} — {t.nombre}</div>
                <div style={{ fontSize: '12px', color: 'var(--gris-secundario)', marginTop: '2px' }}>{t.definicion}</div>
              </div>
            ))}
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

export default MesaEstadisticasGlosario;
