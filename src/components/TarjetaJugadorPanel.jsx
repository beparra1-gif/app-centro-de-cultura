import { BadgeCheck, ShieldCheck, Shirt, Target, Trophy, User } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import PupiloSelector from './PupiloSelector';

function TarjetaJugadorPanel({
  pupiloActivo,
  setPupiloActivo,
  pupilosDisponibles,
  rolUsuario,
}) {
  if (!pupiloActivo) {
    return <div className="player-screen-shell">Cargando tarjeta del jugador...</div>;
  }

  const xpActual = Number(pupiloActivo.xp ?? pupiloActivo.xp_total ?? 0);
  const nivelBase = Number(pupiloActivo.nivel ?? pupiloActivo.nivel_actual ?? 1) || 1;
  const puntosGamificacion = Number(
    pupiloActivo.puntos_gamificacion
    ?? pupiloActivo.puntos
    ?? Math.max(0, Math.round(xpActual / 10))
  );
  const rachaActual = Number(pupiloActivo.racha ?? pupiloActivo.racha_actual ?? Math.max(1, Math.floor(xpActual / 500))) || 1;
  const xpParaSiguienteNivel = Math.max(0, 150 - (xpActual % 150));
  const progresoNivel = Math.min(100, Math.round(((xpActual % 150) / 150) * 100));
  const insignias = Array.isArray(pupiloActivo.insignias) && pupiloActivo.insignias.length > 0
    ? pupiloActivo.insignias
    : [
        nivelBase >= 5 ? 'Constancia' : 'Inicio activo',
        xpActual >= 1000 ? 'Impulso XP' : 'Progreso',
        rachaActual >= 3 ? 'Racha' : 'En desarrollo',
      ];

  let textoRareza = 'BRONCE';
  let estiloRareza = {
    background: 'linear-gradient(145deg, #5A3726 0%, #A56A43 100%)',
    accent: '#D9A066',
    border: 'rgba(255,255,255,0.18)',
  };
  const nivelActual = rolUsuario === 'visita' ? 'MAX' : nivelBase;
  const nombreDisplay = rolUsuario === 'visita' ? 'Invitado' : pupiloActivo.nombre.split(' ')[0];
  const apellidoDisplay = rolUsuario === 'visita' ? 'TORNEO' : pupiloActivo.nombre.split(' ')[1]?.toUpperCase() || '';

  if (nivelActual > 10 && nivelActual <= 20) {
    textoRareza = 'PLATA';
    estiloRareza = {
      background: 'linear-gradient(145deg, #5E6774 0%, #D8E0E8 100%)',
      accent: '#F5F8FA',
      border: 'rgba(255,255,255,0.22)',
    };
  } else if (nivelActual > 20) {
    textoRareza = 'ORO';
    estiloRareza = {
      background: 'linear-gradient(145deg, #8B5E00 0%, #FFC94D 100%)',
      accent: '#FFE29A',
      border: 'rgba(255,255,255,0.22)',
    };
  }

  if (nivelActual > 30) {
    textoRareza = 'DIAMANTE';
    estiloRareza = {
      background: 'linear-gradient(145deg, #0C4A6E 0%, #66D9FF 45%, #E8FBFF 100%)',
      accent: '#E8FBFF',
      border: 'rgba(255,255,255,0.3)',
    };
  }

  if (rolUsuario === 'visita') {
    textoRareza = 'VISITA';
    estiloRareza = {
      background: 'linear-gradient(145deg, #123A57 0%, #3BA4D8 100%)',
      accent: '#D7F2FF',
      border: 'rgba(255,255,255,0.22)',
    };
  }

  const rutValidacion = rolUsuario === 'visita' ? 'VISITA' : (pupiloActivo.rut || 'SIN-RUT');
  const clubNombre = pupiloActivo.club_nombre || pupiloActivo.club_procedencia || (rolUsuario === 'visita' ? 'Club invitado' : 'Centro de Cultura Física');
  const clubLogoUrl = pupiloActivo.club_logo_url || pupiloActivo.foto_jugador || '';
  const clubIniciales = clubNombre
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((parte) => parte[0])
    .join('')
    .toUpperCase() || 'CCF';
  const qrPayload = JSON.stringify({
    tipo: 'asistencia_ccf',
    rut: rutValidacion,
    nombre: pupiloActivo.nombre,
    categoria: pupiloActivo.categoria || 'General',
  });

  return (
    <div className="player-screen-shell">
      <PupiloSelector
        pupilos={pupilosDisponibles}
        pupiloActivo={pupiloActivo}
        rolUsuario={rolUsuario}
        onChangePupilo={setPupiloActivo}
      />

      <div className="card" style={{
        borderRadius: '24px',
        padding: '22px',
        background: estiloRareza.background,
        color: 'white',
        border: `1px solid ${estiloRareza.border}`,
        boxShadow: '0 20px 45px rgba(9, 20, 38, 0.32)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <span style={{ fontSize: '11px', fontWeight: '800', letterSpacing: '0.9px', textTransform: 'uppercase', opacity: 0.85 }}>Tarjeta Oficial 2026</span>
          <span style={{
            fontSize: '11px',
            fontWeight: '900',
            padding: '6px 10px',
            borderRadius: '999px',
            background: 'rgba(255,255,255,0.16)',
            border: `1px solid ${estiloRareza.border}`
          }}>{textoRareza}</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '14px', alignItems: 'center' }}>
          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', marginBottom: '10px', fontSize: '12px', fontWeight: '700', color: 'rgba(255,255,255,0.85)' }}>
              <User size={14} /> Perfil jugador
            </div>
            <h2 style={{ margin: 0, fontSize: '24px', fontWeight: '900', lineHeight: 1.1 }}>{nombreDisplay}</h2>
            <h1 style={{ margin: '2px 0 8px 0', fontSize: '28px', fontWeight: '900', lineHeight: 1.1 }}>{apellidoDisplay}</h1>
            <div style={{ fontSize: '13px', opacity: 0.9, fontWeight: '700' }}>
              N° {rolUsuario === 'visita' ? '00' : pupiloActivo.numeroCamiseta} · {rolUsuario === 'visita' ? 'Open' : pupiloActivo.categoria}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '14px', padding: '10px 12px', borderRadius: '16px', background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.18)', maxWidth: '280px' }}>
              <div style={{ width: '52px', height: '52px', borderRadius: '16px', background: 'rgba(255,255,255,0.18)', border: '1px solid rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
                {clubLogoUrl ? (
                  <img src={clubLogoUrl} alt={`Logo de ${clubNombre}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <span style={{ fontSize: '16px', fontWeight: '900', color: 'white' }}>{clubIniciales}</span>
                )}
              </div>
              <div style={{ minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: '10px', fontWeight: '800', letterSpacing: '0.7px', textTransform: 'uppercase', opacity: 0.8 }}>Club</span>
                <strong style={{ display: 'block', fontSize: '13px', fontWeight: '900', lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{clubNombre}</strong>
              </div>
            </div>
          </div>

          <div style={{
            width: '170px',
            height: '170px',
            borderRadius: '18px',
            background: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: `0 10px 24px rgba(0,0,0,0.25), inset 0 0 0 2px ${estiloRareza.accent}`
          }}>
            <QRCodeSVG value={qrPayload} size={142} bgColor="#FFFFFF" fgColor="#000000" level="M" includeMargin />
          </div>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '10px',
          marginTop: '16px'
        }}>
          <div style={{ background: 'rgba(255,255,255,0.13)', borderRadius: '12px', padding: '10px' }}>
            <span style={{ fontSize: '10px', opacity: 0.8, textTransform: 'uppercase', fontWeight: '800' }}>Posición</span>
            <strong style={{ display: 'block', marginTop: '4px', fontSize: '13px' }}>{rolUsuario === 'visita' ? 'N/A' : pupiloActivo.posicion}</strong>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.13)', borderRadius: '12px', padding: '10px' }}>
            <span style={{ fontSize: '10px', opacity: 0.8, textTransform: 'uppercase', fontWeight: '800' }}>Nivel</span>
            <strong style={{ display: 'block', marginTop: '4px', fontSize: '13px' }}>{rolUsuario === 'visita' ? 'MAX' : nivelActual}</strong>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.13)', borderRadius: '12px', padding: '10px' }}>
            <span style={{ fontSize: '10px', opacity: 0.8, textTransform: 'uppercase', fontWeight: '800' }}>Estado</span>
            <strong style={{ display: 'block', marginTop: '4px', fontSize: '13px' }}>{pupiloActivo.estadoDeportivo || 'Activo'}</strong>
          </div>
        </div>

        {rolUsuario !== 'visita' && (
          <div style={{ marginTop: '12px', padding: '14px', borderRadius: '16px', background: 'rgba(255,255,255,0.11)', border: '1px solid rgba(255,255,255,0.16)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
              <div>
                <div style={{ fontSize: '10px', fontWeight: '800', letterSpacing: '0.8px', textTransform: 'uppercase', opacity: 0.85 }}>Gamificación</div>
                <strong style={{ fontSize: '16px', fontWeight: '900' }}>Progreso deportivo</strong>
              </div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: '900', padding: '6px 10px', borderRadius: '999px', background: 'rgba(255,255,255,0.16)' }}>
                <Trophy size={14} /> Nivel {nivelActual}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '8px' }}>
              <div style={{ background: 'rgba(255,255,255,0.1)', borderRadius: '12px', padding: '10px' }}>
                <span style={{ fontSize: '10px', opacity: 0.8, textTransform: 'uppercase', fontWeight: '800' }}>XP</span>
                <strong style={{ display: 'block', marginTop: '4px', fontSize: '13px' }}>{xpActual} XP</strong>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.1)', borderRadius: '12px', padding: '10px' }}>
                <span style={{ fontSize: '10px', opacity: 0.8, textTransform: 'uppercase', fontWeight: '800' }}>Puntos</span>
                <strong style={{ display: 'block', marginTop: '4px', fontSize: '13px' }}>{puntosGamificacion}</strong>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.1)', borderRadius: '12px', padding: '10px' }}>
                <span style={{ fontSize: '10px', opacity: 0.8, textTransform: 'uppercase', fontWeight: '800' }}>Racha</span>
                <strong style={{ display: 'block', marginTop: '4px', fontSize: '13px' }}>{rachaActual} días</strong>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.1)', borderRadius: '12px', padding: '10px' }}>
                <span style={{ fontSize: '10px', opacity: 0.8, textTransform: 'uppercase', fontWeight: '800' }}>Siguiente nivel</span>
                <strong style={{ display: 'block', marginTop: '4px', fontSize: '13px' }}>{xpParaSiguienteNivel} XP</strong>
              </div>
            </div>

            <div style={{ marginTop: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', opacity: 0.85 }}>
                <span>Progreso al próximo nivel</span>
                <span>{progresoNivel}%</span>
              </div>
              <div style={{ height: '10px', borderRadius: '999px', background: 'rgba(255,255,255,0.15)', overflow: 'hidden' }}>
                <div style={{ width: `${progresoNivel}%`, height: '100%', borderRadius: '999px', background: 'linear-gradient(90deg, #00C7BE 0%, #FFE066 100%)' }} />
              </div>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '12px' }}>
              {insignias.map((insignia) => (
                <span key={insignia} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 10px', borderRadius: '999px', background: 'rgba(255,255,255,0.15)', fontSize: '11px', fontWeight: '900' }}>
                  <BadgeCheck size={13} /> {insignia}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
      <p className="text-center mt-5" style={{ fontSize: '12px', color: 'var(--texto-secundario)', fontWeight: '800' }}>
        Escanea este QR en portería para validar asistencia. RUT asociado: <strong>{rutValidacion}</strong>
      </p>

      {rolUsuario !== 'visita' && (
        <>
          <h3 className="section-title mt-20">Ficha Atlética e Indumentaria</h3>
          <div className="caja-doble-grid mb-15">
            <div className="card sub-caja-card metric-card" style={{ padding: '15px' }}>
              <h5 className="sub-caja-title" style={{ fontSize: '11px' }}><Target size={14} /> Biometría</h5>
              <div className="desglose-row"><span>Estatura:</span><strong>{pupiloActivo.estatura}</strong></div>
              <div className="desglose-row"><span>Peso:</span><strong>{pupiloActivo.peso}</strong></div>
              <div className="desglose-row"><span>Mano hábil:</span><strong>{pupiloActivo.manoHabil}</strong></div>
            </div>

            <div className="card sub-caja-card metric-card" style={{ padding: '15px' }}>
              <h5 className="sub-caja-title" style={{ fontSize: '11px' }}><Shirt size={14} /> Tallas</h5>
              <div className="desglose-row"><span>Camiseta:</span><strong>{pupiloActivo.tallaCamiseta}</strong></div>
              <div className="desglose-row"><span>Short:</span><strong>{pupiloActivo.tallaShort}</strong></div>
              <div className="desglose-row mt-10 text-center">
                <span className="badge-urgente" style={{ background: pupiloActivo.poleraEntregada ? 'var(--verde-victoria)' : '#FF3B30', width: '100%', display: 'block', padding: '8px 0' }}>
                  {pupiloActivo.poleraEntregada ? 'ROPA ENTREGADA ✓' : 'FALTA ENTREGA'}
                </span>
              </div>
            </div>
          </div>

          <div className="card history-card" style={{ background: 'linear-gradient(135deg, #1A222D, #0B1017)', color: 'white', border: 'none' }}>
            <h4 className="form-subtitle" style={{ color: '#00C7BE', margin: '0 0 15px 0' }}>📊 Historial Deportivo</h4>
            <div className="desglose-row"><span>Asistencia a entrenamientos:</span><strong style={{ color: 'var(--verde-victoria)' }}>{pupiloActivo.asistencia}</strong></div>
            <div className="desglose-row"><span>Estado del Jugador:</span><strong style={{ color: '#00C7BE' }}>{pupiloActivo.estadoDeportivo}</strong></div>
            <div className="desglose-row"><span>Beca Asignada:</span><strong>{pupiloActivo.beca}</strong></div>
            <div className="desglose-row mt-10"><span>Validación:</span><strong style={{ color: 'var(--verde-victoria)', display: 'inline-flex', alignItems: 'center', gap: '6px' }}><ShieldCheck size={14} /> Ficha habilitada</strong></div>
          </div>
        </>
      )}
    </div>
  );
}

export default TarjetaJugadorPanel;
