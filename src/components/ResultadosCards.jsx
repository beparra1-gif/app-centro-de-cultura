import { CalendarDays, Trophy } from 'lucide-react';
import LogoAvatar from './LogoAvatar';

export default function ResultadosCards({ partidos }) {
  const frasesVictoria = ['Tremendo triunfo', 'La casa se respeta', 'Que partidazo jugamos'];
  const frasesDerrota = ['A levantar cabeza para el proximo', 'Aprender de los errores y seguir', 'No bajamos los brazos'];

  return partidos.map((partido) => {
    const esVictoria = partido.miEquipo > partido.rival;
    const dif = Math.abs(partido.miEquipo - partido.rival);
    const frases = esVictoria ? frasesVictoria : frasesDerrota;
    const frase = frases[partido.id % frases.length];

    return (
      <div key={partido.id} className={`card-resultado ${esVictoria ? 'resultado-ganado' : 'resultado-perdido'}`} style={{ borderRadius: '24px', boxShadow: '0 12px 28px rgba(15,23,42,0.06)' }}>
        <div className="resultado-competicion">
          <span className={`badge-rama badge-rama-lg ${partido.rama === 'Femenina' ? 'badge-femenina' : 'badge-masculina'}`}>
            {partido.rama} . {partido.categoria}
          </span>
          <span className="torneo-label" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
            <LogoAvatar nombre={partido.torneo} logoUrl={partido.torneoLogoUrl} size={24} borderRadius="999px" />
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}><Trophy size={13} /> {partido.torneo}</span>
          </span>
          <span className="fecha-label"><CalendarDays size={12} /> {partido.fecha}</span>
        </div>

        <div className="marcador-container">
          <div className="equipo">
            <LogoAvatar nombre={partido.equipoLocalNombre || 'Centro de Cultura Física'} logoUrl={partido.equipoLocalLogoUrl} size={54} borderRadius="20px" />
            <span className="nombre-equipo">{partido.equipoLocalNombre || 'C.C. Física'}</span>
            <span className="puntaje">{partido.miEquipo}</span>
          </div>
          <span className="vs">VS</span>
          <div className="equipo">
            <LogoAvatar nombre={partido.nombreRival} size={54} borderRadius="20px" fallbackText={partido.nombreRival.substring(0, 3).toUpperCase()} style={{ background: 'linear-gradient(180deg, rgba(255,149,0,0.12), rgba(255,59,48,0.12))' }} />
            <span className="nombre-equipo">{partido.nombreRival}</span>
            <span className="puntaje">{partido.rival}</span>
          </div>
        </div>

        <div className="resultado-footer">
          <span className="margen-puntos" style={{ color: esVictoria ? 'var(--verde-victoria)' : 'var(--azul-electrico)' }}>
            {esVictoria ? `Ganamos por ${dif} pts` : `Perdimos por ${dif} pts`}
          </span>
          <span className="frase-motivacional">{frase}</span>
        </div>
      </div>
    );
  });
}
