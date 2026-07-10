function PushToast({ pushNotificaciones, setPushNotificaciones }) {
  if (pushNotificaciones.length === 0) return null;

  const push = pushNotificaciones[pushNotificaciones.length - 1];
  const colorUrgencia =
    push.urgencia === 'Crítica'
      ? '#FF3B30'
      : push.urgencia === 'Alta'
        ? '#FF9500'
        : push.urgencia === 'Media'
          ? '#FFD60A'
          : '#34C759';

  return (
    <div
      style={{
        position: 'fixed',
        top: '78px',
        right: '16px',
        width: '320px',
        background: 'linear-gradient(180deg, rgba(255,255,255,0.96) 0%, rgba(249,250,255,0.96) 100%)',
        borderRadius: '22px',
        boxShadow: '0 18px 40px rgba(10, 20, 35, 0.18)',
        padding: '14px 14px 14px 16px',
        border: '1px solid rgba(255,255,255,0.65)',
        borderLeft: `5px solid ${colorUrgencia}`,
        backdropFilter: 'blur(18px)',
        zIndex: 1000,
        animation: 'slideInRight 0.4s ease',
        overflow: 'hidden',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
        <div style={{
          width: '36px',
          height: '36px',
          borderRadius: '12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(0,122,255,0.10)',
          flexShrink: 0,
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.75)',
        }}>
          <span style={{ fontSize: '18px' }}>
          {push.tipo === 'alerta' ? '🚨' : push.tipo === 'comunicacion' ? '💬' : push.tipo === 'pago' ? '💳' : '📨'}
          </span>
        </div>
        <div style={{ flex: 1 }}>
          <h6 style={{ margin: '0 0 5px 0', fontSize: '13px', fontWeight: '900', color: 'var(--texto-principal)', letterSpacing: '-0.01em' }}>{push.titulo}</h6>
          <p style={{ margin: '0 0 10px 0', fontSize: '12px', color: 'var(--texto-secundario)', lineHeight: '1.4' }}>
            {push.descripcion}
          </p>
          <div style={{ display: 'flex', gap: '8px', fontSize: '10px', color: 'var(--texto-secundario)', flexWrap: 'wrap' }}>
            <span style={{ padding: '4px 8px', borderRadius: '999px', background: 'rgba(120,120,128,0.10)' }}>🕐 {push.timestamp.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}</span>
            <span style={{ padding: '4px 8px', borderRadius: '999px', background: `${colorUrgencia}1A`, color: colorUrgencia, fontWeight: '700' }}>● {push.urgencia}</span>
          </div>
        </div>
        <button
          onClick={() => setPushNotificaciones(prev => prev.filter(p => p.id !== push.id))}
          style={{
            background: 'rgba(120,120,128,0.12)',
            border: 'none',
            width: '28px',
            height: '28px',
            borderRadius: '999px',
            fontSize: '14px',
            cursor: 'pointer',
            color: 'var(--texto-secundario)',
            flexShrink: 0,
          }}
        >
          ✕
        </button>
      </div>
    </div>
  );
}

export default PushToast;
