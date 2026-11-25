import { CalendarDays, Clock, Edit2, MapPin, Trash2, Users } from 'lucide-react';
import LogoAvatar from './LogoAvatar';
import { partesFechaCalendario } from '../utils/fechas';
import { absolutizarLogoUrl } from '../utils/logoResolver';

const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

// "Domingo 29 de noviembre" leyendo la fecha calendario (en producción la
// DATE llega como medianoche UTC y new Date() en Chile daría el día anterior).
const fechaLarga = (valor) => {
  const f = partesFechaCalendario(valor);
  if (!f) return 'Fecha por confirmar';
  return `${DIAS[new Date(f.anio, f.mes - 1, f.dia).getDay()]} ${f.dia} de ${MESES[f.mes - 1]}`;
};

// Partido publicado antes de jugarse: genera expectativa; luego el admin lo
// edita y pasa a ser una tarjeta de resultado normal.
export default function ProximoPartidoCard({ partido, puedeEditar = false, onEditar, onBorrar }) {
  return (
    <article className="pp-card" aria-label={`Próximo partido contra ${partido.nombreRival}`}>
      <header className="pp-cabecera">
        <span className="pp-etiqueta">Próximo partido</span>
        <span className="pp-torneo">{partido.torneo} · {partido.rama} {partido.categoria}</span>
      </header>
      {partido.aficheUrl && <img className="pp-afiche" src={absolutizarLogoUrl(partido.aficheUrl)} alt={`Afiche: ${partido.equipoLocalNombre} vs ${partido.nombreRival}`} />}
      <div className="pp-equipos">
        <div><LogoAvatar nombre={partido.equipoLocalNombre} logoUrl={partido.equipoLocalLogoUrl} size={56} borderRadius="14px" /><strong>{partido.equipoLocalNombre}</strong></div>
        <span className="pp-vs">VS</span>
        <div><LogoAvatar nombre={partido.nombreRival} logoUrl={partido.rivalLogoUrl} size={56} borderRadius="14px" /><strong>{partido.nombreRival}</strong></div>
      </div>
      <ul className="pp-datos">
        <li><CalendarDays size={15} aria-hidden="true" /> {fechaLarga(partido.fechaISO)}</li>
        {partido.hora && <li><Clock size={15} aria-hidden="true" /> {partido.hora} hrs</li>}
        {partido.ubicacion && <li><MapPin size={15} aria-hidden="true" /> {partido.ubicacion}</li>}
      </ul>
      {puedeEditar && (
        <footer className="pp-admin">
          {partido.audienciaTexto && <span><Users size={14} aria-hidden="true" /> {partido.audienciaTexto}</span>}
          <div>
            <button type="button" className="btn-secondary tc-btn" onClick={() => onEditar?.(partido)}><Edit2 size={14} /> Cargar resultado / editar</button>
            <button type="button" className="btn-secondary tc-btn" onClick={() => onBorrar?.(partido.id)} aria-label="Borrar partido"><Trash2 size={14} /></button>
          </div>
        </footer>
      )}
    </article>
  );
}
