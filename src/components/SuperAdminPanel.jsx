import { Bell, CheckSquare, FileText, History, User, XSquare } from 'lucide-react';
import * as api from '../api/client';
import { colorTipo } from '../utils/appHelpers';
import { mockMorosos } from '../data/mockData';
import ReportesPanel from './ReportesPanel';

function SuperAdminPanel({
  vistaAdmin,
  setVistaAdmin,
  generarAlertas,
  filtroMorosos,
  setFiltroMorosos,
  pagosPendientesAdmin,
  setPagosPendientesAdmin,
  logAuditoria,
  nominaCita,
  setNominaCita,
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
  cuentasIncompletas,
  abrirEdicionCuenta,
  cuentaEditando,
  actualizarCampoCuenta,
  guardarCuentaPendiente,
  guardandoCuenta,
  setCuentaEditando,
  vistaSaludTab,
  setVistaSaludTab,
  renderDashboardSalud,
  renderAlertasPanel,
  renderTimelineActividad,
}) {
  const enviarAlerta = () => { alert('Notificación enviada por App y Correo a los destinatarios.'); };
  const togglePermiso = (idUsuario, permiso) => { void idUsuario; void permiso; };
  void enviarAlerta;
  void togglePermiso;

  const af = {
    totalSocios: 85, sociosAlDia: 67, sociosMorosos: 18,
    metaSocios: 2975000, recaudadoSocios: 2345000,
    totalDeportistas: 124, deportistasAlDia: 106, deportistasMorosos: 18,
    metaDeportistas: 1860000, recaudadoDeportistas: 1590000,
  };

  const pctSocios = Math.round(af.recaudadoSocios / af.metaSocios * 100);
  const pctDep = Math.round(af.recaudadoDeportistas / af.metaDeportistas * 100);
  const pctGlobal = Math.round((af.recaudadoSocios + af.recaudadoDeportistas) / (af.metaSocios + af.metaDeportistas) * 100);
  const morososFiltrados = filtroMorosos === 'todos'
    ? mockMorosos
    : filtroMorosos === 'socios'
      ? mockMorosos.filter(m => m.tipo === 'socio' || m.tipo === 'socio-apoderado')
      : mockMorosos.filter(m => m.tipo === 'apoderado' || m.tipo === 'socio-apoderado');

  return (
    <div className="admin-container fade-in">
      <div className="scroll-horizontal-menu mb-15">
        <div className="segment-control" style={{ minWidth: '550px' }}>
          <div className={`segment-btn ${vistaAdmin === 'dashboard' ? 'active' : ''}`} onClick={() => setVistaAdmin('dashboard')}>Resumen</div>
          <div className={`segment-btn ${vistaAdmin === 'pagos' ? 'active' : ''}`} onClick={() => setVistaAdmin('pagos')}>Validar Pago</div>
          <div className={`segment-btn ${vistaAdmin === 'citaciones' ? 'active' : ''}`} onClick={() => setVistaAdmin('citaciones')}>Citaciones</div>
          <div className={`segment-btn ${vistaAdmin === 'auditoria' ? 'active' : ''}`} onClick={() => setVistaAdmin('auditoria')}>Auditoría</div>
          <div className={`segment-btn ${vistaAdmin === 'reportes' ? 'active' : ''}`} onClick={() => setVistaAdmin('reportes')}>📊 Reportes</div>
          <div className={`segment-btn ${vistaAdmin === 'cuentas' ? 'active' : ''}`} onClick={() => setVistaAdmin('cuentas')}>🧾 Cuentas</div>
          <div className={`segment-btn ${vistaAdmin === 'salud' ? 'active' : ''}`} onClick={() => { setVistaAdmin('salud'); generarAlertas(); }}>🏥 Salud</div>
          <div className={`segment-btn ${vistaAdmin === 'permisos' ? 'active' : ''}`} onClick={() => setVistaAdmin('permisos')}>Ajustes</div>
        </div>
      </div>

      {vistaAdmin === 'dashboard' && (
        <div className="fade-in">
          <div className="card text-center admin-panel-card mb-5">
            <h4 className="form-subtitle" style={{ justifyContent: 'center' }}>Recaudación Global — Jul 2026</h4>
            <div className="radial-progress-container mt-10 mb-10" style={{ position: 'relative', width: '130px', height: '130px', margin: '0 auto' }}>
              <svg viewBox="0 0 100 100" style={{ transform: 'rotate(-90deg)', width: '100%', height: '100%' }}>
                <circle cx="50" cy="50" r="45" fill="transparent" stroke="var(--borde-suave)" strokeWidth="10" />
                <circle cx="50" cy="50" r="45" fill="transparent" stroke="url(#gradG)" strokeWidth="10" strokeDasharray={`${pctGlobal * 2.82} 300`} strokeLinecap="round" style={{ transition: 'stroke-dasharray 1s ease' }} />
                <defs><linearGradient id="gradG" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stopColor="var(--azul-electrico)" /><stop offset="100%" stopColor="var(--verde-victoria)" /></linearGradient></defs>
              </svg>
              <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', textAlign: 'center' }}>
                <h2 style={{ margin: 0, fontSize: '22px' }}>{pctGlobal}%</h2>
                <span style={{ fontSize: '9px', fontWeight: 'bold', color: 'var(--texto-secundario)' }}>LOGRADO</span>
              </div>
            </div>
            <h3 style={{ margin: '0 0 4px', fontSize: '20px', color: 'var(--texto-principal)' }}>${(af.recaudadoSocios + af.recaudadoDeportistas).toLocaleString('es-CL')}</h3>
            <span style={{ fontSize: '12px', color: 'var(--texto-secundario)', fontWeight: 'bold' }}>Meta mensual: ${(af.metaSocios + af.metaDeportistas).toLocaleString('es-CL')}</span>
          </div>

          <h3 className="section-title mt-20">Socios del Club</h3>
          <div className="caja-triple-grid mb-15">
            <div className="admin-stat-pill verde"><span>Al Día</span><h2>{af.sociosAlDia}</h2></div>
            <div className="admin-stat-pill rojo"><span>Morosos</span><h2>{af.sociosMorosos}</h2></div>
            <div className="admin-stat-pill azul"><span>Total</span><h2>{af.totalSocios}</h2></div>
          </div>
          <div className="card mb-20" style={{ borderLeft: '4px solid var(--azul-electrico)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', fontWeight: '800', color: 'var(--texto-secundario)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Recaudación Socios</span>
              <span style={{ fontWeight: '900', color: 'var(--azul-electrico)', fontSize: '14px' }}>{pctSocios}%</span>
            </div>
            <div className="recaud-bar mt-10"><div className="recaud-bar-fill" style={{ width: `${pctSocios}%`, background: 'linear-gradient(90deg, var(--azul-electrico), var(--verde-victoria))' }} /></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px' }}>
              <span style={{ fontSize: '12px', color: 'var(--verde-victoria)', fontWeight: '800' }}>✓ ${af.recaudadoSocios.toLocaleString('es-CL')}</span>
              <span style={{ fontSize: '12px', color: 'var(--rojo-alerta)', fontWeight: '800' }}>✗ ${(af.metaSocios - af.recaudadoSocios).toLocaleString('es-CL')} pendiente</span>
            </div>
          </div>

          <h3 className="section-title">Deportistas Inscritos</h3>
          <div className="caja-triple-grid mb-15">
            <div className="admin-stat-pill verde"><span>Al Día</span><h2>{af.deportistasAlDia}</h2></div>
            <div className="admin-stat-pill rojo"><span>Morosos</span><h2>{af.deportistasMorosos}</h2></div>
            <div className="admin-stat-pill azul"><span>Total</span><h2>{af.totalDeportistas}</h2></div>
          </div>
          <div className="card mb-20" style={{ borderLeft: '4px solid #FF9500' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', fontWeight: '800', color: 'var(--texto-secundario)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Recaudación Deportistas</span>
              <span style={{ fontWeight: '900', color: '#FF9500', fontSize: '14px' }}>{pctDep}%</span>
            </div>
            <div className="recaud-bar mt-10"><div className="recaud-bar-fill" style={{ width: `${pctDep}%`, background: 'linear-gradient(90deg, #FF9500, var(--verde-victoria))' }} /></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px' }}>
              <span style={{ fontSize: '12px', color: 'var(--verde-victoria)', fontWeight: '800' }}>✓ ${af.recaudadoDeportistas.toLocaleString('es-CL')}</span>
              <span style={{ fontSize: '12px', color: 'var(--rojo-alerta)', fontWeight: '800' }}>✗ ${(af.metaDeportistas - af.recaudadoDeportistas).toLocaleString('es-CL')} pendiente</span>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h3 className="section-title" style={{ margin: 0 }}>Morosos</h3>
            <button className="btn-notificar" style={{ background: 'var(--rojo-alerta)', color: 'white', borderColor: 'var(--rojo-alerta)', boxShadow: '0 4px 12px rgba(255,59,48,0.3)' }} onClick={() => alert(`Notificación masiva enviada a ${mockMorosos.length} deudores.`)}>
              <Bell size={13} /> Notificar Todos
            </button>
          </div>
          <div className="filter-chips mb-15">
            <button className={`filter-chip ${filtroMorosos === 'todos' ? 'active' : ''}`} onClick={() => setFiltroMorosos('todos')}>Todos ({mockMorosos.length})</button>
            <button className={`filter-chip ${filtroMorosos === 'socios' ? 'active' : ''}`} onClick={() => setFiltroMorosos('socios')}>Socios ({mockMorosos.filter(m => m.tipo === 'socio' || m.tipo === 'socio-apoderado').length})</button>
            <button className={`filter-chip ${filtroMorosos === 'apoderados' ? 'active' : ''}`} onClick={() => setFiltroMorosos('apoderados')}>Apoderados ({mockMorosos.filter(m => m.tipo === 'apoderado' || m.tipo === 'socio-apoderado').length})</button>
          </div>
          {[...morososFiltrados].sort((a, b) => b.mesesDeuda - a.mesesDeuda).map(m => {
            const gravedad = m.mesesDeuda >= 3 ? 'var(--rojo-alerta)' : m.mesesDeuda === 2 ? '#FF9500' : '#DDAA00';
            const { bg, color } = colorTipo(m.tipo);
            const labelTipo = m.tipo === 'socio' ? 'Socio' : m.tipo === 'apoderado' ? 'Apoderado' : 'Socio / Apod.';
            return (
              <div key={m.id} className="moroso-row" style={{ borderLeft: `4px solid ${gravedad}` }}>
                <div className="moroso-info">
                  <span className="moroso-nombre">{m.nombre}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '5px', flexWrap: 'wrap' }}>
                    <span className="moroso-tipo-badge" style={{ background: bg, color }}>{labelTipo}</span>
                    {m.pupilos.length > 0 && <span style={{ fontSize: '11px', color: 'var(--texto-secundario)', fontWeight: '700' }}>👤 {m.pupilos.join(' · ')}</span>}
                  </div>
                  <span style={{ fontSize: '11px', color: 'var(--texto-secundario)', marginTop: '4px', display: 'block', fontWeight: '700' }}>📞 {m.contacto}</span>
                </div>
                <div className="moroso-deuda">
                  <span className="moroso-monto">${m.montoDeuda.toLocaleString('es-CL')}</span>
                  <span className="moroso-meses" style={{ color: gravedad }}>{m.mesesDeuda} {m.mesesDeuda === 1 ? 'mes' : 'meses'}</span>
                </div>
                <button className="btn-notificar" onClick={() => alert(`Notificación enviada a ${m.nombre}\n📞 ${m.contacto}`)}>
                  <Bell size={13} /> Avisar
                </button>
              </div>
            );
          })}
        </div>
      )}

      {vistaAdmin === 'pagos' && (
        <div className="fade-in">
          <h3 className="section-title">Bandeja de Validación</h3>
          {pagosPendientesAdmin.length === 0 ? <p className="text-muted text-center italic mt-20">Sin comprobantes pendientes.</p> : null}
          {pagosPendientesAdmin.map(pago => (
            <div key={pago.id} className="card" style={{ borderLeft: '4px solid var(--azul-electrico)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div><h4 style={{ margin: 0, color: 'var(--texto-heading)', fontSize: '16px' }}>{pago.familia}</h4><span style={{ fontSize: '11px', color: 'var(--texto-secundario)' }}>ID Transacción: #{pago.id}</span></div>
                <span style={{ fontWeight: '900', fontSize: '20px', color: 'var(--azul-electrico)' }}>${pago.monto.toLocaleString('es-CL')}</span>
              </div>
              <p style={{ fontSize: '13px', margin: '15px 0', color: 'var(--texto-principal)' }}><strong>Detalle:</strong> {pago.detalle}</p>

              <div className="foto-upload-box mb-15" style={{ padding: '15px', background: 'rgba(0,122,255,0.05)', borderColor: 'rgba(0,122,255,0.2)' }}>
                <FileText size={24} color="var(--azul-electrico)" />
                <span style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--azul-electrico)' }}>Ver Comprobante Adjunto</span>
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button style={{ flex: 1, padding: '12px', background: 'var(--verde-victoria)', color: 'white', border: 'none', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }} onClick={() => { alert('Pago Aprobado.'); setPagosPendientesAdmin(pagosPendientesAdmin.filter(p => p.id !== pago.id)); }}><CheckSquare size={16} /> Aprobar</button>
                <button style={{ flex: 1, padding: '12px', background: '#FF3B30', color: 'white', border: 'none', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }} onClick={() => alert('Pago Rechazado.')}><XSquare size={16} /> Rechazar</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {vistaAdmin === 'auditoria' && (
        <div className="fade-in card">
          <h4 className="form-subtitle"><History size={16} /> Log de Movimientos</h4>
          <p style={{ fontSize: '12px', color: 'var(--texto-secundario)', marginBottom: '20px' }}>Registro inmutable de acciones críticas del sistema.</p>
          {logAuditoria.map(log => (
            <div key={log.id} style={{ borderBottom: '1px dashed rgba(0,0,0,0.1)', paddingBottom: '12px', marginBottom: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><strong style={{ fontSize: '14px', color: 'var(--texto-heading)' }}>{log.accion}</strong><span style={{ fontSize: '12px', color: 'var(--azul-electrico)', fontWeight: 'bold' }}>{log.hora}</span></div>
              <div style={{ fontSize: '13px', color: 'var(--texto-principal)', margin: '5px 0' }}>{log.detalle}</div>
              <span style={{ fontSize: '11px', color: 'var(--texto-secundario)', fontWeight: 'bold' }}>👤 Usuario Auth: {log.usuario}</span>
            </div>
          ))}
        </div>
      )}

      {vistaAdmin === 'citaciones' && (
        <div className="fade-in">
          <h3 className="section-title">Creador de Convocatorias</h3>
          <div className="card mt-15">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
              <h4 className="form-subtitle" style={{ margin: 0 }}>Nómina FIBA (Tope 12)</h4>
              <span style={{ background: nominaCita.filter(j => j.citado).length >= 12 ? '#FF3B30' : 'var(--verde-victoria)', color: 'white', padding: '6px 12px', borderRadius: '10px', fontSize: '12px', fontWeight: '900' }}>
                {nominaCita.filter(j => j.citado).length}/12 Cupos
              </span>
            </div>
            <button className="btn-secondary mb-15" style={{ fontSize: '13px', padding: '12px' }}><User size={16} /> Subir jugador de otra categoría (Call-up)</button>

            {nominaCita.map(jugador => (
              <div key={jugador.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px', background: jugador.deuda ? 'rgba(255,59,48,0.05)' : (jugador.lesion ? 'rgba(0,0,0,0.05)' : 'var(--fondo-app)'), border: `1px solid ${jugador.deuda ? '#FF3B30' : 'rgba(0,0,0,0.05)'}`, borderRadius: '12px', marginBottom: '10px' }}>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <strong style={{ fontSize: '15px', color: 'var(--texto-principal)' }}>{jugador.nombre} {jugador.deuda && '⚠️'} {jugador.lesion && '🚑'}</strong>
                  <span style={{ fontSize: '12px', color: 'var(--texto-secundario)', marginTop: '4px', fontWeight: 'bold' }}>POS: {jugador.pos} | Cat: {jugador.catOriginal}</span>
                </div>
                {jugador.lesion ? (
                  <span style={{ fontSize: '11px', color: '#FF3B30', fontWeight: '900' }}>NO DISPONIBLE</span>
                ) : jugador.deuda ? (
                  <button style={{ background: '#FF9500', color: 'white', border: 'none', padding: '8px 12px', borderRadius: '8px', fontSize: '11px', fontWeight: '800', cursor: 'pointer' }} onClick={() => alert('Excepción autorizada. Administrador asume responsabilidad.')}>Forzar Citación</button>
                ) : (
                  <input type="checkbox" style={{ width: '24px', height: '24px', accentColor: 'var(--azul-electrico)' }} checked={jugador.citado} disabled={!jugador.citado && nominaCita.filter(j => j.citado).length >= 12} onChange={() => setNominaCita(nominaCita.map(j => j.id === jugador.id ? { ...j, citado: !j.citado } : j))} />
                )}
              </div>
            ))}
            <button className="btn-electric mt-20" onClick={() => alert('Citación publicada y enviada a los Muros.')}>CONFIRMAR Y CITAR</button>
          </div>
        </div>
      )}

      {vistaAdmin === 'reportes' && (
        <ReportesPanel
          calcularReportes={calcularReportes}
          vistaReportes={vistaReportes}
          setVistaReportes={setVistaReportes}
          filtroReporteFecha={filtroReporteFecha}
          setFiltroReporteFecha={setFiltroReporteFecha}
          filtroReporteRama={filtroReporteRama}
          setFiltroReporteRama={setFiltroReporteRama}
          setMostrarHistorialNotif={setMostrarHistorialNotif}
          exportarReportePDF={exportarReportePDF}
          renderGraficoSVG={renderGraficoSVG}
        />
      )}

      {vistaAdmin === 'cuentas' && (
        <div className="fade-in">
          <h3 className="section-title">Cuentas por Actualizar</h3>
          <p style={{ fontSize: '13px', color: 'var(--texto-secundario)', marginBottom: '12px' }}>
            Completa los datos faltantes y valida RUT chileno antes de guardar.
          </p>

          {cuentasIncompletas.length === 0 && (
            <div className="card text-center" style={{ fontWeight: '700', color: 'var(--verde-victoria)' }}>
              Todo bien: no hay cuentas pendientes de completar.
            </div>
          )}

          {cuentasIncompletas.map((c) => (
            <div key={c.id} className="card" style={{ marginBottom: '10px', borderLeft: '4px solid #FF9500' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
                <div>
                  <strong style={{ fontSize: '14px' }}>{`${c.nombres || 'Sin nombre'} ${c.apellido_paterno || ''}`.trim()}</strong>
                  <div style={{ fontSize: '12px', color: 'var(--texto-secundario)', marginTop: '4px' }}>
                    {c.correo || 'Sin correo'} · {c.rut || 'Sin RUT'}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '8px' }}>
                    {(c.campos_faltantes || []).map((f) => (
                      <span key={f} style={{ fontSize: '11px', background: 'rgba(255,149,0,0.14)', color: '#b36200', padding: '4px 8px', borderRadius: '999px', fontWeight: '800' }}>
                        Falta: {f}
                      </span>
                    ))}
                  </div>
                </div>
                <button className="btn-notificar" onClick={() => abrirEdicionCuenta(c)}>
                  Completar
                </button>
              </div>
            </div>
          ))}

          {cuentaEditando && (
            <div className="card" style={{ marginTop: '14px', border: '1px solid var(--azul-electrico)' }}>
              <h4 className="form-subtitle">Editar Cuenta #{cuentaEditando.id}</h4>
              <div style={{ marginTop: '8px', marginBottom: '8px', fontSize: '12px', fontWeight: '800', color: 'var(--texto-secundario)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Identidad</div>
              <div className="form-group"><label>Correo</label><input className="form-input" value={cuentaEditando.correo} onChange={(e) => actualizarCampoCuenta('correo', e.target.value)} /></div>
              <div className="form-group"><label>RUT</label><input className="form-input" value={cuentaEditando.rut} onChange={(e) => actualizarCampoCuenta('rut', e.target.value)} style={{ borderColor: cuentaEditando.rut && !api.validarRutChileno(cuentaEditando.rut) ? '#FF3B30' : undefined }} /></div>
              {cuentaEditando.rut && !api.validarRutChileno(cuentaEditando.rut) && <p style={{ fontSize: '12px', color: '#FF3B30', marginTop: '-6px' }}>RUT invalido</p>}
              <div className="form-group"><label>Nombres</label><input className="form-input" value={cuentaEditando.nombres} onChange={(e) => actualizarCampoCuenta('nombres', e.target.value)} /></div>
              <div className="form-group"><label>Apellido Paterno</label><input className="form-input" value={cuentaEditando.apellido_paterno} onChange={(e) => actualizarCampoCuenta('apellido_paterno', e.target.value)} /></div>
              <div className="form-group"><label>Apellido Materno</label><input className="form-input" value={cuentaEditando.apellido_materno} onChange={(e) => actualizarCampoCuenta('apellido_materno', e.target.value)} /></div>
              <div style={{ marginTop: '10px', marginBottom: '8px', fontSize: '12px', fontWeight: '800', color: 'var(--texto-secundario)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Contacto</div>
              <div className="form-group"><label>Telefono</label><input className="form-input" value={cuentaEditando.telefono} onChange={(e) => actualizarCampoCuenta('telefono', e.target.value)} /></div>
              <div className="form-group"><label>Direccion</label><input className="form-input" value={cuentaEditando.direccion} onChange={(e) => actualizarCampoCuenta('direccion', e.target.value)} /></div>
              <div className="form-group"><label>Comuna</label><input className="form-input" value={cuentaEditando.comuna} onChange={(e) => actualizarCampoCuenta('comuna', e.target.value)} /></div>
              <div style={{ marginTop: '10px', marginBottom: '8px', fontSize: '12px', fontWeight: '800', color: 'var(--texto-secundario)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Gestión</div>
              <div className="form-group"><label>Rol</label><input className="form-input" value={cuentaEditando.rol} onChange={(e) => actualizarCampoCuenta('rol', e.target.value)} /></div>
              <div className="form-group"><label>Estado Civil</label><input className="form-input" value={cuentaEditando.estado_civil} onChange={(e) => actualizarCampoCuenta('estado_civil', e.target.value)} /></div>
              <div className="form-group"><label>Profesion u Oficio</label><input className="form-input" value={cuentaEditando.profesion_oficio} onChange={(e) => actualizarCampoCuenta('profesion_oficio', e.target.value)} /></div>
              <div className="form-group"><label>Segundo Contacto</label><input className="form-input" value={cuentaEditando.nombre_segundo_contacto} onChange={(e) => actualizarCampoCuenta('nombre_segundo_contacto', e.target.value)} /></div>
              <div className="form-group"><label>Parentesco Segundo Contacto</label><input className="form-input" value={cuentaEditando.parentesco_segundo_contacto} onChange={(e) => actualizarCampoCuenta('parentesco_segundo_contacto', e.target.value)} /></div>
              <div className="form-group"><label>Numero Segundo Contacto</label><input className="form-input" value={cuentaEditando.num_segundo_contacto} onChange={(e) => actualizarCampoCuenta('num_segundo_contacto', e.target.value)} /></div>
              <div className="form-group"><label>Dia Pago Acordado</label><input className="form-input" type="number" min="1" max="31" value={cuentaEditando.dia_pago_acordado} onChange={(e) => actualizarCampoCuenta('dia_pago_acordado', e.target.value)} /></div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', fontSize: '13px' }}>
                <input type="checkbox" checked={Boolean(cuentaEditando.es_socio)} onChange={(e) => actualizarCampoCuenta('es_socio', e.target.checked)} />
                Es socio
              </label>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button className="btn-electric" onClick={guardarCuentaPendiente} disabled={guardandoCuenta || !api.validarRutChileno(cuentaEditando.rut)}>
                  {guardandoCuenta ? 'Guardando...' : 'Guardar Cuenta'}
                </button>
                <button className="btn-secondary" onClick={() => setCuentaEditando(null)}>Cancelar</button>
              </div>
            </div>
          )}
        </div>
      )}

      {vistaAdmin === 'salud' && (
        <div className="fade-in">
          <div className="scroll-horizontal-menu mb-15">
            <div className="segment-control" style={{ minWidth: '300px' }}>
              <div className={`segment-btn ${vistaSaludTab === 'dashboard' ? 'active' : ''}`} onClick={() => setVistaSaludTab('dashboard')}>Dashboard</div>
              <div className={`segment-btn ${vistaSaludTab === 'alertas' ? 'active' : ''}`} onClick={() => setVistaSaludTab('alertas')}>Alertas</div>
              <div className={`segment-btn ${vistaSaludTab === 'timeline' ? 'active' : ''}`} onClick={() => setVistaSaludTab('timeline')}>Timeline</div>
            </div>
          </div>

          {vistaSaludTab === 'dashboard' && renderDashboardSalud()}
          {vistaSaludTab === 'alertas' && renderAlertasPanel()}
          {vistaSaludTab === 'timeline' && renderTimelineActividad()}
        </div>
      )}

      {vistaAdmin === 'permisos' && (
        <div className="fade-in card">
          <h4 className="form-subtitle">Permisos de Sistema</h4>
          <p>Gestión de permisos activa. Configura accesos por rol y módulo según políticas del club.</p>
        </div>
      )}
    </div>
  );
}

export default SuperAdminPanel;
