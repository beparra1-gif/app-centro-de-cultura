import { useEffect, useState } from 'react';
import { CheckCircle2, AlertTriangle, XCircle, Info, X } from 'lucide-react';
import { subscribeToast } from '../utils/toast';

const ESTILO_POR_TIPO = {
  success: { color: 'var(--verde-victoria)', Icono: CheckCircle2 },
  error: { color: 'var(--rojo-alerta)', Icono: XCircle },
  warning: { color: 'var(--naranja-aviso)', Icono: AlertTriangle },
  info: { color: 'var(--azul-electrico)', Icono: Info },
};

function ToastContainer() {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    const unsubscribe = subscribeToast((toast) => {
      setToasts((prev) => [...prev, toast]);
      window.setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== toast.id));
      }, toast.duration);
    });
    return unsubscribe;
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: '78px',
        right: '16px',
        left: '16px',
        maxWidth: '320px',
        marginLeft: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        zIndex: 1100,
        pointerEvents: 'none',
      }}
    >
      {toasts.map((toast) => {
        const { color, Icono } = ESTILO_POR_TIPO[toast.type] || ESTILO_POR_TIPO.info;
        return (
          <div
            key={toast.id}
            style={{
              pointerEvents: 'auto',
              background: 'linear-gradient(180deg, rgba(255,255,255,0.96) 0%, rgba(249,250,255,0.96) 100%)',
              borderRadius: 'var(--radius-lg)',
              boxShadow: '0 18px 40px rgba(10, 20, 35, 0.18)',
              padding: '12px 14px',
              border: '1px solid rgba(255,255,255,0.65)',
              borderLeft: `5px solid ${color}`,
              backdropFilter: 'blur(18px)',
              animation: 'slideInRight 0.4s ease',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '10px',
            }}
          >
            <Icono size={20} color={color} strokeWidth={2} style={{ flexShrink: 0, marginTop: '1px' }} />
            <p style={{ margin: 0, fontSize: '13px', fontWeight: '600', color: 'var(--texto-principal)', lineHeight: '1.4', flex: 1 }}>
              {toast.message}
            </p>
            <button
              onClick={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))}
              aria-label="Cerrar aviso"
              style={{
                background: 'rgba(120,120,128,0.12)',
                border: 'none',
                width: '22px',
                height: '22px',
                borderRadius: 'var(--radius-pill)',
                cursor: 'pointer',
                color: 'var(--texto-secundario)',
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <X size={12} strokeWidth={2.5} />
            </button>
          </div>
        );
      })}
    </div>
  );
}

export default ToastContainer;
