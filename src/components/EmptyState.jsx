import { Inbox } from 'lucide-react';

function EmptyState({ icon: Icono = Inbox, titulo = 'Sin datos', mensaje = '', accion = null }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: '40px 20px',
        color: 'var(--texto-secundario)',
      }}
    >
      <div
        style={{
          width: '56px',
          height: '56px',
          borderRadius: 'var(--radius-pill)',
          background: 'var(--fondo-input, rgba(120,120,128,0.10))',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '14px',
        }}
      >
        <Icono size={26} color="var(--gris-secundario)" strokeWidth={1.5} />
      </div>
      <h4 style={{ margin: '0 0 6px', fontSize: '15px', color: 'var(--texto-principal)' }}>{titulo}</h4>
      {mensaje && (
        <p style={{ margin: 0, fontSize: '13px', lineHeight: '1.5', maxWidth: '260px' }}>{mensaje}</p>
      )}
      {accion && <div style={{ marginTop: '16px' }}>{accion}</div>}
    </div>
  );
}

export default EmptyState;
