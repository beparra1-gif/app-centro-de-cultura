import { useEffect, useMemo, useState } from 'react';
import { CalendarClock, ChevronLeft, ChevronRight, Plus, BarChart3, Phone, Mail } from 'lucide-react';
import * as api from '../api/client';
import { showToast } from '../utils/toast';
import { confirmAction } from '../utils/confirmDialog';

const hoyISO = () => new Date().toISOString().slice(0, 10);

const inicioSemanaISO = () => {
  const d = new Date();
  const dia = d.getDay();
  const diff = dia === 0 ? 6 : dia - 1;
  d.setDate(d.getDate() - diff);
  return d.toISOString().slice(0, 10);
};

const inicioMesISO = (fecha = new Date()) => new Date(fecha.getFullYear(), fecha.getMonth(), 1).toISOString().slice(0, 10);
const finMesISO = (fecha = new Date()) => new Date(fecha.getFullYear(), fecha.getMonth() + 1, 0).toISOString().slice(0, 10);

const NOMBRES_MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

const FORM_VACIO = {
  nombre_arrendatario: '',
  telefono_contacto: '',
  email_contacto: '',
  fecha: hoyISO(),
  fecha_inicio: hoyISO(),
  fecha_fin: hoyISO(),
  tipo_serie: 'semanal',
  hora_inicio: '10:00',
  hora_fin: '11:00',
  valor_arriendo: '',
  metodo_pago: '',
  observaciones: '',
};

const ESTADO_COLOR = {
  pendiente: { bg: 'rgba(255,149,0,0.12)', color: '#b36200', label: 'Pendiente' },
  pagado: { bg: 'rgba(52,199,89,0.14)', color: '#1c7a3d', label: 'Pagado' },
  anulado: { bg: 'rgba(120,120,128,0.12)', color: '#666', label: 'Anulado' },
};

