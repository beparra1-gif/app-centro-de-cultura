import PushPreferenciasPanel from './PushPreferenciasPanel';

function SettingsPanel({
  rolUsuario,
  busquedaPermisos,
  setBusquedaPermisos,
  filtroRolPermisos,
  setFiltroRolPermisos,
  matrixPermisos,
  togglePermiso,
  temaOscuro,
  setTemaOscuro,
  preferenciasSonido,
  setPreferenciasSonido,
  reproducirSonido,
}) {
  if (rolUsuario === 'admin' || rolUsuario === 'super_admin') {
    const permisosDisponibles = ['kiosco', 'inventario', 'citaciones', 'mesa', 'validacion_pagos', 'auditoria', 'resumen'];
    const usuariosFiltrados = matrixPermisos.filter(
      u => u.nombre.toLowerCase().includes(busquedaPermisos.toLowerCase()) && (filtroRolPermisos === 'Todos' || u.rol === filtroRolPermisos)
    );

    return (
      <div style={{ padding: '12px' }}>
        <h4 style={{ margin: '0 0 10px 0', fontSize: '14px', fontWeight: '900' }}>Control de Permisos</h4>
        <input
          type="text"
          placeholder="Buscar..."
          value={busquedaPermisos}
          onChange={e => setBusquedaPermisos(e.target.value)}
          style={{ width: '100%', padding: '8px', marginBottom: '10px', borderRadius: '8px', border: '1px solid var(--borde-suave)', fontSize: '12px' }}
        />
        <div style={{ display: 'flex', gap: '6px', marginBottom: '10px', flexWrap: 'wrap' }}>
          {['Todos', 'Admin', 'Staff', 'Socio', 'Jugador'].map(r => (
            <button
              key={r}
              onClick={() => setFiltroRolPermisos(r)}
              style={{ padding: '6px 10px', borderRadius: '8px', background: filtroRolPermisos === r ? 'var(--azul-electrico)' : 'var(--fondo-input)', color: filtroRolPermisos === r ? 'white' : 'var(--texto-principal)', fontSize: '11px', fontWeight: '700', border: 'none', cursor: 'pointer' }}
            >
              {r}
            </button>
          ))}
        </div>
        <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
          {usuariosFiltrados.map(u => (
            <div key={u.id} style={{ marginBottom: '8px', padding: '8px', background: 'var(--fondo-card-sutil)', borderRadius: '8px', border: '1px solid var(--borde-suave)' }}>
              <strong style={{ fontSize: '11px', display: 'block' }}>{u.nombre}</strong>
              <span style={{ fontSize: '10px', color: 'var(--texto-secundario)' }}>{u.rol}</span>
              <div style={{ marginTop: '6px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(80px, 1fr))', gap: '4px' }}>
                {permisosDisponibles.map(p => (
                  <button
                    key={p}
                    onClick={() => togglePermiso(u.id, p)}
                    style={{
                      padding: '4px 6px',
                      fontSize: '9px',
                      borderRadius: '6px',
                      background: u.permisos[p] ? 'rgba(52,199,89,0.2)' : 'transparent',
                      border: u.permisos[p] ? '1px solid var(--verde-victoria)' : '1px solid rgba(0,0,0,0.1)',
                      color: u.permisos[p] ? 'var(--verde-victoria)' : 'var(--texto-secundario)',
                      fontWeight: '700',
                      cursor: 'pointer',
                    }}
                  >
                    {u.permisos[p] ? 'OK' : 'O'} {p.split('_')[0]}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <h4 style={{ margin: '0 0 10px 0', fontSize: '14px', fontWeight: '900' }}>Mi Perfil</h4>
      <div>
        <label style={{ fontSize: '11px', fontWeight: '700', display: 'block', marginBottom: '4px' }}>Tema</label>
        <div style={{ display: 'flex', gap: '6px' }}>
          <button onClick={() => setTemaOscuro(false)} style={{ flex: 1, padding: '6px', borderRadius: '6px', background: !temaOscuro ? 'var(--azul-electrico)' : 'var(--fondo-input)', color: !temaOscuro ? 'white' : 'var(--texto-principal)', fontSize: '11px', fontWeight: '700', border: 'none', cursor: 'pointer' }}>Claro</button>
          <button onClick={() => setTemaOscuro(true)} style={{ flex: 1, padding: '6px', borderRadius: '6px', background: temaOscuro ? 'var(--azul-electrico)' : 'var(--fondo-input)', color: temaOscuro ? 'white' : 'var(--texto-principal)', fontSize: '11px', fontWeight: '700', border: 'none', cursor: 'pointer' }}>Oscuro</button>
        </div>
      </div>
      <button onClick={() => alert('Proximamente')} style={{ padding: '6px', borderRadius: '6px', background: 'rgba(0,122,255,0.1)', color: 'var(--azul-electrico)', fontSize: '11px', fontWeight: '700', border: '1px solid rgba(0,122,255,0.3)', cursor: 'pointer' }}>Contrasena</button>
      <hr style={{ margin: '10px 0', border: 'none', borderTop: '1px solid var(--borde-suave)' }} />
      <PushPreferenciasPanel
        preferenciasSonido={preferenciasSonido}
        setPreferenciasSonido={setPreferenciasSonido}
        reproducirSonido={reproducirSonido}
      />
    </div>
  );
}

export default SettingsPanel;
