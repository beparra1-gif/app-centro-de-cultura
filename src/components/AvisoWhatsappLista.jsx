import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, MessageCircle, X } from 'lucide-react';
import useModalAccesible from '../utils/useModalAccesible';

// Usuarios y Cuentas → "WhatsApp": mensaje a los apoderados (o cuentas) del
// listado filtrado. wa.me abre UNA conversación por toque (no hay envío
// masivo real sin WhatsApp Business), así que es una lista donde se va
// tocando "Abrir" uno por uno; el check solo recuerda a quién ya se abrió.
// {nombre} se reemplaza por el primer nombre de cada destinatario.

const numeroWsp = (telefono = '') => {
  const d = String(telefono || '').replace(/\D/g, '');
  if (d.startsWith('56') && d.length === 11) return d;
  if (d.length === 9 && d.startsWith('9')) return `56${d}`;
  if (d.length === 8) return `569${d}`;
  return d.length >= 10 ? d : '';
};

export default function AvisoWhatsappLista({ titulo, destinatarios = [], onCerrar }) {
  useModalAccesible(true, onCerrar);
  const [mensaje, setMensaje] = useState('Hola {nombre}, te escribimos del Club Centro de Cultura Física: ');
  const [abiertos, setAbiertos] = useState(() => new Set());
  const conNumero = destinatarios.filter((d) => numeroWsp(d.telefono));
  const sinNumero = destinatarios.length - conNumero.length;

  return createPortal(
    <div className="fp-fondo" onClick={onCerrar} role="presentation">
      <div className="fp-ventana" role="dialog" aria-modal="true" aria-labelledby="wsp-titulo" onClick={(e) => e.stopPropagation()}>
        <header className="fp-cabecera">
          <span className="tc-avatar" aria-hidden="true"><MessageCircle size={18} /></span>
          <div className="fp-cabecera-texto">
            <h3 id="wsp-titulo">{titulo}</h3>
            <p>{conNumero.length} con teléfono{sinNumero ? ` · ${sinNumero} sin teléfono (no aparecen)` : ''} · {abiertos.size} abiertos</p>
          </div>
          <button type="button" className="fp-cerrar" onClick={onCerrar} aria-label="Cerrar"><X size={20} /></button>
        </header>
        <div className="fp-cuerpo">
          <div className="form-group">
            <label htmlFor="wsp-mensaje">Mensaje ({'{nombre}'} se cambia por el nombre de cada uno)</label>
            <textarea id="wsp-mensaje" className="form-input" rows={4} value={mensaje} onChange={(e) => setMensaje(e.target.value)} />
          </div>
          {conNumero.length === 0 && <p className="tc-vacio">Nadie de este listado tiene teléfono registrado.</p>}
          <div className="wsp-lista">
            {conNumero.map((d) => {
              const texto = mensaje.replaceAll('{nombre}', String(d.nombre || '').split(' ')[0]);
              const listo = abiertos.has(d.clave);
              return (
                <div key={d.clave} className="wsp-fila">
                  <div>
                    <strong>{d.nombre}</strong>
                    <small>{[d.telefono, d.detalle].filter(Boolean).join(' · ')}</small>
                  </div>
                  <a
                    className={`btn-secondary tc-btn ${listo ? 'wsp-listo' : ''}`}
                    href={`https://wa.me/${numeroWsp(d.telefono)}?text=${encodeURIComponent(texto)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setAbiertos((prev) => new Set(prev).add(d.clave))}
                  >
                    {listo ? <><Check size={13} /> Abierto</> : 'Abrir WhatsApp'}
                  </a>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
