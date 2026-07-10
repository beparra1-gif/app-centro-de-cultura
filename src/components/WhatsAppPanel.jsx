function WhatsAppPanel({
  mostrarWhatsAppPanel,
  setMostrarWhatsAppPanel,
  setMostrarHistorialWA,
  contactosWhatsApp,
  setPhoneNumberToValidate,
  templateMensaje,
  setTemplateMensaje,
  mensajeCustomWA,
  setMensajeCustomWA,
  obtenerTemplateWhatsApp,
  phoneNumberToValidate,
  enviarPorWhatsApp,
  nuevoContactoWA,
  setNuevoContactoWA,
  agregarContactoWhatsApp,
  eliminarContactoWhatsApp,
}) {
  return (
    <div className="floating-panel whatsapp-panel" style={{ position: 'fixed', top: '90px', right: '15px', width: '380px', background: 'linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(248,250,255,0.96) 100%)', borderRadius: '24px', boxShadow: '0 18px 44px rgba(0,0,0,0.18)', zIndex: 997, padding: '20px', maxHeight: '80vh', overflowY: 'auto', animation: 'slideInRight 0.4s ease', border: '1px solid rgba(255,255,255,0.72)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
        <h4 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: 'var(--texto-principal)' }}>💬 WhatsApp</h4>
        <button onClick={() => setMostrarWhatsAppPanel(false)} style={{ background: 'rgba(120,120,128,0.10)', border: 'none', fontSize: '20px', cursor: 'pointer', width: '34px', height: '34px', borderRadius: '999px' }}>✕</button>
      </div>

      <div style={{ display: 'flex', gap: '6px', marginBottom: '15px', borderBottom: '1px solid var(--borde-suave)', paddingBottom: '12px', flexWrap: 'wrap' }}>
        <button onClick={() => setMostrarWhatsAppPanel('enviar')} style={{ flex: 1, padding: '8px 10px', borderRadius: '14px', background: 'rgba(52,199,89,0.16)', color: '#1F9D55', fontSize: '11px', fontWeight: '800', border: '1px solid rgba(52,199,89,0.25)', cursor: 'pointer' }}>📤 Enviar</button>
        <button onClick={() => setMostrarHistorialWA(true)} style={{ flex: 1, padding: '8px 10px', borderRadius: '14px', background: 'rgba(0,122,255,0.1)', color: 'var(--azul-electrico)', fontSize: '11px', fontWeight: '800', border: '1px solid rgba(0,122,255,0.16)', cursor: 'pointer' }}>📜 Historial</button>
        <button onClick={() => setMostrarWhatsAppPanel('contactos')} style={{ flex: 1, padding: '8px 10px', borderRadius: '14px', background: 'rgba(255,159,64,0.1)', color: '#D97706', fontSize: '11px', fontWeight: '800', border: '1px solid rgba(255,159,64,0.18)', cursor: 'pointer' }}>👥 Contactos</button>
      </div>

      {mostrarWhatsAppPanel === 'enviar' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div>
            <label style={{ fontSize: '11px', fontWeight: '700', color: 'var(--texto-principal)', display: 'block', marginBottom: '4px' }}>Destinatario</label>
            <select
              className="form-input"
              style={{ width: '100%', fontSize: '12px', borderRadius: '14px' }}
              onChange={e => setPhoneNumberToValidate(e.target.value)}
            >
              <option value="">-- Seleccionar --</option>
              {contactosWhatsApp.filter(c => c.activo).map(c => (
                <option key={c.id} value={c.numero}>{c.nombre} ({c.numero})</option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ fontSize: '11px', fontWeight: '700', color: 'var(--texto-principal)', display: 'block', marginBottom: '4px' }}>Tipo de Mensaje</label>
            <select value={templateMensaje} onChange={e => setTemplateMensaje(e.target.value)} className="form-input" style={{ width: '100%', fontSize: '12px', borderRadius: '14px' }}>
              <option value="alerta">🚨 Alerta Crítica</option>
              <option value="pago">💳 Confirmación Pago</option>
              <option value="confirmacion">✅ Confirmación General</option>
              <option value="general">📝 Personalizado</option>
            </select>
          </div>

          {templateMensaje === 'general' && (
            <div>
              <label style={{ fontSize: '11px', fontWeight: '700', color: 'var(--texto-principal)', display: 'block', marginBottom: '4px' }}>Tu Mensaje</label>
              <textarea value={mensajeCustomWA} onChange={e => setMensajeCustomWA(e.target.value)} placeholder="Escribe tu mensaje..." className="form-input" style={{ width: '100%', fontSize: '12px', borderRadius: '14px', minHeight: '80px', fontFamily: 'inherit', resize: 'vertical' }} />
            </div>
          )}

          {templateMensaje !== 'general' && (
            <div style={{ background: 'rgba(0,0,0,0.02)', padding: '12px', borderRadius: '16px', fontSize: '11px', color: 'var(--texto-principal)', lineHeight: '1.5', whiteSpace: 'pre-wrap', fontFamily: 'monospace' }}>
              {obtenerTemplateWhatsApp(templateMensaje, { alertas: 2, monto: 45000, fecha: '09/07/2026' })}
            </div>
          )}

          <button
            onClick={() => {
              if (!phoneNumberToValidate) {
                alert('Selecciona un destinatario');
                return;
              }
              enviarPorWhatsApp(phoneNumberToValidate, obtenerTemplateWhatsApp(templateMensaje, { alertas: 2, monto: 45000, fecha: '09/07/2026' }), templateMensaje);
              setPhoneNumberToValidate('');
              setMensajeCustomWA('');
              setMostrarWhatsAppPanel(false);
            }}
            style={{ padding: '10px', borderRadius: '14px', border: 'none', background: 'linear-gradient(180deg, #34C759 0%, #1F9D55 100%)', color: 'white', fontSize: '12px', fontWeight: '800', cursor: 'pointer' }}
          >
            ✓ Enviar por WhatsApp
          </button>
        </div>
      )}

      {mostrarWhatsAppPanel === 'contactos' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <h5 style={{ margin: '0 0 8px 0', fontSize: '13px', fontWeight: '700', color: 'var(--texto-principal)' }}>Gestionar Contactos</h5>

          <div>
            <input type="text" placeholder="Nombre" value={nuevoContactoWA.nombre} onChange={e => setNuevoContactoWA({ ...nuevoContactoWA, nombre: e.target.value })} className="form-input" style={{ width: '100%', fontSize: '12px', marginBottom: '6px', borderRadius: '14px' }} />
            <input type="text" placeholder="Número (+56 o 9XXXX)" value={nuevoContactoWA.numero} onChange={e => setNuevoContactoWA({ ...nuevoContactoWA, numero: e.target.value })} className="form-input" style={{ width: '100%', fontSize: '12px', marginBottom: '6px', borderRadius: '14px' }} />
            <button onClick={agregarContactoWhatsApp} style={{ width: '100%', padding: '10px', borderRadius: '14px', border: 'none', background: 'rgba(52,199,89,0.16)', color: '#1F9D55', fontSize: '11px', fontWeight: '800', cursor: 'pointer' }}>+ Agregar Contacto</button>
          </div>

          <div style={{ marginTop: '10px', borderTop: '1px solid var(--borde-suave)', paddingTop: '10px' }}>
            {contactosWhatsApp.map(c => (
              <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px', background: 'rgba(0,0,0,0.02)', borderRadius: '16px', marginBottom: '6px', fontSize: '11px' }}>
                <div>
                  <p style={{ margin: '0 0 2px 0', fontWeight: '700', color: 'var(--texto-principal)' }}>{c.nombre}</p>
                  <p style={{ margin: 0, fontSize: '10px', color: 'var(--texto-secundario)' }}>{c.numero}</p>
                </div>
                <button onClick={() => eliminarContactoWhatsApp(c.id)} style={{ background: 'rgba(255,59,48,0.16)', border: '1px solid rgba(255,59,48,0.18)', color: '#FF3B30', padding: '6px 10px', borderRadius: '999px', fontSize: '10px', fontWeight: '800', cursor: 'pointer' }}>Eliminar</button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default WhatsAppPanel;
