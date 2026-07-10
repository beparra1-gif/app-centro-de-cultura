function WhatsAppHistorialModal({
  historialWhatsApp,
  setMostrarHistorialWA,
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
        zIndex: 996,
        display: 'flex',
        alignItems: 'flex-end',
        animation: 'fadeIn 0.3s ease',
      }}
      onClick={() => setMostrarHistorialWA(false)}
    >
      <div
        style={{
          width: '100%',
          background: 'linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(248,250,255,0.96) 100%)',
          borderRadius: '24px 24px 0 0',
          padding: '20px',
          maxHeight: '80vh',
          overflowY: 'auto',
          animation: 'slideUp 0.4s ease',
          boxShadow: '0 -12px 32px rgba(15,23,42,0.16)'
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
          <h4 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: 'var(--texto-principal)' }}>💬 Historial WhatsApp</h4>
          <button onClick={() => setMostrarHistorialWA(false)} style={{ background: 'rgba(120,120,128,0.10)', border: 'none', fontSize: '20px', cursor: 'pointer', width: '34px', height: '34px', borderRadius: '999px' }}>✕</button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {historialWhatsApp.slice().reverse().map(msg => (
            <div
              key={msg.id}
              style={{
                background: msg.tipo === 'salida' ? 'rgba(52,199,89,0.08)' : 'rgba(0,122,255,0.08)',
                padding: '12px',
                borderRadius: '18px',
                borderLeft: msg.tipo === 'salida' ? '4px solid #34C759' : '4px solid var(--azul-electrico)',
                display: 'flex',
                gap: '10px',
              }}
            >
              <span style={{ fontSize: '16px' }}>{msg.tipo === 'salida' ? '📤' : '📥'}</span>
              <div style={{ flex: 1 }}>
                <p style={{ margin: '0 0 4px 0', fontSize: '12px', fontWeight: '800', color: 'var(--texto-principal)' }}>{msg.contacto}</p>
                <p style={{ margin: '0 0 4px 0', fontSize: '11px', color: 'var(--texto-principal)', lineHeight: '1.4' }}>{msg.mensaje}</p>
                <div style={{ display: 'flex', gap: '8px', fontSize: '10px', color: 'var(--texto-secundario)' }}>
                  <span>🕐 {msg.timestamp.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}</span>
                  <span style={{ color: msg.estado === 'entregado' ? '#34C759' : '#FF9500' }}>✓ {msg.estado === 'entregado' ? 'Entregado' : 'Enviando'}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default WhatsAppHistorialModal;
