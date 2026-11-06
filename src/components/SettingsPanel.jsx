import { useState } from 'react';
import { Check, KeyRound, LogOut, Save, ShieldCheck } from 'lucide-react';
import * as api from '../api/client';
import PushPreferenciasPanel from './PushPreferenciasPanel';
import { MODULOS_ACCESO, normalizarRol, obtenerPermisosBasePorRol } from '../security/accessControl';
import { showToast } from '../utils/toast';

// Filtros de la matriz de permisos. Antes faltaban Apoderado y
// Socio+Apoderado (la mayoría de las cuentas): solo aparecían en "Todos".
const FILTROS_ROL_PERMISOS = [
  { etiqueta: 'Todos' },
  { etiqueta: 'Admin', roles: ['admin', 'super_admin'] },
  { etiqueta: 'Staff', roles: ['staff'] },
  { etiqueta: 'Apoderado', roles: ['apoderado'] },
  { etiqueta: 'Socio', roles: ['socio'] },
  { etiqueta: 'Socio+Apoderado', roles: ['socio_apoderado'] },
  { etiqueta: 'Directiva', roles: ['directiva'] },
  { etiqueta: 'Deportista/Jugador', roles: ['jugador', 'deportista'] },
  { etiqueta: 'Mesa', roles: ['mesa'] },
];

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
  modoSimple,
  setModoSimple,
  // 'encabezado' (engranaje del header): Mi Perfil para todos + acceso a
  // permisos para admins + Cerrar sesión. 'permisos': solo la matriz, para
  // la vista de Admin → Usuarios y Cuentas → Permisos. Antes un admin al
  // tocar el engranaje veía SOLO la matriz y nunca llegaba a Mi Perfil.
  modo = 'encabezado',
  onAbrirPermisos,
  onCerrarSesion,
  rutUsuario,
}) {
  const esAdmin = rolUsuario === 'admin' || rolUsuario === 'super_admin';
  // Cambio de contraseña (antes el botón "Contraseña" solo decía "Próximamente").
  const [formClaveAbierto, setFormClaveAbierto] = useState(false);
  const [claveActual, setClaveActual] = useState('');
  const [claveNueva, setClaveNueva] = useState('');
  const [claveConfirmacion, setClaveConfirmacion] = useState('');
  const [guardandoClave, setGuardandoClave] = useState(false);

  const cambiarClave = async (event) => {
    event.preventDefault();
    if (claveNueva.trim().length < 5) {
      showToast({ message: 'La nueva contraseña debe tener al menos 5 caracteres.', type: 'error' });
      return;
    }
    if (claveNueva !== claveConfirmacion) {
      showToast({ message: 'La confirmación no coincide con la nueva contraseña.', type: 'error' });
      return;
    }
    setGuardandoClave(true);
    try {
      await api.authAPI.changePassword({ rut: rutUsuario, currentPassword: claveActual, newPassword: claveNueva.trim() });
      showToast({ message: 'Contraseña actualizada.', type: 'success' });
      setFormClaveAbierto(false);
      setClaveActual('');
      setClaveNueva('');
      setClaveConfirmacion('');
    } catch (error) {
      showToast({ message: error.message || 'No se pudo cambiar la contraseña.', type: 'error' });
    } finally {
      setGuardandoClave(false);
    }
  };
  if (esAdmin && modo === 'permisos') {
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
      const filtro = FILTROS_ROL_PERMISOS.find((f) => f.etiqueta === filtroRolPermisos);
      const rolesFiltro = filtro?.roles || [normalizarRol(filtroRolPermisos)];
      return rolesFiltro.includes(normalizarRol(u.rol));
    });

    return (
      <div style={{ padding: '12px', borderRadius: 'var(--radius-lg)', background: 'linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(248,250,255,0.96) 100%)', boxShadow: '0 12px 28px rgba(15,23,42,0.06)' }}>
        <h4 style={{ margin: '0 0 10px 0', fontSize: '14px', fontWeight: '900' }}>Control de Permisos</h4>
        <input
          type="text"
          placeholder="Buscar..."
          value={busquedaPermisos}
          onChange={e => setBusquedaPermisos(e.target.value)}
          style={{ width: '100%', padding: '10px', marginBottom: '10px', borderRadius: 'var(--radius-md)', border: '1px solid var(--borde-suave)', fontSize: '12px', background: 'rgba(255,255,255,0.92)' }}
        />
        <div style={{ display: 'flex', gap: '6px', marginBottom: '10px', flexWrap: 'wrap' }}>
          {FILTROS_ROL_PERMISOS.map(({ etiqueta: r }) => (
            <button
              key={r}
              onClick={() => setFiltroRolPermisos(r)}
              style={{ padding: '8px 12px', borderRadius: 'var(--radius-pill)', background: filtroRolPermisos === r ? 'linear-gradient(180deg, #2f8cff 0%, var(--azul-electrico) 100%)' : 'var(--fondo-input)', color: filtroRolPermisos === r ? 'white' : 'var(--texto-principal)', fontSize: 'var(--texto-min)', fontWeight: '700', border: 'none', cursor: 'pointer' }}
            >
              {r}
            </button>
          ))}
        </div>
        <div style={{ marginBottom: '10px', padding: '10px 12px', borderRadius: 'var(--radius-md)', background: 'var(--fondo-card-sutil)', border: '1px solid var(--borde-suave)', fontSize: 'var(--texto-min)', color: 'var(--texto-secundario)', lineHeight: '1.35' }}>
          La base de acceso depende del rol; aquí puedes ajustar excepciones por usuario. Superadmin conserva acceso total a todos los módulos. Los cambios no se guardan solos — usa "Guardar cambios" en cada tarjeta.
          <span style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '6px', fontWeight: 700 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: 'var(--estado-pagado-texto)' }}><Check size={12} strokeWidth={3} /> Activo</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ width: '14px', height: '10px', borderRadius: 'var(--radius-sm)', border: '1px dashed var(--naranja-aviso)', display: 'inline-block' }} /> Excepción solo para esa cuenta
            </span>
          </span>
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
              <div key={u.id} style={{ marginBottom: '8px', padding: '10px', background: 'var(--fondo-card-sutil)', borderRadius: 'var(--radius-md)', border: tieneCambios ? '1px solid rgba(255,149,0,0.5)' : '1px solid var(--borde-suave)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                  <div>
                    <strong style={{ fontSize: 'var(--texto-min)', display: 'block' }}>{u.nombre}</strong>
                    <span style={{ fontSize: 'var(--texto-min)', color: 'var(--texto-secundario)' }}>{u.rol}</span>
                  </div>
                  {tieneCambios && (
                    <button
                      type="button"
                      onClick={() => onGuardarCuenta && onGuardarCuenta(u.id)}
                      disabled={guardando}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '6px 10px', borderRadius: 'var(--radius-pill)', background: 'var(--azul-electrico)', color: 'white', fontSize: 'var(--texto-min)', fontWeight: '800', border: 'none', cursor: guardando ? 'wait' : 'pointer', whiteSpace: 'nowrap' }}
                    >
                      <Save size={11} /> {guardando ? 'Guardando...' : 'Guardar cambios'}
                    </button>
                  )}
                </div>
                {/* Chips de ancho automático (antes una grilla de columnas fijas
                    donde los nombres largos se montaban sobre el chip vecino).
                    Borde naranjo punteado = excepción individual de esta
                    cuenta (distinta a lo que trae su perfil base). */}
                <div style={{ marginTop: '8px', display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                  {permisosDisponibles.map(p => {
                    const activo = Boolean(u.permisos[p.id]);
                    const base = obtenerPermisosBasePorRol(u.rol);
                    const esExcepcion = normalizarRol(u.rol) !== 'super_admin' && activo !== Boolean(base[p.id]);
                    return (
                      <button
                        key={p.id}
                        type="button"
                        aria-pressed={activo}
                        title={esExcepcion
                          ? `${activo ? 'Habilitado' : 'Quitado'} solo para esta cuenta (su perfil ${activo ? 'no lo trae' : 'sí lo trae'})`
                          : `${activo ? 'Incluido' : 'No incluido'} en su perfil`}
                        onClick={() => togglePermiso(u.id, p.id)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '6px 10px',
                          minHeight: '36px',
                          fontSize: 'var(--texto-min)',
                          lineHeight: 1.2,
                          borderRadius: 'var(--radius-pill)',
                          background: activo ? 'rgba(52,199,89,0.16)' : 'rgba(255,255,255,0.92)',
                          border: esExcepcion
                            ? '1px dashed var(--naranja-aviso)'
                            : (activo ? '1px solid rgba(52,199,89,0.55)' : '1px solid rgba(0,0,0,0.12)'),
                          color: activo ? 'var(--estado-pagado-texto)' : 'var(--texto-secundario)',
                          fontWeight: '700',
                          cursor: 'pointer',
                          transition: 'background 0.15s ease, border-color 0.15s ease',
                        }}
                      >
                        {activo && <Check size={12} strokeWidth={3} aria-hidden="true" />}
                        {p.etiqueta}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {Array.isArray(rolesBaseInfo) && rolesBaseInfo.length > 0 && (
          <div style={{ marginTop: '14px', paddingTop: '12px', borderTop: '1px solid var(--borde-suave)' }}>
            <h4 style={{ margin: '0 0 8px 0', fontSize: '13px', fontWeight: '900' }}>Qué trae cada perfil por defecto</h4>
            <p style={{ margin: '0 0 8px 0', fontSize: 'var(--texto-min)', color: 'var(--texto-secundario)' }}>
              Solo referencia — para cambiar esto hay que modificar código. Para dar o quitar acceso a una persona puntual, usa la lista de arriba.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '220px', overflowY: 'auto' }}>
              {rolesBaseInfo.map((r) => (
                <div key={r.rol} style={{ padding: '8px 10px', borderRadius: 'var(--radius-md)', background: 'var(--fondo-card-sutil)', border: '1px solid var(--borde-suave)' }}>
                  <strong style={{ fontSize: 'var(--texto-min)', display: 'block', marginBottom: '4px' }}>{r.etiqueta}</strong>
                  <span style={{ fontSize: 'var(--texto-min)', color: 'var(--texto-secundario)' }}>
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
    <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px', borderRadius: 'var(--radius-lg)', background: 'linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(248,250,255,0.96) 100%)', boxShadow: '0 12px 28px rgba(15,23,42,0.06)' }}>
      <h4 style={{ margin: '0 0 10px 0', fontSize: '14px', fontWeight: '900' }}>Mi Perfil</h4>
      {rutUsuario && (
        <button type="button" className="settings-accion" aria-expanded={formClaveAbierto} onClick={() => setFormClaveAbierto((v) => !v)}>
          <KeyRound size={18} aria-hidden="true" />
          <span><strong>Cambiar contraseña</strong></span>
        </button>
      )}
      {formClaveAbierto && (
        <form onSubmit={cambiarClave} className="form-cambiar-clave">
          <input type="password" className="form-input" placeholder="Contraseña actual" autoComplete="current-password" value={claveActual} onChange={(e) => setClaveActual(e.target.value)} required />
          <input type="password" className="form-input" placeholder="Nueva contraseña (mín. 5)" autoComplete="new-password" value={claveNueva} onChange={(e) => setClaveNueva(e.target.value)} required />
          <input type="password" className="form-input" placeholder="Repite la nueva contraseña" autoComplete="new-password" value={claveConfirmacion} onChange={(e) => setClaveConfirmacion(e.target.value)} required />
          <button type="submit" className="btn-electric" disabled={guardandoClave} style={{ minHeight: 'var(--toque-min)' }}>
            {guardandoClave ? 'Guardando…' : 'Guardar nueva contraseña'}
          </button>
        </form>
      )}
      {typeof setModoSimple === 'function' && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', borderRadius: 'var(--radius-md)', background: 'var(--fondo-card-sutil)', border: '1px solid var(--borde-suave)' }}>
          <div>
            <strong style={{ fontSize: '12px', display: 'block' }}>Modo Fácil</strong>
            <span style={{ fontSize: 'var(--texto-min)', color: 'var(--texto-secundario)' }}>Letra grande, 3 botones: ficha, comprobante, noticias.</span>
          </div>
          <button
            type="button"
            onClick={() => {
              const activando = !modoSimple;
              setModoSimple(activando);
              // Al activarlo, cerramos este panel para que se vea de
              // inmediato el Modo Fácil, en vez de quedar tapado detrás.
              if (activando && typeof onCerrarConfiguracion === 'function') onCerrarConfiguracion();
            }}
            style={{
              flexShrink: 0, width: '46px', height: '26px', borderRadius: 'var(--radius-pill)', border: 'none', cursor: 'pointer',
              background: modoSimple ? 'var(--verde-victoria)' : 'rgba(120,120,128,0.3)', position: 'relative', transition: 'background 0.2s',
            }}
            aria-label="Activar o desactivar Modo Fácil"
          >
            <span style={{
              position: 'absolute', top: '3px', left: modoSimple ? '23px' : '3px', width: '20px', height: '20px',
              borderRadius: '50%', background: 'white', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
            }} />
          </button>
        </div>
      )}
      {esAdmin && typeof onAbrirPermisos === 'function' && (
        <>
          <hr style={{ margin: '10px 0', border: 'none', borderTop: '1px solid var(--borde-suave)' }} />
          <button type="button" className="settings-accion" onClick={onAbrirPermisos}>
            <ShieldCheck size={18} aria-hidden="true" />
            <span>
              <strong>Permisos por usuario</strong>
              <small>Habilitar o quitar módulos a una cuenta puntual</small>
            </span>
          </button>
        </>
      )}
      {typeof onCerrarSesion === 'function' && (
        <>
          <hr style={{ margin: '10px 0', border: 'none', borderTop: '1px solid var(--borde-suave)' }} />
          {/* Antes era un ícono suelto en el header, junto a la campana. */}
          <button type="button" className="settings-accion settings-accion-peligro" onClick={onCerrarSesion}>
            <LogOut size={18} aria-hidden="true" />
            <span><strong>Cerrar sesión</strong></span>
          </button>
        </>
      )}
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
