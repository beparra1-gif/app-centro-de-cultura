import { Clock } from 'lucide-react';

// Presentacional: pinta el resultado de useHorasOcupadasEnFecha como una
// lista de chips "10:00-11:00 · Juan Pérez" para que el usuario vea el
// hueco libre antes de escribir la hora en el formulario.
function CanchaEntrenamientosOcupacion({ ocupaciones, cargando }) {
  if (cargando) {
    return <p className="text-muted" style={{ fontSize: '11px', margin: '6px 0' }}>Revisando horas ocupadas...</p>;
  }
  if (ocupaciones.length === 0) {
    return <p className="text-muted" style={{ fontSize: '11px', margin: '6px 0' }}>Sin nada agendado ese día — cualquier hora está libre.</p>;
  }
  return (
    <div style={{ margin: '6px 0 10px' }}>
      <span style={{ fontSize: '11px', fontWeight: '800', color: 'var(--texto-secundario)' }}>
        <Clock size={12} style={{ verticalAlign: '-2px', marginRight: '3px' }} />
        Horas ocupadas ese día:
      </span>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginTop: '5px' }}>
        {ocupaciones.map((o, idx) => (
          <span
            key={`${o.horaInicio}-${idx}`}
            style={{
              fontSize: '11px',
              fontWeight: '700',
              padding: '4px 9px',
              borderRadius: '999px',
              background: o.origen === 'arriendo' ? 'rgba(255,149,0,0.12)' : 'rgba(94,92,230,0.14)',
              color: o.origen === 'arriendo' ? '#b36200' : '#3d3ba0',
            }}
          >
            {o.horaInicio}-{o.horaFin} · {o.etiqueta}
          </span>
        ))}
      </div>
    </div>
  );
}

export default CanchaEntrenamientosOcupacion;
