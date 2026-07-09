export default function ReportesPanel({
  calcularReportes,
  vistaReportes,
  setVistaReportes,
  filtroReporteFecha,
  setFiltroReporteFecha,
  filtroReporteRama,
  setFiltroReporteRama,
  setMostrarHistorialNotif,
  exportarReportePDF,
  renderGraficoSVG,
}) {
  const reportes = calcularReportes();
  const totalEngagement = reportes.totalComentarios + reportes.totalReacciones + reportes.totalRSVP;

  return (
    <div className="mt-20">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
        <h4 style={{ color: 'var(--texto-heading)', margin: 0, fontSize: '18px', fontWeight: '800' }}>📊 Reportes de Actividad</h4>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button onClick={() => setMostrarHistorialNotif(true)} style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--borde-suave)', background: 'var(--blanco-tarjeta)', color: 'var(--texto-principal)', fontSize: '12px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
            📜 Historial
          </button>
          <button onClick={exportarReportePDF} style={{ padding: '8px 12px', borderRadius: '6px', border: 'none', background: 'var(--azul-electrico)', color: 'white', fontSize: '12px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
            📥 Exportar
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '10px', marginBottom: '15px' }}>
        <select value={filtroReporteFecha} onChange={(e) => setFiltroReporteFecha(e.target.value)} style={{ padding: '8px', borderRadius: '6px', border: '1px solid var(--borde-suave)', fontSize: '12px' }}>
          <option value="semana">📅 Esta semana</option>
          <option value="mes">📆 Este mes</option>
          <option value="todos">🕐 Todo el tiempo</option>
        </select>
        <select value={filtroReporteRama} onChange={(e) => setFiltroReporteRama(e.target.value)} style={{ padding: '8px', borderRadius: '6px', border: '1px solid var(--borde-suave)', fontSize: '12px' }}>
          <option value="General">General</option>
          <option value="Femenina">Rama Femenina</option>
          <option value="Masculina">Rama Masculina</option>
        </select>
      </div>

      <div className="segment-control mb-20" style={{ background: 'var(--blanco-tarjeta)', flexWrap: 'wrap', gap: '4px' }}>
        <div className={`segment-btn ${vistaReportes === 'engagement' ? 'active' : ''}`} onClick={() => setVistaReportes('engagement')} style={{ flex: '1 1 150px' }}>
          📈 Engagement
        </div>
        <div className={`segment-btn ${vistaReportes === 'comentaristas' ? 'active' : ''}`} onClick={() => setVistaReportes('comentaristas')} style={{ flex: '1 1 150px' }}>
          💬 Top Comentaristas
        </div>
        <div className={`segment-btn ${vistaReportes === 'comunicaciones-top' ? 'active' : ''}`} onClick={() => setVistaReportes('comunicaciones-top')} style={{ flex: '1 1 150px' }}>
          🏆 Comunicaciones Top
        </div>
      </div>

      {vistaReportes === 'engagement' && (
        <div className="fade-in">
          {totalEngagement === 0 ? (
            <div className="card text-center" style={{ padding: '24px 14px' }}>
              <h5 style={{ margin: '0 0 8px 0', fontSize: '16px', color: 'var(--texto-principal)' }}>Sin datos de engagement aún</h5>
              <p style={{ margin: 0, fontSize: '13px', color: 'var(--texto-secundario)' }}>
                Publica comunicaciones o interactúa con reacciones/comentarios para ver métricas.
              </p>
            </div>
          ) : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '12px', marginBottom: '15px' }}>
                <div className="card" style={{ background: 'linear-gradient(135deg, rgba(0, 122, 255, 0.1), rgba(0, 122, 255, 0.05))', borderLeft: '4px solid var(--azul-electrico)' }}>
                  <h6 style={{ margin: '0 0 6px 0', fontSize: '11px', fontWeight: '600', color: 'var(--texto-secundario)' }}>💬 Comentarios</h6>
                  <h3 style={{ margin: 0, fontSize: '28px', fontWeight: '800', color: 'var(--azul-electrico)' }}>{reportes.totalComentarios}</h3>
                </div>
                <div className="card" style={{ background: 'linear-gradient(135deg, rgba(52, 199, 89, 0.1), rgba(52, 199, 89, 0.05))', borderLeft: '4px solid #34C759' }}>
                  <h6 style={{ margin: '0 0 6px 0', fontSize: '11px', fontWeight: '600', color: 'var(--texto-secundario)' }}>❤️ Reacciones</h6>
                  <h3 style={{ margin: 0, fontSize: '28px', fontWeight: '800', color: '#34C759' }}>{reportes.totalReacciones}</h3>
                </div>
                <div className="card" style={{ background: 'linear-gradient(135deg, rgba(255, 159, 64, 0.1), rgba(255, 159, 64, 0.05))', borderLeft: '4px solid #FF9500' }}>
                  <h6 style={{ margin: '0 0 6px 0', fontSize: '11px', fontWeight: '600', color: 'var(--texto-secundario)' }}>✓ RSVP</h6>
                  <h3 style={{ margin: 0, fontSize: '28px', fontWeight: '800', color: '#FF9500' }}>{reportes.totalRSVP}</h3>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '15px', marginBottom: '15px' }}>
                <div className="card" style={{ textAlign: 'center' }}>
                  <h6 style={{ margin: '0 0 10px 0', fontSize: '12px', fontWeight: '700', color: 'var(--texto-principal)' }}>📊 Gráfico Pie</h6>
                  {renderGraficoSVG('pie')}
                </div>
                <div className="card" style={{ textAlign: 'center' }}>
                  <h6 style={{ margin: '0 0 10px 0', fontSize: '12px', fontWeight: '700', color: 'var(--texto-principal)' }}>📈 Gráfico Barras</h6>
                  {renderGraficoSVG('bar')}
                </div>
              </div>

              <div style={{ marginTop: '15px', textAlign: 'center', padding: '15px', background: 'rgba(0,0,0,0.02)', borderRadius: '8px', fontSize: '13px', color: 'var(--texto-secundario)' }}>
                <p style={{ margin: 0 }}>📅 Período: {filtroReporteFecha === 'semana' ? 'Esta semana' : filtroReporteFecha === 'mes' ? 'Este mes' : 'Todo el tiempo'}</p>
                <p style={{ margin: '4px 0 0 0' }}>Total de Engagement: <strong style={{ color: 'var(--azul-electrico)' }}>{totalEngagement}</strong> interacciones</p>
              </div>
            </>
          )}
        </div>
      )}

      {vistaReportes === 'comentaristas' && (
        <div className="fade-in">
          {reportes.topComentaristas.length > 0 ? (
            <div>
              {reportes.topComentaristas.map((com, i) => (
                <div key={i} className="card mb-10" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ background: 'var(--azul-electrico)', color: 'white', width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '800', fontSize: '14px' }}>
                    {i + 1}
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ margin: 0, fontWeight: '700', color: 'var(--texto-principal)' }}>{com.usuario}</p>
                    <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: 'var(--texto-secundario)' }}>💬 {com.count} comentario{com.count !== 1 ? 's' : ''}</p>
                  </div>
                  <div style={{ background: 'linear-gradient(90deg, var(--azul-electrico), #34C759)', color: 'white', padding: '6px 12px', borderRadius: '12px', fontWeight: '700', fontSize: '12px' }}>
                    {com.count}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ textAlign: 'center', color: 'var(--texto-secundario)', fontSize: '13px' }}>Sin comentarios aún</p>
          )}
        </div>
      )}

      {vistaReportes === 'comunicaciones-top' && (
        <div className="fade-in">
          {reportes.comTop.length > 0 ? (
            <div>
              {reportes.comTop.map((com, i) => (
                <div key={i} className="card mb-10">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <h6 style={{ margin: 0, fontWeight: '700', fontSize: '13px', color: 'var(--texto-principal)', maxWidth: '70%' }}>{com.titulo}</h6>
                    <span style={{ background: 'var(--azul-electrico)', color: 'white', padding: '4px 8px', borderRadius: '12px', fontWeight: '700', fontSize: '11px' }}>#{i + 1}</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(92px, 1fr))', gap: '10px', fontSize: '12px' }}>
                    <div style={{ background: 'rgba(0, 122, 255, 0.08)', padding: '6px', borderRadius: '4px', textAlign: 'center' }}>
                      <p style={{ margin: 0, fontWeight: '700', color: 'var(--azul-electrico)' }}>{com.comentarios}</p>
                      <p style={{ margin: '2px 0 0 0', fontSize: '10px', color: 'var(--texto-secundario)' }}>💬 Comentarios</p>
                    </div>
                    <div style={{ background: 'rgba(52, 199, 89, 0.08)', padding: '6px', borderRadius: '4px', textAlign: 'center' }}>
                      <p style={{ margin: 0, fontWeight: '700', color: '#34C759' }}>{com.reacciones}</p>
                      <p style={{ margin: '2px 0 0 0', fontSize: '10px', color: 'var(--texto-secundario)' }}>❤️ Reacciones</p>
                    </div>
                    <div style={{ background: 'rgba(255, 159, 64, 0.08)', padding: '6px', borderRadius: '4px', textAlign: 'center' }}>
                      <p style={{ margin: 0, fontWeight: '700', color: '#FF9500' }}>{com.rsvp}</p>
                      <p style={{ margin: '2px 0 0 0', fontSize: '10px', color: 'var(--texto-secundario)' }}>✓ RSVP</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ textAlign: 'center', color: 'var(--texto-secundario)', fontSize: '13px' }}>Sin comunicaciones aún</p>
          )}
        </div>
      )}
    </div>
  );
}
