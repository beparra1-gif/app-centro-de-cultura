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
        top: '70px',
        right: '15px',
        width: '320px',
        background: 'var(--blanco-tarjeta)',
        borderRadius: '12px',
        boxShadow: '0 10px 30px rgba(0,0,0,0.2)',
        padding: '15px',
        borderLeft: `4px solid ${colorUrgencia}`,
        zIndex: 1000,
        animation: 'slideInRight 0.4s ease',
        '@keyframes slideInRight': {
          from: { transform: 'translateX(350px)', opacity: 0 },
          to: { transform: 'translateX(0)', opacity: 1 },
        },
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
        <span style={{ fontSize: '20px', marginTop: '2px' }}>
          {push.tipo === 'alerta' ? '🚨' : push.tipo === 'comunicacion' ? '💬' : push.tipo === 'pago' ? '💳' : '📨'}
        </span>
        <div style={{ flex: 1 }}>
          <h6 style={{ margin: '0 0 4px 0', fontSize: '13px', fontWeight: '700', color: 'var(--texto-principal)' }}>{push.titulo}</h6>
          <p style={{ margin: '0 0 8px 0', fontSize: '12px', color: 'var(--texto-secundario)', lineHeight: '1.4' }}>
            {push.descripcion}
          </p>
          <div style={{ display: 'flex', gap: '8px', fontSize: '10px', color: 'var(--texto-secundario)' }}>
            <span>🕐 {push.timestamp.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}</span>
            <span style={{ color: colorUrgencia, fontWeight: '600' }}>● {push.urgencia}</span>
          </div>
        </div>
        <button
          onClick={() => setPushNotificaciones(prev => prev.filter(p => p.id !== push.id))}
          style={{ background: 'none', border: 'none', fontSize: '16px', cursor: 'pointer', color: 'var(--texto-secundario)' }}
        >
          ✕
        </button>
      </div>
    </div>
  );
}

export default PushToast;
