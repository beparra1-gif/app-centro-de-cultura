function NotificationsPanel({
  notificaciones,
  setNotificaciones,
}) {
  return (
    <div style={{ position: 'fixed', top: '90px', right: '15px', width: '320px', maxHeight: '400px', overflowY: 'auto', zIndex: 1000 }}>
      {notificaciones.length === 0 ? (
        <div style={{ padding: '20px', textAlign: 'center', color: 'var(--texto-secundario)', fontSize: '13px' }}>
          Sin notificaciones
        </div>
      ) : (
        notificaciones.map(notif => (
          <div key={notif.id} style={{ background: 'var(--blanco-tarjeta)', border: '1px solid var(--borde-suave)', borderRadius: '8px', padding: '12px', marginBottom: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', animation: 'slideIn 0.3s ease-out' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
              <span style={{ fontWeight: '700', fontSize: '13px', color: 'var(--texto-principal)' }}>
                {notif.tipo === 'comentario' ? 'Comentario' : notif.tipo === 'rsvp' ? 'RSVP' : notif.tipo === 'comunicacion' ? 'Comunicacion' : 'Notificacion'} {notif.titulo}
              </span>
              <button onClick={() => setNotificaciones(notifs => notifs.filter(n => n.id !== notif.id))} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px' }}>✕</button>
            </div>
            <p style={{ margin: '0', fontSize: '12px', color: 'var(--texto-secundario)', lineHeight: '1.3' }}>{notif.descripcion}</p>
          </div>
        ))
      )}
      <style>{`@keyframes slideIn { from { transform: translateX(350px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }`}</style>
    </div>
  );
}

export default NotificationsPanel;
