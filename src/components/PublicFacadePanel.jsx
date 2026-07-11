import { Bell, ChevronLeft, Lock, QrCode, User } from 'lucide-react';
import LogoAvatar from './LogoAvatar';
import ResultadosCards from './ResultadosCards';

function PublicFacadePanel({
  vistaPublica,
  mostrarFormularioLogin,
  abrirFormularioLogin,
  tipoLoginSeleccionado,
  handleLoginSubmit,
  rutInput,
  setRutInput,
  passInput,
  setPassInput,
  volverInicioLogin,
  comunicacionesPublicas,
  galeriaPublica,
  partidos,
}) {
  return (
    <>
      {vistaPublica === 'inicio' && (
        <div className="text-center login-card-main hero-panel" style={{ borderRadius: '28px', boxShadow: '0 18px 44px rgba(15,23,42,0.08)' }}>
          <div className="hero-official-stack">
            <span className="hero-badge" style={{ borderRadius: '999px', padding: '7px 12px', fontWeight: '800', display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
              <LogoAvatar nombre="Centro de Cultura Física" logoUrl="/logos/club-logo.png" size={22} borderRadius="999px" />
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
              <button className="btn-whatsapp want-club-btn mt-15" onClick={() => window.open('https://wa.me/56953297869?text=Hola!%20Quiero%20conocer%20más%20sobre%20el%20Club%20Centro%20de%20Cultura%20Física%20de%20Viña%20del%20Mar', '_blank')}>
                Quiero ser parte del Club
              </button>
            </div>
          ) : (
            <form className="login-form-real fade-in" onSubmit={handleLoginSubmit} style={{ borderRadius: '24px' }}>
              <h4 className="login-form-title">
                {tipoLoginSeleccionado === 'invitado' ? 'Portal Invitados' : 'Acceso Oficial'}
              </h4>
              <div className="input-group-login">
                <User size={18} color="#6B7280" strokeWidth={1.5} />
                <input type="text" placeholder="RUT" value={rutInput} onChange={e => setRutInput(e.target.value)} required />
              </div>
              <div className="input-group-login mt-10">
                <Lock size={18} color="#6B7280" strokeWidth={1.5} />
                <input type="password" placeholder="Contraseña" value={passInput} onChange={e => setPassInput(e.target.value)} required />
              </div>
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
            <div className="card mb-15" style={{ borderRadius: '24px', boxShadow: '0 12px 28px rgba(15,23,42,0.06)' }}>
              <h4 style={{ margin: '0 0 6px 0', fontSize: '16px', fontWeight: '900' }}>Sin noticias disponibles</h4>
              <p style={{ margin: 0, fontSize: '13px', color: 'var(--texto-secundario)' }}>
                Aún no hay publicaciones públicas.
              </p>
            </div>
          )}
          {comunicacionesPublicas.map(c => (
            <div key={c.id} className="ios-rrss-card fade-in" style={{ borderRadius: '24px', boxShadow: '0 12px 28px rgba(15,23,42,0.06)' }}>
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
              <p className="ios-rrss-body">{c.CUERPO_TEXTO}</p>
            </div>
          ))}

          <h3 className="section-title mt-20">Galeria</h3>
          {galeriaPublica.length === 0 ? (
            <div className="card mb-20" style={{ borderRadius: '24px', boxShadow: '0 12px 28px rgba(15,23,42,0.06)' }}>
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

          <div className="cta-contacto-card" style={{ borderRadius: '26px', boxShadow: '0 14px 34px rgba(15,23,42,0.14)' }}>
            <h3 style={{ margin: '0 0 6px 0', fontSize: '18px', fontWeight: '900' }}>Club Centro de Cultura Física</h3>
            <p style={{ margin: 0, fontSize: '13px', color: 'rgba(255,255,255,0.85)', lineHeight: '1.5' }}>
              ¿Quieres ser parte de nuestra familia deportiva?<br />Conoce nuestros programas y catálogo de servicios.
            </p>
            <button className="btn-contacto" onClick={() => alert('Gracias por tu interés. Un representante del Club Centro de Cultura Física se pondrá en contacto contigo pronto.')}>
              Contáctanos, haz clic acá
            </button>
          </div>
        </div>
      )}

      {vistaPublica === 'resultados' && (
        <div className="fade-in">
          <h3 className="section-title mt-20">Ultimos Resultados</h3>
          {partidos.length === 0 ? (
            <div className="card" style={{ borderRadius: '24px', boxShadow: '0 12px 28px rgba(15,23,42,0.06)' }}>
              <p style={{ margin: 0, fontSize: '13px', color: 'var(--texto-secundario)' }}>No hay resultados publicados aún.</p>
            </div>
          ) : (
            <ResultadosCards partidos={partidos} />
          )}
        </div>
      )}
    </>
  );
}

export default PublicFacadePanel;
