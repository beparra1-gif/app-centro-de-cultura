import { useEffect, useMemo, useState } from 'react';
import { CalendarClock, Plus, BarChart3, Phone, Mail, X } from 'lucide-react';
import * as api from '../api/client';
import { showToast } from '../utils/toast';
import { confirmAction } from '../utils/confirmDialog';
import { colorBarraPorRama } from '../utils/coloresRama';
import CalendarioGrilla from './CalendarioGrilla';

const hoyISO = () => new Date().toISOString().slice(0, 10);

const inicioSemanaISO = () => {
  const d = new Date();
  const dia = d.getDay();
  const diff = dia === 0 ? 6 : dia - 1;
  d.setDate(d.getDate() - diff);
  return d.toISOString().slice(0, 10);
};

const inicioMesISO = (fecha = new Date()) => new Date(fecha.getFullYear(), fecha.getMonth(), 1).toISOString().slice(0, 10);

const FORM_VACIO = {
  nombre_arrendatario: '',
  telefono_contacto: '',
  email_contacto: '',
  hora_inicio: '10:00',
  hora_fin: '11:00',
  valor_arriendo: '',
  metodo_pago: '',
  observaciones: '',
};

const RANGO_VACIO = {
  tipo: 'semanal',
  desde: hoyISO(),
  hasta: hoyISO(),
};

// Misma lógica que antes vivía solo en el backend (endpoint /serie) — ahora
// el frontend arma la lista de fechas (a mano, por patrón, o mezclando
// ambas) y el backend solo recibe un array explícito. Evita mantener dos
// veces la generación de fechas y deja "reserva única" y "varias fechas"
// como el mismo flujo.
const generarFechasPorPatron = ({ tipo, desde, hasta }) => {
  const inicio = new Date(`${desde}T00:00:00`);
  const fin = new Date(`${hasta}T00:00:00`);
  if (Number.isNaN(inicio.getTime()) || Number.isNaN(fin.getTime()) || fin < inicio) return null;

  const fechas = [];
  if (tipo === 'diaria') {
    for (let d = new Date(inicio); d <= fin; d.setDate(d.getDate() + 1)) fechas.push(new Date(d));
  } else if (tipo === 'semanal') {
    for (let d = new Date(inicio); d <= fin; d.setDate(d.getDate() + 7)) fechas.push(new Date(d));
  } else {
    const diaMes = inicio.getDate();
    for (let d = new Date(inicio); d <= fin; d.setMonth(d.getMonth() + 1)) {
      const candidato = new Date(d.getFullYear(), d.getMonth(), diaMes);
      if (candidato.getMonth() === d.getMonth() && candidato <= fin) fechas.push(candidato);
    }
  }
  return fechas.map((d) => d.toISOString().slice(0, 10));
};

const ESTADO_COLOR = {
  pendiente: { bg: 'rgba(255,149,0,0.12)', color: '#b36200', label: 'Pendiente' },
  pagado: { bg: 'rgba(52,199,89,0.14)', color: '#1c7a3d', label: 'Pagado' },
  anulado: { bg: 'rgba(120,120,128,0.12)', color: '#666', label: 'Anulado' },
};

// Colores sólidos para las barras de evento del calendario (arriendo vs
// entrenamiento deben distinguirse a simple vista, y cada estado de arriendo
// también) — distintos de ESTADO_COLOR, que son tonos pastel para badges.
const COLOR_BARRA_ARRIENDO = {
  pendiente: '#FF9500',
  pagado: '#34C759',
  anulado: '#8E8E93',
};

