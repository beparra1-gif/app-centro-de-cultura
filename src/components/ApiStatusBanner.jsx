function ApiStatusBanner({
  visible,
  message,
  retrying,
  onRetry,
}) {
  if (!visible) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: '74px',
        left: '50%',
        transform: 'translateX(-50%)',
        width: 'min(92%, 680px)',
        background: 'rgba(255,149,0,0.14)',
        border: '1px solid rgba(255,149,0,0.45)',
        color: 'var(--texto-principal)',
        borderRadius: '20px',
        padding: '12px 14px',
        zIndex: 1200,
        backdropFilter: 'blur(18px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px',
        boxShadow: '0 14px 34px rgba(15,23,42,0.12)',
      }}
    >
      <div style={{ fontSize: '12px', lineHeight: 1.35 }}>
        <strong style={{ display: 'block' }}>Modo sin conexión</strong>
        <span>
          Backend no disponible. Se muestran datos locales.
          {message ? ` (${message})` : ''}
        </span>
      </div>
      <button
        onClick={onRetry}
        disabled={retrying}
        style={{
          border: 'none',
          borderRadius: '999px',
          padding: '9px 12px',
          background: retrying ? 'rgba(0,0,0,0.15)' : 'linear-gradient(180deg, #2f8cff 0%, var(--azul-electrico) 100%)',
          color: 'white',
          fontSize: '12px',
          fontWeight: '700',
          cursor: retrying ? 'not-allowed' : 'pointer',
          whiteSpace: 'nowrap',
        }}
      >
        {retrying ? 'Reintentando...' : 'Reintentar'}
      </button>
    </div>
  );
}

export default ApiStatusBanner;
