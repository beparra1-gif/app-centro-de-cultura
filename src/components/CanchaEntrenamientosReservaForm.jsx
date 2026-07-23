import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import * as api from '../api/client';
import { showToast } from '../utils/toast';
import { useHorasOcupadasEnFecha } from '../utils/useHorasOcupadasEnFecha';
import CanchaEntrenamientosOcupacion from './CanchaEntrenamientosOcupacion';

const hoyISO = () => new Date().toISOString().slice(0, 10);

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

// Misma lógica que antes vivía solo en el backend (endpoint /serie) — el
// frontend arma la lista de fechas (a mano, por patrón, o mezclando ambas) y
// el backend solo recibe un array explícito. "Reserva única" y "varias
// fechas" son el mismo flujo.
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

function CanchaEntrenamientosReservaForm({ onGuardado }) {
  const [form, setForm] = useState(FORM_VACIO);
  const [fechasSeleccionadas, setFechasSeleccionadas] = useState([hoyISO()]);
  const [fechaParaAgregar, setFechaParaAgregar] = useState(hoyISO());
  const [mostrarRangoAutomatico, setMostrarRangoAutomatico] = useState(false);
  const [rango, setRango] = useState(RANGO_VACIO);
  const [guardando, setGuardando] = useState(false);
  const [ultimoResultadoLote, setUltimoResultadoLote] = useState(null);

  const { ocupaciones, cargando: cargandoOcupacion } = useHorasOcupadasEnFecha(fechaParaAgregar);

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
        onGuardado && onGuardado();
      }
    } catch (error) {
      showToast({ message: error.message || 'No se pudo registrar el arriendo.', type: 'error' });
    } finally {
      setGuardando(false);
    }
  };

  return (
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

        <CanchaEntrenamientosOcupacion ocupaciones={ocupaciones} cargando={cargandoOcupacion} />

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
  );
}

export default CanchaEntrenamientosReservaForm;
