import { CalendarDays, Trophy } from 'lucide-react';

export default function ResultadosCards({ partidos }) {
  const frasesVictoria = ['Tremendo triunfo', 'La casa se respeta', 'Que partidazo jugamos'];
  const frasesDerrota = ['A levantar cabeza para el proximo', 'Aprender de los errores y seguir', 'No bajamos los brazos'];

  return partidos.map((partido) => {
    const esVictoria = partido.miEquipo > partido.rival;
    const dif = Math.abs(partido.miEquipo - partido.rival);
    const frases = esVictoria ? frasesVictoria : frasesDerrota;
    const frase = frases[partido.id % frases.length];

    return (
      <div key={partido.id} className={`card-resultado ${esVictoria ? 'resultado-ganado' : 'resultado-perdido'}`}>
        <div className="resultado-competicion">
          <span className={`badge-rama badge-rama-lg ${partido.rama === 'Femenina' ? 'badge-femenina' : 'badge-masculina'}`}>
            {partido.rama} . {partido.categoria}
          </span>
          <span className="torneo-label"><Trophy size={13} /> {partido.torneo}</span>
          <span className="fecha-label"><CalendarDays size={12} /> {partido.fecha}</span>
        </div>

        <div className="marcador-container">
          <div className="equipo">
            <div className="equipo-logo-placeholder">CCF</div>
            <span className="nombre-equipo">C.C. Fisica</span>
            <span className="puntaje">{partido.miEquipo}</span>
          </div>
          <span className="vs">VS</span>
          <div className="equipo">
            <div className="equipo-logo-placeholder rival">{partido.nombreRival.substring(0, 3).toUpperCase()}</div>
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