function CanchaArriendoPanel() {
  const [vista, setVista] = useState('calendario');
  const [vistaCalendario, setVistaCalendario] = useState('mes');
  const [fechaFoco, setFechaFoco] = useState(new Date());
  const [rangoCalendario, setRangoCalendario] = useState({ desde: '', hasta: '' });
  const [arriendos, setArriendos] = useState([]);
  const [entrenamientosCalendario, setEntrenamientosCalendario] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [arriendoSeleccionado, setArriendoSeleccionado] = useState(null);
  const [entrenamientoSeleccionado, setEntrenamientoSeleccionado] = useState(null);

  const [form, setForm] = useState(FORM_VACIO);
  const [fechasSeleccionadas, setFechasSeleccionadas] = useState([hoyISO()]);
  const [fechaParaAgregar, setFechaParaAgregar] = useState(hoyISO());
  const [mostrarRangoAutomatico, setMostrarRangoAutomatico] = useState(false);
  const [rango, setRango] = useState(RANGO_VACIO);
  const [guardando, setGuardando] = useState(false);
  const [ultimoResultadoLote, setUltimoResultadoLote] = useState(null);

  const [analiticaDesde, setAnaliticaDesde] = useState(inicioMesISO());
  const [analiticaHasta, setAnaliticaHasta] = useState(hoyISO());
  const [analitica, setAnalitica] = useState([]);
  const [cargandoAnalitica, setCargandoAnalitica] = useState(false);

  // El horario de entrenamientos es de solo lectura acá (se gestiona en su
  // propio apartado, con su propio permiso) — si no está disponible o el
  // usuario no tiene acceso a esa API, la grilla simplemente no muestra esa
  // capa en vez de romper la carga de arriendos.
  const cargarRango = async (desde, hasta) => {
    if (!desde || !hasta) return;
    setCargando(true);
    try {
      const [datosArriendos, datosEntrenamientos] = await Promise.all([
        api.arriendosCanchaAPI.getAll({ desde, hasta }),
        api.horariosEntrenamientoAPI.getInstancias({ desde, hasta }).catch(() => []),
      ]);
      setArriendos(Array.isArray(datosArriendos) ? datosArriendos : []);
      setEntrenamientosCalendario(Array.isArray(datosEntrenamientos) ? datosEntrenamientos : []);
    } catch (error) {
      showToast({ message: error.message || 'No se pudo cargar el calendario de arriendos.', type: 'error' });
      setArriendos([]);
      setEntrenamientosCalendario([]);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    if (vista !== 'calendario') return;
    if (!rangoCalendario.desde || !rangoCalendario.hasta) return;
    (async () => { await cargarRango(rangoCalendario.desde, rangoCalendario.hasta); })();
  }, [vista, rangoCalendario.desde, rangoCalendario.hasta]);

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

  const eventosCalendario = useMemo(() => {
    const eventosArriendos = arriendos.map((a) => ({
      id: `arriendo-${a.id_arriendo}`,
      fecha: String(a.fecha).slice(0, 10),
      horaInicio: String(a.hora_inicio || '00:00').slice(0, 5),
      horaFin: String(a.hora_fin || '00:00').slice(0, 5),
      titulo: a.nombre_arrendatario,
      subtitulo: a.telefono_contacto || '',
      color: COLOR_BARRA_ARRIENDO[a.estado_pago] || COLOR_BARRA_ARRIENDO.pendiente,
      tipo: 'arriendo',
      raw: a,
    }));
    const eventosEntrenamientos = entrenamientosCalendario.map((e) => ({
      id: `entreno-${e.id_horario}_${e.fecha}`,
      fecha: e.fecha,
      horaInicio: String(e.hora_inicio || '00:00').slice(0, 5),
      horaFin: String(e.hora_fin || '00:00').slice(0, 5),
      titulo: `${e.rama} ${e.categoria}`,
      subtitulo: e.entrenador_a_cargo || '',
      color: colorBarraPorRama(e.rama),
      tipo: 'entrenamiento',
      raw: e,
    }));
    return [...eventosArriendos, ...eventosEntrenamientos];
  }, [arriendos, entrenamientosCalendario]);

  const manejarRangoVisible = (desde, hasta) => {
    setRangoCalendario((prev) => (prev.desde === desde && prev.hasta === hasta ? prev : { desde, hasta }));
  };

  const manejarClickEvento = (evento) => {
    if (evento.tipo === 'arriendo') {
      setArriendoSeleccionado(evento.raw);
      setEntrenamientoSeleccionado(null);
    } else {
      setEntrenamientoSeleccionado(evento.raw);
      setArriendoSeleccionado(null);
    }
  };

  const marcarEstado = async (arriendo, nuevoEstado) => {
    try {
      await api.arriendosCanchaAPI.update(arriendo.id_arriendo, { estado_pago: nuevoEstado });
      showToast({ message: `Arriendo de ${arriendo.nombre_arrendatario} marcado como ${ESTADO_COLOR[nuevoEstado]?.label || nuevoEstado}.`, type: 'success' });
      setArriendoSeleccionado(null);
      await cargarRango(rangoCalendario.desde, rangoCalendario.hasta);
    } catch (error) {
      showToast({ message: error.message || 'No se pudo actualizar el arriendo.', type: 'error' });
    }
  };

  const borrarArriendo = async (arriendo) => {
    if (!(await confirmAction({ title: 'Borrar arriendo', message: `¿Confirmas borrar el arriendo de ${arriendo.nombre_arrendatario} (${arriendo.fecha})? Esta acción no se puede deshacer.`, danger: true }))) return;
    try {
      await api.arriendosCanchaAPI.remove(arriendo.id_arriendo);
      showToast({ message: 'Arriendo borrado.', type: 'success' });
      setArriendoSeleccionado(null);
      await cargarRango(rangoCalendario.desde, rangoCalendario.hasta);
    } catch (error) {
      showToast({ message: error.message || 'No se pudo borrar el arriendo.', type: 'error' });
    }
  };

  const resetForm = () => {
    setForm(FORM_VACIO);
    setFechasSeleccionadas([hoyISO()]);
    setFechaParaAgregar(hoyISO());
    setMostrarRangoAutomatico(false);
    setRango(RANGO_VACIO);
    setUltimoResultadoLote(null);
  };

  const agregarFecha = () => {
    if (!fechaParaAgregar) return;
    if (fechasSeleccionadas.includes(fechaParaAgregar)) {
      showToast({ message: 'Esa fecha ya está en la lista.', type: 'error' });
      return;
    }
    setFechasSeleccionadas((prev) => [...prev, fechaParaAgregar].sort());
  };

  const quitarFecha = (fecha) => {
    setFechasSeleccionadas((prev) => prev.filter((f) => f !== fecha));
  };

  const agregarRangoAutomatico = () => {
    const nuevas = generarFechasPorPatron(rango);
    if (!nuevas) {
      showToast({ message: 'Rango de fechas inválido.', type: 'error' });
      return;
    }
    if (nuevas.length > 60) {
      showToast({ message: `Eso generaría ${nuevas.length} fechas — acorta el rango (máximo 60 de una vez).`, type: 'error' });
      return;
    }
    setFechasSeleccionadas((prev) => [...new Set([...prev, ...nuevas])].sort());
    showToast({ message: `${nuevas.length} fecha${nuevas.length === 1 ? '' : 's'} agregada${nuevas.length === 1 ? '' : 's'} a la lista.`, type: 'success' });
  };

  const guardarReserva = async () => {
    if (!form.nombre_arrendatario.trim()) {
      showToast({ message: 'Ponle un nombre a quien arrienda.', type: 'error' });
      return;
    }
    if (fechasSeleccionadas.length === 0) {
      showToast({ message: 'Elige al menos una fecha.', type: 'error' });
      return;
    }
    setGuardando(true);
    setUltimoResultadoLote(null);
    try {
      const resultado = await api.arriendosCanchaAPI.createLote({
        nombre_arrendatario: form.nombre_arrendatario,
        telefono_contacto: form.telefono_contacto,
        email_contacto: form.email_contacto,
        fechas: fechasSeleccionadas,
        hora_inicio: form.hora_inicio,
        hora_fin: form.hora_fin,
        valor_arriendo: form.valor_arriendo ? Number(form.valor_arriendo) : 0,
        metodo_pago: form.metodo_pago,
        observaciones: form.observaciones,
      });
      setUltimoResultadoLote(resultado);
      showToast({
        message: resultado.omitidos?.length > 0
          ? `Se registraron ${resultado.creados.length} arriendos. ${resultado.omitidos.length} fecha${resultado.omitidos.length === 1 ? '' : 's'} quedaron fuera por choque de horario.`
          : `Se registraron ${resultado.creados.length} arriendo${resultado.creados.length === 1 ? '' : 's'}.`,
        type: resultado.omitidos?.length > 0 ? 'error' : 'success',
      });
      if (!resultado.omitidos || resultado.omitidos.length === 0) {
        resetForm();
        setVista('calendario');
      }
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
          <div style={{ display: 'flex', gap: '14px', fontSize: '11px', fontWeight: '800', color: 'var(--texto-secundario)', marginBottom: '10px', flexWrap: 'wrap' }}>
            <span><span style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '3px', background: COLOR_BARRA_ARRIENDO.pendiente, marginRight: '4px', verticalAlign: '-1px' }} />Arriendo pendiente</span>
            <span><span style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '3px', background: COLOR_BARRA_ARRIENDO.pagado, marginRight: '4px', verticalAlign: '-1px' }} />Arriendo pagado</span>
            <span><span style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '3px', background: colorBarraPorRama('masculina'), marginRight: '4px', verticalAlign: '-1px' }} />Entrenamiento masculino</span>
            <span><span style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '3px', background: colorBarraPorRama('femenina'), marginRight: '4px', verticalAlign: '-1px' }} />Entrenamiento femenino</span>
            <span><span style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '3px', background: colorBarraPorRama('mixta'), marginRight: '4px', verticalAlign: '-1px' }} />Entrenamiento mixto</span>
          </div>

          {cargando && <p className="text-muted">Cargando calendario...</p>}

          <CalendarioGrilla
            vista={vistaCalendario}
            fechaFoco={fechaFoco}
            eventos={eventosCalendario}
            onCambiarFoco={setFechaFoco}
            onCambiarVista={setVistaCalendario}
            onClickEvento={manejarClickEvento}
            onRangoVisibleChange={manejarRangoVisible}
          />

          {arriendoSeleccionado && (
            <div className="card mt-15" style={{ borderRadius: '16px', borderLeft: `4px solid ${COLOR_BARRA_ARRIENDO[arriendoSeleccionado.estado_pago] || COLOR_BARRA_ARRIENDO.pendiente}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px', flexWrap: 'wrap' }}>
                <div>
                  <strong style={{ fontSize: '14px' }}>
                    {arriendoSeleccionado.hora_inicio?.slice(0, 5)} - {arriendoSeleccionado.hora_fin?.slice(0, 5)} · {arriendoSeleccionado.nombre_arrendatario}
                  </strong>
                  <div style={{ fontSize: '11px', color: 'var(--texto-secundario)', fontWeight: '700', marginTop: '4px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    {arriendoSeleccionado.telefono_contacto && <span><Phone size={11} style={{ verticalAlign: '-1px' }} /> {arriendoSeleccionado.telefono_contacto}</span>}
                    {arriendoSeleccionado.email_contacto && <span><Mail size={11} style={{ verticalAlign: '-1px' }} /> {arriendoSeleccionado.email_contacto}</span>}
                    <span>${Number(arriendoSeleccionado.valor_arriendo || 0).toLocaleString('es-CL')}</span>
                    {arriendoSeleccionado.serie_tipo && <span>Serie {arriendoSeleccionado.serie_tipo}</span>}
                  </div>
                </div>
                <button type="button" onClick={() => setArriendoSeleccionado(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--texto-secundario)' }} aria-label="Cerrar">
                  <X size={16} />
                </button>
              </div>
              <div style={{ display: 'flex', gap: '6px', marginTop: '10px', flexWrap: 'wrap' }}>
                {arriendoSeleccionado.estado_pago !== 'pagado' && (
                  <button className="btn-secondary" style={{ width: 'auto', padding: '6px 10px', fontSize: '11px' }} onClick={() => marcarEstado(arriendoSeleccionado, 'pagado')}>Marcar pagado</button>
                )}
                {arriendoSeleccionado.estado_pago !== 'anulado' && (
                  <button className="btn-secondary" style={{ width: 'auto', padding: '6px 10px', fontSize: '11px' }} onClick={() => marcarEstado(arriendoSeleccionado, 'anulado')}>Anular</button>
                )}
                {arriendoSeleccionado.estado_pago === 'anulado' && (
                  <button className="btn-secondary" style={{ width: 'auto', padding: '6px 10px', fontSize: '11px' }} onClick={() => marcarEstado(arriendoSeleccionado, 'pendiente')}>Reactivar</button>
                )}
                <button
                  className="btn-secondary"
                  style={{ width: 'auto', padding: '6px 10px', fontSize: '11px', borderColor: 'rgba(255,59,48,0.35)', color: '#b91c1c' }}
                  onClick={() => borrarArriendo(arriendoSeleccionado)}
                >
                  Borrar
                </button>
              </div>
            </div>
          )}

          {entrenamientoSeleccionado && (
            <div className="card mt-15" style={{ borderRadius: '16px', borderLeft: `4px solid ${colorBarraPorRama(entrenamientoSeleccionado.rama)}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                <div>
                  <strong style={{ fontSize: '14px' }}>
                    {entrenamientoSeleccionado.hora_inicio?.slice(0, 5)} - {entrenamientoSeleccionado.hora_fin?.slice(0, 5)} · {entrenamientoSeleccionado.rama} {entrenamientoSeleccionado.categoria}
                  </strong>
                  <div style={{ fontSize: '11px', color: 'var(--texto-secundario)', fontWeight: '700', marginTop: '4px' }}>
                    {entrenamientoSeleccionado.entrenador_a_cargo && <span>Profesor: {entrenamientoSeleccionado.entrenador_a_cargo}</span>}
                    {entrenamientoSeleccionado.lugar && <span> · {entrenamientoSeleccionado.lugar}</span>}
                    {entrenamientoSeleccionado.es_reprogramado && <span> · Reprogramado esta fecha</span>}
                  </div>
                </div>
                <button type="button" onClick={() => setEntrenamientoSeleccionado(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--texto-secundario)' }} aria-label="Cerrar">
                  <X size={16} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {vista === 'nueva' && (
        <div className="card fade-in" style={{ borderRadius: '20px' }}>
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
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Hora inicio</label>
              <input type="time" className="form-input" value={form.hora_inicio} onChange={(e) => setForm((p) => ({ ...p, hora_inicio: e.target.value }))} />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Hora término</label>
              <input type="time" className="form-input" value={form.hora_fin} onChange={(e) => setForm((p) => ({ ...p, hora_fin: e.target.value }))} />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Valor {fechasSeleccionadas.length > 1 ? '(por fecha)' : ''}</label>
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

          <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px dashed var(--borde-suave)' }}>
            <label style={{ display: 'block', marginBottom: '8px' }}>Días a reservar (misma hora en todos)</label>

            {fechasSeleccionadas.length === 0 ? (
              <p className="text-muted italic" style={{ fontSize: '12px', margin: '0 0 10px' }}>Todavía no eliges ninguna fecha.</p>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '10px' }}>
                {fechasSeleccionadas.map((f) => (
                  <span
                    key={f}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '12px', fontWeight: '700', background: 'rgba(0,122,255,0.08)', color: 'var(--azul-electrico)', borderRadius: '999px', padding: '5px 6px 5px 12px' }}
                  >
                    {new Date(`${f}T00:00:00`).toLocaleDateString('es-CL', { day: 'numeric', month: 'short' })}
                    <button
                      type="button"
                      onClick={() => quitarFecha(f)}
                      style={{ background: 'rgba(0,122,255,0.16)', border: 'none', borderRadius: '999px', width: '18px', height: '18px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'inherit' }}
                      aria-label={`Quitar ${f}`}
                    >
                      <X size={11} />
                    </button>
                  </span>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label style={{ fontSize: '11px' }}>Agregar fecha</label>
                <input type="date" className="form-input" value={fechaParaAgregar} onChange={(e) => setFechaParaAgregar(e.target.value)} />
              </div>
              <button type="button" className="btn-secondary" style={{ width: 'auto', padding: '10px 14px' }} onClick={agregarFecha}>
                <Plus size={14} /> Agregar
              </button>
              <button
                type="button"
                className="btn-secondary"
                style={{ width: 'auto', padding: '10px 14px' }}
                onClick={() => setMostrarRangoAutomatico((v) => !v)}
              >
                {mostrarRangoAutomatico ? 'Ocultar rango automático' : 'Agregar varias fechas seguidas...'}
              </button>
            </div>

            {mostrarRangoAutomatico && (
              <div style={{ marginTop: '10px', display: 'flex', gap: '8px', alignItems: 'flex-end', flexWrap: 'wrap', background: 'rgba(0,122,255,0.04)', borderRadius: '14px', padding: '10px' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label style={{ fontSize: '11px' }}>Repetir</label>
                  <select className="form-input" value={rango.tipo} onChange={(e) => setRango((p) => ({ ...p, tipo: e.target.value }))}>
                    <option value="diaria">Todos los días</option>
                    <option value="semanal">Semanal</option>
                    <option value="mensual">Mensual</option>
                  </select>
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label style={{ fontSize: '11px' }}>Desde</label>
                  <input type="date" className="form-input" value={rango.desde} onChange={(e) => setRango((p) => ({ ...p, desde: e.target.value }))} />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label style={{ fontSize: '11px' }}>Hasta</label>
                  <input type="date" className="form-input" value={rango.hasta} onChange={(e) => setRango((p) => ({ ...p, hasta: e.target.value }))} />
                </div>
                <button type="button" className="btn-secondary" style={{ width: 'auto', padding: '10px 14px' }} onClick={agregarRangoAutomatico}>
                  Agregar a la lista
                </button>
              </div>
            )}
          </div>

          {ultimoResultadoLote?.omitidos?.length > 0 && (
            <div className="card mt-15" style={{ borderLeft: '4px solid var(--rojo-alerta)', borderRadius: '16px', background: 'rgba(255,59,48,0.06)' }}>
              <strong style={{ fontSize: '12px', color: '#b91c1c' }}>Fechas que no se pudieron reservar (choque de horario):</strong>
              <ul style={{ margin: '8px 0 0', paddingLeft: '18px', fontSize: '12px' }}>
                {ultimoResultadoLote.omitidos.map((o) => (
                  <li key={o.fecha}>{o.fecha}: {o.motivo}</li>
                ))}
              </ul>
            </div>
          )}

          <button className="btn-electric mt-15" onClick={guardarReserva} disabled={guardando}>
            {guardando ? 'Guardando...' : `Guardar ${fechasSeleccionadas.length > 1 ? `${fechasSeleccionadas.length} reservas` : 'reserva'}`}
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
