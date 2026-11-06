import { useEffect, useState } from 'react';
import { Bell, ChevronLeft, Eye, EyeOff, Lock, QrCode, Trophy, User } from 'lucide-react';
import * as api from '../api/client';
import { showToast } from '../utils/toast';
import LogoAvatar from './LogoAvatar';
import LogoPicker from './LogoPicker';
import ResultadosCards from './ResultadosCards';
import { esUrlImagen, esUrlYoutube, esUrlVimeo, esUrlVideoInterno, obtenerIdYoutube, obtenerIdVimeo } from '../utils/contenidoMultimedia';

// Misma lógica que ContenidoComunicacion en ComunicacionesPanel.jsx: el muro
// público muestra los mismos posts, así que necesita la misma detección de
// imagen/video/enlace en vez de mostrar la URL como texto plano.
function ContenidoComunicacion({ texto }) {
  const valor = String(texto || '').trim();
  if (!valor) return null;

  if (esUrlImagen(valor)) {
    return <img src={valor} alt="" style={{ width: '100%', borderRadius: 'var(--radius-md)', marginTop: '4px', marginBottom: '8px' }} />;
  }

  if (esUrlYoutube(valor)) {
    const id = obtenerIdYoutube(valor);
    if (id) {
      return (
        <div style={{ borderRadius: 'var(--radius-md)', overflow: 'hidden', aspectRatio: '16/9', marginTop: '4px', marginBottom: '8px' }}>
          <iframe src={`https://www.youtube.com/embed/${id}`} title="Video" style={{ width: '100%', height: '100%', border: 'none' }} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
        </div>
      );
    }
  }

  if (esUrlVimeo(valor)) {
    const id = obtenerIdVimeo(valor);
    if (id) {
      return (
        <div style={{ borderRadius: 'var(--radius-md)', overflow: 'hidden', aspectRatio: '16/9', marginTop: '4px', marginBottom: '8px' }}>
          <iframe src={`https://player.vimeo.com/video/${id}`} title="Video" style={{ width: '100%', height: '100%', border: 'none' }} allow="autoplay; fullscreen; picture-in-picture" allowFullScreen />
        </div>
      );
    }
  }

  if (esUrlVideoInterno(valor)) {
    return (
      <video controls preload="metadata" style={{ width: '100%', borderRadius: 'var(--radius-md)', marginTop: '4px', marginBottom: '8px', background: '#000' }}>
        <source src={`${api.API_BASE_URL_CONFIG}/${valor}`} />
        Tu navegador no soporta reproducción de video.
      </video>
    );
  }

  if (/^https?:\/\//i.test(valor)) {
    return <a href={valor} target="_blank" rel="noreferrer" className="ios-rrss-body" style={{ display: 'block', color: 'var(--azul-electrico)', wordBreak: 'break-word' }}>{valor}</a>;
  }

  return <p className="ios-rrss-body">{valor}</p>;
}

