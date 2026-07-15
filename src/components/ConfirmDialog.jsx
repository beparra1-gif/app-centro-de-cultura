import { useEffect, useState } from 'react';
import { AlertTriangle, HelpCircle } from 'lucide-react';
import { subscribeConfirmDialog } from '../utils/confirmDialog';

function ConfirmDialog() {
  const [pedido, setPedido] = useState(null);

  useEffect(() => subscribeConfirmDialog(setPedido), []);

  if (!pedido) return null;

  const { title, message, confirmText, cancelText, danger, resolve } = pedido;

  const cerrar = (valor) => {
    resolve(valor);
    setPedido(null);
  };

  const Icono = danger ? AlertTriangle : HelpCircle;
  const colorAcento = danger ? 'var(--rojo-alerta)' : 'var(--azul-electrico)';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(10, 15, 25, 0.45)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1200,
        padding: '20px',
      }}
      onClick={() => cerrar(false)}
    >
      <div
        onClick={(e) => e.stopPropagation()}
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
