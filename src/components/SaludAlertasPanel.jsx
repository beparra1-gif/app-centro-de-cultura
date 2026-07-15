import { AlertCircle } from 'lucide-react';

function SaludAlertasPanel({ alertas }) {
  return (
    <div style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(248,250,255,0.96) 100%)', borderRadius: '24px', padding: '18px', marginTop: '15px', boxShadow: '0 12px 28px rgba(15,23,42,0.06)', border: '1px solid rgba(255,255,255,0.72)' }}>
      <h6 style={{ margin: '0 0 12px 0', fontSize: '13px', fontWeight: '900', color: 'var(--texto-principal)' }}>Alertas Inteligentes ({alertas.length})</h6>

      {alertas.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '20px' }}>
          <p style={{ margin: 0, fontSize: '14px', color: 'var(--texto-secundario)' }}>No hay alertas criticas</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {alertas.map(alerta => (
            <div
              key={alerta.id}
              style={{
                background: alerta.urgencia === 'Crítica'
                  ? 'rgba(255,59,48,0.08)'
                  : alerta.urgencia === 'Alta'
                    ? 'rgba(255,159,64,0.08)'
                    : 'rgba(52,199,89,0.08)',
                borderLeft: alerta.urgencia === 'Crítica'
                  ? '4px solid var(--rojo-alerta)'
                  : alerta.urgencia === 'Alta'
                    ? '4px solid #FF9500'
                    : '4px solid #34C759',
                padding: '12px',
                borderRadius: '18px',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '10px',
                boxShadow: '0 8px 18px rgba(15,23,42,0.04)'
              }}
            >
              <AlertCircle
                size={18}
                style={{ marginTop: '2px', flexShrink: 0 }}
                color={alerta.urgencia === 'Crítica' ? 'var(--rojo-alerta)' : alerta.urgencia === 'Alta' ? '#FF9500' : '#FFD60A'}
              />
              <div style={{ flex: 1 }}>
                <p style={{ margin: '0 0 4px 0', fontSize: '12px', fontWeight: '700', color: 'var(--texto-principal)' }}>
                  {alerta.titulo}
                </p>
                <p style={{ margin: '0', fontSize: '11px', color: 'var(--texto-secundario)', lineHeight: '1.4' }}>
                  {alerta.descripcion}
                </p>
                <span style={{ fontSize: '11px', color: 'var(--texto-secundario)', marginTop: '6px', display: 'block' }}>
                  {alerta.timestamp.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default SaludAlertasPanel;
