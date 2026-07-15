import { CalendarDays, Heart, Edit2, Trash2, MapPin, ThumbsUp, Frown, Check, X, Venus, Mars } from 'lucide-react';
import { useState } from 'react';
import LogoAvatar from './LogoAvatar';

export default function ResultadosCards({ partidos, puedeEditar = false, onEditar, onBorrar, diseño = 'clasico' }) {
  const frasesVictoria = ['Tremendo triunfo', 'La casa se respeta', 'Que partidazo jugamos'];
  const frasesDerrota = ['A levantar cabeza para el próximo', 'Aprender de los errores y seguir', 'No bajamos los brazos'];
  const [reacciones, setReacciones] = useState({});

  const toggleReaccion = (partidoId, tipo) => {
    setReacciones(prev => ({
      ...prev,
      [partidoId]: prev[partidoId] === tipo ? null : tipo
    }));
  };

  const esFemelina = (partido) => (partido.rama || '').toLowerCase().includes('femen');
  const colorBorde = (partido) => esFemelina(partido) ? '#ec4899' : '#3b82f6';
  const colorFondo = (partido) => esFemelina(partido) ? 'rgba(236, 72, 153, 0.08)' : 'rgba(59, 130, 246, 0.08)';
  const colorBadge = (partido) => esFemelina(partido) ? '#ec4899' : '#3b82f6';
  const isMobile = typeof window !== 'undefined' && window.innerWidth <= 560;
  
  // Colores monocromáticos para iconos
  const colorIcono = 'var(--gris-secundario)'; // Gris neutro

  return partidos.map((partido) => {
    const esVictoria = partido.miEquipo > partido.rival;
    const esEmpate = partido.miEquipo === partido.rival;
    const dif = Math.abs(partido.miEquipo - partido.rival);
    const frases = esVictoria ? frasesVictoria : frasesDerrota;
    const frase = frases[partido.id % frases.length];
    const reaccionActual = reacciones[partido.id];

    // DISEÑO 1: CLÁSICO MEJORADO (por defecto)
    if (diseño === 'clasico') {
      const estaGanando = partido.miEquipo > partido.rival;
      const esEmpate = partido.miEquipo === partido.rival;
      const colorResultado = estaGanando ? '#10b981' : esEmpate ? '#6366f1' : '#ef4444';
      const textResultado = estaGanando ? 'GANAMOS' : esEmpate ? 'EMPATE' : 'PERDIMOS';
      
      return (
        <div key={partido.id} style={{ 
          borderLeft: `6px solid ${colorBorde(partido)}`,
          background: colorFondo(partido),
          marginBottom: '16px',
          borderRadius: '18px',
          padding: isMobile ? '12px' : '16px',
          transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
          cursor: 'pointer',
          transform: 'translateZ(0)',
          boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
          backdropFilter: 'blur(10px)'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'translateY(-4px)';
          e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.12)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'translateY(0)';
          e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)';
        }}
        >
          {/* Header - Torneo y Categoría */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: isMobile ? 'flex-start' : 'center', marginBottom: '14px', gap: isMobile ? '8px' : '0', flexWrap: isMobile ? 'wrap' : 'nowrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0 }}>
              {partido.torneoLogoUrl && (
                <LogoAvatar nombre={partido.torneo || 'Torneo'} logoUrl={partido.torneoLogoUrl} size={26} borderRadius="999px" />
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--texto-secundario)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  {partido.torneo || 'Competencia'}
                </span>
                <span style={{ fontSize: '11px', color: 'var(--texto-secundario)', opacity: 0.7 }}>
                  {partido.categoria || 'General'}
                </span>
              </div>
            </div>
            <span style={{
              fontSize: '11px',
              fontWeight: '900',
              padding: '5px 12px',
              borderRadius: '10px',
              background: colorBadge(partido),
              color: 'white',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              boxShadow: `0 4px 12px rgba(${colorBadge(partido) === '#ec4899' ? '236, 72, 153' : '59, 130, 246'}, 0.3)`
            }}>
              {partido.rama}
            </span>
          </div>

          {/* Marcador Central - Mejorado */}
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'minmax(0,1fr) minmax(62px, auto) minmax(0,1fr)',
            gap: isMobile ? '6px' : '12px',
            alignItems: 'center',
            marginBottom: '14px'
          }}>
            {/* Local */}
            <div style={{ textAlign: 'center', minWidth: 0 }}>
              <LogoAvatar 
                nombre={partido.equipoLocalNombre || 'Centro de Cultura Física'} 
                logoUrl={partido.equipoLocalLogoUrl || '/logos/club-logo.png'} 
                size={isMobile ? 60 : 82} 
                borderRadius="14px"
                style={{ border: 'none', background: 'transparent', boxShadow: 'none' }}
              />
              <div style={{ 
                fontSize: isMobile ? '10px' : '13px', 
                fontWeight: '700', 
                marginTop: '8px', 
                color: 'var(--texto-principal)',
                lineHeight: '1.3',
                textTransform: 'uppercase',
                letterSpacing: '0.2px',
                fontFamily: isMobile ? "'Inter Tight', sans-serif" : "'Bungee', sans-serif",
                overflowWrap: 'anywhere'
              }}>
                {partido.equipoLocalNombre || 'C.C. Física'}
              </div>
            </div>

            {/* Score - Horizontal Layout */}
            <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: '4px', minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '6px' : '12px', justifyContent: 'center' }}>
                <div style={{ 
                  fontSize: isMobile ? '40px' : '56px', 
                  fontWeight: '700', 
                  color: colorBadge(partido), 
                  fontFamily: "'Bungee', 'Inter Tight', monospace", 
                  lineHeight: '0.9',
                  textShadow: `0 4px 12px rgba(${colorBadge(partido) === '#ec4899' ? '236, 72, 153' : '59, 130, 246'}, 0.3)`
                }}>
                  {partido.miEquipo}
                </div>
                <div style={{ fontSize: isMobile ? '11px' : '14px', fontWeight: '700', color: 'var(--texto-secundario)', letterSpacing: '1px' }}>vs</div>
                <div style={{ fontSize: isMobile ? '40px' : '56px', fontWeight: '700', color: '#D1D5DB', fontFamily: "'Bungee', 'Inter Tight', monospace", lineHeight: '0.9' }}>
                  {partido.rival}
                </div>
              </div>
            </div>

            {/* Visitante */}
            <div style={{ textAlign: 'center', minWidth: 0 }}>
              <LogoAvatar 
                nombre={partido.nombreRival} 
                logoUrl={partido.rivalLogoUrl || partido.equipoVisitaLogoUrl || ''} 
                size={isMobile ? 60 : 82} 
                borderRadius="14px"
                fallbackText={partido.nombreRival?.substring(0, 3).toUpperCase()}
                style={{ border: 'none', background: 'transparent', boxShadow: 'none' }}
              />
              <div style={{ 
                fontSize: isMobile ? '10px' : '13px', 
                fontWeight: '700', 
                marginTop: '8px', 
                color: 'var(--texto-principal)',
                lineHeight: '1.3',
                textTransform: 'uppercase',
                letterSpacing: '0.2px',
                fontFamily: isMobile ? "'Inter Tight', sans-serif" : "'Bungee', sans-serif",
                overflowWrap: 'anywhere'
              }}>
                {partido.nombreRival}
              </div>
            </div>
          </div>

          {/* Estado Resultado - MEJORADO */}
          <div style={{ 
            textAlign: 'center', 
            padding: '12px 14px', 
            background: `linear-gradient(135deg, ${colorResultado}20, ${colorResultado}10)`,
            borderRadius: '14px',
            marginBottom: '14px',
            border: `1.5px solid ${colorResultado}40`
          }}>
            <div style={{ 
              fontSize: '14px', 
              fontWeight: '900', 
              color: colorResultado,
              textTransform: 'uppercase',
              letterSpacing: '1px',
              marginBottom: '4px',
              textShadow: `0 2px 4px rgba(0,0,0,0.1)`
            }}>
              {textResultado} {!esEmpate && `POR ${Math.abs(partido.miEquipo - partido.rival)}`}
            </div>
            <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--texto-secundario)', fontStyle: 'italic' }}>
              {frase}
            </div>
          </div>

          {/* Info - Ubicación y Fecha */}
          <div style={{ 
            display: 'flex', 
            gap: '14px', 
            fontSize: '11px', 
            color: 'var(--texto-secundario)', 
            fontWeight: '600',
            marginBottom: '14px',
            paddingBottom: '12px',
            borderBottom: '1px solid rgba(0,0,0,0.06)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1 }}>
              <MapPin size={15} color={colorIcono} strokeWidth={1.5} /> 
              <span>{partido.ubicacion || 'Cancha CCF'}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1 }}>
              <CalendarDays size={15} color={colorIcono} strokeWidth={1.5} /> 
              <span>{partido.fecha}</span>
            </div>
          </div>

          {/* Reacciones Mejoradas - MÚLTIPLES OPCIONES */}
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'space-between', 
            gap: '8px', 
            flexWrap: 'wrap'
          }}>
            <div style={{ display: 'flex', gap: '6px' }}>
              {/* Me Encanta */}
              <button
                onClick={() => toggleReaccion(partido.id, 'love')}
                style={{
                  background: reaccionActual === 'love' ? `${colorBadge(partido)}15` : 'transparent',
                  border: `1.5px solid ${reaccionActual === 'love' ? colorBadge(partido) : '#E5E7EB'}`,
                  padding: '7px 11px',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  fontSize: '12px',
                  fontWeight: '700',
                  color: reaccionActual === 'love' ? colorBadge(partido) : 'var(--texto-secundario)',
                  transition: 'all 0.2s',
                  transform: reaccionActual === 'love' ? 'scale(1.05)' : 'scale(1)'
                }}
                title="Me encanta"
              >
                <Heart size={14} color="var(--gris-secundario)" fill={reaccionActual === 'love' ? colorBadge(partido) : 'none'} strokeWidth={1.5} />
              </button>

              {/* Genial - Thumbs Up */}
              <button
                onClick={() => toggleReaccion(partido.id, 'great')}
                style={{
                  background: reaccionActual === 'great' ? '#10b98115' : 'transparent',
                  border: `1.5px solid ${reaccionActual === 'great' ? '#10b981' : '#E5E7EB'}`,
                  padding: '7px 11px',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  fontSize: '12px',
                  fontWeight: '700',
                  color: reaccionActual === 'great' ? '#10b981' : 'var(--texto-secundario)',
                  transition: 'all 0.2s',
                  transform: reaccionActual === 'great' ? 'scale(1.05)' : 'scale(1)'
                }}
                title="Genial"
              >
                <ThumbsUp size={14} color="var(--gris-secundario)" fill={reaccionActual === 'great' ? '#10b981' : 'none'} strokeWidth={1.5} />
              </button>

              {/* Ánimo - Frown */}
              <button
                onClick={() => toggleReaccion(partido.id, 'sad')}
                style={{
                  background: reaccionActual === 'sad' ? '#f5931515' : 'transparent',
                  border: `1.5px solid ${reaccionActual === 'sad' ? '#f59315' : '#E5E7EB'}`,
                  padding: '7px 11px',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  fontSize: '12px',
                  fontWeight: '700',
                  color: reaccionActual === 'sad' ? '#f59315' : 'var(--texto-secundario)',
                  transition: 'all 0.2s',
                  transform: reaccionActual === 'sad' ? 'scale(1.05)' : 'scale(1)'
                }}
                title="Ánimo"
              >
                <Frown size={14} color="var(--gris-secundario)" fill={reaccionActual === 'sad' ? '#f59315' : 'none'} strokeWidth={1.5} />
              </button>
            </div>

            {/* Botones Admin - Editar/Borrar */}
            {puedeEditar && (
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  onClick={() => onEditar?.(partido)}
                  style={{
                    background: 'transparent',
                    border: `1.5px solid #3b82f6`,
                    padding: '7px 11px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    color: '#3b82f6',
                    fontWeight: '700',
                    fontSize: '11px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    transition: 'all 0.2s',
                    transform: 'scale(1)'
                  }}
                  onMouseEnter={(e) => e.target.style.transform = 'scale(1.08)'}
                  onMouseLeave={(e) => e.target.style.transform = 'scale(1)'}
                  title="Editar"
                >
                  <Edit2 size={13} strokeWidth={1.5} />
                </button>
                <button
                  onClick={() => onBorrar?.(partido.id)}
                  style={{
                    background: 'transparent',
                    border: `1.5px solid #ef4444`,
                    padding: '7px 11px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    color: '#ef4444',
                    fontWeight: '700',
                    fontSize: '11px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    transition: 'all 0.2s',
                    transform: 'scale(1)'
                  }}
                  onMouseEnter={(e) => e.target.style.transform = 'scale(1.08)'}
                  onMouseLeave={(e) => e.target.style.transform = 'scale(1)'}
                  title="Borrar"
                >
                  <Trash2 size={13} strokeWidth={1.5} />
                </button>
              </div>
            )}
          </div>
        </div>
      );
    }

    // DISEÑO 2: MINIMALISTA (alternativa)
    if (diseño === 'minimalista') {
      return (
        <div key={partido.id} className="card" style={{
          borderLeft: `6px solid ${colorBorde(partido)}`,
          borderRadius: '16px',
          marginBottom: '12px',
          background: 'var(--blanco-tarjeta)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
            {/* Local */}
            <div style={{ textAlign: 'center', flex: 1 }}>
              <LogoAvatar nombre={partido.equipoLocalNombre || 'CCF'} logoUrl={partido.equipoLocalLogoUrl || '/logos/club-logo.png'} size={44} borderRadius="12px" />
              <div style={{ fontSize: '11px', fontWeight: '800', marginTop: '4px' }}>{partido.equipoLocalNombre || 'CCF'}</div>
            </div>

            {/* Score */}
            <div style={{ textAlign: 'center', minWidth: '70px' }}>
              <div style={{ fontSize: '32px', fontWeight: '900', color: colorBadge(partido), fontFamily: "'Inter Tight', monospace" }}>
                {partido.miEquipo}
              </div>
              <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--texto-secundario)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                {esVictoria ? <><Check size={12} /> Ganado</> : esEmpate ? '= Empate' : <><X size={12} /> Perdido</>}
              </div>
              <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--texto-secundario)', marginTop: '2px' }}>
                {partido.rival}
              </div>
            </div>

            {/* Visitante */}
            <div style={{ textAlign: 'center', flex: 1 }}>
              <LogoAvatar nombre={partido.nombreRival} logoUrl={partido.rivalLogoUrl || ''} size={44} borderRadius="12px" fallbackText={partido.nombreRival?.substring(0, 2).toUpperCase()} />
              <div style={{ fontSize: '11px', fontWeight: '800', marginTop: '4px' }}>{partido.nombreRival}</div>
            </div>
          </div>

          {/* Meta info */}
          <div style={{ fontSize: '11px', color: 'var(--texto-secundario)', marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #f0f0f0', display: 'flex', gap: '8px', justifyContent: 'center' }}>
            <span>{partido.torneo}</span> · <span>{partido.fecha}</span>
          </div>
        </div>
      );
    }

    // DISEÑO 3: MODERNO (moderna con más detalle)
    return (
      <div key={partido.id} className="card" style={{
        background: colorFondo(partido),
        borderLeft: `4px solid ${colorBorde(partido)}`,
        borderRadius: '18px',
        marginBottom: '14px',
        overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(0,0,0,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
            {partido.torneoLogoUrl && <LogoAvatar nombre={partido.torneo} logoUrl={partido.torneoLogoUrl} size={20} borderRadius="999px" />}
            <span style={{ fontWeight: '800', color: 'var(--texto-principal)' }}>{partido.torneo}</span>
            <span style={{ fontWeight: '600', color: 'var(--texto-secundario)' }}>• {partido.categoria}</span>
          </div>
          <span style={{ fontSize: '11px', fontWeight: '900', background: colorBadge(partido), color: 'white', padding: '3px 8px', borderRadius: '6px', textTransform: 'uppercase', display: 'inline-flex', alignItems: 'center' }}>
            {esFemelina(partido) ? <Venus size={12} /> : <Mars size={12} />}
          </span>
        </div>

        {/* Score */}
        <div style={{ padding: '14px 16px', display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: '12px', alignItems: 'center' }}>
          {/* Local */}
          <div style={{ textAlign: 'center' }}>
            <LogoAvatar nombre={partido.equipoLocalNombre || 'CCF'} logoUrl={partido.equipoLocalLogoUrl} size={48} borderRadius="12px" />
            <div style={{ fontSize: '12px', fontWeight: '800', marginTop: '6px', lineHeight: '1.2' }}>{partido.equipoLocalNombre || 'CCF'}</div>
          </div>

          {/* Marcador */}
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '42px', fontWeight: '900', color: colorBadge(partido), fontFamily: "'Inter Tight', monospace", lineHeight: '1' }}>
              {partido.miEquipo}
            </div>
            <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--texto-secundario)', margin: '3px 0' }}>vs</div>
            <div style={{ fontSize: '42px', fontWeight: '900', color: '#D1D5DB', fontFamily: "'Inter Tight', monospace", lineHeight: '1' }}>
              {partido.rival}
            </div>
          </div>

          {/* Visitante */}
          <div style={{ textAlign: 'center' }}>
            <LogoAvatar nombre={partido.nombreRival} logoUrl={partido.rivalLogoUrl} size={48} borderRadius="12px" fallbackText={partido.nombreRival?.substring(0, 2)} />
            <div style={{ fontSize: '12px', fontWeight: '800', marginTop: '6px', lineHeight: '1.2' }}>{partido.nombreRival}</div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '10px 16px', background: 'rgba(255,255,255,0.4)', fontSize: '11px', color: 'var(--texto-secundario)', fontWeight: '600', display: 'flex', gap: '10px', justifyContent: 'center' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>{esVictoria ? <><Check size={11} /> +{dif}</> : esEmpate ? '=' : <><X size={11} /> -{dif}</>}</span> · <span>{partido.fecha}</span>
        </div>
      </div>
    );
  });
}
