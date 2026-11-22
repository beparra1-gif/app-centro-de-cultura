import { useEffect, useState } from 'react';
import { AlertTriangle, HelpCircle } from 'lucide-react';
import { subscribeConfirmDialog } from '../utils/confirmDialog';
import useModalAccesible from '../utils/useModalAccesible';

function ConfirmDialog() {
  const [pedido, setPedido] = useState(null);
  const [texto, setTexto] = useState('');

  useEffect(() => subscribeConfirmDialog((p) => { setTexto(''); setPedido(p); }), []);
  // Escape = Cancelar.
  useModalAccesible(Boolean(pedido), () => {
    if (!pedido) return;
    pedido.resolve(false);
    setPedido(null);
  });

  if (!pedido) return null;

  const { title, message, confirmText, cancelText, danger, pedirTexto, resolve } = pedido;

  const cerrar = (valor) => {
    resolve(valor && pedirTexto ? texto.trim() : valor);
    setPedido(null);
  };

  const Icono = danger ? AlertTriangle : HelpCircle;
  const colorAcento = danger ? 'var(--rojo-alerta)' : 'var(--azul-electrico)';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="modal-animado-fondo"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(10, 15, 25, 0.45)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        // Siempre por encima de cualquier ventana (fichas, edición: 1200).
        zIndex: 2000,
        padding: '20px',
      }}
      onClick={() => cerrar(false)}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="modal-animado"
        style={{
          background: 'var(--blanco-tarjeta)',
          borderRadius: 'var(--radius-lg)',
          padding: '24px 20px 20px',
          maxWidth: '340px',
          width: '100%',
          boxShadow: '0 25px 60px rgba(0,0,0,0.3)',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            width: '52px',
            height: '52px',
            borderRadius: 'var(--radius-pill)',
            background: `${colorAcento}1A`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 14px',
          }}
        >
          <Icono size={26} color={colorAcento} strokeWidth={2} />
        </div>
        <h4 style={{ margin: '0 0 8px', fontSize: '17px', color: 'var(--texto-principal)' }}>{title}</h4>
        <p style={{ margin: '0 0 20px', fontSize: '13px', color: 'var(--texto-secundario)', lineHeight: '1.5' }}>{message}</p>
        {pedirTexto && (
          <div className="form-group" style={{ textAlign: 'left', margin: '-8px 0 16px' }}>
            <label htmlFor="confirm-texto">{pedirTexto.etiqueta}</label>
            <input
              id="confirm-texto"
              className="form-input"
              value={texto}
              maxLength={300}
              placeholder={pedirTexto.placeholder || ''}
              onChange={(e) => setTexto(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') cerrar(true); }}
            />
          </div>
        )}
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={() => cerrar(false)}
            style={{
              flex: 1,
              padding: '12px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--borde-suave)',
              background: 'transparent',
              color: 'var(--texto-principal)',
              fontWeight: '700',
              cursor: 'pointer',
            }}
          >
            {cancelText}
          </button>
          <button
            onClick={() => cerrar(true)}
            style={{
              flex: 1,
              padding: '12px',
              borderRadius: 'var(--radius-md)',
              border: 'none',
              background: colorAcento,
              color: 'white',
              fontWeight: '700',
              cursor: 'pointer',
            }}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ConfirmDialog;