function CanchaArriendoPanel() {
  const [vista, setVista] = useState('calendario');
  const [mesActivo, setMesActivo] = useState(new Date());
  const [arriendos, setArriendos] = useState([]);
  const [cargando, setCargando] = useState(false);

  const [modoSerie, setModoSerie] = useState(false);
  const [form, setForm] = useState(FORM_VACIO);
  const [guardando, setGuardando] = useState(false);
  const [ultimoResultadoSerie, setUltimoResultadoSerie] = useState(null);

  const [analiticaDesde, setAnaliticaDesde] = useState(inicioMesISO());
  const [analiticaHasta, setAnaliticaHasta] = useState(hoyISO());
  const [analitica, setAnalitica] = useState([]);
  const [cargandoAnalitica, setCargandoAnalitica] = useState(false);

  const cargarMes = async () => {
    setCargando(true);
    try {
      const datos = await api.arriendosCanchaAPI.getAll({ desde: inicioMesISO(mesActivo), hasta: finMesISO(mesActivo) });
      setArriendos(Array.isArray(datos) ? datos : []);
    } catch (error) {
      showToast({ message: error.message || 'No se pudo cargar el calendario de arriendos.', type: 'error' });
      setArriendos([]);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    if (vista !== 'calendario') return;
    (async () => { await cargarMes(); })();
  }, [vista, mesActivo]);

  useEffect(() => {
    if (vista !== 'analisis') return;
    (async () => {
      setCargandoAnalitica(true);
      try {
        const datos = await api.arriendosCanchaAPI.getAll({ desde: analiticaDesde, hasta: analiticaHasta });
        setAnalitica(Array.isArray(datos) ? datos : []);
      } catch (error) {
        showToast({ message: error.message || 'No se pudo cargar el análisis.', type: 'error' });
        setAnalitica([]);
      } finally {
        setCargandoAnalitica(false);
      }
    })();
  }, [vista, analiticaDesde, analiticaHasta]);

  const arriendosPorFecha = useMemo(() => {
    const grupos = new Map();
    [...arriendos]
      .sort((a, b) => (a.fecha === b.fecha ? String(a.hora_inicio).localeCompare(b.hora_inicio) : String(a.fecha).localeCompare(b.fecha)))
      .forEach((a) => {
        const key = a.fecha;
        if (!grupos.has(key)) grupos.set(key, []);
        grupos.get(key).push(a);
      });
    return [...grupos.entries()];
  }, [arriendos]);

  const cambiarMes = (delta) => {
    setMesActivo((prev) => new Date(prev.getFullYear(), prev.getMonth() + delta, 1));
  };

  const marcarEstado = async (arriendo, nuevoEstado) => {
    try {
      await api.arriendosCanchaAPI.update(arriendo.id_arriendo, { estado_pago: nuevoEstado });
      showToast({ message: `Arriendo de ${arriendo.nombre_arrendatario} marcado como ${ESTADO_COLOR[nuevoEstado]?.label || nuevoEstado}.`, type: 'success' });
      await cargarMes();
    } catch (error) {
      showToast({ message: error.message || 'No se pudo actualizar el arriendo.', type: 'error' });
    }
  };

  const borrarArriendo = async (arriendo) => {
    if (!(await confirmAction({ title: 'Borrar arriendo', message: `¿Confirmas borrar el arriendo de ${arriendo.nombre_arrendatario} (${arriendo.fecha})? Esta acción no se puede deshacer.`, danger: true }))) return;
    try {
      await api.arriendosCanchaAPI.remove(arriendo.id_arriendo);
      showToast({ message: 'Arriendo borrado.', type: 'success' });
      await cargarMes();
    } catch (error) {
      showToast({ message: error.message || 'No se pudo borrar el arriendo.', type: 'error' });
    }
  };

  const resetForm = () => {
    setForm(FORM_VACIO);
    setModoSerie(false);
    setUltimoResultadoSerie(null);
  };

  const guardarReserva = async () => {
    if (!form.nombre_arrendatario.trim()) {
      showToast({ message: 'Ponle un nombre a quien arrienda.', type: 'error' });
      return;
    }
    setGuardando(true);
    setUltimoResultadoSerie(null);
    try {
      if (modoSerie) {
        const resultado = await api.arriendosCanchaAPI.createSerie({
          nombre_arrendatario: form.nombre_arrendatario,
          telefono_contacto: form.telefono_contacto,
          email_contacto: form.email_contacto,
          tipo_serie: form.tipo_serie,
          fecha_inicio: form.fecha_inicio,
          fecha_fin: form.fecha_fin,
          hora_inicio: form.hora_inicio,
          hora_fin: form.hora_fin,
          valor_arriendo: form.valor_arriendo ? Number(form.valor_arriendo) : 0,
          metodo_pago: form.metodo_pago,
          observaciones: form.observaciones,
        });
        setUltimoResultadoSerie(resultado);
        showToast({
          message: resultado.omitidos?.length > 0
            ? `Se crearon ${resultado.creados.length} arriendos. ${resultado.omitidos.length} fechas quedaron fuera por choque de horario.`
            : `Se crearon ${resultado.creados.length} arriendos de la serie.`,
          type: resultado.omitidos?.length > 0 ? 'error' : 'success',
        });
        if (!resultado.omitidos || resultado.omitidos.length === 0) resetForm();
      } else {
        await api.arriendosCanchaAPI.create({
          nombre_arrendatario: form.nombre_arrendatario,
          telefono_contacto: form.telefono_contacto,
          email_contacto: form.email_contacto,
          fecha: form.fecha,
          hora_inicio: form.hora_inicio,
          hora_fin: form.hora_fin,
          valor_arriendo: form.valor_arriendo ? Number(form.valor_arriendo) : 0,
          metodo_pago: form.metodo_pago,
          observaciones: form.observaciones,
        });
        showToast({ message: 'Arriendo registrado correctamente.', type: 'success' });
        resetForm();
      }
      setVista('calendario');
    } catch (error) {
      showToast({ message: error.message || 'No se pudo registrar el arriendo.', type: 'error' });
    } finally {
      setGuardando(false);
    }
  };

  const totalRecaudado = analitica.filter((a) => a.estado_pago === 'pagado').reduce((acc, a) => acc + Number(a.valor_arriendo || 0), 0);
  const totalPendiente = analitica.filter((a) => a.estado_pago === 'pendiente').reduce((acc, a) => acc + Number(a.valor_arriendo || 0), 0);
  const cantidadReservas = analitica.filter((a) => a.estado_pago !== 'anulado').length;
  const horasArrendadas = analitica
    .filter((a) => a.estado_pago !== 'anulado')
    .reduce((acc, a) => {
      const [hIni, mIni] = String(a.hora_inicio || '0:0').split(':').map(Number);
      const [hFin, mFin] = String(a.hora_fin || '0:0').split(':').map(Number);
      return acc + Math.max(0, (hFin * 60 + mFin - (hIni * 60 + mIni)) / 60);
    }, 0);
  const rankingArrendatarios = useMemo(() => {
    const mapa = new Map();
    analitica.filter((a) => a.estado_pago !== 'anulado').forEach((a) => {
      const key = a.nombre_arrendatario;
      mapa.set(key, (mapa.get(key) || 0) + 1);
    });
    return [...mapa.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  }, [analitica]);

  return (
    <div className="mt-20 fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', marginBottom: '14px', flexWrap: 'wrap' }}>
        <h3 className="section-title" style={{ margin: 0 }}><CalendarClock size={18} style={{ verticalAlign: '-3px', marginRight: '6px' }} />Arriendo de Cancha</h3>
      </div>

      <div className="segment-control mb-15" style={{ gap: '6px' }}>
        <button type="button" className={`segment-btn ${vista === 'calendario' ? 'active' : ''}`} onClick={() => setVista('calendario')}>Calendario</button>
        <button type="button" className={`segment-btn ${vista === 'nueva' ? 'active' : ''}`} onClick={() => setVista('nueva')}><Plus size={14} /> Nueva reserva</button>
        <button type="button" className={`segment-btn ${vista === 'analisis' ? 'active' : ''}`} onClick={() => setVista('analisis')}><BarChart3 size={14} /> Análisis</button>
      </div>

      {vista === 'calendario' && (
        <div className="fade-in">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <button type="button" className="btn-secondary" style={{ width: 'auto', padding: '8px 12px' }} onClick={() => cambiarMes(-1)}><ChevronLeft size={16} /></button>
            <strong style={{ fontSize: '15px' }}>{NOMBRES_MESES[mesActivo.getMonth()]} {mesActivo.getFullYear()}</strong>
            <button type="button" className="btn-secondary" style={{ width: 'auto', padding: '8px 12px' }} onClick={() => cambiarMes(1)}><ChevronRight size={16} /></button>
          </div>

          {cargando && <p className="text-muted">Cargando arriendos...</p>}
          {!cargando && arriendosPorFecha.length === 0 && (
            <p className="text-muted text-center italic">No hay arriendos registrados este mes.</p>
          )}

          {!cargando && arriendosPorFecha.map(([fecha, items]) => (
            <div key={fecha} className="card mb-15" style={{ borderRadius: '18px' }}>
              <h5 style={{ margin: '0 0 10px', fontSize: '13px', fontWeight: '900' }}>
                {new Date(`${fecha}T00:00:00`).toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long' })}
              </h5>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {items.map((a) => {
                  const estado = ESTADO_COLOR[a.estado_pago] || ESTADO_COLOR.pendiente;
                  return (
                    <div key={a.id_arriendo} style={{ border: '1px solid var(--borde-suave)', borderRadius: '14px', padding: '10px 12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px', flexWrap: 'wrap' }}>
                        <div>
                          <strong style={{ fontSize: '13px' }}>{a.hora_inicio?.slice(0, 5)} - {a.hora_fin?.slice(0, 5)} · {a.nombre_arrendatario}</strong>
                          <div style={{ fontSize: '11px', color: 'var(--texto-secundario)', fontWeight: '700', marginTop: '4px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                            {a.telefono_contacto && <span><Phone size={11} style={{ verticalAlign: '-1px' }} /> {a.telefono_contacto}</span>}
                            {a.email_contacto && <span><Mail size={11} style={{ verticalAlign: '-1px' }} /> {a.email_contacto}</span>}
                            <span>${Number(a.valor_arriendo || 0).toLocaleString('es-CL')}</span>
                            {a.serie_tipo && <span>Serie {a.serie_tipo}</span>}
                          </div>
                        </div>
                        <span style={{ fontSize: '10px', fontWeight: '800', padding: '3px 8px', borderRadius: '999px', color: estado.color, background: estado.bg }}>
                          {estado.label}
                        </span>
                      </div>
                      <div style={{ display: 'flex', gap: '6px', marginTop: '8px', flexWrap: 'wrap' }}>
                        {a.estado_pago !== 'pagado' && (
                          <button className="btn-secondary" style={{ width: 'auto', padding: '6px 10px', fontSize: '11px' }} onClick={() => marcarEstado(a, 'pagado')}>Marcar pagado</button>
                        )}
                        {a.estado_pago !== 'anulado' && (
                          <button className="btn-secondary" style={{ width: 'auto', padding: '6px 10px', fontSize: '11px' }} onClick={() => marcarEstado(a, 'anulado')}>Anular</button>
                        )}
                        {a.estado_pago === 'anulado' && (
                          <button className="btn-secondary" style={{ width: 'auto', padding: '6px 10px', fontSize: '11px' }} onClick={() => marcarEstado(a, 'pendiente')}>Reactivar</button>
                        )}
                        <button
                          className="btn-secondary"
                          style={{ width: 'auto', padding: '6px 10px', fontSize: '11px', borderColor: 'rgba(255,59,48,0.35)', color: '#b91c1c' }}
                          onClick={() => borrarArriendo(a)}
                        >
                          Borrar
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {vista === 'nueva' && (
        <div className="card fade-in" style={{ borderRadius: '20px' }}>
          <div className="segment-control mb-15" style={{ gap: '6px' }}>
            <button type="button" className={`segment-btn ${!modoSerie ? 'active' : ''}`} onClick={() => setModoSerie(false)}>Reserva única</button>
            <button type="button" className={`segment-btn ${modoSerie ? 'active' : ''}`} onClick={() => setModoSerie(true)}>Serie recurrente</button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Nombre arrendatario *</label>
              <input className="form-input" value={form.nombre_arrendatario} onChange={(e) => setForm((p) => ({ ...p, nombre_arrendatario: e.target.value }))} placeholder="Ej: Juan Pérez" />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Teléfono</label>
              <input className="form-input" value={form.telefono_contacto} onChange={(e) => setForm((p) => ({ ...p, telefono_contacto: e.target.value }))} placeholder="+56 9..." />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Correo (opcional)</label>
              <input className="form-input" value={form.email_contacto} onChange={(e) => setForm((p) => ({ ...p, email_contacto: e.target.value }))} />
            </div>

            {!modoSerie ? (
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Fecha</label>
                <input type="date" className="form-input" value={form.fecha} onChange={(e) => setForm((p) => ({ ...p, fecha: e.target.value }))} />
              </div>
            ) : (
              <>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Tipo de serie</label>
                  <select className="form-input" value={form.tipo_serie} onChange={(e) => setForm((p) => ({ ...p, tipo_serie: e.target.value }))}>
                    <option value="diaria">Diaria</option>
                    <option value="semanal">Semanal</option>
                    <option value="mensual">Mensual</option>
                  </select>
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Desde</label>
                  <input type="date" className="form-input" value={form.fecha_inicio} onChange={(e) => setForm((p) => ({ ...p, fecha_inicio: e.target.value }))} />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Hasta</label>
                  <input type="date" className="form-input" value={form.fecha_fin} onChange={(e) => setForm((p) => ({ ...p, fecha_fin: e.target.value }))} />
                </div>
              </>
            )}

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Hora inicio</label>
              <input type="time" className="form-input" value={form.hora_inicio} onChange={(e) => setForm((p) => ({ ...p, hora_inicio: e.target.value }))} />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Hora término</label>
              <input type="time" className="form-input" value={form.hora_fin} onChange={(e) => setForm((p) => ({ ...p, hora_fin: e.target.value }))} />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Valor {modoSerie ? '(por fecha)' : ''}</label>
              <input type="number" min="0" className="form-input" value={form.valor_arriendo} onChange={(e) => setForm((p) => ({ ...p, valor_arriendo: e.target.value }))} placeholder="Ej: 15000" />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Método de pago</label>
              <input className="form-input" value={form.metodo_pago} onChange={(e) => setForm((p) => ({ ...p, metodo_pago: e.target.value }))} placeholder="Efectivo, transferencia..." />
            </div>
            <div className="form-group" style={{ marginBottom: 0, gridColumn: '1 / -1' }}>
              <label>Observaciones</label>
              <textarea className="form-input" rows="2" value={form.observaciones} onChange={(e) => setForm((p) => ({ ...p, observaciones: e.target.value }))} />
            </div>
          </div>

          {ultimoResultadoSerie?.omitidos?.length > 0 && (
            <div className="card mt-15" style={{ borderLeft: '4px solid var(--rojo-alerta)', borderRadius: '16px', background: 'rgba(255,59,48,0.06)' }}>
              <strong style={{ fontSize: '12px', color: '#b91c1c' }}>Fechas que no se pudieron reservar (choque de horario):</strong>
              <ul style={{ margin: '8px 0 0', paddingLeft: '18px', fontSize: '12px' }}>
                {ultimoResultadoSerie.omitidos.map((o) => (
                  <li key={o.fecha}>{o.fecha}: {o.motivo}</li>
                ))}
              </ul>
            </div>
          )}

          <button className="btn-electric mt-15" onClick={guardarReserva} disabled={guardando}>
            {guardando ? 'Guardando...' : modoSerie ? 'Generar serie de arriendos' : 'Guardar reserva'}
          </button>
        </div>
      )}

      {vista === 'analisis' && (
        <div className="fade-in">
          <div className="card mb-15" style={{ borderRadius: '18px' }}>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '10px' }}>
              <button className="btn-secondary" style={{ width: 'auto', padding: '8px 14px', fontSize: '12px' }} onClick={() => { setAnaliticaDesde(hoyISO()); setAnaliticaHasta(hoyISO()); }}>Hoy</button>
              <button className="btn-secondary" style={{ width: 'auto', padding: '8px 14px', fontSize: '12px' }} onClick={() => { setAnaliticaDesde(inicioSemanaISO()); setAnaliticaHasta(hoyISO()); }}>Esta semana</button>
              <button className="btn-secondary" style={{ width: 'auto', padding: '8px 14px', fontSize: '12px' }} onClick={() => { setAnaliticaDesde(inicioMesISO()); setAnaliticaHasta(hoyISO()); }}>Este mes</button>
            </div>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
              <input type="date" className="form-input" style={{ maxWidth: '160px' }} value={analiticaDesde} onChange={(e) => setAnaliticaDesde(e.target.value)} />
              <span>a</span>
              <input type="date" className="form-input" style={{ maxWidth: '160px' }} value={analiticaHasta} onChange={(e) => setAnaliticaHasta(e.target.value)} />
            </div>
          </div>

          {cargandoAnalitica && <p className="text-muted">Calculando...</p>}

          {!cargandoAnalitica && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '8px', marginBottom: '15px' }}>
                <div className="admin-stat-pill verde"><span>Recaudado</span><h2>${totalRecaudado.toLocaleString('es-CL')}</h2></div>
                <div className="admin-stat-pill" style={{ background: 'rgba(255,149,0,0.1)' }}><span>Pendiente de cobro</span><h2 style={{ color: '#b36200' }}>${totalPendiente.toLocaleString('es-CL')}</h2></div>
                <div className="admin-stat-pill azul"><span>Reservas</span><h2>{cantidadReservas}</h2></div>
                <div className="admin-stat-pill azul"><span>Horas arrendadas</span><h2>{horasArrendadas.toFixed(1)}</h2></div>
              </div>

              <h4 className="form-subtitle">Arrendatarios frecuentes</h4>
              {rankingArrendatarios.length === 0 && (
                <p className="text-muted italic">Sin datos en el período seleccionado.</p>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {rankingArrendatarios.map(([nombre, cantidad]) => (
                  <div key={nombre} style={{ display: 'flex', justifyContent: 'space-between', border: '1px solid var(--borde-suave)', borderRadius: '12px', padding: '8px 12px', fontSize: '13px' }}>
                    <span>{nombre}</span>
                    <strong>{cantidad} {cantidad === 1 ? 'reserva' : 'reservas'}</strong>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default CanchaArriendoPanel;
