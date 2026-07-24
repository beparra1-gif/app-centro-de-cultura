import { useState } from 'react';
import { CalendarClock, Plus, BarChart3, Phone, Mail, X } from 'lucide-react';
import * as api from '../api/client';
import { showToast } from '../utils/toast';
import { confirmAction } from '../utils/confirmDialog';
import { colorBarraPorRama } from '../utils/coloresRama';
import { useCalendarioCanchaEntrenamientos, COLOR_BARRA_ARRIENDO } from '../utils/useCalendarioCanchaEntrenamientos';
import CalendarioGrilla from './CalendarioGrilla';
import CanchaEntrenamientosDiaModal from './CanchaEntrenamientosDiaModal';
import CanchaEntrenamientosReservaForm from './CanchaEntrenamientosReservaForm';
import CanchaEntrenamientosHorarioForm from './CanchaEntrenamientosHorarioForm';
import CanchaEntrenamientosExcepciones from './CanchaEntrenamientosExcepciones';
import CanchaEntrenamientosAnalisis from './CanchaEntrenamientosAnalisis';

const ESTADO_LABEL = { pendiente: 'Pendiente', parcial: 'Parcial', pagado: 'Pagado', anulado: 'Anulado' };

function CanchaEntrenamientosPanel({ puedeCancha, puedeHorarios }) {
  const [vista, setVista] = useState('calendario');
  const [vistaCalendario, setVistaCalendario] = useState('mes');
  const [fechaFoco, setFechaFoco] = useState(new Date());
  const [diaModalFecha, setDiaModalFecha] = useState(null);
  const [arriendoSeleccionado, setArriendoSeleccionado] = useState(null);
  const [entrenamientoSeleccionado, setEntrenamientoSeleccionado] = useState(null);
  const [arriendoParaEditar, setArriendoParaEditar] = useState(null);
  const [mostrarFormPago, setMostrarFormPago] = useState(false);
  const [abono, setAbono] = useState('');
  const [metodoPagoAbono, setMetodoPagoAbono] = useState('Efectivo');

  const { manejarRangoVisible, eventos, cargando, recargar } = useCalendarioCanchaEntrenamientos({ puedeCancha });

  const manejarClickEvento = (evento) => {
    setMostrarFormPago(false);
    if (evento.tipo === 'arriendo') {
      setArriendoSeleccionado(evento.raw);
      setEntrenamientoSeleccionado(null);
    } else {
      setEntrenamientoSeleccionado(evento.raw);
      setArriendoSeleccionado(null);
    }
    setDiaModalFecha(null);
  };

  const marcarEstado = async (arriendo, nuevoEstado) => {
    try {
      await api.arriendosCanchaAPI.update(arriendo.id_arriendo, { estado_pago: nuevoEstado });
      showToast({ message: `Arriendo de ${arriendo.nombre_arrendatario} marcado como ${ESTADO_LABEL[nuevoEstado] || nuevoEstado}.`, type: 'success' });
      setArriendoSeleccionado(null);
      await recargar();
    } catch (error) {
      showToast({ message: error.message || 'No se pudo actualizar el arriendo.', type: 'error' });
    }
  };

  const abrirFormPago = (arriendo) => {
    const saldo = Math.max(0, Number(arriendo.valor_arriendo || 0) - Number(arriendo.monto_pagado || 0));
    setAbono(String(saldo));
    setMetodoPagoAbono('Efectivo');
    setMostrarFormPago(true);
  };

  const registrarPago = async (arriendo) => {
    const montoAbono = Number(abono);
    if (Number.isNaN(montoAbono) || montoAbono <= 0) {
      showToast({ message: 'Ingresa un monto de abono válido.', type: 'error' });
      return;
    }
    try {
      const nuevoMonto = Number(arriendo.monto_pagado || 0) + montoAbono;
      await api.arriendosCanchaAPI.update(arriendo.id_arriendo, { monto_pagado: nuevoMonto, metodo_pago: metodoPagoAbono });
      showToast({ message: `Pago registrado para ${arriendo.nombre_arrendatario}.`, type: 'success' });
      setArriendoSeleccionado(null);
      setMostrarFormPago(false);
      await recargar();
    } catch (error) {
      showToast({ message: error.message || 'No se pudo registrar el pago.', type: 'error' });
    }
  };

  const borrarArriendo = async (arriendo) => {
    if (!(await confirmAction({ title: 'Borrar arriendo', message: `¿Confirmas borrar el arriendo de ${arriendo.nombre_arrendatario} (${arriendo.fecha})? Esta acción no se puede deshacer.`, danger: true }))) return;
    try {
      await api.arriendosCanchaAPI.remove(arriendo.id_arriendo);
      showToast({ message: 'Arriendo borrado.', type: 'success' });
      setArriendoSeleccionado(null);
      await recargar();
    } catch (error) {
      showToast({ message: error.message || 'No se pudo borrar el arriendo.', type: 'error' });
    }
  };

  const borrarSerie = async (arriendo) => {
    if (!(await confirmAction({ title: 'Borrar toda la serie', message: `¿Confirmas borrar TODAS las fechas de la serie de ${arriendo.nombre_arrendatario}, no solo esta? Esta acción no se puede deshacer.`, danger: true }))) return;
    try {
      await api.arriendosCanchaAPI.removeSerie(arriendo.serie_id);
      showToast({ message: 'Serie borrada.', type: 'success' });
      setArriendoSeleccionado(null);
      await recargar();
    } catch (error) {
      showToast({ message: error.message || 'No se pudo borrar la serie.', type: 'error' });
    }
  };

  return (
    <div className="mt-20 fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', marginBottom: '14px', flexWrap: 'wrap' }}>
        <h3 className="section-title" style={{ margin: 0 }}><CalendarClock size={18} style={{ verticalAlign: '-3px', marginRight: '6px' }} />Cancha y Entrenamientos</h3>
      </div>

      <div className="segment-control mb-15" style={{ gap: '6px', flexWrap: 'wrap' }}>
        <button type="button" className={`segment-btn ${vista === 'calendario' ? 'active' : ''}`} onClick={() => setVista('calendario')}>Calendario</button>
        {puedeCancha && <button type="button" className={`segment-btn ${vista === 'nueva' ? 'active' : ''}`} onClick={() => { setArriendoParaEditar(null); setVista('nueva'); }}><Plus size={14} /> Nueva reserva</button>}
        {puedeHorarios && <button type="button" className={`segment-btn ${vista === 'horarios' ? 'active' : ''}`} onClick={() => setVista('horarios')}>Horarios</button>}
        {puedeHorarios && <button type="button" className={`segment-btn ${vista === 'excepciones' ? 'active' : ''}`} onClick={() => setVista('excepciones')}>Excepciones</button>}
        {puedeCancha && <button type="button" className={`segment-btn ${vista === 'analisis' ? 'active' : ''}`} onClick={() => setVista('analisis')}><BarChart3 size={14} /> Análisis</button>}
      </div>

      {vista === 'calendario' && (
        <div className="fade-in">
          <div style={{ display: 'flex', gap: '14px', fontSize: '11px', fontWeight: '800', color: 'var(--texto-secundario)', marginBottom: '10px', flexWrap: 'wrap' }}>
            <span><span style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '3px', background: COLOR_BARRA_ARRIENDO.pendiente, marginRight: '4px', verticalAlign: '-1px' }} />Arriendo pendiente</span>
            <span><span style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '3px', background: COLOR_BARRA_ARRIENDO.parcial, marginRight: '4px', verticalAlign: '-1px' }} />Arriendo parcial</span>
            <span><span style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '3px', background: COLOR_BARRA_ARRIENDO.pagado, marginRight: '4px', verticalAlign: '-1px' }} />Arriendo pagado</span>
            <span><span style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '3px', background: colorBarraPorRama('masculina'), marginRight: '4px', verticalAlign: '-1px' }} />Entrenamiento masculino</span>
            <span><span style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '3px', background: colorBarraPorRama('femenina'), marginRight: '4px', verticalAlign: '-1px' }} />Entrenamiento femenino</span>
            <span><span style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '3px', background: colorBarraPorRama('mixta'), marginRight: '4px', verticalAlign: '-1px' }} />Entrenamiento mixto</span>
          </div>

          {cargando && <p className="text-muted">Cargando calendario...</p>}

          <CalendarioGrilla
            vista={vistaCalendario}
            fechaFoco={fechaFoco}
            eventos={eventos}
            onCambiarFoco={setFechaFoco}
            onCambiarVista={setVistaCalendario}
            onClickEvento={manejarClickEvento}
            onClickDia={(fechaISO) => { setDiaModalFecha(fechaISO); setArriendoSeleccionado(null); setEntrenamientoSeleccionado(null); }}
            onRangoVisibleChange={manejarRangoVisible}
          />

          {diaModalFecha && (
            <CanchaEntrenamientosDiaModal
              fecha={diaModalFecha}
              eventos={eventos}
              onCerrar={() => setDiaModalFecha(null)}
              onClickItem={manejarClickEvento}
            />
          )}

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
                    {arriendoSeleccionado.estado_pago !== 'pendiente' && arriendoSeleccionado.estado_pago !== 'anulado' && (
                      <span>Pagado: ${Number(arriendoSeleccionado.monto_pagado || 0).toLocaleString('es-CL')} · Saldo: ${Math.max(0, Number(arriendoSeleccionado.valor_arriendo || 0) - Number(arriendoSeleccionado.monto_pagado || 0)).toLocaleString('es-CL')}</span>
                    )}
                    {arriendoSeleccionado.serie_tipo && <span>Serie {arriendoSeleccionado.serie_tipo}</span>}
                  </div>
                </div>
                <button type="button" onClick={() => setArriendoSeleccionado(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--texto-secundario)' }} aria-label="Cerrar">
                  <X size={16} />
                </button>
              </div>
              {puedeCancha && (
                <div style={{ display: 'flex', gap: '6px', marginTop: '10px', flexWrap: 'wrap' }}>
                  {arriendoSeleccionado.estado_pago !== 'pagado' && arriendoSeleccionado.estado_pago !== 'anulado' && (
                    <button className="btn-secondary" style={{ width: 'auto', padding: '6px 10px', fontSize: '11px' }} onClick={() => (mostrarFormPago ? setMostrarFormPago(false) : abrirFormPago(arriendoSeleccionado))}>
                      {mostrarFormPago ? 'Cancelar pago' : 'Registrar pago'}
                    </button>
                  )}
                  <button
                    className="btn-secondary"
                    style={{ width: 'auto', padding: '6px 10px', fontSize: '11px' }}
                    onClick={() => { setArriendoParaEditar(arriendoSeleccionado); setVista('nueva'); setArriendoSeleccionado(null); }}
                  >
                    Editar
                  </button>
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
                  {arriendoSeleccionado.serie_id && (
                    <button
                      className="btn-secondary"
                      style={{ width: 'auto', padding: '6px 10px', fontSize: '11px', borderColor: 'rgba(255,59,48,0.35)', color: '#b91c1c' }}
                      onClick={() => borrarSerie(arriendoSeleccionado)}
                    >
                      Borrar toda la serie
                    </button>
                  )}
                </div>
              )}
              {puedeCancha && mostrarFormPago && (
                <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end', flexWrap: 'wrap', marginTop: '10px', paddingTop: '10px', borderTop: '1px dashed var(--borde-suave)' }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label style={{ fontSize: '11px' }}>Monto a abonar</label>
                    <input type="number" min="0" className="form-input" value={abono} onChange={(e) => setAbono(e.target.value)} />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label style={{ fontSize: '11px' }}>Método</label>
                    <select className="form-input" value={metodoPagoAbono} onChange={(e) => setMetodoPagoAbono(e.target.value)}>
                      <option value="Efectivo">Efectivo</option>
                      <option value="Transferencia">Transferencia</option>
                      <option value="Otro">Otro</option>
                    </select>
                  </div>
                  <button className="btn-electric" style={{ width: 'auto', padding: '10px 14px' }} onClick={() => registrarPago(arriendoSeleccionado)}>
                    Confirmar pago
                  </button>
                </div>
              )}
            </div>
          )}

          {entrenamientoSeleccionado && (
            <div className="card mt-15" style={{ borderRadius: '16px', borderLeft: `4px solid ${colorBarraPorRama(entrenamientoSeleccionado.rama)}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                <div>
                  <strong style={{ fontSize: '14px' }}>
                    {entrenamientoSeleccionado.hora_inicio?.slice(0, 5)} - {entrenamientoSeleccionado.hora_fin?.slice(0, 5)} · {entrenamientoSeleccionado.rama} {(entrenamientoSeleccionado.categorias || []).join(', ')}
                  </strong>
                  <div style={{ fontSize: '11px', color: 'var(--texto-secundario)', fontWeight: '700', marginTop: '4px' }}>
                    {(entrenamientoSeleccionado.entrenadores || []).length > 0 && <span>Profesor(es): {entrenamientoSeleccionado.entrenadores.join(', ')}</span>}
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

      {vista === 'nueva' && puedeCancha && (
        <CanchaEntrenamientosReservaForm
          arriendoParaEditar={arriendoParaEditar}
          onGuardado={() => { recargar(); setVista('calendario'); setArriendoParaEditar(null); }}
        />
      )}
      {vista === 'horarios' && puedeHorarios && <CanchaEntrenamientosHorarioForm onCambio={recargar} />}
      {vista === 'excepciones' && puedeHorarios && <CanchaEntrenamientosExcepciones onCambio={recargar} />}
      {vista === 'analisis' && puedeCancha && <CanchaEntrenamientosAnalisis />}
    </div>
  );
}

export default CanchaEntrenamientosPanel;
