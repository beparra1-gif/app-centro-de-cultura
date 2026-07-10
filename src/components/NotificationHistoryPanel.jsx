function NotificationHistoryPanel({
  historialNotificaciones,
  filtroReporteFecha,
  setFiltroReporteFecha,
  setMostrarHistorialNotif,
}) {
  const notifFiltradas = historialNotificaciones.filter(n => {
    const diasAtras = (new Date() - n.timestamp) / (1000 * 60 * 60 * 24);
    if (filtroReporteFecha === 'semana') return diasAtras <= 7;
    if (filtroReporteFecha === 'mes') return diasAtras <= 30;
    return true;
  });

  return (
    <div style={{ position: 'fixed', top: '90px', left: '50%', transform: 'translateX(-50%)', width: '90%', maxWidth: '500px', maxHeight: '600px', background: 'var(--blanco-tarjeta)', borderRadius: '16px', boxShadow: '0 15px 40px rgba(0,0,0,0.3)', zIndex: 999, padding: '20px', border: '1px solid rgba(0,0,0,0.05)', overflowY: 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
        <h4 style={{ margin: 0, color: 'var(--texto-heading)', fontSize: '16px', fontWeight: '700' }}>Historial de Notificaciones</h4>
        <button onClick={() => setMostrarHistorialNotif(false)} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer' }}>✕</button>
      </div>

      <div style={{ display: 'flex', gap: '6px', marginBottom: '12px' }}>
        {['semana', 'mes', 'todos'].map(f => (
          <button key={f} onClick={() => setFiltroReporteFecha(f)} style={{ padding: '6px 10px', borderRadius: '6px', border: filtroReporteFecha === f ? 'none' : '1px solid var(--borde-suave)', background: filtroReporteFecha === f ? 'var(--azul-electrico)' : 'var(--blanco-tarjeta)', color: filtroReporteFecha === f ? 'white' : 'var(--texto-principal)', fontSize: '11px', fontWeight: '600', cursor: 'pointer' }}>
            {f === 'semana' ? 'Semana' : f === 'mes' ? 'Mes' : 'Todo'}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {notifFiltradas.length === 0 ? (
          <p style={{ textAlign: 'center', color: 'var(--texto-secundario)', fontSize: '12px' }}>Sin notificaciones</p>
        ) : (
          notifFiltradas.map(notif => (
            <div key={notif.id} style={{ background: 'rgba(0,0,0,0.02)', padding: '10px', borderRadius: '6px', borderLeft: '3px solid var(--azul-electrico)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
                <span style={{ fontWeight: '700', fontSize: '13px', color: 'var(--texto-principal)' }}>{notif.titulo}</span>
                <span style={{ fontSize: '10px', color: 'var(--texto-secundario)' }}>{notif.timestamp.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
              <p style={{ margin: '0', fontSize: '12px', color: 'var(--texto-secundario)', lineHeight: '1.3' }}>{notif.descripcion}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default NotificationHistoryPanel;
