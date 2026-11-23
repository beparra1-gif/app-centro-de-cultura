import { useState } from 'react';
import { Check, Copy, MessageCircle } from 'lucide-react';
import { showToast } from '../utils/toast';
import { telefonoParaWhatsApp } from '../utils/codigoActivacion';
import { esBanca, mensajeGrupoCitacion, mensajeWhatsappCitacion, urlRespuestaCitacion } from '../utils/citaciones';

// Envío por WhatsApp de una citación: un mensaje personal por apoderado con
// su enlace directo para confirmar o rechazar (con motivo), y un mensaje para
// el grupo de la categoría con la nómina.

const copiar = async (texto, ok) => {
  try {
    await navigator.clipboard.writeText(texto);
    showToast({ message: ok, type: 'success' });
  } catch {
    showToast({ message: 'No se pudo copiar: selecciona y copia el texto a mano.', type: 'error' });
  }
};

const ETIQUETA_RESPUESTA = { si: 'Confirmó', no: 'No asiste', pendiente: 'Sin responder' };

export default function CitacionWhatsapp({ cita, soloPendientes: soloPendientesInicial = false }) {
  const [abiertos, setAbiertos] = useState(() => new Set());
  const [soloPendientes, setSoloPendientes] = useState(soloPendientesInicial);
  const convocados = (cita?.convocados || []).filter((c) => !soloPendientes || c.respuesta === 'pendiente');
  const grupo = mensajeGrupoCitacion(cita);

  return (
    <div data-testid="citacion-whatsapp" style={{ marginTop: '10px', border: '1px solid rgba(37,211,102,0.45)', background: 'rgba(37,211,102,0.06)', borderRadius: 'var(--radius-md)', padding: '10px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
        <strong style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}><MessageCircle size={15} /> Enviar por WhatsApp</strong>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          <a className="btn-secondary tc-btn" href={`https://wa.me/?text=${encodeURIComponent(grupo)}`} target="_blank" rel="noopener noreferrer">Mensaje al grupo</a>
          <button type="button" className="btn-secondary tc-btn" onClick={() => copiar(grupo, 'Mensaje del grupo copiado.')}><Copy size={13} /> Copiar</button>
        </div>
      </div>
      <p className="pf-ayuda" style={{ marginTop: '6px' }}>
        Cada apoderado recibe su enlace para confirmar o indicar el motivo, sin iniciar sesión. Los deportistas solo confirman si son autogestionados.
      </p>
      <label className="checkbox-label-row" style={{ margin: '4px 0 8px' }}>
        <input type="checkbox" checked={soloPendientes} onChange={(e) => setSoloPendientes(e.target.checked)} /> Solo quienes no han respondido (recordatorio)
      </label>
      {convocados.length === 0 && <p className="text-muted" style={{ fontSize: '12px', margin: 0 }}>Todos respondieron.</p>}
      <div style={{ display: 'grid', gap: '6px' }}>
        {convocados.map((c) => {
          const numero = telefonoParaWhatsApp(c.apoderado_telefono);
          const mensaje = mensajeWhatsappCitacion(cita, c);
          const clave = c.rut_jugador;
          return (
            <div key={clave} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flexWrap: 'wrap', background: 'var(--blanco-tarjeta)', borderRadius: 'var(--radius-sm)', padding: '6px 8px' }}>
              <div style={{ fontSize: '12px' }}>
                <b>{c.nombre}</b>{esBanca(c) ? ' · banca' : ''} · {ETIQUETA_RESPUESTA[c.respuesta] || c.respuesta}
                <div className="pf-ayuda" style={{ marginTop: 0 }}>{c.apoderado_nombre || 'Apoderado sin cuenta'}{numero ? ` · +${numero}` : ' · sin teléfono'}</div>
              </div>
              <div style={{ display: 'flex', gap: '6px' }}>
                {numero ? (
                  <a
                    className={`btn-electric tc-btn ${abiertos.has(clave) ? 'wsp-listo' : ''}`}
                    href={`https://wa.me/${numero}?text=${encodeURIComponent(mensaje)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setAbiertos((prev) => new Set(prev).add(clave))}
                  >
                    {abiertos.has(clave) ? <><Check size={13} /> Enviado</> : 'WhatsApp'}
                  </a>
                ) : (
                  <button type="button" className="btn-secondary tc-btn" onClick={() => copiar(mensaje, `Mensaje para ${c.nombre} copiado.`)}><Copy size={13} /> Copiar mensaje</button>
                )}
                <button type="button" className="btn-secondary tc-btn" aria-label={`Copiar enlace de ${c.nombre}`} onClick={() => copiar(urlRespuestaCitacion(c.token_respuesta), 'Enlace copiado.')}><Copy size={13} /> Enlace</button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
