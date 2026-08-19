import { X, ArrowRight } from 'lucide-react';

function NotificationsPanel({
  notificaciones,
  onBorrar,
  onIrA,
  resolverDestino,
}) {
  return (
    <div style={{ position: 'fixed', top: '90px', right: '15px', width: '320px', maxHeight: '400px', overflowY: 'auto', zIndex: 1000, background: 'rgba(255,255,255,0.78)', backdropFilter: 'blur(22px)', WebkitBackdropFilter: 'blur(22px)', borderRadius: '24px', padding: '8px' }}>
      {notificaciones.length === 0 ? (
        <div style={{ padding: '20px', textAlign: 'center', color: 'var(--texto-secundario)', fontSize: '13px' }}>
          Sin notificaciones
        </div>
      ) : (
        notificaciones.map(notif => {
          const tieneDestino = Boolean(resolverDestino?.(notif));
          return (
            <div key={notif.id} style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(248,250,255,0.96) 100%)', border: '1px solid rgba(255,255,255,0.72)', borderRadius: '18px', padding: '12px', marginBottom: '8px', boxShadow: '0 10px 24px rgba(15,23,42,0.08)', animation: 'slideIn 0.3s ease-out' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                <span style={{ fontWeight: '700', fontSize: '13px', color: 'var(--texto-principal)' }}>
                  {notif.tipo === 'comentario' ? 'Comentario' : notif.tipo === 'rsvp' ? 'RSVP' : notif.tipo === 'comunicacion' ? 'Comunicacion' : notif.tipo === 'pago' ? 'Pago' : 'Notificacion'} {notif.titulo}
                </span>
                <button onClick={() => onBorrar(notif)} style={{ background: 'rgba(120,120,128,0.10)', border: 'none', cursor: 'pointer', width: '30px', height: '30px', borderRadius: '999px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }} aria-label="Cerrar"><X size={14} /></button>
              </div>
              <p style={{ margin: '0 0 8px', fontSize: '12px', color: 'var(--texto-secundario)', lineHeight: '1.3' }}>{notif.mensaje}</p>
              <div style={{ display: 'flex', gap: '6px' }}>
                {tieneDestino && (
                  <button onClick={() => onIrA(notif)} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '6px 12px', borderRadius: '999px', border: 'none', background: 'var(--azul-electrico)', color: 'white', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}>
                    Ir a <ArrowRight size={12} />
                  </button>
                )}
                <button onClick={() => onBorrar(notif)} style={{ padding: '6px 12px', borderRadius: '999px', border: '1px solid var(--borde-suave)', background: 'transparent', color: 'var(--texto-secundario)', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}>
                  Borrar
                </button>
              </div>
            </div>
          );
        })
      )}
      <style>{`@keyframes slideIn { from { transform: translateX(350px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }`}</style>
    </div>
  );
}

export default NotificationsPanel;
