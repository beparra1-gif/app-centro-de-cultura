function PushPreferenciasPanel({
  preferenciasSonido,
  setPreferenciasSonido,
  reproducirSonido,
}) {
  return (
    <div className="card fade-in" style={{ marginTop: '15px' }}>
      <h5 style={{ margin: '0 0 15px 0', fontSize: '14px', fontWeight: '700', color: 'var(--texto-principal)' }}>🔔 Preferencias de Notificaciones Push</h5>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', paddingBottom: '12px', borderBottom: '1px solid var(--borde-suave)' }}>
        <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--texto-principal)' }}>Habilitar Notificaciones</label>
        <button
          onClick={() => setPreferenciasSonido({ ...preferenciasSonido, habilitado: !preferenciasSonido.habilitado })}
          style={{
            padding: '6px 12px',
            borderRadius: '20px',
            border: 'none',
            background: preferenciasSonido.habilitado ? 'var(--azul-electrico)' : 'var(--borde-suave)',
            color: preferenciasSonido.habilitado ? 'white' : 'var(--texto-principal)',
            fontSize: '11px',
            fontWeight: '600',
            cursor: 'pointer',
          }}
        >
          {preferenciasSonido.habilitado ? '✓ Activo' : 'Inactivo'}
        </button>
      </div>

      <div style={{ marginBottom: '12px', paddingBottom: '12px', borderBottom: '1px solid var(--borde-suave)' }}>
        <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--texto-principal)', display: 'block', marginBottom: '6px' }}>Sonido de Alerta</label>
        <select
          value={preferenciasSonido.sonidoAlerta}
          onChange={e => setPreferenciasSonido({ ...preferenciasSonido, sonidoAlerta: e.target.value })}
          style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--borde-suave)', fontSize: '12px', background: 'var(--blanco-tarjeta)', color: 'var(--texto-principal)' }}
        >
          <option value="campana">🔔 Campana Clásica</option>
          <option value="tono">📱 Tono Moderno</option>
        </select>
        <button
          onClick={() => reproducirSonido(preferenciasSonido.sonidoAlerta)}
          style={{ marginTop: '8px', padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--borde-suave)', background: 'rgba(0,122,255,0.08)', color: 'var(--azul-electrico)', fontSize: '11px', fontWeight: '600', cursor: 'pointer', width: '100%' }}
        >
          🔊 Reproducir Preview
        </button>
      </div>

      <div style={{ marginBottom: '12px', paddingBottom: '12px', borderBottom: '1px solid var(--borde-suave)' }}>
        <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--texto-principal)', display: 'block', marginBottom: '6px' }}>Volumen ({preferenciasSonido.volumen}%)</label>
        <input
          type="range"
          min="0"
          max="100"
          value={preferenciasSonido.volumen}
          onChange={e => setPreferenciasSonido({ ...preferenciasSonido, volumen: parseInt(e.target.value, 10) })}
          style={{ width: '100%', cursor: 'pointer' }}
        />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--texto-principal)' }}>Vibración</label>
        <button
          onClick={() => setPreferenciasSonido({ ...preferenciasSonido, vibración: !preferenciasSonido.vibración })}
          style={{
            padding: '6px 12px',
            borderRadius: '20px',
            border: 'none',
            background: preferenciasSonido.vibración ? '#34C759' : 'var(--borde-suave)',
            color: preferenciasSonido.vibración ? 'white' : 'var(--texto-principal)',
            fontSize: '11px',
            fontWeight: '600',
            cursor: 'pointer',
          }}
        >
          {preferenciasSonido.vibración ? '✓ Activo' : 'Inactivo'}
        </button>
      </div>
    </div>
  );
}

export default PushPreferenciasPanel;
