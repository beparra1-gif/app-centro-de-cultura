import SaludTimelinePanel from './SaludTimelinePanel';

function SaludDashboardPanel({
  scoreActual,
  saludDelSistema,
  comunicacionesCount,
  engagementTotal,
  alertasCount,
}) {
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '15px' }}>
        <div className="card" style={{ textAlign: 'center', background: 'linear-gradient(135deg, rgba(0,122,255,0.15), rgba(52,199,89,0.15))', borderTop: '3px solid var(--azul-electrico)' }}>
          <h6 style={{ margin: '0 0 8px 0', fontSize: '11px', fontWeight: '600', color: 'var(--texto-secundario)' }}>SALUD DEL SISTEMA</h6>
          <div style={{ fontSize: '48px', fontWeight: '900', color: 'var(--azul-electrico)' }}>
            {scoreActual}
          </div>
          <span style={{ fontSize: '22px' }}>{saludDelSistema.emoji || '🟢'}</span>
          <p style={{ margin: '6px 0 0 0', fontSize: '11px', color: 'var(--texto-principal)', fontWeight: '600' }}>
            {saludDelSistema.estado || 'Optimo'}
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateRows: '1fr 1fr', gap: '12px' }}>
          <div className="card" style={{ padding: '10px', textAlign: 'center', background: 'rgba(0,122,255,0.05)', borderLeft: '3px solid var(--azul-electrico)' }}>
            <p style={{ margin: '0 0 4px 0', fontSize: '10px', fontWeight: '600', color: 'var(--texto-secundario)' }}>Socios Activos</p>
            <p style={{ margin: 0, fontSize: '20px', fontWeight: '800', color: 'var(--azul-electrico)' }}>12/15</p>
          </div>
          <div className="card" style={{ padding: '10px', textAlign: 'center', background: 'rgba(52,199,89,0.05)', borderLeft: '3px solid #34C759' }}>
            <p style={{ margin: '0 0 4px 0', fontSize: '10px', fontWeight: '600', color: 'var(--texto-secundario)' }}>Comunicaciones</p>
            <p style={{ margin: 0, fontSize: '20px', fontWeight: '800', color: '#34C759' }}>{comunicacionesCount}</p>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '15px' }}>
        <div className="card" style={{ padding: '10px', textAlign: 'center', background: 'rgba(255,159,64,0.05)', borderLeft: '3px solid #FF9500' }}>
          <p style={{ margin: '0 0 4px 0', fontSize: '10px', fontWeight: '600', color: 'var(--texto-secundario)' }}>Engagement Total</p>
          <p style={{ margin: 0, fontSize: '20px', fontWeight: '800', color: '#FF9500' }}>
            {engagementTotal}
          </p>
        </div>
        <div className="card" style={{ padding: '10px', textAlign: 'center', background: 'rgba(255,59,48,0.05)', borderLeft: '3px solid #FF3B30' }}>
          <p style={{ margin: '0 0 4px 0', fontSize: '10px', fontWeight: '600', color: 'var(--texto-secundario)' }}>Alertas Activas</p>
          <p style={{ margin: 0, fontSize: '20px', fontWeight: '800', color: '#FF3B30' }}>{alertasCount}</p>
        </div>
      </div>

      <SaludTimelinePanel />
    </div>
  );
}

export default SaludDashboardPanel;
