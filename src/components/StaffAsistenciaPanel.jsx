import { useMemo, useState } from 'react';
import { Save } from 'lucide-react';
import LogoAvatar from './LogoAvatar';

function StaffAsistenciaPanel({
  vistaStaff,
  setVistaStaff,
  filtroRamaStaff,
  setFiltroRamaStaff,
  filtroCatStaff,
  setFiltroCatStaff,
  rosterEquipo,
  setRosterEquipo,
}) {
  const [fechaLista, setFechaLista] = useState(() => new Date().toISOString().slice(0, 10));
  const [horaInicio, setHoraInicio] = useState('18:00');
  const [horaFin, setHoraFin] = useState('19:30');
  const [categoriasSeleccionadas, setCategoriasSeleccionadas] = useState([]);

  const categoriasDisponibles = useMemo(() => {
    const setCategorias = new Set(
      (rosterEquipo || []).map((j) => String(j.categoria || '').trim()).filter(Boolean)
    );
    return Array.from(setCategorias).sort((a, b) => a.localeCompare(b, 'es'));
  }, [rosterEquipo]);

  const rosterFiltrado = useMemo(() => {
    return (rosterEquipo || []).filter((j) => {
      const rama = String(j.rama || '').toLowerCase();
      const categoria = String(j.categoria || '').trim();
      const coincideRama = filtroRamaStaff === 'todas' || rama === String(filtroRamaStaff || '').toLowerCase();
      const coincideCategoria = categoriasSeleccionadas.length === 0 || categoriasSeleccionadas.includes(categoria);
      return coincideRama && coincideCategoria;
    });
  }, [rosterEquipo, filtroRamaStaff, categoriasSeleccionadas]);

  const presentes = rosterFiltrado.filter(j => j.estadoAsistencia === 'presente').length;
  const ausentes = rosterFiltrado.filter(j => j.estadoAsistencia === 'ausente').length;
  const justificados = rosterFiltrado.filter(j => j.estadoAsistencia === 'justificado').length;
  const totalLista = rosterFiltrado.length;
  const baseAsistencia = Math.max(totalLista - justificados, 1);
  const porcentaje = totalLista > 0 ? Math.round((presentes / baseAsistencia) * 100) : 0;

  const cambiarEstado = (id, nuevoEstado) => {
    setRosterEquipo(rosterEquipo.map(j => j.id === id ? { ...j, estadoAsistencia: nuevoEstado } : j));
  };

  const toggleCategoria = (categoria) => {
    setCategoriasSeleccionadas((prev) => (
      prev.includes(categoria)
        ? prev.filter((c) => c !== categoria)
        : [...prev, categoria]
    ));
  };

  return (
    <div className="mt-20 fade-in">
      <div className="segment-control mb-20">
        <div className={`segment-btn ${vistaStaff === 'asistencia' ? 'active' : ''}`} onClick={() => setVistaStaff('asistencia')}>Pasar Lista</div>
        <div className={`segment-btn ${vistaStaff === 'historial' ? 'active' : ''}`} onClick={() => setVistaStaff('historial')}>Historial</div>
      </div>

      {vistaStaff === 'asistencia' && (
        <div className="card" style={{ borderRadius: '24px' }}>
          <h4 className="form-subtitle" style={{ fontWeight: '900' }}>Configurar Entrenamiento</h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '10px' }} className="mb-15">
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Rama</label>
              <select className="form-input" value={filtroRamaStaff} onChange={(e) => setFiltroRamaStaff(e.target.value)}>
                <option value="todas">Todas</option>
                <option value="masculina">Masculina</option>
                <option value="femenina">Femenina</option>
                <option value="mixta">Mixta</option>
              </select>
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Fecha</label>
              <input type="date" className="form-input" value={fechaLista} onChange={(e) => setFechaLista(e.target.value)} />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Hora inicio</label>
              <input type="time" className="form-input" value={horaInicio} onChange={(e) => setHoraInicio(e.target.value)} />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Hora fin</label>
              <input type="time" className="form-input" value={horaFin} onChange={(e) => setHoraFin(e.target.value)} />
            </div>
          </div>

          <div className="mb-15">
            <label style={{ fontSize: '12px', fontWeight: '800', color: 'var(--texto-secundario)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
              Categorías del entrenamiento
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '8px' }}>
              {categoriasDisponibles.map((cat) => {
                const activa = categoriasSeleccionadas.includes(cat);
                return (
                  <button
                    key={`cat-staff-${cat}`}
                    type="button"
                    className="filter-chip"
                    style={{
                      border: '1px solid rgba(0,122,255,0.24)',
                      background: activa ? 'var(--azul-electrico)' : 'rgba(0,122,255,0.08)',
                      color: activa ? 'white' : 'var(--azul-electrico)',
                      fontWeight: '800',
                    }}
                    onClick={() => toggleCategoria(cat)}
                  >
                    {cat}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="staff-header-info mb-15" style={{ borderBottom: '1px solid rgba(0,0,0,0.05)', paddingBottom: '15px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <LogoAvatar nombre={`${categoriasSeleccionadas.join(' / ') || 'Todas'} ${filtroRamaStaff}`} size={38} borderRadius="12px" />
              <div>
                <h4 style={{ margin: '0 0 5px 0', color: 'var(--texto-heading)' }}>
                  Nómina: {filtroRamaStaff === 'todas' ? 'Todas las ramas' : filtroRamaStaff} · {categoriasSeleccionadas.length > 0 ? categoriasSeleccionadas.join(', ') : 'Todas las categorías'}
                </h4>
                <span style={{ fontSize: '11px', color: 'var(--texto-secundario)', fontWeight: '700' }}>
                  Fecha: {fechaLista} · Horario: {horaInicio} - {horaFin}
                </span>
                <br />
                <span style={{ fontSize: '11px', color: 'var(--texto-secundario)', fontWeight: '700' }}>Logo por nombre o archivo en /public/logos</span>
              </div>
            </div>
          </div>

          <div className="roster-list">
            {rosterFiltrado.map(jugador => (
              <div key={jugador.id} className="roster-item" style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '15px 0', borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
                <div className="jugador-info-staff" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <span className="roster-nombre" style={{ fontWeight: '800', color: 'var(--texto-principal)', fontSize: '15px' }}>{jugador.nombre}</span>
                    <span style={{ fontSize: '11px', color: 'var(--texto-secundario)', marginLeft: '10px', fontWeight: 'bold' }}>Nac: {jugador.año}</span>
                    <span style={{ fontSize: '11px', color: 'var(--texto-secundario)', marginLeft: '10px', fontWeight: 'bold' }}>
                      {jugador.rama || 'Sin rama'} · {jugador.categoria || 'Sin categoría'}
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
                  <button onClick={() => cambiarEstado(jugador.id, 'presente')} style={{ flex: 1, padding: '10px', border: 'none', borderRadius: '14px', fontWeight: '800', fontSize: '11px', background: jugador.estadoAsistencia === 'presente' ? 'var(--verde-victoria)' : 'rgba(52,199,89,0.10)', color: jugador.estadoAsistencia === 'presente' ? 'white' : 'var(--texto-secundario)', transition: '0.2s' }}>✓ PRESENTE</button>
                  <button onClick={() => cambiarEstado(jugador.id, 'ausente')} style={{ flex: 1, padding: '10px', border: 'none', borderRadius: '14px', fontWeight: '800', fontSize: '11px', background: jugador.estadoAsistencia === 'ausente' ? '#FF3B30' : 'rgba(255,59,48,0.10)', color: jugador.estadoAsistencia === 'ausente' ? 'white' : 'var(--texto-secundario)', transition: '0.2s' }}>❌ AUSENTE</button>
                  <button onClick={() => cambiarEstado(jugador.id, 'justificado')} style={{ flex: 1, padding: '10px', border: 'none', borderRadius: '14px', fontWeight: '800', fontSize: '11px', background: jugador.estadoAsistencia === 'justificado' ? '#FF9500' : 'rgba(255,149,0,0.10)', color: jugador.estadoAsistencia === 'justificado' ? 'white' : 'var(--texto-secundario)', transition: '0.2s' }}>🚑 JUSTIFIC.</button>
                </div>
              </div>
            ))}
            {rosterFiltrado.length === 0 && (
              <p className="text-center text-muted" style={{ fontSize: '13px', fontStyle: 'italic', margin: '16px 0' }}>
                No hay jugadores para los filtros seleccionados.
              </p>
            )}
          </div>

          <div className="mt-20" style={{ background: 'rgba(0,122,255,0.05)', borderRadius: '22px', padding: '20px' }}>
            <h5 style={{ margin: '0 0 15px 0', fontSize: '15px', color: 'var(--texto-heading)' }}>Resumen a Guardar:</h5>
            <div className="desglose-row"><span>Asistencia Efectiva:</span><strong style={{ color: porcentaje > 70 ? 'var(--verde-victoria)' : '#FF3B30', fontSize: '16px' }}>{porcentaje}%</strong></div>
            <div className="desglose-row"><span>Presentes en Cancha:</span><strong>{presentes}</strong></div>
            <div className="desglose-row"><span>Ausentes (Sin aviso):</span><strong style={{ color: '#FF3B30' }}>{ausentes}</strong></div>
            <div className="desglose-row"><span>Con Licencia Médica:</span><strong style={{ color: '#FF9500' }}>{justificados}</strong></div>
          </div>

          <button className="btn-electric mt-20" onClick={() => alert('Asistencia guardada en la base de datos de Auditoría.')}>
            <Save size={18} /> Confirmar y Guardar Asistencia
          </button>
        </div>
      )}

      {vistaStaff === 'historial' && (
        <div className="card fade-in" style={{ borderRadius: '24px' }}>
          <h4 className="form-subtitle" style={{ fontWeight: '900' }}>Registros Anteriores</h4>
          <input type="date" className="form-input mb-15" />
          <p className="text-center text-muted" style={{ fontStyle: 'italic', fontSize: '13px' }}>Seleccione una fecha para editar la asistencia pasada.</p>
        </div>
      )}
    </div>
  );
}

export default StaffAsistenciaPanel;
