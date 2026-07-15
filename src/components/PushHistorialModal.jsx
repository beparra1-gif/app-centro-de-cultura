import { AlertTriangle, Clock, CreditCard, Mail, MessageCircle, X } from 'lucide-react';

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
          <h4 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: 'var(--texto-principal)' }}>Historial de Push</h4>
          <button onClick={() => setMostrarHistorialPush(false)} style={{ background: 'rgba(120,120,128,0.10)', border: 'none', cursor: 'pointer', width: '34px', height: '34px', borderRadius: '999px', display: 'flex', alignItems: 'center', justifyContent: 'center' }} aria-label="Cerrar"><X size={16} /></button>
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
                  borderRadius: '18px',
                  borderLeft: push.urgencia === 'Crítica' ? '4px solid var(--rojo-alerta)' : push.urgencia === 'Alta' ? '4px solid #FF9500' : push.urgencia === 'Media' ? '4px solid #FFD60A' : '4px solid #34C759',
                  display: 'flex',
                  gap: '10px',
                  alignItems: 'flex-start',
                  boxShadow: '0 8px 18px rgba(15,23,42,0.04)'
                }}
              >
                {push.tipo === 'alerta' ? <AlertTriangle size={18} color="var(--rojo-alerta)" style={{ marginTop: '2px', flexShrink: 0 }} />
                  : push.tipo === 'comunicacion' ? <MessageCircle size={18} color="var(--azul-electrico)" style={{ marginTop: '2px', flexShrink: 0 }} />
                  : push.tipo === 'pago' ? <CreditCard size={18} color="var(--verde-victoria)" style={{ marginTop: '2px', flexShrink: 0 }} />
                  : <Mail size={18} color="var(--azul-electrico)" style={{ marginTop: '2px', flexShrink: 0 }} />}
                <div style={{ flex: 1 }}>
                  <p style={{ margin: '0 0 4px 0', fontSize: '12px', fontWeight: '700', color: 'var(--texto-principal)' }}>{push.titulo}</p>
                  <p style={{ margin: '0 0 4px 0', fontSize: '11px', color: 'var(--texto-secundario)' }}>{push.descripcion}</p>
                  <span style={{ fontSize: '11px', color: 'var(--texto-secundario)', display: 'inline-flex', alignItems: 'center', gap: '3px' }}><Clock size={10} /> {push.timestamp.toLocaleTimeString('es-CL')}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                  <span style={{ fontSize: '11px', fontWeight: '600', color: push.urgencia === 'Crítica' ? 'var(--rojo-alerta)' : push.urgencia === 'Alta' ? '#FF9500' : '#34C759' }}>● {push.urgencia}</span>
                  {!push.leida && <span style={{ fontSize: '11px', background: 'linear-gradient(180deg, #2f8cff 0%, var(--azul-electrico) 100%)', color: 'white', padding: '2px 6px', borderRadius: '999px', fontWeight: '700' }}>NUEVA</span>}
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
