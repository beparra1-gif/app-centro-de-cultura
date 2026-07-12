import { Users } from 'lucide-react';

export default function PupiloSelector({ pupilos, pupiloActivo, rolUsuario, onChangePupilo }) {
  if (!pupilos || pupilos.length <= 1 || rolUsuario === 'jugador' || rolUsuario === 'deportista') {
    return null;
  }

  return (
    <div className="card mb-15 fade-in player-pill-card" style={{ padding: '15px', background: 'var(--azul-marino)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderRadius: '16px' }}>
      <span style={{ fontSize: '13px', fontWeight: '800', color: 'white' }}><Users size={16} style={{ marginRight: '5px' }} /> Perfil Activo:</span>
      <select
        className="form-input dark-select"
        style={{ width: 'auto', background: 'rgba(255,255,255,0.2)', color: 'white', border: 'none', padding: '8px 12px', fontSize: '13px' }}
        value={pupiloActivo.id}
        onChange={(e) => {
          const pupilo = pupilos.find((p) => p.id === parseInt(e.target.value, 10));
          if (pupilo) onChangePupilo(pupilo);
        }}
      >
        {pupilos.map((p) => (
          <option key={p.id} value={p.id} style={{ color: 'black' }}>
            {p.nombre}
          </option>
        ))}
      </select>
    </div>
  );
}
