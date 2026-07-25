import { useMemo } from 'react';
import LogoAvatar from './LogoAvatar';

// Etiqueta amigable por ronda: la última es la Final, la anteúltima
// Semifinal, la antepenúltima Cuartos de Final — el resto queda como
// "Ronda N" (torneos de 16+ equipos).
const etiquetaRonda = (ronda, totalRondas) => {
  const faltan = totalRondas - ronda;
  if (faltan === 0) return 'Final';
  if (faltan === 1) return 'Semifinal';
  if (faltan === 2) return 'Cuartos de Final';
  return `Ronda ${ronda}`;
};

function TorneoBracket({ partidos = [] }) {
  const rondas = useMemo(() => {
    const bracketPartidos = partidos.filter((p) => p.ronda_bracket != null);
    const porRonda = new Map();
    bracketPartidos.forEach((p) => {
      const lista = porRonda.get(p.ronda_bracket) || [];
      lista.push(p);
      porRonda.set(p.ronda_bracket, lista);
    });
    return [...porRonda.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([ronda, lista]) => ({ ronda, partidos: lista.sort((a, b) => (a.posicion_bracket || 0) - (b.posicion_bracket || 0)) }));
  }, [partidos]);

  if (rondas.length === 0) {
    return <p className="text-muted text-center italic">Todavía no se generó el cuadro de este torneo.</p>;
  }

  const totalRondas = rondas[rondas.length - 1].ronda;

  return (
    <div style={{ display: 'flex', gap: '16px', overflowX: 'auto', paddingBottom: '8px' }}>
      {rondas.map(({ ronda, partidos: partidosRonda }) => (
        <div key={ronda} style={{ minWidth: '220px', flex: '0 0 auto' }}>
          <h5 style={{ margin: '0 0 8px', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--texto-secundario)' }}>
            {etiquetaRonda(ronda, totalRondas)}
          </h5>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {partidosRonda.map((p) => {
              const jugado = p.estado_juego === 'finalizado';
              const ganaLocal = jugado && Number(p.pts_local) > Number(p.pts_visitante);
              const ganaVisita = jugado && Number(p.pts_visitante) > Number(p.pts_local);
              return (
                <div key={p.id_partido} style={{ border: '1px solid var(--borde-suave)', borderRadius: '12px', padding: '8px 10px', fontSize: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', padding: '3px 0', fontWeight: ganaLocal ? '900' : '600', color: ganaLocal ? 'var(--verde-victoria)' : 'inherit' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                      <LogoAvatar nombre={p.equipo_local || '?'} logoUrl={p.logo_local_url} tipo="club" size={18} borderRadius="6px" />
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.equipo_local || 'Por definir'}</span>
                    </span>
                    <span>{jugado ? p.pts_local : ''}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', padding: '3px 0', fontWeight: ganaVisita ? '900' : '600', color: ganaVisita ? 'var(--verde-victoria)' : 'inherit' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                      <LogoAvatar nombre={p.equipo_visitante || '?'} logoUrl={p.logo_visitante_url} tipo="club" size={18} borderRadius="6px" />
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.equipo_visitante || 'Por definir'}</span>
                    </span>
                    <span>{jugado ? p.pts_visitante : ''}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

export default TorneoBracket;
