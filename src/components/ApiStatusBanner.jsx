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
        borderRadius: '12px',
        padding: '10px 12px',
        zIndex: 1200,
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px',
      }}
    >
      <div style={{ fontSize: '12px', lineHeight: 1.35 }}>
        <strong style={{ display: 'block' }}>Modo demo activo</strong>
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
          borderRadius: '8px',
          padding: '8px 10px',
          background: retrying ? 'rgba(0,0,0,0.15)' : 'var(--azul-electrico)',
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