// Vista pública de solo lectura de Torneos: mismos endpoints que TorneosPanel
// (ya son públicos, GET /api/torneos y /api/torneos/:id/tabla-posiciones no
// piden sesión), pero sin el botón de crear torneo — acá solo se consulta.
function TablaPosicionesPublica() {
  const [torneos, setTorneos] = useState([]);
  const [cargandoTorneos, setCargandoTorneos] = useState(true);
  const [torneoSeleccionadoId, setTorneoSeleccionadoId] = useState(null);
  const [tabla, setTabla] = useState(null);
  const [cargandoTabla, setCargandoTabla] = useState(false);

  useEffect(() => {
    let cancelado = false;
    api.torneosAPI.getAll()
      .then((datos) => { if (!cancelado) setTorneos(Array.isArray(datos) ? datos : []); })
      .catch(() => { if (!cancelado) setTorneos([]); })
      .finally(() => { if (!cancelado) setCargandoTorneos(false); });
    return () => { cancelado = true; };
  }, []);

  const seleccionarTorneo = async (idTorneo) => {
    if (torneoSeleccionadoId === idTorneo) {
      setTorneoSeleccionadoId(null);
      setTabla(null);
      return;
    }
    setTorneoSeleccionadoId(idTorneo);
    setCargandoTabla(true);
    try {
      const datos = await api.torneosAPI.tablaPosiciones(idTorneo);
      setTabla(datos);
    } catch {
      setTabla(null);
    } finally {
      setCargandoTabla(false);
    }
  };

  if (cargandoTorneos) return <p style={{ fontSize: '13px', color: 'var(--texto-secundario)' }}>Cargando torneos...</p>;

  if (torneos.length === 0) {
    return (
      <div className="card" style={{ borderRadius: 'var(--radius-lg)', boxShadow: '0 12px 28px rgba(15,23,42,0.06)' }}>
        <p style={{ margin: 0, fontSize: '13px', color: 'var(--texto-secundario)' }}>Todavía no hay torneos publicados.</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {torneos.map((t) => {
        const abierto = torneoSeleccionadoId === t.id_torneo;
        return (
          <div key={t.id_torneo} className="card" style={{ borderRadius: 'var(--radius-lg)', padding: 0, overflow: 'hidden', boxShadow: '0 12px 28px rgba(15,23,42,0.06)' }}>
            <button
              type="button"
              onClick={() => seleccionarTorneo(t.id_torneo)}
              style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', padding: '14px 16px', background: abierto ? 'rgba(0,122,255,0.06)' : 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left' }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Trophy size={18} color="var(--azul-electrico)" strokeWidth={1.5} />
                <span>
                  <strong style={{ display: 'block', fontSize: '14px' }}>{t.nombre_torneo}</strong>
                  <span style={{ fontSize: '11px', color: 'var(--texto-secundario)', fontWeight: '700' }}>
                    {t.rama || 'General'} · {t.categoria || 'General'}
                  </span>
                </span>
              </span>
            </button>

            {abierto && (
              <div style={{ padding: '4px 16px 16px 16px' }}>
                {cargandoTabla && <p style={{ fontSize: '13px', color: 'var(--texto-secundario)' }}>Cargando tabla de posiciones...</p>}
                {!cargandoTabla && tabla && tabla.posiciones.length === 0 && (
                  <p style={{ fontSize: '13px', color: 'var(--texto-secundario)', fontStyle: 'italic' }}>Todavía no hay partidos finalizados en este torneo.</p>
                )}
                {!cargandoTabla && tabla && tabla.posiciones.length > 0 && (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                      <thead>
                        <tr style={{ textAlign: 'left', borderBottom: '2px solid var(--borde-suave)' }}>
                          <th style={{ padding: '6px 8px' }}>#</th>
                          <th style={{ padding: '6px 8px' }}>Equipo</th>
                          <th style={{ padding: '6px 8px', textAlign: 'center' }}>PJ</th>
                          <th style={{ padding: '6px 8px', textAlign: 'center' }}>PG</th>
                          <th style={{ padding: '6px 8px', textAlign: 'center' }}>PP</th>
                          <th style={{ padding: '6px 8px', textAlign: 'center' }}>DIF</th>
                          <th style={{ padding: '6px 8px', textAlign: 'center' }}>%</th>
                        </tr>
                      </thead>
                      <tbody>
                        {tabla.posiciones.map((fila) => (
                          <tr key={fila.nombre} style={{ borderBottom: '1px solid var(--borde-suave)' }}>
                            <td style={{ padding: '6px 8px', fontWeight: '900', color: 'var(--azul-electrico)' }}>{fila.posicion}</td>
                            <td style={{ padding: '6px 8px', fontWeight: '800' }}>{fila.nombre}</td>
                            <td style={{ padding: '6px 8px', textAlign: 'center' }}>{fila.pj}</td>
                            <td style={{ padding: '6px 8px', textAlign: 'center' }}>{fila.pg}</td>
                            <td style={{ padding: '6px 8px', textAlign: 'center' }}>{fila.pp}</td>
                            <td style={{ padding: '6px 8px', textAlign: 'center' }}>{fila.dif > 0 ? `+${fila.dif}` : fila.dif}</td>
                            <td style={{ padding: '6px 8px', textAlign: 'center' }}>{Math.round(fila.pct * 100)}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {!cargandoTabla && tabla && tabla.partidosPendientes?.length > 0 && (
                  <>
                    <h5 style={{ margin: '16px 0 8px 0', fontSize: '13px' }}>Próximos partidos</h5>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {tabla.partidosPendientes.map((p) => (
                        <div key={p.id_partido} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', border: '1px dashed var(--borde-suave)', borderRadius: 'var(--radius-sm)', padding: '8px 10px', fontSize: '12px' }}>
                          <span>{p.equipo_local} vs {p.equipo_visitante}</span>
                          <span style={{ color: 'var(--texto-secundario)', fontWeight: '700' }}>
                            {p.fecha_hora ? new Date(p.fecha_hora).toLocaleDateString('es-CL') : 'Sin fecha'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// Primer ingreso / "Olvidé mi contraseña": código de 6 dígitos al correo
// registrado (POST /api/auth/solicitar-codigo y /api/auth/canjear-codigo).
// Si la cuenta no tiene correo o el envío no está configurado, ofrece
// escribir al club por WhatsApp (el mecanismo anterior).
function AccesoConCodigo({ rut, setRut, pasoInicial, destinoInicial, onVolver, onListo, onWhatsApp }) {
  const [paso, setPaso] = useState(pasoInicial || 'pedir');
  const [destino, setDestino] = useState(destinoInicial || '');
  const [codigo, setCodigo] = useState('');
  const [nuevaClave, setNuevaClave] = useState('');
  const [confirmacion, setConfirmacion] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [sinCorreo, setSinCorreo] = useState('');
  // true = el código lo entregó el club (WhatsApp/en persona), no llegó al correo.
  const [codigoDelClub, setCodigoDelClub] = useState(false);
  // Mientras el club no tenga SMTP, el código se pide solo por WhatsApp.
  // null = consultando (se muestra la versión WhatsApp, la más segura).
  const [porCorreo, setPorCorreo] = useState(null);

  useEffect(() => {
    let activo = true;
    api.authAPI.codigosPorCorreo().then((valor) => { if (activo) setPorCorreo(valor); });
    return () => { activo = false; };
  }, []);

  const pedirCodigo = async (event) => {
    event?.preventDefault();
    if (!String(rut || '').trim()) {
      showToast({ message: 'Ingresa tu RUT.', type: 'error' });
      return;
    }
    setEnviando(true);
    setSinCorreo('');
    try {
      const respuesta = await api.authAPI.solicitarCodigo(rut);
      if (!respuesta?.enviado) {
        setSinCorreo(respuesta?.mensaje || 'No encontramos un correo registrado para ese RUT.');
        return;
      }
      setDestino(respuesta.destino || '');
      setPaso('canjear');
      showToast({ message: respuesta.mensaje, type: 'success' });
    } catch (error) {
      if (error?.code === 'CORREO_NO_CONFIGURADO') setSinCorreo(error.message);
      else showToast({ message: error.message || 'No se pudo enviar el código.', type: 'error' });
    } finally {
      setEnviando(false);
    }
  };

  const crearClave = async (event) => {
    event.preventDefault();
    if (nuevaClave.trim().length < 5) {
      showToast({ message: 'La nueva contraseña debe tener al menos 5 caracteres.', type: 'error' });
      return;
    }
    if (nuevaClave !== confirmacion) {
      showToast({ message: 'La confirmación no coincide con la nueva contraseña.', type: 'error' });
      return;
    }
    setEnviando(true);
    try {
      const respuesta = await api.authAPI.canjearCodigo({ rut, codigo, nuevaClave: nuevaClave.trim() });
      showToast({ message: respuesta?.mensaje || 'Contraseña creada. Ya puedes ingresar.', type: 'success' });
      onListo?.();
    } catch (error) {
      showToast({ message: error.message || 'No se pudo crear la contraseña.', type: 'error' });
    } finally {
      setEnviando(false);
    }
  };

  if (paso === 'canjear') {
    return (
      <form className="login-form-real fade-in" onSubmit={crearClave} style={{ borderRadius: 'var(--radius-lg)' }}>
        <h4 className="login-form-title">Crea tu contraseña</h4>
        <p className="acceso-codigo-ayuda">
          {codigoDelClub
            ? 'Ingresa tu RUT y el código de 6 dígitos que te entregó el club.'
            : <>{destino ? <>Enviamos un código de 6 dígitos a <strong>{destino}</strong>.</> : 'Revisa tu correo: enviamos un código de 6 dígitos.'} Vence en 15 minutos; revisa también spam.</>}
        </p>
        {codigoDelClub && (
          <div className="input-group-login mb-10">
            <User size={18} color="var(--gris-secundario)" strokeWidth={1.5} />
            <input type="text" placeholder="RUT" value={rut} onChange={(e) => setRut(e.target.value)} required />
          </div>
        )}
        <div className="input-group-login">
          <Lock size={18} color="var(--gris-secundario)" strokeWidth={1.5} />
          <input
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            placeholder="Código de 6 dígitos"
            aria-label="Código de 6 dígitos"
            value={codigo}
            onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ''))}
            required
          />
        </div>
        <div className="input-group-login mt-10">
          <Lock size={18} color="var(--gris-secundario)" strokeWidth={1.5} />
          <input type="password" autoComplete="new-password" placeholder="Nueva contraseña (mín. 5)" value={nuevaClave} onChange={(e) => setNuevaClave(e.target.value)} required />
        </div>
        <div className="input-group-login mt-10">
          <Lock size={18} color="var(--gris-secundario)" strokeWidth={1.5} />
          <input type="password" autoComplete="new-password" placeholder="Repite la nueva contraseña" value={confirmacion} onChange={(e) => setConfirmacion(e.target.value)} required />
        </div>
        <button type="submit" className="btn-electric mt-20" disabled={enviando}>{enviando ? 'Guardando…' : 'Crear contraseña'}</button>
        {!codigoDelClub && (
          <button type="button" className="btn-volver-texto mt-15" onClick={pedirCodigo} disabled={enviando}>¿No llegó? Reenviar código</button>
        )}
        <button type="button" className="btn-volver-texto" onClick={onVolver}>
          <ChevronLeft size={16} /> Volver al ingreso
        </button>
      </form>
    );
  }

  if (porCorreo !== true) {
    return (
      <div className="login-form-real fade-in" style={{ borderRadius: 'var(--radius-lg)' }}>
        <h4 className="login-form-title">Primer ingreso o clave olvidada</h4>
        <p className="acceso-codigo-ayuda">
          Pide tu código de activación al club por WhatsApp. Cuando lo tengas, elige
          <strong> “Tengo un código del club”</strong> y crea tu contraseña.
        </p>
        <div className="input-group-login">
          <User size={18} color="var(--gris-secundario)" strokeWidth={1.5} />
          <input type="text" placeholder="RUT (opcional, para el mensaje)" value={rut} onChange={(e) => setRut(e.target.value)} />
        </div>
        <button type="button" className="btn-electric mt-20" onClick={onWhatsApp}>Pedir código por WhatsApp</button>
        <button type="button" className="btn-secondary mt-10" onClick={() => { setCodigoDelClub(true); setPaso('canjear'); }}>
          Tengo un código del club
        </button>
        <button type="button" className="btn-volver-texto mt-15" onClick={onVolver}>
          <ChevronLeft size={16} /> Volver al ingreso
        </button>
      </div>
    );
  }

  return (
    <form className="login-form-real fade-in" onSubmit={pedirCodigo} style={{ borderRadius: 'var(--radius-lg)' }}>
      <h4 className="login-form-title">Primer ingreso o clave olvidada</h4>
      <p className="acceso-codigo-ayuda">Te enviaremos un código de 6 dígitos al correo registrado en el club para que crees tu contraseña.</p>
      <div className="input-group-login">
        <User size={18} color="var(--gris-secundario)" strokeWidth={1.5} />
        <input type="text" placeholder="RUT" value={rut} onChange={(e) => setRut(e.target.value)} required />
      </div>
      {sinCorreo && (
        <div className="acceso-codigo-aviso" role="status">
          <p>{sinCorreo}</p>
          <button type="button" className="btn-secondary" onClick={onWhatsApp}>Escribir al club por WhatsApp</button>
        </div>
      )}
      <button type="submit" className="btn-electric mt-20" disabled={enviando}>{enviando ? 'Enviando…' : 'Enviar código a mi correo'}</button>
      <button type="button" className="btn-secondary mt-10" onClick={() => { setCodigoDelClub(true); setPaso('canjear'); }}>
        Tengo un código del club
      </button>
      <button type="button" className="btn-volver-texto mt-15" onClick={onVolver}>
        <ChevronLeft size={16} /> Volver al ingreso
      </button>
    </form>
  );
}

function PublicFacadePanel({
  codigoCorreoPendiente,
  limpiarCodigoCorreoPendiente,
  vistaPublica,
  mostrarFormularioLogin,
  abrirFormularioLogin,
  tipoLoginSeleccionado,
  handleLoginSubmit,
  rutInput,
  setRutInput,
  passInput,
  setPassInput,
  nombreInvitado,
  setNombreInvitado,
  clubInvitado,
  setClubInvitado,
  clubLogoInvitado,
  setClubLogoInvitado,
  volverInicioLogin,
  comunicacionesPublicas,
  galeriaPublica,
  partidos,
}) {
  const [mostrarClave, setMostrarClave] = useState(false);
  // null = formulario de ingreso normal; 'pedir' | 'canjear' = acceso con
  // código por correo (AccesoConCodigo).
  const [modoCodigo, setModoCodigo] = useState(null);
  const [destinoCodigo, setDestinoCodigo] = useState('');

  // El login respondió USAR_CODIGO_CORREO (App.jsx): abrir directo el paso
  // de ingresar el código, que el backend ya envió.
  useEffect(() => {
    if (!codigoCorreoPendiente) return;
    setDestinoCodigo(codigoCorreoPendiente.destino || '');
    setModoCodigo('canjear');
  }, [codigoCorreoPendiente]);

  const salirModoCodigo = () => {
    setModoCodigo(null);
    limpiarCodigoCorreoPendiente?.();
  };

  const abrirContactoWhatsApp = () => {
    const mensaje = encodeURIComponent('Hola! Quiero ser parte de la familia deportiva del Club Centro de Cultura Física.');
    window.open(`https://wa.me/56953297869?text=${mensaje}`, '_blank');
  };

  // Respaldo cuando la cuenta no tiene correo registrado (o el envío de
  // correos no está configurado): escribir al club por WhatsApp para que
  // restablezca la clave desde Usuarios y Cuentas.
  const abrirRecuperarClave = () => {
    const rut = String(rutInput || '').trim();
    const mensaje = encodeURIComponent(
      `Hola! Necesito mi código de activación para entrar a la app del club (primer ingreso o clave olvidada).${rut ? ` Mi RUT es: ${rut}.` : ''}`
    );
    window.open(`https://wa.me/56953297869?text=${mensaje}`, '_blank');
  };

  return (
    <>
      {vistaPublica === 'inicio' && (
        <div className="text-center login-card-main hero-panel" style={{ borderRadius: 'var(--radius-lg)', boxShadow: '0 18px 44px rgba(15,23,42,0.08)' }}>
          <div className="hero-official-stack">
            <span className="hero-badge" style={{ borderRadius: 'var(--radius-pill)', padding: '7px 16px', fontWeight: '800', display: 'inline-flex', alignItems: 'center' }}>
              Portal Oficial
            </span>
            <LogoAvatar nombre="Centro de Cultura Física" logoUrl="/logos/club-logo.png" tipo="club" size={96} borderRadius="999px" className="home-brand-logo-only" style={{ display: 'flex', margin: '0 auto' }} />
          </div>

          {!mostrarFormularioLogin ? (
            <div className="login-botones-iniciales">
              <button className="btn-electric access-users-btn" onClick={() => abrirFormularioLogin('socios')}>
                <User size={18} /> Ingreso Usuarios CCF
              </button>
              <button className="btn-secondary access-visits-btn mt-15" onClick={() => abrirFormularioLogin('invitado')}>
                <QrCode size={18} /> Acceso Visitas
              </button>
              <div className="cta-contacto-card" style={{ borderRadius: 'var(--radius-lg)', boxShadow: '0 14px 34px rgba(15,23,42,0.14)', marginTop: '22px' }}>
                <h3 style={{ margin: '0 0 6px 0', fontSize: '18px', fontWeight: '900' }}>Club Centro de Cultura Física</h3>
                <p style={{ margin: 0, fontSize: '13px', color: 'rgba(255,255,255,0.85)', lineHeight: '1.5' }}>
                  ¿Quieres ser parte de nuestra familia deportiva?
                </p>
                <button className="btn-contacto" onClick={abrirContactoWhatsApp}>
                  Contáctanos, haz clic acá
                </button>
              </div>
            </div>
          ) : modoCodigo ? (
            <AccesoConCodigo
              key={`${modoCodigo}-${codigoCorreoPendiente?.solicitadoEn || 0}`}
              rut={rutInput}
              setRut={setRutInput}
              pasoInicial={modoCodigo}
              destinoInicial={destinoCodigo}
              onVolver={salirModoCodigo}
              onListo={() => { setPassInput(''); salirModoCodigo(); }}
              onWhatsApp={abrirRecuperarClave}
            />
          ) : (
            <form className="login-form-real fade-in" onSubmit={handleLoginSubmit} style={{ borderRadius: 'var(--radius-lg)' }}>
              <h4 className="login-form-title">
                {tipoLoginSeleccionado === 'invitado' ? 'Portal Invitados' : 'Acceso Oficial'}
              </h4>
              {tipoLoginSeleccionado === 'invitado' && (
                <>
                  <div className="input-group-login">
                    <User size={18} color="var(--gris-secundario)" strokeWidth={1.5} />
                    <input type="text" placeholder="Tu nombre completo" value={nombreInvitado} onChange={e => setNombreInvitado(e.target.value)} required />
                  </div>
                  <div className="mt-10 mb-10">
                    <LogoPicker
                      label=""
                      nombre={clubInvitado}
                      onNombre={setClubInvitado}
                      logoUrl={clubLogoInvitado}
                      onLogoUrl={setClubLogoInvitado}
                      tipo="club"
                      placeholder="Tu club (opcional)..."
                    />
                  </div>
                </>
              )}
              <div className="input-group-login">
                <User size={18} color="var(--gris-secundario)" strokeWidth={1.5} />
                <input type="text" placeholder="RUT" value={rutInput} onChange={e => setRutInput(e.target.value)} required />
              </div>
              <div className="input-group-login mt-10">
                <Lock size={18} color="var(--gris-secundario)" strokeWidth={1.5} />
                <input type={mostrarClave ? 'text' : 'password'} placeholder="Contraseña" value={passInput} onChange={e => setPassInput(e.target.value)} required />
                <button
                  type="button"
                  onClick={() => setMostrarClave((v) => !v)}
                  aria-label={mostrarClave ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', display: 'flex', color: 'var(--gris-secundario)' }}
                >
                  {mostrarClave ? <EyeOff size={18} strokeWidth={1.5} /> : <Eye size={18} strokeWidth={1.5} />}
                </button>
              </div>
              {tipoLoginSeleccionado !== 'invitado' && (
                <button type="button" className="btn-volver-texto" style={{ padding: '8px 0', fontSize: '13px' }} onClick={() => setModoCodigo('pedir')}>
                  ¿Primera vez u olvidaste tu contraseña?
                </button>
              )}
              <button type="submit" className="btn-electric mt-20">Ingresar al Sistema</button>
              <button type="button" className="btn-volver-texto mt-15" onClick={volverInicioLogin}>
                <ChevronLeft size={16} /> Volver a opciones
              </button>
            </form>
          )}
        </div>
      )}

      {vistaPublica === 'noticias' && (
        <div className="fade-in">
          <h3 className="section-title mt-20">Anuncios del Club</h3>
          {comunicacionesPublicas.length === 0 && (
            <div className="card mb-15" style={{ borderRadius: 'var(--radius-lg)', boxShadow: '0 12px 28px rgba(15,23,42,0.06)' }}>
              <h4 style={{ margin: '0 0 6px 0', fontSize: '16px', fontWeight: '900' }}>Sin noticias disponibles</h4>
              <p style={{ margin: 0, fontSize: '13px', color: 'var(--texto-secundario)' }}>
                Aún no hay publicaciones públicas.
              </p>
            </div>
          )}
          {comunicacionesPublicas.map(c => (
            <div key={c.id} className="ios-rrss-card fade-in" style={{ borderRadius: 'var(--radius-lg)', boxShadow: '0 12px 28px rgba(15,23,42,0.06)' }}>
              <div className="ios-rrss-header">
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                  <LogoAvatar nombre={c.TITULO} logoUrl={c.logo_url || c.logoUrl} size={26} borderRadius="999px" />
                  <span className="badge-tipo">{c.TIPO_COMUNICADO}</span>
                </span>
                <span className="fecha-comunicado">{c.FECHA}</span>
              </div>
              <h4 className="titulo-comunicado">
                <Bell size={16} style={{ marginRight: '6px' }} />
                {c.TITULO}
              </h4>
              <ContenidoComunicacion texto={c.CUERPO_TEXTO} />
            </div>
          ))}

          <h3 className="section-title mt-20">Galeria</h3>
          {galeriaPublica.length === 0 ? (
            <div className="card mb-20" style={{ borderRadius: 'var(--radius-lg)', boxShadow: '0 12px 28px rgba(15,23,42,0.06)' }}>
              <p style={{ margin: 0, fontSize: '13px', color: 'var(--texto-secundario)' }}>No hay elementos en galería por ahora.</p>
            </div>
          ) : (
            <div className="fotos-grid mb-20">
              {galeriaPublica.map(foto => (
                <div key={foto.id} className="foto-card">
                  <span className="foto-emoji">{foto.emoji}</span>
                  <span className="foto-titulo">{foto.titulo}</span>
                  <span className="foto-fecha">{foto.fecha}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {vistaPublica === 'resultados' && (
        <div className="fade-in">
          <h3 className="section-title mt-20">Ultimos Resultados</h3>
          {partidos.length === 0 ? (
            <div className="card" style={{ borderRadius: 'var(--radius-lg)', boxShadow: '0 12px 28px rgba(15,23,42,0.06)' }}>
              <p style={{ margin: 0, fontSize: '13px', color: 'var(--texto-secundario)' }}>No hay resultados publicados aún.</p>
            </div>
          ) : (
            <ResultadosCards partidos={partidos} />
          )}
        </div>
      )}

      {vistaPublica === 'torneos' && (
        <div className="fade-in">
          <h3 className="section-title mt-20">Torneos y Tabla de Posiciones</h3>
          <TablaPosicionesPublica />
        </div>
      )}
    </>
  );
}

export default PublicFacadePanel;
