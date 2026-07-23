import { useEffect, useMemo, useState } from 'react';
import { CalendarDays } from 'lucide-react';
import * as api from '../api/client';
import { colorBadgePorRama } from '../utils/coloresRama';

const DIAS_LARGO = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

const aISO = (fecha) => {
  const d = new Date(fecha);
  d.setHours(0, 0, 0, 0);
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tz).toISOString().slice(0, 10);
};

const sumarDias = (fecha, n) => {
  const d = new Date(fecha);
  d.setDate(d.getDate() + n);
  return d;
};

const lunesDeSemana = (fecha) => {
  const d = new Date(fecha);
  d.setHours(0, 0, 0, 0);
  const dia = d.getDay();
  const diff = dia === 0 ? -6 : 1 - dia;
  d.setDate(d.getDate() + diff);
  return d;
};

// Widget fijo del Muro (no un post más de la lista cronológica) — se arma
// solo, sin props, para poder insertarse en ComunicacionesPanel sin tocar
// el prop-drilling que ese componente todavía usa para el resto. Consume
// /instancias (no /publico) porque ya resuelve excepciones — una sesión
// cancelada o reprogramada hoy debe verse correcta, no el patrón crudo.
function MuroHorarioEntrenamientos() {
  const [vista, setVista] = useState('dia');
  const [instancias, setInstancias] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [hayHorarios, setHayHorarios] = useState(true);
  const [colapsado, setColapsado] = useState(false);

  // Chequeo liviano, una sola vez: si el club nunca definió ningún horario,
  // el widget no tiene nada que ofrecer y no se muestra (mismo criterio que
  // antes). Si sí hay horarios definidos pero ninguno cae hoy/esta semana,
  // se muestra igual con un mensaje — así el usuario entiende que el
  // sistema existe, no que algo falló.
  useEffect(() => {
    (async () => {
      try {
        const datos = await api.horariosEntrenamientoAPI.getPublico();
        setHayHorarios(Array.isArray(datos) && datos.length > 0);
      } catch {
        setHayHorarios(false);
      }
    })();
  }, []);

  useEffect(() => {
    const hoy = new Date();
    const { desde, hasta } = vista === 'semana'
      ? { desde: aISO(lunesDeSemana(hoy)), hasta: aISO(sumarDias(lunesDeSemana(hoy), 6)) }
      : { desde: aISO(hoy), hasta: aISO(hoy) };
    (async () => {
      setCargando(true);
      try {
        const datos = await api.horariosEntrenamientoAPI.getInstancias({ desde, hasta });
        setInstancias(Array.isArray(datos) ? datos : []);
      } catch {
        setInstancias([]);
      } finally {
        setCargando(false);
      }
    })();
  }, [vista]);

  const grupoPorDia = useMemo(() => {
    const mapa = new Map();
    instancias.forEach((i) => {
      if (!mapa.has(i.fecha)) mapa.set(i.fecha, []);
      mapa.get(i.fecha).push(i);
    });
    mapa.forEach((lista) => lista.sort((a, b) => a.hora_inicio.localeCompare(b.hora_inicio)));
    return [...mapa.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [instancias]);

  if (!hayHorarios) return null;

  const renderSesion = (s) => {
    const { bg, color } = colorBadgePorRama(s.rama);
    const categorias = Array.isArray(s.categorias) ? s.categorias.join(', ') : '';
    return (
      <div key={`${s.id_horario}-${s.fecha}`} style={{ border: '1px solid var(--borde-suave)', borderRadius: '12px', padding: '8px 12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '10px', fontWeight: '800', padding: '2px 8px', borderRadius: '999px', color, background: bg }}>{s.rama}</span>
          <strong style={{ fontSize: '13px' }}>{categorias}</strong>
          {s.es_reprogramado && <span style={{ fontSize: '10px', fontWeight: '800', color: '#b36200' }}>Reprogramado</span>}
        </div>
        <div style={{ marginTop: '3px', fontSize: '11px', color: 'var(--texto-secundario)', fontWeight: '700' }}>
          {s.hora_inicio?.slice(0, 5)}-{s.hora_fin?.slice(0, 5)}
          {s.lugar && ` · ${s.lugar}`}
          {Array.isArray(s.entrenadores) && s.entrenadores.length > 0 && ` · Prof. ${s.entrenadores.join(', ')}`}
        </div>
      </div>
    );
  };

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
        <div style={{ marginTop: '12px' }}>
          <div className="segment-control" style={{ gap: '6px', marginBottom: '10px' }}>
            <button type="button" className={`segment-btn ${vista === 'dia' ? 'active' : ''}`} onClick={() => setVista('dia')}>Hoy</button>
            <button type="button" className={`segment-btn ${vista === 'semana' ? 'active' : ''}`} onClick={() => setVista('semana')}>Esta semana</button>
          </div>

          {cargando && <p className="text-muted" style={{ fontSize: '12px' }}>Cargando...</p>}

          {!cargando && grupoPorDia.length === 0 && (
            <p className="text-muted italic" style={{ fontSize: '12px', margin: 0 }}>
              {vista === 'semana' ? 'Esta semana no hay entrenamientos programados.' : 'Hoy no hay entrenamientos programados.'}
            </p>
          )}

          {!cargando && vista === 'dia' && grupoPorDia.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {grupoPorDia[0][1].map(renderSesion)}
            </div>
          )}

          {!cargando && vista === 'semana' && grupoPorDia.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {grupoPorDia.map(([fecha, sesiones]) => (
                <div key={fecha}>
                  <div style={{ fontSize: '11px', fontWeight: '800', color: 'var(--texto-secundario)', marginBottom: '5px', textTransform: 'uppercase' }}>
                    {DIAS_LARGO[new Date(`${fecha}T00:00:00`).getDay()]} {new Date(`${fecha}T00:00:00`).getDate()}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {sesiones.map(renderSesion)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default MuroHorarioEntrenamientos;
