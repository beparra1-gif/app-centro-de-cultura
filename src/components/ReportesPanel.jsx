import { BarChart2, TrendingUp, MessageCircle, Trophy, History, Download, Calendar, Heart, Check } from 'lucide-react';

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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', gap: '10px', flexWrap: 'wrap' }}>
        <h4 style={{ color: 'var(--texto-heading)', margin: 0, fontSize: '18px', fontWeight: '900', display: 'flex', alignItems: 'center', gap: '6px' }}><BarChart2 size={18} /> Reportes de Actividad</h4>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button onClick={() => setMostrarHistorialNotif(true)} style={{ padding: '10px 14px', borderRadius: '14px', border: '1px solid var(--borde-suave)', background: 'rgba(255,255,255,0.88)', color: 'var(--texto-principal)', fontSize: '12px', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', boxShadow: '0 8px 18px rgba(15,23,42,0.04)' }}>
            <History size={13} /> Historial
          </button>
          <button onClick={exportarReportePDF} style={{ padding: '10px 14px', borderRadius: '14px', border: 'none', background: 'linear-gradient(180deg, #2f8cff 0%, var(--azul-electrico) 100%)', color: 'white', fontSize: '12px', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', boxShadow: '0 10px 18px rgba(0,122,255,0.18)' }}>
            <Download size={13} /> Exportar
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '10px', marginBottom: '15px' }}>
        <select value={filtroReporteFecha} onChange={(e) => setFiltroReporteFecha(e.target.value)} className="form-input" style={{ fontSize: '12px', borderRadius: '14px' }}>
          <option value="semana">Esta semana</option>
          <option value="mes">Este mes</option>
          <option value="todos">Todo el tiempo</option>
        </select>
        <select value={filtroReporteRama} onChange={(e) => setFiltroReporteRama(e.target.value)} className="form-input" style={{ fontSize: '12px', borderRadius: '14px' }}>
          <option value="General">General</option>
          <option value="Femenina">Rama Femenina</option>
          <option value="Masculina">Rama Masculina</option>
        </select>
      </div>

      <div className="segment-control mb-20" style={{ background: 'rgba(255,255,255,0.88)', flexWrap: 'wrap', gap: '4px', borderRadius: '18px', padding: '4px', minWidth: 'auto' }}>
        <button type="button" className={`segment-btn ${vistaReportes === 'engagement' ? 'active' : ''}`} onClick={() => setVistaReportes('engagement')} style={{ flex: '1 1 150px' }}>
          <TrendingUp size={14} /> Engagement
        </button>
        <button type="button" className={`segment-btn ${vistaReportes === 'comentaristas' ? 'active' : ''}`} onClick={() => setVistaReportes('comentaristas')} style={{ flex: '1 1 150px' }}>
          <MessageCircle size={14} /> Top Comentaristas
        </button>
        <button type="button" className={`segment-btn ${vistaReportes === 'comunicaciones-top' ? 'active' : ''}`} onClick={() => setVistaReportes('comunicaciones-top')} style={{ flex: '1 1 150px' }}>
          <Trophy size={14} /> Comunicaciones Top
        </button>
      </div>

      {vistaReportes === 'engagement' && (
        <div className="fade-in">
          {totalEngagement === 0 ? (
            <div className="card text-center" style={{ padding: '24px 14px', borderRadius: '24px' }}>
              <h5 style={{ margin: '0 0 8px 0', fontSize: '16px', color: 'var(--texto-principal)' }}>Sin datos de engagement aún</h5>
              <p style={{ margin: 0, fontSize: '13px', color: 'var(--texto-secundario)' }}>
                Publica comunicaciones o interactúa con reacciones/comentarios para ver métricas.
              </p>
            </div>
          ) : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '12px', marginBottom: '15px' }}>
                <div className="card" style={{ background: 'linear-gradient(180deg, rgba(0, 122, 255, 0.10), rgba(0, 122, 255, 0.05))', borderLeft: '4px solid var(--azul-electrico)', borderRadius: '22px' }}>
                  <h6 style={{ margin: '0 0 6px 0', fontSize: '11px', fontWeight: '600', color: 'var(--texto-secundario)', display: 'flex', alignItems: 'center', gap: '4px' }}><MessageCircle size={12} /> Comentarios</h6>
                  <h3 style={{ margin: 0, fontSize: '28px', fontWeight: '800', color: 'var(--azul-electrico)' }}>{reportes.totalComentarios}</h3>
                </div>
                <div className="card" style={{ background: 'linear-gradient(180deg, rgba(52, 199, 89, 0.10), rgba(52, 199, 89, 0.05))', borderLeft: '4px solid #34C759', borderRadius: '22px' }}>
                  <h6 style={{ margin: '0 0 6px 0', fontSize: '11px', fontWeight: '600', color: 'var(--texto-secundario)', display: 'flex', alignItems: 'center', gap: '4px' }}><Heart size={12} /> Reacciones</h6>
                  <h3 style={{ margin: 0, fontSize: '28px', fontWeight: '800', color: '#34C759' }}>{reportes.totalReacciones}</h3>
                </div>
                <div className="card" style={{ background: 'linear-gradient(180deg, rgba(255, 159, 64, 0.10), rgba(255, 159, 64, 0.05))', borderLeft: '4px solid #FF9500', borderRadius: '22px' }}>
                  <h6 style={{ margin: '0 0 6px 0', fontSize: '11px', fontWeight: '600', color: 'var(--texto-secundario)', display: 'flex', alignItems: 'center', gap: '4px' }}><Check size={12} /> RSVP</h6>
                  <h3 style={{ margin: 0, fontSize: '28px', fontWeight: '800', color: '#FF9500' }}>{reportes.totalRSVP}</h3>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '15px', marginBottom: '15px' }}>
                <div className="card" style={{ textAlign: 'center', borderRadius: '22px' }}>
                  <h6 style={{ margin: '0 0 10px 0', fontSize: '12px', fontWeight: '700', color: 'var(--texto-principal)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}><BarChart2 size={13} /> Gráfico Pie</h6>
                  {renderGraficoSVG('pie')}
                </div>
                <div className="card" style={{ textAlign: 'center', borderRadius: '22px' }}>
                  <h6 style={{ margin: '0 0 10px 0', fontSize: '12px', fontWeight: '700', color: 'var(--texto-principal)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}><TrendingUp size={13} /> Gráfico Barras</h6>
                  {renderGraficoSVG('bar')}
                </div>
              </div>

              <div style={{ marginTop: '15px', textAlign: 'center', padding: '16px', background: 'rgba(0,0,0,0.02)', borderRadius: '18px', fontSize: '13px', color: 'var(--texto-secundario)' }}>
                <p style={{ margin: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}><Calendar size={13} /> Período: {filtroReporteFecha === 'semana' ? 'Esta semana' : filtroReporteFecha === 'mes' ? 'Este mes' : 'Todo el tiempo'}</p>
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
                <div key={i} className="card mb-10" style={{ display: 'flex', alignItems: 'center', gap: '12px', borderRadius: '22px' }}>
                  <div style={{ background: 'linear-gradient(180deg, #2f8cff 0%, var(--azul-electrico) 100%)', color: 'white', width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '800', fontSize: '14px' }}>
                    {i + 1}
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ margin: 0, fontWeight: '700', color: 'var(--texto-principal)' }}>{com.usuario}</p>
                    <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: 'var(--texto-secundario)', display: 'flex', alignItems: 'center', gap: '4px' }}><MessageCircle size={12} /> {com.count} comentario{com.count !== 1 ? 's' : ''}</p>
                  </div>
                  <div style={{ background: 'linear-gradient(90deg, var(--azul-electrico), #34C759)', color: 'white', padding: '6px 12px', borderRadius: '999px', fontWeight: '700', fontSize: '12px' }}>
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
                <div key={i} className="card mb-10" style={{ borderRadius: '22px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <h6 style={{ margin: 0, fontWeight: '700', fontSize: '13px', color: 'var(--texto-principal)', maxWidth: '70%' }}>{com.titulo}</h6>
                    <span style={{ background: 'var(--azul-electrico)', color: 'white', padding: '4px 8px', borderRadius: '12px', fontWeight: '700', fontSize: '11px' }}>#{i + 1}</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(92px, 1fr))', gap: '10px', fontSize: '12px' }}>
                    <div style={{ background: 'rgba(0, 122, 255, 0.08)', padding: '8px', borderRadius: '14px', textAlign: 'center' }}>
                      <p style={{ margin: 0, fontWeight: '700', color: 'var(--azul-electrico)' }}>{com.comentarios}</p>
                      <p style={{ margin: '2px 0 0 0', fontSize: '11px', color: 'var(--texto-secundario)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '3px' }}><MessageCircle size={10} /> Comentarios</p>
                    </div>
                    <div style={{ background: 'rgba(52, 199, 89, 0.08)', padding: '8px', borderRadius: '14px', textAlign: 'center' }}>
                      <p style={{ margin: 0, fontWeight: '700', color: '#34C759' }}>{com.reacciones}</p>
                      <p style={{ margin: '2px 0 0 0', fontSize: '11px', color: 'var(--texto-secundario)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '3px' }}><Heart size={10} /> Reacciones</p>
                    </div>
                    <div style={{ background: 'rgba(255, 159, 64, 0.08)', padding: '8px', borderRadius: '14px', textAlign: 'center' }}>
                      <p style={{ margin: 0, fontWeight: '700', color: '#FF9500' }}>{com.rsvp}</p>
                      <p style={{ margin: '2px 0 0 0', fontSize: '11px', color: 'var(--texto-secundario)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '3px' }}><Check size={10} /> RSVP</p>
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
