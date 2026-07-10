function PushPreferenciasPanel({
  preferenciasSonido,
  setPreferenciasSonido,
  reproducirSonido,
  onProbarPush,
  onCerrarConfiguracion,
}) {
  return (
    <div
      className="card fade-in"
      style={{
        marginTop: '15px',
        borderRadius: '24px',
        background: 'linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(245,248,255,0.96) 100%)',
        border: '1px solid rgba(255,255,255,0.72)',
        boxShadow: '0 18px 45px rgba(13, 28, 55, 0.12)',
        overflow: 'hidden',
      }}
    >
      <div style={{ marginBottom: '16px' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '6px 10px', borderRadius: '999px', background: 'rgba(0,122,255,0.10)', color: 'var(--azul-electrico)', fontSize: '11px', fontWeight: '800', letterSpacing: '0.3px' }}>
          <span style={{ width: '8px', height: '8px', borderRadius: '999px', background: 'linear-gradient(180deg, #7DD3FC 0%, #007AFF 100%)' }} />
          Notificaciones
        </div>
        <h5 style={{ margin: '10px 0 0 0', fontSize: '16px', fontWeight: '900', color: 'var(--texto-principal)', letterSpacing: '-0.02em' }}>Estilo iOS activo</h5>
        <p style={{ margin: '6px 0 0 0', fontSize: '12px', color: 'var(--texto-secundario)', lineHeight: '1.45' }}>Controla sonido, vibración y pruebas desde una interfaz más limpia y actual.</p>
      </div>

      <div style={{ marginBottom: '12px', padding: '12px', borderRadius: '18px', background: 'rgba(255,255,255,0.76)', border: '1px solid rgba(0,0,0,0.04)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
          <label style={{ fontSize: '12px', fontWeight: '700', color: 'var(--texto-principal)' }}>Habilitar notificaciones</label>
          <button
            onClick={() => setPreferenciasSonido({ ...preferenciasSonido, habilitado: !preferenciasSonido.habilitado })}
            style={{
              padding: '8px 14px',
              borderRadius: '999px',
              border: 'none',
              background: preferenciasSonido.habilitado ? 'linear-gradient(180deg, #4CD964 0%, #30B84C 100%)' : 'rgba(120,120,128,0.16)',
              color: preferenciasSonido.habilitado ? 'white' : 'var(--texto-principal)',
              fontSize: '11px',
              fontWeight: '800',
              cursor: 'pointer',
              boxShadow: preferenciasSonido.habilitado ? '0 10px 18px rgba(48,184,76,0.22)' : 'none',
            }}
          >
            {preferenciasSonido.habilitado ? '✓ Activo' : 'Inactivo'}
          </button>
        </div>

        <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', paddingTop: '10px', borderTop: '1px solid rgba(0,0,0,0.05)' }}>
          <label style={{ fontSize: '12px', fontWeight: '700', color: 'var(--texto-principal)' }}>Vibración</label>
          <button
            onClick={() => setPreferenciasSonido({ ...preferenciasSonido, vibración: !preferenciasSonido.vibración })}
            style={{
              padding: '8px 14px',
              borderRadius: '999px',
              border: 'none',
              background: preferenciasSonido.vibración ? 'linear-gradient(180deg, #34C759 0%, #2AA84A 100%)' : 'rgba(120,120,128,0.16)',
              color: preferenciasSonido.vibración ? 'white' : 'var(--texto-principal)',
              fontSize: '11px',
              fontWeight: '800',
              cursor: 'pointer',
              boxShadow: preferenciasSonido.vibración ? '0 10px 18px rgba(52,199,89,0.18)' : 'none',
            }}
          >
            {preferenciasSonido.vibración ? '✓ Activo' : 'Inactivo'}
          </button>
        </div>
      </div>

      <div style={{ marginBottom: '12px', padding: '12px', borderRadius: '18px', background: 'rgba(255,255,255,0.76)', border: '1px solid rgba(0,0,0,0.04)' }}>
        <label style={{ fontSize: '12px', fontWeight: '700', color: 'var(--texto-principal)', display: 'block', marginBottom: '8px' }}>Sonido de alerta</label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '8px' }}>
          {[
            { value: 'sistema', label: 'Sistema / teléfono', icon: '📳', recommended: true },
            { value: 'campana', label: 'Campana', icon: '🔔' },
            { value: 'tono', label: 'Moderno', icon: '📱' },
          ].map((opcion) => {
            const activa = preferenciasSonido.sonidoAlerta === opcion.value;
            return (
              <button
                key={opcion.value}
                onClick={() => setPreferenciasSonido({ ...preferenciasSonido, sonidoAlerta: opcion.value })}
                style={{
                  padding: '10px 10px',
                  borderRadius: '16px',
                  border: activa ? '1px solid rgba(0,122,255,0.22)' : '1px solid rgba(0,0,0,0.06)',
                  background: activa
                    ? 'linear-gradient(180deg, rgba(0,122,255,0.14) 0%, rgba(0,122,255,0.08) 100%)'
                    : 'rgba(255,255,255,0.82)',
                  color: 'var(--texto-principal)',
                  fontSize: '11px',
                  fontWeight: '800',
                  cursor: 'pointer',
                  boxShadow: activa ? '0 10px 18px rgba(0,122,255,0.12)' : 'none',
                  textAlign: 'left',
                  minHeight: '68px',
                }}
              >
                <div style={{ fontSize: '16px', marginBottom: '4px' }}>{opcion.icon}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                  <span>{opcion.label}</span>
                  {opcion.recommended && (
                    <span style={{ padding: '2px 6px', borderRadius: '999px', background: 'rgba(52,199,89,0.12)', color: 'var(--verde-victoria)', fontSize: '9px', fontWeight: '900' }}>Recomendado</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
        <button
          onClick={() => reproducirSonido(preferenciasSonido.sonidoAlerta)}
          style={{ marginTop: '10px', padding: '10px 12px', borderRadius: '14px', border: '1px solid rgba(0,122,255,0.18)', background: 'linear-gradient(180deg, rgba(0,122,255,0.10) 0%, rgba(0,122,255,0.06) 100%)', color: 'var(--azul-electrico)', fontSize: '11px', fontWeight: '800', cursor: 'pointer', width: '100%' }}
        >
          🔊 Reproducir preview
        </button>
        <p style={{ margin: '8px 0 0 0', fontSize: '11px', color: 'var(--texto-secundario)', lineHeight: '1.45' }}>
          El sonido final puede depender del navegador y del dispositivo. La opción de sistema usa la notificación nativa.
        </p>
      </div>

      <div style={{ marginBottom: '12px', padding: '12px', borderRadius: '18px', background: 'rgba(255,255,255,0.76)', border: '1px solid rgba(0,0,0,0.04)' }}>
        <label style={{ fontSize: '12px', fontWeight: '700', color: 'var(--texto-principal)', display: 'block', marginBottom: '6px' }}>Volumen ({preferenciasSonido.volumen}%)</label>
        <input
          type="range"
          min="0"
          max="100"
          value={preferenciasSonido.volumen}
          onChange={e => setPreferenciasSonido({ ...preferenciasSonido, volumen: parseInt(e.target.value, 10) })}
          style={{ width: '100%', cursor: 'pointer', accentColor: 'var(--azul-electrico)' }}
        />
        <button
          onClick={() => onProbarPush?.()}
          style={{ marginTop: '10px', padding: '10px 12px', borderRadius: '14px', border: '1px solid rgba(0,122,255,0.22)', background: 'linear-gradient(180deg, rgba(0,122,255,0.12) 0%, rgba(0,122,255,0.06) 100%)', color: 'var(--azul-electrico)', fontSize: '11px', fontWeight: '800', cursor: 'pointer', width: '100%' }}
        >
          🔔 Probar notificación push
        </button>
        <button
          onClick={() => onCerrarConfiguracion?.()}
          style={{ marginTop: '8px', padding: '10px 12px', borderRadius: '14px', border: '1px solid rgba(0,0,0,0.06)', background: 'rgba(120,120,128,0.10)', color: 'var(--texto-principal)', fontSize: '11px', fontWeight: '800', cursor: 'pointer', width: '100%' }}
        >
          Cerrar configuración
        </button>
      </div>
    </div>
  );
}

export default PushPreferenciasPanel;
