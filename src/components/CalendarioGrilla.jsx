import { useEffect, useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

// Calendario agnóstico del dominio: no sabe si un evento es un arriendo o un
// entrenamiento, solo pinta lo que recibe. El consumidor arma cada evento
// con esta forma:
//   { id, fecha: 'YYYY-MM-DD', horaInicio: 'HH:MM', horaFin: 'HH:MM',
//     titulo, subtitulo, color, tipo, raw }
// y decide qué hacer al hacer clic (onClickEvento) — este componente no
// abre modales ni conoce ninguna API.

const DIAS_SEMANA = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const NOMBRES_MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

const aISO = (fecha) => {
  const d = new Date(fecha);
  d.setHours(0, 0, 0, 0);
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tz).toISOString().slice(0, 10);
};

const lunesDeSemana = (fecha) => {
  const d = new Date(fecha);
  d.setHours(0, 0, 0, 0);
  const dia = d.getDay();
  const diff = dia === 0 ? -6 : 1 - dia;
  d.setDate(d.getDate() + diff);
  return d;
};

const sumarDias = (fecha, n) => {
  const d = new Date(fecha);
  d.setDate(d.getDate() + n);
  return d;
};

const minutosDeHora = (horaStr = '00:00') => {
  const [h, m] = String(horaStr).slice(0, 5).split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};

// Rango visible según la vista activa — se expone via onRangoVisibleChange
// para que el consumidor sepa exactamente qué pedirle a la API (la grilla
// de mes casi siempre incluye días de meses vecinos).
const calcularRangoVisible = (vista, fechaFoco) => {
  if (vista === 'dia') {
    const dia = new Date(fechaFoco);
    dia.setHours(0, 0, 0, 0);
    return { desde: dia, hasta: dia };
  }
  if (vista === 'semana') {
    const desde = lunesDeSemana(fechaFoco);
    return { desde, hasta: sumarDias(desde, 6) };
  }
  const primerDiaMes = new Date(fechaFoco.getFullYear(), fechaFoco.getMonth(), 1);
  const ultimoDiaMes = new Date(fechaFoco.getFullYear(), fechaFoco.getMonth() + 1, 0);
  const desde = lunesDeSemana(primerDiaMes);
  const hasta = sumarDias(lunesDeSemana(ultimoDiaMes), 6);
  return { desde, hasta };
};

