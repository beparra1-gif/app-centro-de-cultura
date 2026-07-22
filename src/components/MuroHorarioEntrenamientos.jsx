import { useEffect, useMemo, useState } from 'react';
import { CalendarDays } from 'lucide-react';
import * as api from '../api/client';

const DIAS_CORTO = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

const COLOR_RAMA = {
  masculina: { bg: 'rgba(0,122,255,0.12)', color: '#0a4da2' },
  femenina: { bg: 'rgba(255,45,146,0.12)', color: '#a3145f' },
  mixta: { bg: 'rgba(52,199,89,0.14)', color: '#1c7a3d' },
};
const colorRama = (rama = '') => COLOR_RAMA[String(rama).toLowerCase()] || { bg: 'rgba(120,120,128,0.12)', color: '#555' };

// Widget fijo del Muro (no un post más de la lista cronológica) — se arma
// solo, sin props, para poder insertarse en ComunicacionesPanel sin tocar
// el prop-drilling que ese componente todavía usa para el resto.
function MuroHorarioEntrenamientos() {
  const [horarios, setHorarios] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [colapsado, setColapsado] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const datos = await api.horariosEntrenamientoAPI.getPublico();
        setHorarios(Array.isArray(datos) ? datos : []);
      } catch {
        setHorarios([]);
      } finally {
        setCargando(false);
      }
    })();
  }, []);

  const grupos = useMemo(() => {
    const mapa = new Map();
    horarios.forEach((h) => {
      const key = `${h.rama}__${h.categoria}`;
      if (!mapa.has(key)) mapa.set(key, { rama: h.rama, categoria: h.categoria, sesiones: [] });
      mapa.get(key).sesiones.push(h);
    });
    return [...mapa.values()].sort((a, b) => (a.rama + a.categoria).localeCompare(b.rama + b.categoria));
  }, [horarios]);

  if (cargando || grupos.length === 0) return null;

  return (
    <div className="card mb-15" style={{ borderRadius: '18px' }}>
      <button
        type="button"
        onClick={() => setColapsado((v) => !v)}
        style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
      >
        <h4 className="form-subtitle" style={{ margin: 0 }}>
          <CalendarDays size={16} style={{ verticalAlign: '-3px', marginRight: '6px' }} />
          Horario de Entrenamientos
        </h4>
        <span style={{ fontSize: '11px', fontWeight: '800', color: 'var(--azul-electrico)' }}>{colapsado ? 'Ver' : 'Ocultar'}</span>
      </button>

      {!colapsado && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '12px' }}>
          {grupos.map((g) => {
            const { bg, color } = colorRama(g.rama);
            return (
              <div key={`${g.rama}-${g.categoria}`} style={{ border: '1px solid var(--borde-suave)', borderRadius: '12px', padding: '8px 12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '10px', fontWeight: '800', padding: '2px 8px', borderRadius: '999px', color, background: bg }}>{g.rama}</span>
                  <strong style={{ fontSize: '13px' }}>{g.categoria}</strong>
                </div>
                <div style={{ marginTop: '4px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  {g.sesiones.map((s) => (
                    <span key={s.id_horario} style={{ fontSize: '11px', color: 'var(--texto-secundario)', fontWeight: '700' }}>
                      {DIAS_CORTO[s.dia_semana]} {s.hora_inicio?.slice(0, 5)}-{s.hora_fin?.slice(0, 5)}
                      {s.lugar && ` · ${s.lugar}`}
                      {s.entrenador_a_cargo && ` · Prof. ${s.entrenador_a_cargo}`}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default MuroHorarioEntrenamientos;
