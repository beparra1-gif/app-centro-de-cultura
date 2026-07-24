import { Save } from 'lucide-react';
import PushPreferenciasPanel from './PushPreferenciasPanel';
import { MODULOS_ACCESO, normalizarRol } from '../security/accessControl';
import { showToast } from '../utils/toast';

function SettingsPanel({
  rolUsuario,
  busquedaPermisos,
  setBusquedaPermisos,
  filtroRolPermisos,
  setFiltroRolPermisos,
  matrixPermisos,
  togglePermiso,
  cuentasConCambiosPendientes,
  guardandoCuentaId,
  onGuardarCuenta,
  rolesBaseInfo,
  preferenciasSonido,
  setPreferenciasSonido,
  reproducirSonido,
  onProbarPush,
  onCerrarConfiguracion,
}) {
  if (rolUsuario === 'admin' || rolUsuario === 'super_admin') {
    // Todos los módulos reales son asignables acá (antes era una lista
    // recortada de 17 que ni siquiera incluía Cancha/Torneos/Horarios de
    // Entrenamiento) — mesa_publica queda fuera porque no requiere sesión.
    const permisosDisponibles = MODULOS_ACCESO.filter((modulo) => modulo.id !== 'mesa_publica');
    const usuariosFiltrados = matrixPermisos.filter((u) => {
      if (!u.nombre.toLowerCase().includes(busquedaPermisos.toLowerCase())) return false;
      if (filtroRolPermisos === 'Todos') return true;

      if (filtroRolPermisos === 'Deportista/Jugador') {
        const rol = normalizarRol(u.rol);
        return rol === 'jugador' || rol === 'deportista';
      }

      return normalizarRol(u.rol) === normalizarRol(filtroRolPermisos);
    });

    return (
      <div style={{ padding: '12px', borderRadius: '24px', background: 'linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(248,250,255,0.96) 100%)', boxShadow: '0 12px 28px rgba(15,23,42,0.06)' }}>
        <h4 style={{ margin: '0 0 10px 0', fontSize: '14px', fontWeight: '900' }}>Control de Permisos</h4>
        <input
          type="text"
          placeholder="Buscar..."
          value={busquedaPermisos}
          onChange={e => setBusquedaPermisos(e.target.value)}
          style={{ width: '100%', padding: '10px', marginBottom: '10px', borderRadius: '16px', border: '1px solid var(--borde-suave)', fontSize: '12px', background: 'rgba(255,255,255,0.92)' }}
        />
        <div style={{ display: 'flex', gap: '6px', marginBottom: '10px', flexWrap: 'wrap' }}>
          {['Todos', 'Admin', 'Staff', 'Socio', 'Deportista/Jugador'].map(r => (
            <button
              key={r}
              onClick={() => setFiltroRolPermisos(r)}
              style={{ padding: '8px 12px', borderRadius: '999px', background: filtroRolPermisos === r ? 'linear-gradient(180deg, #2f8cff 0%, var(--azul-electrico) 100%)' : 'var(--fondo-input)', color: filtroRolPermisos === r ? 'white' : 'var(--texto-principal)', fontSize: '11px', fontWeight: '700', border: 'none', cursor: 'pointer' }}
            >
              {r}
            </button>
          ))}
        </div>
        <div style={{ marginBottom: '10px', padding: '10px 12px', borderRadius: '16px', background: 'var(--fondo-card-sutil)', border: '1px solid var(--borde-suave)', fontSize: '11px', color: 'var(--texto-secundario)', lineHeight: '1.35' }}>
          La base de acceso depende del rol; aquí puedes ajustar excepciones por usuario. Superadmin conserva acceso total a todos los módulos. Los cambios no se guardan solos — usa "Guardar cambios" en cada tarjeta.
        </div>
        <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
          {usuariosFiltrados.map(u => {
            // cuentasConCambiosPendientes es un Set armado con Object.keys()
            // (siempre strings) — a diferencia del acceso a propiedades de
            // objeto, Set.has() no hace coerción de tipos, así que hay que
            // normalizar acá si u.id llega como number.
            const tieneCambios = cuentasConCambiosPendientes?.has(String(u.id));
            const guardando = String(guardandoCuentaId) === String(u.id) && guardandoCuentaId !== null;
            return (
              <div key={u.id} style={{ marginBottom: '8px', padding: '10px', background: 'var(--fondo-card-sutil)', borderRadius: '18px', border: tieneCambios ? '1px solid rgba(255,149,0,0.5)' : '1px solid var(--borde-suave)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                  <div>
                    <strong style={{ fontSize: '11px', display: 'block' }}>{u.nombre}</strong>
                    <span style={{ fontSize: '11px', color: 'var(--texto-secundario)' }}>{u.rol}</span>
                  </div>
                  {tieneCambios && (
                    <button
                      type="button"
                      onClick={() => onGuardarCuenta && onGuardarCuenta(u.id)}
                      disabled={guardando}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '6px 10px', borderRadius: '999px', background: 'var(--azul-electrico)', color: 'white', fontSize: '10px', fontWeight: '800', border: 'none', cursor: guardando ? 'wait' : 'pointer', whiteSpace: 'nowrap' }}
                    >
                      <Save size={11} /> {guardando ? 'Guardando...' : 'Guardar cambios'}
                    </button>
                  )}
                </div>
                <div style={{ marginTop: '6px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(80px, 1fr))', gap: '4px' }}>
                  {permisosDisponibles.map(p => (
                    <button
                      key={p.id}
                      onClick={() => togglePermiso(u.id, p.id)}
                      style={{
                        padding: '4px 6px',
                        fontSize: '11px',
                        borderRadius: '999px',
                        background: u.permisos[p.id] ? 'rgba(52,199,89,0.2)' : 'rgba(255,255,255,0.92)',
                        border: u.permisos[p.id] ? '1px solid var(--verde-victoria)' : '1px solid rgba(0,0,0,0.1)',
                        color: u.permisos[p.id] ? 'var(--verde-victoria)' : 'var(--texto-secundario)',
                        fontWeight: '700',
                        cursor: 'pointer',
                      }}
                    >
                      {u.permisos[p.id] ? 'OK' : 'O'} {p.etiqueta}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {Array.isArray(rolesBaseInfo) && rolesBaseInfo.length > 0 && (
          <div style={{ marginTop: '14px', paddingTop: '12px', borderTop: '1px solid var(--borde-suave)' }}>
            <h4 style={{ margin: '0 0 8px 0', fontSize: '13px', fontWeight: '900' }}>Qué trae cada perfil por defecto</h4>
            <p style={{ margin: '0 0 8px 0', fontSize: '11px', color: 'var(--texto-secundario)' }}>
              Solo referencia — para cambiar esto hay que modificar código. Para dar o quitar acceso a una persona puntual, usa la lista de arriba.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '220px', overflowY: 'auto' }}>
              {rolesBaseInfo.map((r) => (
                <div key={r.rol} style={{ padding: '8px 10px', borderRadius: '14px', background: 'var(--fondo-card-sutil)', border: '1px solid var(--borde-suave)' }}>
                  <strong style={{ fontSize: '11px', display: 'block', marginBottom: '4px' }}>{r.etiqueta}</strong>
                  <span style={{ fontSize: '10px', color: 'var(--texto-secundario)' }}>
                    {r.modulos.length > 0 ? r.modulos.join(', ') : 'Sin módulos por defecto'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px', borderRadius: '24px', background: 'linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(248,250,255,0.96) 100%)', boxShadow: '0 12px 28px rgba(15,23,42,0.06)' }}>
      <h4 style={{ margin: '0 0 10px 0', fontSize: '14px', fontWeight: '900' }}>Mi Perfil</h4>
      <div style={{ fontSize: '11px', color: 'var(--texto-secundario)', fontWeight: '700' }}>Tema único activo: Claro</div>
      <button onClick={() => showToast({ message: 'Próximamente', type: 'info' })} style={{ padding: '8px 10px', borderRadius: '999px', background: 'rgba(0,122,255,0.1)', color: 'var(--azul-electrico)', fontSize: '11px', fontWeight: '700', border: '1px solid rgba(0,122,255,0.18)', cursor: 'pointer' }}>Contraseña</button>
      <hr style={{ margin: '10px 0', border: 'none', borderTop: '1px solid var(--borde-suave)' }} />
      <PushPreferenciasPanel
        preferenciasSonido={preferenciasSonido}
        setPreferenciasSonido={setPreferenciasSonido}
        reproducirSonido={reproducirSonido}
        onProbarPush={onProbarPush}
        onCerrarConfiguracion={onCerrarConfiguracion}
      />
    </div>
  );
}

export default SettingsPanel;
