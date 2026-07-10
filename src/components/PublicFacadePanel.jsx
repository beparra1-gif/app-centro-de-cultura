import { Bell, ChevronLeft, Lock, QrCode, User } from 'lucide-react';
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
  mockComunicaciones,
  mockFotos,
  partidosPrueba,
}) {
  return (
    <>
      {vistaPublica === 'inicio' && (
        <div className="text-center login-card-main hero-panel">
          <span className="hero-badge">Portal Oficial</span>
          <div className="escudo-club-login">Escudo</div>
          <h2 className="hero-title">Centro de Cultura Fisica<br /><span style={{ fontSize: '72%', fontWeight: '800', opacity: 0.85 }}>Vina Del Mar</span></h2>

          {!mostrarFormularioLogin ? (
            <div className="login-botones-iniciales">
              <button className="btn-electric" onClick={() => abrirFormularioLogin('socios')}>
                <User size={18} /> Acceso Socios y Staff
              </button>
              <button className="btn-secondary mt-15" onClick={() => abrirFormularioLogin('invitado')}>
                <QrCode size={18} /> Entrar como Visitante
              </button>
              <button className="btn-whatsapp mt-15" onClick={() => window.open('https://wa.me/56953297869?text=Hola!%20Quiero%20conocer%20mas%20sobre%20el%20Club%20Centro%20de%20Cultura%20Fisica%20de%20Vina%20del%20Mar', '_blank')}>
                Quieres ser parte del Club?
              </button>
            </div>
          ) : (
            <form className="login-form-real fade-in" onSubmit={handleLoginSubmit}>
              <h4 className="login-form-title">
                {tipoLoginSeleccionado === 'invitado' ? 'Portal Invitados' : 'Acceso Oficial'}
              </h4>
              <div className="input-group-login">
                <User size={18} color="var(--texto-secundario)" />
                <input type="text" placeholder="RUT" value={rutInput} onChange={e => setRutInput(e.target.value)} required />
              </div>
              <div className="input-group-login mt-10">
                <Lock size={18} color="var(--texto-secundario)" />
                <input type="password" placeholder="Contrasena" value={passInput} onChange={e => setPassInput(e.target.value)} required />
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
          {mockComunicaciones.filter(c => c.publico).map(c => (
            <div key={c.id} className="ios-rrss-card fade-in">
              <div className="ios-rrss-header">
                <span className="badge-tipo">{c.TIPO_COMUNICADO}</span>
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
          <div className="fotos-grid mb-20">
            {mockFotos.map(foto => (
              <div key={foto.id} className="foto-card">
                <span className="foto-emoji">{foto.emoji}</span>
                <span className="foto-titulo">{foto.titulo}</span>
                <span className="foto-fecha">{foto.fecha}</span>
              </div>
            ))}
          </div>

          <div className="cta-contacto-card">
            <h3 style={{ margin: '0 0 6px 0', fontSize: '18px', fontWeight: '900' }}>Club Centro de Cultura Fisica</h3>
            <p style={{ margin: 0, fontSize: '13px', color: 'rgba(255,255,255,0.85)', lineHeight: '1.5' }}>
              Quieres ser parte de nuestra familia deportiva?<br />Conoce nuestros programas y catalogo de servicios.
            </p>
            <button className="btn-contacto" onClick={() => alert('Gracias por tu interes! Un representante del Club Centro de Cultura Fisica se pondra en contacto contigo pronto.')}>
              Contactanos, haz clic aca!
            </button>
          </div>
        </div>
      )}

      {vistaPublica === 'resultados' && (
        <div className="fade-in">
          <h3 className="section-title mt-20">Ultimos Resultados</h3>
          <ResultadosCards partidos={partidosPrueba} />
        </div>
      )}
    </>
  );
}

export default PublicFacadePanel;
