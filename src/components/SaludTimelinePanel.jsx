function SaludTimelinePanel() {
  const horas = Array.from({ length: 24 }, (_, i) => ({
    hora: `${i.toString().padStart(2, '0')}:00`,
    // Curva estable con pico vespertino para evitar datos aleatorios en cada render.
    cantidad: Math.max(1, Math.round(6 + (Math.sin((i - 5) * 0.55) + 1) * 4 + (i >= 18 && i <= 22 ? 5 : 0))),
  }));

  const maxCantidad = Math.max(...horas.map(h => h.cantidad), 1);

  return (
    <div style={{ background: 'var(--blanco-tarjeta)', borderRadius: '12px', padding: '15px', marginTop: '15px' }}>
      <h6 style={{ margin: '0 0 12px 0', fontSize: '13px', fontWeight: '700', color: 'var(--texto-principal)' }}>Ultimas 24 Horas</h6>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '4px', height: '150px' }}>
        {horas.map((h, i) => (
          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
            <div
              style={{ width: '100%', background: 'linear-gradient(180deg, var(--azul-electrico) 0%, rgba(0,122,255,0.3) 100%)', height: `${(h.cantidad / maxCantidad) * 130}px`, borderRadius: '4px', cursor: 'pointer', transition: 'all 0.2s' }}
              title={h.cantidad + ' acciones'}
            ></div>
            {i % 3 === 0 && <span style={{ fontSize: '9px', color: 'var(--texto-secundario)', fontWeight: '500' }}>{h.hora}</span>}
          </div>
        ))}
      </div>
      <p style={{ margin: '12px 0 0 0', fontSize: '11px', color: 'var(--texto-secundario)', textAlign: 'center' }}>Pico de actividad: 20:00 - 22:30 hrs (Tarde)</p>
    </div>
  );
}

export default SaludTimelinePanel;