function CalendarioGrilla({
  vista = 'mes',
  fechaFoco = new Date(),
  eventos = [],
  onCambiarFoco,
  onCambiarVista,
  onClickEvento,
  onClickDia,
  onRangoVisibleChange,
  horaMin = 8,
  horaMax = 22,
}) {
  const { desde: rangoDesde, hasta: rangoHasta } = useMemo(() => calcularRangoVisible(vista, fechaFoco), [vista, fechaFoco]);
  const rangoDesdeISO = aISO(rangoDesde);
  const rangoHastaISO = aISO(rangoHasta);

  // El rango visible de la grilla casi siempre incluye días de meses vecinos
  // (la vista Mes rellena hasta completar semanas) — se lo pasamos al
  // consumidor para que sepa exactamente qué pedirle a la API, sin que
  // tenga que duplicar este cálculo.
  useEffect(() => {
    if (onRangoVisibleChange) onRangoVisibleChange(rangoDesdeISO, rangoHastaISO);
  }, [rangoDesdeISO, rangoHastaISO]);

  const eventosPorFecha = useMemo(() => {
    const mapa = new Map();
    eventos.forEach((ev) => {
      if (!mapa.has(ev.fecha)) mapa.set(ev.fecha, []);
      mapa.get(ev.fecha).push(ev);
    });
    mapa.forEach((lista) => lista.sort((a, b) => a.horaInicio.localeCompare(b.horaInicio)));
    return mapa;
  }, [eventos]);

  const hoyISO = aISO(new Date());

  const irAnterior = () => {
    if (!onCambiarFoco) return;
    if (vista === 'dia') onCambiarFoco(sumarDias(fechaFoco, -1));
    else if (vista === 'semana') onCambiarFoco(sumarDias(fechaFoco, -7));
    else onCambiarFoco(new Date(fechaFoco.getFullYear(), fechaFoco.getMonth() - 1, 1));
  };

  const irSiguiente = () => {
    if (!onCambiarFoco) return;
    if (vista === 'dia') onCambiarFoco(sumarDias(fechaFoco, 1));
    else if (vista === 'semana') onCambiarFoco(sumarDias(fechaFoco, 7));
    else onCambiarFoco(new Date(fechaFoco.getFullYear(), fechaFoco.getMonth() + 1, 1));
  };

  const tituloRango = () => {
    if (vista === 'dia') {
      return fechaFoco.toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long' });
    }
    if (vista === 'semana') {
      const desde = lunesDeSemana(fechaFoco);
      const hasta = sumarDias(desde, 6);
      const mismomes = desde.getMonth() === hasta.getMonth();
      return mismomes
        ? `${desde.getDate()} - ${hasta.getDate()} de ${NOMBRES_MESES[desde.getMonth()]} ${desde.getFullYear()}`
        : `${desde.getDate()} ${NOMBRES_MESES[desde.getMonth()]} - ${hasta.getDate()} ${NOMBRES_MESES[hasta.getMonth()]} ${hasta.getFullYear()}`;
    }
    return `${NOMBRES_MESES[fechaFoco.getMonth()]} ${fechaFoco.getFullYear()}`;
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', gap: '10px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button type="button" className="btn-secondary" style={{ width: 'auto', padding: '8px 12px' }} onClick={irAnterior}><ChevronLeft size={16} /></button>
          <strong style={{ fontSize: '14px', textTransform: 'capitalize' }}>{tituloRango()}</strong>
          <button type="button" className="btn-secondary" style={{ width: 'auto', padding: '8px 12px' }} onClick={irSiguiente}><ChevronRight size={16} /></button>
        </div>
        {onCambiarVista && (
          <div className="segment-control" style={{ gap: '6px' }}>
            <button type="button" className={`segment-btn ${vista === 'mes' ? 'active' : ''}`} onClick={() => onCambiarVista('mes')}>Mes</button>
            <button type="button" className={`segment-btn ${vista === 'semana' ? 'active' : ''}`} onClick={() => onCambiarVista('semana')}>Semana</button>
            <button type="button" className={`segment-btn ${vista === 'dia' ? 'active' : ''}`} onClick={() => onCambiarVista('dia')}>Día</button>
          </div>
        )}
      </div>

      {vista === 'mes' && (
        <VistaMes
          rangoDesde={rangoDesde}
          rangoHasta={rangoHasta}
          mesReferencia={fechaFoco.getMonth()}
          eventosPorFecha={eventosPorFecha}
          hoyISO={hoyISO}
          onClickEvento={onClickEvento}
          onClickDia={onClickDia}
        />
      )}
      {vista === 'semana' && (
        <VistaAgenda
          dias={[0, 1, 2, 3, 4, 5, 6].map((n) => sumarDias(rangoDesde, n))}
          eventosPorFecha={eventosPorFecha}
          hoyISO={hoyISO}
          horaMin={horaMin}
          horaMax={horaMax}
          onClickEvento={onClickEvento}
        />
      )}
      {vista === 'dia' && (
        <VistaAgenda
          dias={[fechaFoco]}
          eventosPorFecha={eventosPorFecha}
          hoyISO={hoyISO}
          horaMin={horaMin}
          horaMax={horaMax}
          onClickEvento={onClickEvento}
          detallado
        />
      )}
    </div>
  );
}

