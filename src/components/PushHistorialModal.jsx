function PushHistorialModal({
  historialPushTotal,
  setMostrarHistorialPush,
}) {
  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        background: 'rgba(0,0,0,0.5)',
        zIndex: 998,
        display: 'flex',
        alignItems: 'flex-end',
        animation: 'fadeIn 0.3s ease',
      }}
      onClick={() => setMostrarHistorialPush(false)}
    >
      <div
        style={{
          width: '100%',
          background: 'var(--blanco-tarjeta)',
          borderRadius: '24px 24px 0 0',
          padding: '20px',
          maxHeight: '80vh',
          overflowY: 'auto',
          animation: 'slideUp 0.4s ease',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
          <h4 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: 'var(--texto-principal)' }}>📲 Historial de Push</h4>
          <button onClick={() => setMostrarHistorialPush(false)} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer' }}>✕</button>
        </div>

        {historialPushTotal.length === 0 ? (
          <p style={{ textAlign: 'center', color: 'var(--texto-secundario)', fontSize: '13px' }}>Sin notificaciones aún</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {historialPushTotal.slice().reverse().map(push => (
              <div
                key={push.id}
                style={{
                  background: push.leida ? 'rgba(0,0,0,0.01)' : 'rgba(0,122,255,0.05)',
                  padding: '12px',
                  borderRadius: '8px',
                  borderLeft: push.urgencia === 'Crítica' ? '4px solid #FF3B30' : push.urgencia === 'Alta' ? '4px solid #FF9500' : push.urgencia === 'Media' ? '4px solid #FFD60A' : '4px solid #34C759',
                  display: 'flex',
                  gap: '10px',
                  alignItems: 'flex-start',
                }}
              >
                <span style={{ fontSize: '18px', marginTop: '2px' }}>
                  {push.tipo === 'alerta' ? '🚨' : push.tipo === 'comunicacion' ? '💬' : push.tipo === 'pago' ? '💳' : '📨'}
                </span>
                <div style={{ flex: 1 }}>
                  <p style={{ margin: '0 0 4px 0', fontSize: '12px', fontWeight: '700', color: 'var(--texto-principal)' }}>{push.titulo}</p>
                  <p style={{ margin: '0 0 4px 0', fontSize: '11px', color: 'var(--texto-secundario)' }}>{push.descripcion}</p>
                  <span style={{ fontSize: '10px', color: 'var(--texto-secundario)' }}>🕐 {push.timestamp.toLocaleTimeString('es-CL')}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                  <span style={{ fontSize: '11px', fontWeight: '600', color: push.urgencia === 'Crítica' ? '#FF3B30' : push.urgencia === 'Alta' ? '#FF9500' : '#34C759' }}>● {push.urgencia}</span>
                  {!push.leida && <span style={{ fontSize: '9px', background: 'var(--azul-electrico)', color: 'white', padding: '2px 6px', borderRadius: '3px', fontWeight: '600' }}>NUEVA</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default PushHistorialModal;
