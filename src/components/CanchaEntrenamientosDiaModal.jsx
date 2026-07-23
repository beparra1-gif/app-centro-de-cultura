import { X, CalendarDays } from 'lucide-react';

// Overlay con todo lo agendado un día del calendario (arriendos +
// entrenamientos), ordenado por hora. onClickItem reusa el mismo manejador
// que ya abre la tarjeta de detalle/acciones existente — este modal no
// reimplementa esas acciones, solo lista y delega.
function CanchaEntrenamientosDiaModal({ fecha, eventos, onCerrar, onClickItem }) {
  const eventosDelDia = eventos
    .filter((ev) => ev.fecha === fecha)
    .sort((a, b) => a.horaInicio.localeCompare(b.horaInicio));

  const fechaLegible = fecha
    ? new Date(`${fecha}T00:00:00`).toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long' })
    : '';

  return (
    <div className="modal-overlay-alert" onClick={onCerrar}>
      <div className="modal-alert-card" style={{ maxWidth: '440px' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px', marginBottom: '14px' }}>
          <h3 style={{ margin: 0, fontSize: '16px', textTransform: 'capitalize' }}>
            <CalendarDays size={16} style={{ verticalAlign: '-3px', marginRight: '6px' }} />
            {fechaLegible}
          </h3>
          <button type="button" onClick={onCerrar} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--texto-secundario)' }} aria-label="Cerrar">
            <X size={18} />
          </button>
        </div>

        {eventosDelDia.length === 0 ? (
          <p className="text-muted italic" style={{ fontSize: '13px', textAlign: 'center', padding: '10px 0' }}>Nada agendado este día.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '55vh', overflowY: 'auto' }}>
            {eventosDelDia.map((ev) => (
              <button
                key={ev.id}
                type="button"
                onClick={() => onClickItem(ev)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '10px', textAlign: 'left',
                  border: '1px solid var(--borde-suave)', borderRadius: '14px', padding: '10px 12px',
                  background: 'none', cursor: 'pointer', width: '100%',
                }}
              >
                <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: ev.color, flexShrink: 0 }} />
                <div style={{ minWidth: 0 }}>
                  <strong style={{ fontSize: '13px' }}>{ev.horaInicio}-{ev.horaFin} · {ev.titulo}</strong>
                  {ev.subtitulo && <div style={{ fontSize: '11px', color: 'var(--texto-secundario)', fontWeight: '700' }}>{ev.subtitulo}</div>}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default CanchaEntrenamientosDiaModal;
