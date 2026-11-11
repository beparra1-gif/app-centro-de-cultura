import { Cake } from 'lucide-react';
import { cumpleanosDelMes } from '../utils/cumpleanos';

// Panel (inicio): cumpleaños del mes de deportistas y cuentas activas,
// ordenados por día; el de hoy se destaca. Las fechas se leen con
// partesFechaCalendario (en producción las DATE llegan con hora UTC).

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

export default function CumpleanosMes({ jugadores = [], cuentas = [], onVer }) {
  const hoy = new Date();
  const lista = cumpleanosDelMes({ jugadores, cuentas, hoy });
  if (lista.length === 0) return null;
  const diaHoy = hoy.getDate();
  return (
    <section className="pn-grupo" aria-label="Cumpleaños del mes">
      <h3 className="pn-grupo-titulo">Cumpleaños de {MESES[hoy.getMonth()]} ({lista.length})</h3>
      <div className="cm-cumples">
        {lista.map((c) => (
          <button
            key={c.clave}
            type="button"
            className={`cm-cumple ${c.dia === diaHoy ? 'hoy' : ''} ${c.dia < diaHoy ? 'pasado' : ''}`}
            onClick={() => onVer?.(c)}
          >
            <span className="cm-cumple-dia">{c.dia === diaHoy ? <Cake size={16} aria-label="Hoy" /> : c.dia}</span>
            <span className="cm-cumple-texto">
              <strong>{c.nombre}</strong>
              <small>{c.dia === diaHoy ? '¡Hoy! · ' : ''}{c.cumple > 0 && c.cumple < 110 ? `cumple ${c.cumple}` : ''}{c.detalle ? ` · ${c.detalle}` : ''}</small>
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
