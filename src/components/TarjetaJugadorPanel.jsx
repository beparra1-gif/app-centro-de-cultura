import { useEffect, useRef, useState } from 'react';
import { BadgeCheck, Download, Mars, QrCode, ShieldCheck, Shirt, Target, Trophy, User, Venus, X } from 'lucide-react';
import html2canvas from 'html2canvas';
import { QRCodeSVG } from 'qrcode.react';
import { PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer } from 'recharts';
import PupiloSelector from './PupiloSelector';
import * as api from '../api/client';

const EXPORT_WIDTH = 750;
const EXPORT_HEIGHT = 1050;

function TarjetaJugadorPanel({
  pupiloActivo,
  setPupiloActivo,
  pupilosDisponibles,
  rolUsuario,
}) {
  if (!pupiloActivo) {
    return <div className="player-screen-shell">Cargando tarjeta del jugador...</div>;
  }

  const cardRef = useRef(null);
  const cardFrontExportRef = useRef(null);
  const cardBackRef = useRef(null);
  const [mostrarCredencialAsistencia, setMostrarCredencialAsistencia] = useState(false);
  const estiloColeccion = 'coleccionista';
  const [vistaColeccion, setVistaColeccion] = useState('frente');
  const [detalleJugador, setDetalleJugador] = useState(null);

  useEffect(() => {
    let cancelled = false;

    const cargarDetalleJugador = async () => {
      const rut = String(pupiloActivo?.rut || '').trim();
      if (!rut || rolUsuario === 'visita') {
        setDetalleJugador(null);
        return;
      }

      try {
        const detalle = await api.jugadoresAPI.getByRut(rut);
        if (!cancelled) {
          setDetalleJugador(detalle || null);
        }
      } catch {
        if (!cancelled) {
          setDetalleJugador(null);
        }
      }
    };

    void cargarDetalleJugador();
    return () => {
      cancelled = true;
    };
  }, [pupiloActivo?.rut, rolUsuario]);

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
  const nivelActualNumero = Number(nivelActual) || 0;
  const rolNormalizado = String(rolUsuario || '').toLowerCase().replace('-', '_');
  const mostrarIndumentaria = ['admin', 'super_admin'].includes(rolNormalizado);
  const normalizarRut = (rut = '') => String(rut || '').replace(/\./g, '').replace(/-/g, '').trim().toUpperCase();
  const pupiloDesdeListado = Array.isArray(pupilosDisponibles)
    ? pupilosDisponibles.find((item) => normalizarRut(item?.rut) === normalizarRut(pupiloActivo?.rut))
    : null;
  const construirNombreCompleto = (jugador = {}) => {
    const nombres = String(jugador?.nombres || '').trim();
    const paterno = String(jugador?.apellido_paterno || '').trim();
    const materno = String(jugador?.apellido_materno || '').trim();
    const compuesto = [nombres, paterno, materno].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
    if (compuesto) return compuesto;
    return String(jugador?.nombre || '').replace(/\s+/g, ' ').trim();
  };
  const nombreCompletoReal =
    construirNombreCompleto(pupiloActivo)
    || construirNombreCompleto(pupiloDesdeListado)
    || construirNombreCompleto(detalleJugador)
    || String(pupiloActivo?.nombre || '').trim();
  const nombreCompletoDisplay = rolUsuario === 'visita' ? 'INVITADO TORNEO' : (nombreCompletoReal || 'JUGADOR');
  const partesNombre = String(nombreCompletoDisplay || '').trim().split(/\s+/).filter(Boolean);
  const nombreDisplay = rolUsuario === 'visita' ? 'Invitado' : (partesNombre[0] || 'Jugador');
  const apellidoDisplay = rolUsuario === 'visita'
    ? 'TORNEO'
    : ((partesNombre.slice(1).join(' ') || partesNombre[0] || '').toUpperCase());
  const anioNacimiento = (
    pupiloActivo.anioNacimiento
    || pupiloActivo.anio_nacimiento
    || pupiloActivo.ano_nacimiento
    || pupiloActivo['año_nacimiento']
    || pupiloActivo['a├▒o_nacimiento']
    || pupiloDesdeListado?.anioNacimiento
    || pupiloDesdeListado?.anio_nacimiento
    || pupiloDesdeListado?.ano_nacimiento
    || pupiloDesdeListado?.['año_nacimiento']
    || pupiloDesdeListado?.['a├▒o_nacimiento']
    || detalleJugador?.anioNacimiento
    || detalleJugador?.anio_nacimiento
    || detalleJugador?.ano_nacimiento
    || detalleJugador?.['año_nacimiento']
    || detalleJugador?.['a├▒o_nacimiento']
    || (detalleJugador?.fecha_nacimiento ? new Date(detalleJugador.fecha_nacimiento).getUTCFullYear() : '')
    || ''
  );
  const numeroCamiseta = (() => {
    const raw = (
      pupiloActivo.numeroCamiseta
      ?? pupiloActivo.numero_camiseta
      ?? pupiloActivo.numero
      ?? pupiloActivo.dorsal
      ?? pupiloDesdeListado?.numeroCamiseta
      ?? pupiloDesdeListado?.numero_camiseta
      ?? pupiloDesdeListado?.numero
      ?? pupiloDesdeListado?.dorsal
      ?? detalleJugador?.numeroCamiseta
      ?? detalleJugador?.numero_camiseta
      ?? detalleJugador?.numero
      ?? detalleJugador?.dorsal
      ?? 0
    );
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  })();
  const categoriaDisplay = rolUsuario === 'visita' ? 'Open' : (pupiloActivo.categoria || 'General');
  const categoriaConAnio = anioNacimiento ? `${categoriaDisplay} · ${anioNacimiento}` : categoriaDisplay;

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
  const clubLogoUrl = pupiloActivo.club_logo_url || '/logos/club-logo.png';
  const fotoPrincipal = pupiloActivo.foto_jugador || pupiloActivo.foto_perfil_url || '';
  const descriptorGenero = `${pupiloActivo.genero || ''} ${pupiloActivo.sexo || ''} ${pupiloActivo.rama || ''}`.toLowerCase();
  const esFemenino = descriptorGenero.includes('femen') || descriptorGenero.includes('mujer');
  const clubIniciales = clubNombre
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((parte) => parte[0])
    .join('')
    .toUpperCase() || 'CCF';
  const etiquetaClub = rolUsuario === 'visita' ? 'INVITADO' : 'LOCAL';
  const hashSerial = (String(pupiloActivo.rut || pupiloActivo.nombre || 'ccf')
    .split('')
    .reduce((acc, char) => ((acc * 31) + char.charCodeAt(0)) % 9973, 0) % 500) + 1;
  const serialTexto = `${String(hashSerial).padStart(3, '0')}/500`;
  const qrPayload = JSON.stringify({
    tipo: 'asistencia_ccf',
    rut: rutValidacion,
    nombre: nombreCompletoDisplay,
    categoria: pupiloActivo.categoria || 'General',
  });
  const porcentajeDesdeTexto = (valor = '') => {
    const txt = String(valor || '').trim();
    const match = txt.match(/(\d{1,3})/);
    if (!match) return null;
    const parsed = Number(match[1]);
    if (!Number.isFinite(parsed)) return null;
    return Math.max(0, Math.min(100, parsed));
  };
  const asistenciaRadar = porcentajeDesdeTexto(pupiloActivo.asistencia) ?? Math.max(20, Math.min(100, rachaActual * 12));
  const progresoRadar = Math.max(0, Math.min(100, progresoNivel));
  const fisicoRadar = Number.isFinite(Number(detalleJugador?.fisico_score))
    ? Math.max(0, Math.min(100, Number(detalleJugador.fisico_score)))
    : 60;
  const tecnicaRadar = Number.isFinite(Number(detalleJugador?.tecnica_score))
    ? Math.max(0, Math.min(100, Number(detalleJugador.tecnica_score)))
    : 58;
  const tacticaRadar = Number.isFinite(Number(detalleJugador?.tactica_score))
    ? Math.max(0, Math.min(100, Number(detalleJugador.tactica_score)))
    : 55;
  const radarGamificacionData = [
    { area: 'Fisico', valor: fisicoRadar },
    { area: 'Tecnica', valor: tecnicaRadar },
    { area: 'Tactica', valor: tacticaRadar },
    { area: 'Asistencia', valor: asistenciaRadar },
    { area: 'Progreso', valor: progresoRadar },
  ];

  const descargarDataUrl = (dataUrl, nombreArchivo) => {
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = nombreArchivo;
    link.click();
  };

  const capturarRefExport = async (targetRef) => {
    if (!targetRef.current) throw new Error('No se pudo preparar la tarjeta para exportar.');
    return html2canvas(targetRef.current, {
      backgroundColor: null,
      scale: 1,
      useCORS: true,
      width: EXPORT_WIDTH,
      height: EXPORT_HEIGHT,
    });
  };

  const descargarTarjetaColeccionActual = async () => {
    const refObjetivo = vistaColeccion === 'reverso' ? cardBackRef : cardFrontExportRef;
    const sufijo = vistaColeccion === 'reverso' ? 'reverso' : 'frente';
    if (!refObjetivo.current) return;
    try {
      const canvas = await capturarRefExport(refObjetivo);
      const image = canvas.toDataURL('image/png');
      descargarDataUrl(image, `tarjeta-coleccion-${sufijo}-${String(nombreDisplay || 'jugador').toLowerCase()}.png`);
    } catch (error) {
      alert('No se pudo descargar la tarjeta en este momento.');
    }
  };

  return (
    <div className="player-screen-shell">
      <PupiloSelector
        pupilos={pupilosDisponibles}
        pupiloActivo={pupiloActivo}
        rolUsuario={rolUsuario}
        onChangePupilo={setPupiloActivo}
      />

      {rolUsuario !== 'visita' && (
        <div className="card history-assist-card" style={{ marginTop: '4px', borderRadius: '18px', background: 'linear-gradient(135deg, #101C2E 0%, #142E45 100%)', color: 'white', border: '1px solid rgba(255,255,255,0.12)' }}>
          <div className="history-assist-layout">
            <div className="history-summary-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                <div>
                  <strong style={{ fontSize: '16px', fontWeight: '900' }}>Resumen del jugador</strong>
                </div>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: '900', padding: '6px 10px', borderRadius: '999px', background: 'rgba(255,255,255,0.16)' }}>
                  <Trophy size={14} /> Nivel {nivelActualNumero}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(145px, 1fr))', gap: '8px' }}>
                <div style={{ background: 'rgba(255,255,255,0.1)', borderRadius: '12px', padding: '10px' }}>
                  <span style={{ fontSize: '10px', opacity: 0.8, textTransform: 'uppercase', fontWeight: '800' }}>Asistencia</span>
                  <strong style={{ display: 'block', marginTop: '4px', fontSize: '13px', color: 'var(--verde-victoria)' }}>{pupiloActivo.asistencia || 'N/A'}</strong>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.1)', borderRadius: '12px', padding: '10px' }}>
                  <span style={{ fontSize: '10px', opacity: 0.8, textTransform: 'uppercase', fontWeight: '800' }}>Estado</span>
                  <strong style={{ display: 'block', marginTop: '4px', fontSize: '13px', color: '#00C7BE' }}>{pupiloActivo.estadoDeportivo || 'Activo'}</strong>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.1)', borderRadius: '12px', padding: '10px' }}>
                  <span style={{ fontSize: '10px', opacity: 0.8, textTransform: 'uppercase', fontWeight: '800' }}>Validacion</span>
                  <strong style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', marginTop: '4px', fontSize: '13px', color: 'var(--verde-victoria)' }}><ShieldCheck size={14} /> Ficha habilitada</strong>
                </div>
              </div>
            </div>

            <div className="assist-cta-card">
              <button className="assist-cta-btn" onClick={() => setMostrarCredencialAsistencia(true)}>
                <QrCode size={16} />
                <span>Valida tu asistencia</span>
              </button>
            </div>
          </div>
        </div>
      )}

      <div
        ref={cardRef}
        className="card player-id-card official-player-card"
        style={{
          borderRadius: '24px',
          padding: '22px',
          background: `${estiloRareza.background}, radial-gradient(circle at 20% -10%, rgba(255,255,255,0.28) 0%, rgba(255,255,255,0) 45%)`,
          color: 'white',
          border: `1px solid ${estiloRareza.border}`,
          boxShadow: '0 20px 45px rgba(9, 20, 38, 0.32)'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <span style={{ fontSize: '11px', fontWeight: '800', letterSpacing: '0.9px', textTransform: 'uppercase', opacity: 0.85 }}>Tarjeta Oficial CCF 2026</span>
          <span
            style={{
              fontSize: '11px',
              fontWeight: '900',
              padding: '6px 10px',
              borderRadius: '999px',
              background: 'rgba(255,255,255,0.16)',
              border: `1px solid ${estiloRareza.border}`
            }}
          >
            {textoRareza}
          </span>
        </div>

        <div className="official-player-main-grid" style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '14px', alignItems: 'center' }}>
          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', marginBottom: '10px', fontSize: '12px', fontWeight: '700', color: 'rgba(255,255,255,0.85)' }}>
              <User size={14} /> Perfil jugador
            </div>
            <h1 className="player-lastname-focus" style={{ margin: '2px 0 8px 0' }}>{nombreCompletoDisplay}</h1>
            <div style={{ fontSize: '13px', opacity: 0.9, fontWeight: '700' }}>
              N° {rolUsuario === 'visita' ? '00' : numeroCamiseta} · {categoriaConAnio}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '14px', padding: '10px 12px', borderRadius: '16px', background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.18)', maxWidth: '320px' }}>
              <div style={{ width: '54px', height: '54px', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
                {clubLogoUrl ? (
                  <img src={clubLogoUrl} alt={`Logo de ${clubNombre}`} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                ) : (
                  <span style={{ fontSize: '16px', fontWeight: '900', color: 'white' }}>{clubIniciales}</span>
                )}
              </div>
              <div style={{ minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: '10px', fontWeight: '800', letterSpacing: '0.7px', textTransform: 'uppercase', opacity: 0.8 }}>Club</span>
                <strong style={{ display: 'block', fontSize: '13px', fontWeight: '900', lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{clubNombre}</strong>
              </div>
            </div>

            <div style={{ marginTop: '12px', display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 10px', borderRadius: '999px', background: 'rgba(255,255,255,0.15)', fontSize: '11px', fontWeight: '900', textTransform: 'uppercase' }}>
              {esFemenino ? <Venus size={14} /> : <Mars size={14} />}
              Rama {pupiloActivo.rama || 'General'}
            </div>
          </div>

          <div className="official-player-photo-wrap" style={{ display: 'grid', gap: '10px', justifyItems: 'center' }}>
            <div className="official-player-photo-frame" style={{
              width: '180px',
              height: '214px',
              borderRadius: '20px',
              background: 'linear-gradient(180deg, rgba(255,255,255,0.24) 0%, rgba(255,255,255,0.12) 100%)',
              border: '1px solid rgba(255,255,255,0.3)',
              padding: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: `0 10px 24px rgba(0,0,0,0.25), inset 0 0 0 2px ${estiloRareza.accent}`
            }}>
              {fotoPrincipal ? (
                <img src={fotoPrincipal} alt={`Foto de ${nombreDisplay}`} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '14px' }} />
              ) : (
                <div style={{ width: '100%', height: '100%', borderRadius: '14px', background: 'rgba(255,255,255,0.18)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                  {esFemenino ? <Venus size={30} /> : <Mars size={30} />}
                  <span style={{ fontSize: '10px', fontWeight: '800', opacity: 0.9 }}>SIN FOTO</span>
                </div>
              )}
            </div>
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
            <strong style={{ display: 'block', marginTop: '4px', fontSize: '13px' }}>{rolUsuario === 'visita' ? 'MAX' : nivelActualNumero}</strong>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.13)', borderRadius: '12px', padding: '10px' }}>
            <span style={{ fontSize: '10px', opacity: 0.8, textTransform: 'uppercase', fontWeight: '800' }}>Estado</span>
            <strong style={{ display: 'block', marginTop: '4px', fontSize: '13px' }}>{pupiloActivo.estadoDeportivo || 'Activo'}</strong>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.1)', borderRadius: '12px', padding: '10px' }}>
            <span style={{ fontSize: '10px', opacity: 0.8, textTransform: 'uppercase', fontWeight: '800' }}>Estatura</span>
            <strong style={{ display: 'block', marginTop: '4px', fontSize: '13px' }}>{pupiloActivo.estatura || 'N/A'}</strong>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.1)', borderRadius: '12px', padding: '10px' }}>
            <span style={{ fontSize: '10px', opacity: 0.8, textTransform: 'uppercase', fontWeight: '800' }}>Peso</span>
            <strong style={{ display: 'block', marginTop: '4px', fontSize: '13px' }}>{pupiloActivo.peso || 'N/A'}</strong>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.1)', borderRadius: '12px', padding: '10px' }}>
            <span style={{ fontSize: '10px', opacity: 0.8, textTransform: 'uppercase', fontWeight: '800' }}>Mano habil</span>
            <strong style={{ display: 'block', marginTop: '4px', fontSize: '13px' }}>{pupiloActivo.manoHabil || 'N/A'}</strong>
          </div>
        </div>

      </div>

      <div className="card collection-panel" style={{ marginTop: '8px', borderRadius: '18px', border: '1px solid var(--borde-suave)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <h4 className="collection-title" style={{ margin: 0, fontSize: '15px', fontWeight: '900', color: 'var(--azul-marino)' }}>Ver mi tarjeta de coleccion</h4>
          <button className="player-action-btn alt" onClick={descargarTarjetaColeccionActual} style={{ padding: '8px 12px' }}>
            <Download size={14} /> Descargar
          </button>
        </div>

        <div className="collection-style-switch mt-10" role="radiogroup" aria-label="Vista tarjeta de coleccion">
          <button
            type="button"
            className={vistaColeccion === 'frente' ? 'active' : ''}
            onClick={() => setVistaColeccion('frente')}
          >
            Frente
          </button>
          <button
            type="button"
            className={vistaColeccion === 'reverso' ? 'active' : ''}
            onClick={() => setVistaColeccion('reverso')}
          >
            Reverso
          </button>
        </div>

        <div className="collection-preview-wrap" style={{ marginTop: '12px', display: 'flex', justifyContent: 'center' }}>
          {vistaColeccion === 'frente' ? (
            <div className="player-collection-preview preview-front" style={{
              width: '220px',
              aspectRatio: '5 / 7',
              borderRadius: '16px',
              padding: '12px',
              background: estiloRareza.background,
              color: 'white',
              boxShadow: '0 12px 24px rgba(15,23,42,0.25)',
              display: 'grid',
              gridTemplateRows: 'auto auto 1fr auto'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '9px', fontWeight: '900', textTransform: 'uppercase' }}>
                <span>CCF 2026</span>
                <span>#{serialTexto}</span>
              </div>
              <div style={{ marginTop: '6px', fontFamily: 'Orbitron, Segoe UI, sans-serif', fontSize: '14px', fontWeight: '900', textTransform: 'uppercase' }}>
                {nombreDisplay} {apellidoDisplay}
              </div>
              <div style={{ marginTop: '8px', borderRadius: '12px', overflow: 'hidden', background: 'rgba(255,255,255,0.2)' }}>
                {fotoPrincipal ? (
                  <img src={fotoPrincipal} alt={`Foto de ${nombreDisplay}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <div style={{ height: '100%', minHeight: '130px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {esFemenino ? <Venus size={24} /> : <Mars size={24} />}
                  </div>
                )}
              </div>
              <div style={{ marginTop: '8px', fontSize: '10px', fontWeight: '800' }}>
                Nivel {nivelActualNumero} · {pupiloActivo.categoria || 'General'}
              </div>
            </div>
          ) : (
            <div className="player-collection-preview preview-back" style={{
              width: '220px',
              aspectRatio: '5 / 7',
              borderRadius: '16px',
              padding: '12px',
              background: 'linear-gradient(160deg, #0b1d3a 0%, #133a66 46%, #0e2b4d 100%)',
              color: 'white',
              boxShadow: '0 12px 24px rgba(15,23,42,0.25)',
              display: 'grid',
              gridTemplateRows: 'auto auto 1fr auto'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '9px', fontWeight: '900', textTransform: 'uppercase' }}>
                <span>Reverso CCF</span>
                <span>#{serialTexto}</span>
              </div>
              <div style={{ marginTop: '6px', fontSize: '11px', fontWeight: '900' }}>{pupiloActivo.nombre || 'Jugador'}</div>
              <div style={{ marginTop: '8px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', fontSize: '10px', fontWeight: '800' }}>
                <span>Nivel {nivelActualNumero}</span>
                <span>XP {xpActual}</span>
                <span>Racha {rachaActual} dias</span>
                <span>Puntos {puntosGamificacion}</span>
              </div>
              <div style={{ marginTop: '8px', fontSize: '9px', opacity: 0.9 }}>
                Formato 2.5 x 3.5 in vertical
              </div>
            </div>
          )}
        </div>
      </div>

      {rolUsuario !== 'visita' && (
        <div className="card" style={{ marginTop: '14px', borderRadius: '18px', background: 'linear-gradient(135deg, #101C2E 0%, #142E45 100%)', color: 'white', border: '1px solid rgba(255,255,255,0.12)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
            <div>
              <strong style={{ fontSize: '16px', fontWeight: '900' }}>Progreso deportivo</strong>
            </div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: '900', padding: '6px 10px', borderRadius: '999px', background: 'rgba(255,255,255,0.16)' }}>
              <Trophy size={14} /> Nivel {nivelActualNumero}
            </div>
          </div>

          <div style={{ width: '100%', height: '230px', marginBottom: '10px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radarGamificacionData} outerRadius={80}>
                <PolarGrid stroke="rgba(255,255,255,0.25)" />
                <PolarAngleAxis dataKey="area" tick={{ fill: 'rgba(255,255,255,0.9)', fontSize: 11, fontWeight: 700 }} />
                <PolarRadiusAxis domain={[0, 100]} tick={{ fill: 'rgba(255,255,255,0.65)', fontSize: 10 }} tickCount={5} />
                <Radar dataKey="valor" stroke="#00C7BE" fill="#00C7BE" fillOpacity={0.32} strokeWidth={2} />
              </RadarChart>
            </ResponsiveContainer>
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
              <strong style={{ display: 'block', marginTop: '4px', fontSize: '13px' }}>{rachaActual} dias</strong>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.1)', borderRadius: '12px', padding: '10px' }}>
              <span style={{ fontSize: '10px', opacity: 0.8, textTransform: 'uppercase', fontWeight: '800' }}>Siguiente nivel</span>
              <strong style={{ display: 'block', marginTop: '4px', fontSize: '13px' }}>{xpParaSiguienteNivel} XP</strong>
            </div>
          </div>

          <div style={{ marginTop: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', opacity: 0.85 }}>
              <span>Progreso al proximo nivel</span>
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

      {rolUsuario !== 'visita' && (
        <>
          {mostrarIndumentaria && (
            <>
              <h3 className="section-title mt-20">Gestion de Indumentaria</h3>
              <div className="caja-doble-grid mb-15">
              <div className="card sub-caja-card metric-card" style={{ padding: '15px' }}>
                <h5 className="sub-caja-title" style={{ fontSize: '11px' }}><Shirt size={14} /> Indumentaria (solo administración)</h5>
                <div className="desglose-row"><span>Camiseta:</span><strong>{pupiloActivo.tallaCamiseta}</strong></div>
                <div className="desglose-row"><span>Short:</span><strong>{pupiloActivo.tallaShort}</strong></div>
                <div className="desglose-row mt-10 text-center">
                  <span className="badge-urgente" style={{ background: pupiloActivo.poleraEntregada ? 'var(--verde-victoria)' : '#FF3B30', width: '100%', display: 'block', padding: '8px 0' }}>
                    {pupiloActivo.poleraEntregada ? 'ROPA ENTREGADA ✓' : 'FALTA ENTREGA'}
                  </span>
                </div>
              </div>
              </div>
            </>
          )}

        </>
      )}

      {mostrarCredencialAsistencia && (
        <div className="attendance-overlay" role="dialog" aria-modal="true">
          <div className="attendance-card">
            <button className="attendance-close" onClick={() => setMostrarCredencialAsistencia(false)}>
              <X size={18} />
            </button>
            <div className="attendance-eyebrow">Credencial de asistencia</div>
            <h3>{pupiloActivo.nombre || 'Jugador'}</h3>
            <div className="attendance-meta">
              <span>{pupiloActivo.categoria || 'General'}</span>
              <span>{clubNombre}</span>
              <span>{etiquetaClub}</span>
            </div>
            <div className="attendance-qr-wrap">
              <QRCodeSVG value={qrPayload} size={178} bgColor="#FFFFFF" fgColor="#0D2244" level="M" includeMargin />
            </div>
            <p>Presenta este QR al staff para registrar tu asistencia.</p>
          </div>
        </div>
      )}

      <div aria-hidden="true" style={{ position: 'fixed', left: '-9999px', top: '-9999px', opacity: 0, pointerEvents: 'none' }}>
        <div
          ref={cardFrontExportRef}
          className="card"
          style={{
            width: `${EXPORT_WIDTH}px`,
            height: `${EXPORT_HEIGHT}px`,
            borderRadius: '26px',
            padding: '30px',
            display: 'flex',
            flexDirection: 'column',
            background: `${estiloRareza.background}, radial-gradient(circle at 18% -5%, rgba(255,255,255,0.28) 0%, rgba(255,255,255,0) 40%)`,
            color: 'white',
            border: `1px solid ${estiloRareza.border}`,
            boxShadow: '0 20px 45px rgba(9, 20, 38, 0.32)'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
            <span style={{ fontSize: '13px', fontWeight: '900', letterSpacing: '0.9px', textTransform: 'uppercase', opacity: 0.9 }}>Tarjeta Oficial CCF 2026</span>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', fontWeight: '900', padding: '7px 12px', borderRadius: '999px', background: 'rgba(255,255,255,0.16)' }}>{textoRareza}</span>
              <span style={{ fontSize: '11px', fontWeight: '900', padding: '7px 10px', borderRadius: '999px', background: 'rgba(255,255,255,0.12)' }}>#{serialTexto}</span>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: '20px', alignItems: 'center' }}>
            <div>
              <h1 style={{ margin: '8px 0 10px', fontFamily: 'Orbitron, Segoe UI, sans-serif', fontSize: '52px', lineHeight: 1, letterSpacing: '1.2px', textTransform: 'uppercase' }}>{nombreCompletoDisplay}</h1>
              <div style={{ fontSize: '20px', fontWeight: '800', opacity: 0.95 }}>
                N° {rolUsuario === 'visita' ? '00' : numeroCamiseta} · {categoriaConAnio}
              </div>

              <div style={{ marginTop: '16px', display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 12px', borderRadius: '14px', background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.16)', maxWidth: '360px' }}>
                <div style={{ width: '64px', height: '64px', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
                  {clubLogoUrl ? (
                    <img src={clubLogoUrl} alt={`Logo de ${clubNombre}`} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                  ) : (
                    <span style={{ fontSize: '20px', fontWeight: '900' }}>{clubIniciales}</span>
                  )}
                </div>
                <div>
                  <span style={{ display: 'block', fontSize: '11px', fontWeight: '800', letterSpacing: '0.7px', textTransform: 'uppercase', opacity: 0.85 }}>Club</span>
                  <strong style={{ fontSize: '16px', fontWeight: '900' }}>{clubNombre}</strong>
                </div>
              </div>
            </div>

            <div style={{ width: '280px', height: '364px', borderRadius: '22px', background: 'linear-gradient(180deg, rgba(255,255,255,0.24) 0%, rgba(255,255,255,0.12) 100%)', border: '1px solid rgba(255,255,255,0.3)', padding: '10px', boxShadow: `0 10px 24px rgba(0,0,0,0.25), inset 0 0 0 2px ${estiloRareza.accent}` }}>
              {fotoPrincipal ? (
                <img src={fotoPrincipal} alt={`Foto de ${nombreDisplay}`} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '16px' }} />
              ) : (
                <div style={{ width: '100%', height: '100%', borderRadius: '16px', background: 'rgba(255,255,255,0.18)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                  {esFemenino ? <Venus size={46} /> : <Mars size={46} />}
                  <span style={{ fontSize: '12px', fontWeight: '800' }}>SIN FOTO</span>
                </div>
              )}
            </div>
          </div>

          <div style={{ marginTop: 'auto' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
              <div style={{ background: 'rgba(255,255,255,0.13)', borderRadius: '12px', padding: '10px' }}>
                <span style={{ fontSize: '10px', opacity: 0.8, textTransform: 'uppercase', fontWeight: '800' }}>Posicion</span>
                <strong style={{ display: 'block', marginTop: '4px', fontSize: '14px' }}>{rolUsuario === 'visita' ? 'N/A' : pupiloActivo.posicion}</strong>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.13)', borderRadius: '12px', padding: '10px' }}>
                <span style={{ fontSize: '10px', opacity: 0.8, textTransform: 'uppercase', fontWeight: '800' }}>Nivel</span>
                <strong style={{ display: 'block', marginTop: '4px', fontSize: '14px' }}>{rolUsuario === 'visita' ? 'MAX' : nivelActualNumero}</strong>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.13)', borderRadius: '12px', padding: '10px' }}>
                <span style={{ fontSize: '10px', opacity: 0.8, textTransform: 'uppercase', fontWeight: '800' }}>Estado</span>
                <strong style={{ display: 'block', marginTop: '4px', fontSize: '14px' }}>{pupiloActivo.estadoDeportivo || 'Activo'}</strong>
              </div>
            </div>
            <div style={{ marginTop: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', opacity: 0.92 }}>
              <span>Formato 2.5 x 3.5 in (vertical)</span>
              <span>Temporada 2026</span>
            </div>
          </div>
        </div>

        <div
          ref={cardBackRef}
          className="card"
          style={{
            width: `${EXPORT_WIDTH}px`,
            height: `${EXPORT_HEIGHT}px`,
            borderRadius: '24px',
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            background: 'linear-gradient(160deg, #0b1d3a 0%, #133a66 46%, #0e2b4d 100%)',
            color: 'white',
            border: '1px solid rgba(255,255,255,0.14)',
            boxShadow: '0 20px 45px rgba(9, 20, 38, 0.32)'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <span style={{ fontSize: '12px', fontWeight: '900', letterSpacing: '0.8px', textTransform: 'uppercase' }}>Reverso Coleccionable CCF</span>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <span style={{ fontSize: '11px', fontWeight: '900', padding: '5px 10px', borderRadius: '999px', background: 'rgba(255,255,255,0.16)' }}>{textoRareza}</span>
              <span style={{ fontSize: '11px', fontWeight: '900', padding: '5px 10px', borderRadius: '999px', background: 'rgba(255,255,255,0.12)' }}>#{serialTexto}</span>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '16px', alignItems: 'center' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '28px', fontWeight: '900', lineHeight: 1.1 }}>{pupiloActivo.nombre || 'Jugador'}</h3>
              <p style={{ margin: '8px 0 0', fontSize: '13px', opacity: 0.9, fontWeight: '700' }}>
                Categoria: {categoriaConAnio} · Club: {clubNombre}
              </p>
            </div>
            <div style={{ width: '78px', height: '78px', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
              {clubLogoUrl ? (
                <img src={clubLogoUrl} alt={`Logo de ${clubNombre}`} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
              ) : (
                <span style={{ fontSize: '20px', fontWeight: '900' }}>{clubIniciales}</span>
              )}
            </div>
          </div>

          {estiloColeccion === 'coleccionista' ? (
            <>
              <div style={{ marginTop: '14px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                <div style={{ background: 'rgba(255,255,255,0.12)', borderRadius: '12px', padding: '10px' }}>
                  <span style={{ fontSize: '10px', textTransform: 'uppercase', opacity: 0.85, fontWeight: '800' }}>Nivel</span>
                  <strong style={{ display: 'block', marginTop: '4px', fontSize: '16px' }}>{nivelActualNumero}</strong>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.12)', borderRadius: '12px', padding: '10px' }}>
                  <span style={{ fontSize: '10px', textTransform: 'uppercase', opacity: 0.85, fontWeight: '800' }}>XP</span>
                  <strong style={{ display: 'block', marginTop: '4px', fontSize: '16px' }}>{xpActual}</strong>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.12)', borderRadius: '12px', padding: '10px' }}>
                  <span style={{ fontSize: '10px', textTransform: 'uppercase', opacity: 0.85, fontWeight: '800' }}>Racha</span>
                  <strong style={{ display: 'block', marginTop: '4px', fontSize: '16px' }}>{rachaActual} dias</strong>
                </div>
              </div>

              <div style={{ marginTop: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', fontSize: '11px', fontWeight: '800', textTransform: 'uppercase' }}>
                  <span>Progreso</span>
                  <span>{progresoNivel}%</span>
                </div>
                <div style={{ height: '10px', borderRadius: '999px', background: 'rgba(255,255,255,0.18)', overflow: 'hidden' }}>
                  <div style={{ width: `${progresoNivel}%`, height: '100%', borderRadius: '999px', background: 'linear-gradient(90deg, #00C7BE 0%, #FFE066 100%)' }} />
                </div>
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '14px' }}>
                {insignias.map((insignia) => (
                  <span key={`back-${insignia}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 10px', borderRadius: '999px', background: 'rgba(255,255,255,0.15)', fontSize: '11px', fontWeight: '900' }}>
                    <BadgeCheck size={13} /> {insignia}
                  </span>
                ))}
              </div>
            </>
          ) : (
            <>
              <div style={{ marginTop: '14px', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
                <div style={{ background: 'rgba(255,255,255,0.12)', borderRadius: '12px', padding: '10px' }}>
                  <span style={{ fontSize: '10px', textTransform: 'uppercase', opacity: 0.85, fontWeight: '800' }}>POS</span>
                  <strong style={{ display: 'block', marginTop: '4px', fontSize: '15px' }}>{pupiloActivo.posicion || 'N/A'}</strong>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.12)', borderRadius: '12px', padding: '10px' }}>
                  <span style={{ fontSize: '10px', textTransform: 'uppercase', opacity: 0.85, fontWeight: '800' }}>PTS</span>
                  <strong style={{ display: 'block', marginTop: '4px', fontSize: '15px' }}>{puntosGamificacion}</strong>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.12)', borderRadius: '12px', padding: '10px' }}>
                  <span style={{ fontSize: '10px', textTransform: 'uppercase', opacity: 0.85, fontWeight: '800' }}>EST</span>
                  <strong style={{ display: 'block', marginTop: '4px', fontSize: '15px' }}>{pupiloActivo.estatura || 'N/A'}</strong>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.12)', borderRadius: '12px', padding: '10px' }}>
                  <span style={{ fontSize: '10px', textTransform: 'uppercase', opacity: 0.85, fontWeight: '800' }}>PESO</span>
                  <strong style={{ display: 'block', marginTop: '4px', fontSize: '15px' }}>{pupiloActivo.peso || 'N/A'}</strong>
                </div>
              </div>

              <div style={{ marginTop: '14px', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.18)', padding: '10px 12px', background: 'rgba(255,255,255,0.08)' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '12px', fontWeight: '800' }}>
                  <span>Estado: {pupiloActivo.estadoDeportivo || 'Activo'}</span>
                  <span>Beca: {pupiloActivo.beca || 'Sin beca'}</span>
                  <span>XP total: {xpActual}</span>
                  <span>Nivel: {nivelActualNumero}</span>
                </div>
              </div>

              <div style={{ marginTop: '14px', fontSize: '11px', opacity: 0.9, fontWeight: '700' }}>
                Perfil tecnico del jugador para seguimiento deportivo y evaluacion interna del club.
              </div>
            </>
          )}

          <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', opacity: 0.9 }}>
            <span>Formato 2.5 x 3.5 in</span>
            <span>Temporada 2026</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default TarjetaJugadorPanel;
