import { useState } from 'react';
import { Clock, MapPin, MessageSquare, Navigation, Shield } from 'lucide-react';
import { absolutizarLogoUrl } from '../utils/logoResolver';

// Resumen visual de un partido citado: competencia, escudos (club vs rival),
// fecha, horario de citación (llegada) y de partido, ubicación con enlaces a
// Google Maps / Waze y el mensaje del responsable. Lo usan el Muro, el enlace
// de WhatsApp y la revisión antes de publicar.

const LOGO_CLUB = '/logos/club-logo.png';
const urlLogo = (url) => {
  const raw = String(url || '').trim();
  if (!raw) return '';
  return raw.startsWith('/logos/') ? raw : absolutizarLogoUrl(raw);
};

// Escudo con respaldo: si no hay logo (o no carga), un escudo genérico.
function Escudo({ url, nombre, tamano = 64 }) {
  const [fallo, setFallo] = useState(false);
  const src = urlLogo(url);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', minWidth: 0, flex: 1 }}>
      {/* Sin marco ni círculo: cada club tiene una forma de escudo distinta y el recorte la deformaba. */}
      <div style={{ width: tamano, height: tamano, display: 'grid', placeItems: 'center' }}>
        {src && !fallo
          ? <img src={src} alt={`Escudo de ${nombre}`} width={tamano} height={tamano} style={{ objectFit: 'contain', filter: 'drop-shadow(0 2px 4px rgba(15,23,42,0.18))' }} onError={() => setFallo(true)} />
          : <Shield size={tamano * 0.55} color="var(--azul-electrico)" strokeWidth={1.6} role="img" aria-label={`Escudo genérico de ${nombre}`} />}
      </div>
      <strong style={{ fontSize: '13px', textAlign: 'center', lineHeight: 1.2, overflowWrap: 'anywhere' }}>{nombre}</strong>
    </div>
  );
}

const hora = (h) => String(h || '').slice(0, 5);
const fechaLarga = (iso) => {
  const [a, m, d] = String(iso || '').slice(0, 10).split('-').map(Number);
  if (!a) return '';
  const texto = new Date(a, m - 1, d).toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long' });
  return texto.charAt(0).toUpperCase() + texto.slice(1);
};

const enlacesMapa = (lugar, direccion) => {
  const q = [lugar, direccion].filter(Boolean).join(', ');
  if (!q) return null;
  const consulta = encodeURIComponent(q);
  return {
    google: `https://www.google.com/maps/search/?api=1&query=${consulta}`,
    waze: `https://waze.com/ul?q=${consulta}&navigate=yes`,
  };
};

export default function TarjetaPartido({ cita = {}, nombreClub = 'CCF Viña del Mar' }) {
  // Datos antiguos guardaban el escudo del club como logo del rival: se trata como "sin logo".
  const logoRival = cita.rival_logo_url && cita.rival_logo_url !== LOGO_CLUB ? cita.rival_logo_url : '';
  const logoCompetencia = cita.competencia_logo_url && cita.competencia_logo_url !== LOGO_CLUB ? cita.competencia_logo_url : '';
  const mapa = enlacesMapa(cita.lugar_nombre, cita.lugar_direccion);
  return (
    <div className="tarjeta-partido" data-testid="tarjeta-partido" style={{ background: 'linear-gradient(180deg, rgba(11,29,58,0.06), rgba(0,122,255,0.05))', borderRadius: 'var(--radius-md)', padding: '12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '10px' }}>
        {logoCompetencia
          ? <img src={urlLogo(logoCompetencia)} alt="" width="26" height="26" style={{ objectFit: 'contain', borderRadius: '6px' }} />
          : <Shield size={18} color="var(--azul-electrico)" aria-hidden="true" />}
        <span style={{ fontSize: '12px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.4px', color: 'var(--texto-secundario)' }}>
          {[cita.tipo_competencia, cita.competencia_nombre].filter(Boolean).join(' · ')}
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Escudo url={LOGO_CLUB} nombre={nombreClub} />
        <span style={{ fontSize: '20px', fontWeight: 900, color: 'var(--texto-secundario)' }} aria-label="contra">VS</span>
        <Escudo url={logoRival} nombre={cita.rival_nombre || 'Rival'} />
      </div>
      <div style={{ marginTop: '12px', display: 'grid', gap: '6px', fontSize: '13px' }}>
        {cita.dia_citacion && <div style={{ fontWeight: 800 }}>{fechaLarga(cita.dia_citacion)}</div>}
        <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}><Clock size={14} aria-hidden="true" /> Citación <b>{hora(cita.hora_presentacion) || '—'}</b></span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}><Clock size={14} aria-hidden="true" /> Partido <b>{hora(cita.hora_citacion) || '—'}</b></span>
        </div>
        {(cita.lugar_nombre || cita.lugar_direccion) && (
          <div style={{ display: 'flex', gap: '6px', alignItems: 'flex-start' }}>
            <MapPin size={14} aria-hidden="true" style={{ flexShrink: 0, marginTop: '2px' }} />
            <span>{[cita.lugar_nombre, cita.lugar_direccion].filter(Boolean).join(' · ')}</span>
          </div>
        )}
        {mapa && (
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <a className="btn-secondary tc-btn" href={mapa.google} target="_blank" rel="noopener noreferrer"><MapPin size={13} /> Google Maps</a>
            <a className="btn-secondary tc-btn" href={mapa.waze} target="_blank" rel="noopener noreferrer"><Navigation size={13} /> Waze</a>
          </div>
        )}
        {cita.mensaje_adicional && (
          <div style={{ display: 'flex', gap: '6px', alignItems: 'flex-start', background: 'rgba(255,149,0,0.10)', borderRadius: 'var(--radius-sm)', padding: '8px' }}>
            <MessageSquare size={14} aria-hidden="true" style={{ flexShrink: 0, marginTop: '2px' }} />
            <span style={{ whiteSpace: 'pre-line' }}>{cita.mensaje_adicional}</span>
          </div>
        )}
      </div>
    </div>
  );
}
