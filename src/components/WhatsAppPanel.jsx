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
    <div className="floating-panel whatsapp-panel" style={{ position: 'fixed', top: '90px', right: '15px', width: '380px', background: 'var(--blanco-tarjeta)', borderRadius: '16px', boxShadow: '0 10px 40px rgba(0,0,0,0.2)', zIndex: 997, padding: '20px', maxHeight: '80vh', overflowY: 'auto', animation: 'slideInRight 0.4s ease' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
        <h4 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: 'var(--texto-principal)' }}>💬 WhatsApp</h4>
        <button onClick={() => setMostrarWhatsAppPanel(false)} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer' }}>✕</button>
      </div>

      <div style={{ display: 'flex', gap: '6px', marginBottom: '15px', borderBottom: '1px solid var(--borde-suave)', paddingBottom: '12px' }}>
        <button onClick={() => setMostrarWhatsAppPanel('enviar')} style={{ flex: 1, padding: '6px', borderRadius: '6px', background: 'rgba(52,199,89,0.2)', color: '#34C759', fontSize: '11px', fontWeight: '700', border: '1px solid #34C759', cursor: 'pointer' }}>📤 Enviar</button>
        <button onClick={() => setMostrarHistorialWA(true)} style={{ flex: 1, padding: '6px', borderRadius: '6px', background: 'rgba(0,122,255,0.1)', color: 'var(--azul-electrico)', fontSize: '11px', fontWeight: '700', border: '1px solid rgba(0,122,255,0.3)', cursor: 'pointer' }}>📜 Historial</button>
        <button onClick={() => setMostrarWhatsAppPanel('contactos')} style={{ flex: 1, padding: '6px', borderRadius: '6px', background: 'rgba(255,159,64,0.1)', color: '#FF9500', fontSize: '11px', fontWeight: '700', border: '1px solid rgba(255,159,64,0.3)', cursor: 'pointer' }}>👥 Contactos</button>
      </div>

      {mostrarWhatsAppPanel === 'enviar' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div>
            <label style={{ fontSize: '11px', fontWeight: '700', color: 'var(--texto-principal)', display: 'block', marginBottom: '4px' }}>Destinatario</label>
            <select
              style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--borde-suave)', fontSize: '12px', background: 'var(--blanco-tarjeta)', color: 'var(--texto-principal)' }}
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
            <select value={templateMensaje} onChange={e => setTemplateMensaje(e.target.value)} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--borde-suave)', fontSize: '12px', background: 'var(--blanco-tarjeta)', color: 'var(--texto-principal)' }}>
              <option value="alerta">🚨 Alerta Crítica</option>
              <option value="pago">💳 Confirmación Pago</option>
              <option value="confirmacion">✅ Confirmación General</option>
              <option value="general">📝 Personalizado</option>
            </select>
          </div>

          {templateMensaje === 'general' && (
            <div>
              <label style={{ fontSize: '11px', fontWeight: '700', color: 'var(--texto-principal)', display: 'block', marginBottom: '4px' }}>Tu Mensaje</label>
              <textarea value={mensajeCustomWA} onChange={e => setMensajeCustomWA(e.target.value)} placeholder="Escribe tu mensaje..." style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--borde-suave)', fontSize: '12px', background: 'var(--blanco-tarjeta)', color: 'var(--texto-principal)', minHeight: '80px', fontFamily: 'inherit', resize: 'vertical' }} />
            </div>
          )}

          {templateMensaje !== 'general' && (
            <div style={{ background: 'rgba(0,0,0,0.02)', padding: '10px', borderRadius: '8px', fontSize: '11px', color: 'var(--texto-principal)', lineHeight: '1.5', whiteSpace: 'pre-wrap', fontFamily: 'monospace' }}>
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
            style={{ padding: '10px', borderRadius: '6px', border: 'none', background: '#34C759', color: 'white', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}
          >
            ✓ Enviar por WhatsApp
          </button>
        </div>
      )}

      {mostrarWhatsAppPanel === 'contactos' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <h5 style={{ margin: '0 0 8px 0', fontSize: '13px', fontWeight: '700', color: 'var(--texto-principal)' }}>Gestionar Contactos</h5>

          <div>
            <input type="text" placeholder="Nombre" value={nuevoContactoWA.nombre} onChange={e => setNuevoContactoWA({ ...nuevoContactoWA, nombre: e.target.value })} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--borde-suave)', fontSize: '12px', marginBottom: '6px', background: 'var(--blanco-tarjeta)', color: 'var(--texto-principal)' }} />
            <input type="text" placeholder="Número (+56 o 9XXXX)" value={nuevoContactoWA.numero} onChange={e => setNuevoContactoWA({ ...nuevoContactoWA, numero: e.target.value })} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--borde-suave)', fontSize: '12px', marginBottom: '6px', background: 'var(--blanco-tarjeta)', color: 'var(--texto-principal)' }} />
            <button onClick={agregarContactoWhatsApp} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: 'none', background: 'rgba(52,199,89,0.2)', color: '#34C759', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}>+ Agregar Contacto</button>
          </div>

          <div style={{ marginTop: '10px', borderTop: '1px solid var(--borde-suave)', paddingTop: '10px' }}>
            {contactosWhatsApp.map(c => (
              <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px', background: 'rgba(0,0,0,0.02)', borderRadius: '6px', marginBottom: '6px', fontSize: '11px' }}>
                <div>
                  <p style={{ margin: '0 0 2px 0', fontWeight: '700', color: 'var(--texto-principal)' }}>{c.nombre}</p>
                  <p style={{ margin: 0, fontSize: '10px', color: 'var(--texto-secundario)' }}>{c.numero}</p>
                </div>
                <button onClick={() => eliminarContactoWhatsApp(c.id)} style={{ background: 'rgba(255,59,48,0.2)', border: '1px solid rgba(255,59,48,0.3)', color: '#FF3B30', padding: '4px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: '700', cursor: 'pointer' }}>Eliminar</button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default WhatsAppPanel;