function VistaMes({ rangoDesde, rangoHasta, mesReferencia, eventosPorFecha, hoyISO, onClickEvento, onClickDia }) {
  const dias = [];
  for (let d = new Date(rangoDesde); d <= rangoHasta; d.setDate(d.getDate() + 1)) {
    dias.push(new Date(d));
  }

  return (
    <div className="card" style={{ borderRadius: '16px', padding: '8px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: '2px', marginBottom: '4px' }}>
        {DIAS_SEMANA.map((d) => (
          <div key={d} style={{ fontSize: '11px', fontWeight: '800', color: 'var(--texto-secundario)', textAlign: 'center', padding: '4px 0' }}>{d}</div>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: '2px' }}>
        {dias.map((dia) => {
          const fechaISO = aISO(dia);
          const eventosDia = eventosPorFecha.get(fechaISO) || [];
          const esMesActual = dia.getMonth() === mesReferencia;
          const esHoy = fechaISO === hoyISO;
          const visibles = eventosDia.slice(0, 3);
          const restantes = eventosDia.length - visibles.length;

          return (
            <div
              key={fechaISO}
              onClick={() => onClickDia && onClickDia(fechaISO)}
              style={{
                minHeight: '76px',
                minWidth: 0,
                borderRadius: '10px',
                padding: '4px',
                background: esHoy ? 'rgba(0,122,255,0.08)' : 'transparent',
                border: esHoy ? '1px solid rgba(0,122,255,0.3)' : '1px solid rgba(0,0,0,0.05)',
                opacity: esMesActual ? 1 : 0.4,
                cursor: onClickDia ? 'pointer' : 'default',
                display: 'flex',
                flexDirection: 'column',
                gap: '2px',
                overflow: 'hidden',
              }}
            >
              <span style={{ fontSize: '11px', fontWeight: esHoy ? '900' : '700', color: esHoy ? 'var(--azul-electrico)' : 'var(--texto-principal)' }}>
                {dia.getDate()}
              </span>
              {visibles.map((ev) => (
                <button
                  key={ev.id}
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onClickEvento && onClickEvento(ev); }}
                  title={`${ev.horaInicio} ${ev.titulo}`}
                  style={{
                    display: 'block',
                    width: '100%',
                    minWidth: 0,
                    maxWidth: '100%',
                    boxSizing: 'border-box',
                    background: ev.color,
                    color: 'white',
                    border: 'none',
                    borderRadius: '5px',
                    padding: '2px 4px',
                    fontSize: '9px',
                    fontWeight: '800',
                    textAlign: 'left',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    cursor: 'pointer',
                  }}
                >
                  {ev.horaInicio} {ev.titulo}
                </button>
              ))}
              {restantes > 0 && (
                <span style={{ fontSize: '9px', fontWeight: '800', color: 'var(--texto-secundario)', paddingLeft: '4px' }}>+{restantes} más</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function VistaAgenda({ dias, eventosPorFecha, hoyISO, horaMin, horaMax, onClickEvento, detallado = false }) {
  const alturaHora = 48;
  const horas = [];
  for (let h = horaMin; h < horaMax; h += 1) horas.push(h);

  return (
    <div className="card" style={{ borderRadius: '16px', padding: '8px', overflowX: 'auto' }}>
      <div style={{ display: 'grid', gridTemplateColumns: `56px repeat(${dias.length}, minmax(${detallado ? '220px' : '110px'}, 1fr))`, minWidth: detallado ? 'auto' : `${56 + dias.length * 110}px` }}>
        <div />
        {dias.map((dia) => {
          const fechaISO = aISO(dia);
          const esHoy = fechaISO === hoyISO;
          return (
            <div key={fechaISO} style={{ textAlign: 'center', padding: '4px 0', fontSize: '11px', fontWeight: '800', color: esHoy ? 'var(--azul-electrico)' : 'var(--texto-principal)' }}>
              {DIAS_SEMANA[dia.getDay() === 0 ? 6 : dia.getDay() - 1]} {dia.getDate()}
            </div>
          );
        })}

        <div style={{ position: 'relative' }}>
          {horas.map((h) => (
            <div key={h} style={{ height: `${alturaHora}px`, fontSize: '10px', color: 'var(--texto-secundario)', textAlign: 'right', paddingRight: '6px', borderTop: '1px solid rgba(0,0,0,0.05)' }}>
              {String(h).padStart(2, '0')}:00
            </div>
          ))}
        </div>

        {dias.map((dia) => {
          const fechaISO = aISO(dia);
          const eventosDia = eventosPorFecha.get(fechaISO) || [];
          return (
            <div key={fechaISO} style={{ position: 'relative', borderLeft: '1px solid rgba(0,0,0,0.05)' }}>
              {horas.map((h) => (
                <div key={h} style={{ height: `${alturaHora}px`, borderTop: '1px solid rgba(0,0,0,0.05)' }} />
              ))}
              {eventosDia.map((ev) => {
                const inicioMin = Math.max(minutosDeHora(ev.horaInicio) - horaMin * 60, 0);
                const finMin = Math.min(minutosDeHora(ev.horaFin) - horaMin * 60, (horaMax - horaMin) * 60);
                const top = (inicioMin / 60) * alturaHora;
                const height = Math.max(((finMin - inicioMin) / 60) * alturaHora, 16);
                return (
                  <button
                    key={ev.id}
                    type="button"
                    onClick={() => onClickEvento && onClickEvento(ev)}
                    style={{
                      position: 'absolute',
                      top: `${top}px`,
                      height: `${height}px`,
                      left: '2px',
                      right: '2px',
                      background: ev.color,
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      padding: '3px 6px',
                      fontSize: detallado ? '12px' : '10px',
                      fontWeight: '800',
                      textAlign: 'left',
                      overflow: 'hidden',
                      cursor: 'pointer',
                    }}
                    title={`${ev.horaInicio}-${ev.horaFin} ${ev.titulo}`}
                  >
                    {ev.horaInicio} {ev.titulo}
                    {detallado && ev.subtitulo && <div style={{ fontSize: '10px', fontWeight: '600', opacity: 0.9 }}>{ev.subtitulo}</div>}
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default CalendarioGrilla;
