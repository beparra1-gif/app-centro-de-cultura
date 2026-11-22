import { useEffect, useMemo, useState } from 'react';
import { Eye, FileUp, History, UserX } from 'lucide-react';
import * as api from '../api/client';
import { showToast } from '../utils/toast';
import { confirmAction } from '../utils/confirmDialog';
import { cambioDeEstado, estaActivo } from '../utils/estadoActivo';
import { hoyLocalISO } from '../utils/fechas';
import { leerPrimeraHojaXlsx } from '../utils/leerXlsx';
import { planRevisionPadron, resumenAltasBajas } from '../utils/revisionPadron';
import CuentasSinActivar from './CuentasSinActivar';

// Usuarios y Cuentas → "Altas y bajas": mantener el padrón al día.
//  1. Subir el Excel exportado con "¿Sigue?" marcado y aplicar los cambios.
//  2. Deportistas que no vienen hace N semanas (según pasar lista).
//  3. Informe de ingresos, bajas y reactivaciones de los últimos 12 meses.
//  (Arriba: cuentas sin activar, para repartir códigos del club.)

const nombreDe = (p) => `${p.nombres || ''} ${p.apellido_paterno || ''}`.trim() || p.rut_jugador || p.rut;
const fechaCl = (v) => {
  const t = String(v || '').slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(t) ? t.split('-').reverse().join('-') : '—';
};

// Aplica activar/desactivar uno por uno; devuelve cuántos fallaron.
const aplicarCambios = async (items) => {
  let fallidos = 0;
  for (const { tipo, persona, activar, motivo } of items) {
    try {
      const cambio = cambioDeEstado(tipo, activar, hoyLocalISO(), motivo);
      if (tipo === 'jugador') await api.jugadoresAPI.update(persona.rut_jugador, cambio);
      else await api.cuentasAPI.update(persona.id, cambio);
    } catch {
      fallidos += 1;
    }
  }
  return fallidos;
};

export default function RevisionPadronPanel({ jugadores = [], cuentas = [], onRecargar, onVerFicha }) {
  const [plan, setPlan] = useState(null);
  const [archivo, setArchivo] = useState('');
  const [aplicando, setAplicando] = useState(false);
  const [semanas, setSemanas] = useState(4);
  const [inactivos, setInactivos] = useState(null);
  const [buscando, setBuscando] = useState(false);
  const [elegidos, setElegidos] = useState(() => new Set());
  const [historial, setHistorial] = useState([]);

  const cargarHistorial = async () => {
    try {
      setHistorial(await api.historialEstadosAPI.listar());
    } catch {
      setHistorial([]);
    }
  };
  useEffect(() => { cargarHistorial(); }, []);

  const terminar = async (fallidos, total) => {
    await onRecargar?.();
    await cargarHistorial();
    showToast({
      message: fallidos ? `${total - fallidos} actualizados, ${fallidos} con error (reintenta).` : `${total} actualizados.`,
      type: fallidos ? 'error' : 'success',
    });
  };

  const leerArchivo = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const filas = await leerPrimeraHojaXlsx(await file.arrayBuffer());
      setPlan(planRevisionPadron(filas, { jugadores, cuentas }));
      setArchivo(file.name);
    } catch (error) {
      setPlan(null);
      showToast({ message: error.message || 'No se pudo leer el Excel.', type: 'error' });
    }
  };

  const aplicarPlan = async () => {
    const items = [
      ...plan.desactivar.map(({ persona, motivo }) => ({ tipo: plan.tipo, persona, activar: false, motivo })),
      ...plan.reactivar.map(({ persona }) => ({ tipo: plan.tipo, persona, activar: true })),
    ];
    const ok = await confirmAction({
      title: 'Aplicar revisión',
      message: `Se desactivarán ${plan.desactivar.length} y se reactivarán ${plan.reactivar.length}. Se puede deshacer reactivando desde la ficha.`,
      confirmText: 'Aplicar',
    });
    if (!ok) return;
    setAplicando(true);
    const fallidos = await aplicarCambios(items);
    setAplicando(false);
    setPlan(null);
    await terminar(fallidos, items.length);
  };

  const buscarInactivos = async () => {
    setBuscando(true);
    try {
      const r = await api.asistenciaAPI.inactividad(semanas);
      setInactivos(r.jugadores || []);
      setElegidos(new Set());
    } catch (error) {
      showToast({ message: error.message || 'No se pudo calcular.', type: 'error' });
    } finally {
      setBuscando(false);
    }
  };

  const desactivarElegidos = async () => {
    const lista = (inactivos || []).filter((j) => elegidos.has(j.rut_jugador));
    const motivo = await confirmAction({
      title: 'Desactivar seleccionados',
      message: `${lista.length} deportistas quedarán inactivos: salen de cobros, citaciones y pasar lista.`,
      confirmText: 'Desactivar',
      pedirTexto: { etiqueta: 'Motivo (opcional, no lo ve la familia)', placeholder: `Sin asistencia ${semanas} semanas` },
    });
    if (motivo === false) return;
    setAplicando(true);
    const completos = lista.map((j) => jugadores.find((x) => x.rut_jugador === j.rut_jugador) || j);
    const fallidos = await aplicarCambios(completos.map((persona) => ({
      tipo: 'jugador', persona, activar: false, motivo: motivo || `Sin asistencia ${semanas} semanas`,
    })));
    setAplicando(false);
    setInactivos((prev) => (prev || []).filter((j) => !elegidos.has(j.rut_jugador)));
    setElegidos(new Set());
    await terminar(fallidos, lista.length);
  };

  const meses = useMemo(() => resumenAltasBajas({ historial, jugadores }), [historial, jugadores]);
  const ultimasBajas = historial.filter((h) => h.tipo === 'jugador').slice(0, 30);
  const gruposInactivos = useMemo(() => {
    const m = new Map();
    (inactivos || []).forEach((j) => {
      const g = `${j.categoria || 'Sin categoría'} · ${j.rama || 'Sin rama'}`;
      m.set(g, [...(m.get(g) || []), j]);
    });
    return [...m.entries()];
  }, [inactivos]);

  return (
    <div className="rp-panel">
      <CuentasSinActivar jugadores={jugadores} cuentas={cuentas} />

      <section className="card">
        <h4 className="form-subtitle"><FileUp size={16} /> Subir el Excel revisado</h4>
        <p className="fp-ayuda">
          Exporta el listado en Excel (pestaña Deportistas o Cuentas), marca la columna “¿Sigue?” con Sí o No
          y súbelo aquí. Los “No” quedan inactivos (la “Observación” se guarda como motivo) y los “Sí” que estaban inactivos se reactivan.
          Nada cambia hasta que aprietes “Aplicar”.
        </p>
        <label className="btn-secondary tc-btn rp-subir">
          <FileUp size={14} /> Elegir Excel (.xlsx)
          <input type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={leerArchivo} hidden />
        </label>
        {plan && (
          <div className="rp-plan">
            <p><strong>{archivo}</strong> · {plan.tipo === 'jugador' ? 'deportistas' : 'cuentas'}</p>
            <ul>
              <li><strong>{plan.desactivar.length}</strong> se desactivarán</li>
              <li><strong>{plan.reactivar.length}</strong> se reactivarán</li>
              <li>{plan.yaEstaban} ya estaban así · {plan.sinMarca} sin marcar (no se tocan)</li>
              {plan.noEncontrados.length > 0 && <li className="rp-alerta">{plan.noEncontrados.length} RUT no encontrados: {plan.noEncontrados.slice(0, 8).join(', ')}{plan.noEncontrados.length > 8 ? '…' : ''}</li>}
              {plan.marcaInvalida.length > 0 && <li className="rp-alerta">Marca no reconocida (usa Sí o No): {plan.marcaInvalida.slice(0, 8).join(', ')}</li>}
            </ul>
            {plan.desactivar.length > 0 && (
              <details>
                <summary>Ver quiénes se desactivan</summary>
                <ul className="rp-nombres">{plan.desactivar.map(({ persona, motivo }) => <li key={persona.rut_jugador || persona.id}>{nombreDe(persona)}{motivo ? ` — ${motivo}` : ''}</li>)}</ul>
              </details>
            )}
            {plan.reactivar.length > 0 && (
              <details>
                <summary>Ver quiénes se reactivan</summary>
                <ul className="rp-nombres">{plan.reactivar.map(({ persona }) => <li key={persona.rut_jugador || persona.id}>{nombreDe(persona)}</li>)}</ul>
              </details>
            )}
            <div className="rp-acciones">
              <button type="button" className="btn-electric tc-btn" disabled={aplicando || (!plan.desactivar.length && !plan.reactivar.length)} onClick={aplicarPlan}>
                {aplicando ? 'Aplicando…' : 'Aplicar'}
              </button>
              <button type="button" className="btn-secondary tc-btn" disabled={aplicando} onClick={() => setPlan(null)}>Descartar</button>
            </div>
          </div>
        )}
      </section>

      <section className="card">
        <h4 className="form-subtitle"><UserX size={16} /> No vienen hace un tiempo</h4>
        <p className="fp-ayuda">
          Deportistas activos sin ningún “presente” en pasar lista. Solo se revisan categorías donde sí se pasó lista,
          y no aparecen los recién ingresados ni los con ausencia prolongada reportada.
        </p>
        <div className="rp-acciones">
          <label htmlFor="rp-semanas" className="fp-ayuda">Sin venir hace</label>
          <select id="rp-semanas" className="form-input rp-semanas" value={semanas} onChange={(e) => setSemanas(Number(e.target.value))}>
            {[3, 4, 6, 8, 12].map((n) => <option key={n} value={n}>{n} semanas</option>)}
          </select>
          <button type="button" className="btn-electric tc-btn" disabled={buscando} onClick={buscarInactivos}>{buscando ? 'Buscando…' : 'Buscar'}</button>
          {elegidos.size > 0 && (
            <button type="button" className="btn-secondary tc-btn" disabled={aplicando} onClick={desactivarElegidos}>
              {aplicando ? 'Guardando…' : `Desactivar ${elegidos.size}`}
            </button>
          )}
        </div>
        {inactivos && inactivos.length === 0 && <p className="tc-vacio">Nadie lleva {semanas} semanas sin venir.</p>}
        {gruposInactivos.map(([grupo, lista]) => (
          <div key={grupo} className="rp-grupo">
            <h5>{grupo} ({lista.length})</h5>
            {lista.map((j) => (
              <div key={j.rut_jugador} className="rp-fila">
                <input
                  type="checkbox"
                  className="uc-seleccion"
                  checked={elegidos.has(j.rut_jugador)}
                  onChange={() => setElegidos((prev) => { const s = new Set(prev); if (s.has(j.rut_jugador)) s.delete(j.rut_jugador); else s.add(j.rut_jugador); return s; })}
                  aria-label={`Seleccionar a ${nombreDe(j)}`}
                />
                <div className="rp-fila-texto">
                  <strong>{nombreDe(j)}</strong>
                  <small>Última vez: {j.ultima_presencia ? fechaCl(j.ultima_presencia) : 'nunca registrada'} · {j.ausencias_recientes} ausente en {j.listas_recientes} listas</small>
                </div>
                <button type="button" className="btn-secondary tc-btn" onClick={() => onVerFicha?.(jugadores.find((x) => x.rut_jugador === j.rut_jugador) || j)} aria-label={`Ver ficha de ${nombreDe(j)}`}>
                  <Eye size={13} />
                </button>
              </div>
            ))}
          </div>
        ))}
      </section>

      <section className="card">
        <h4 className="form-subtitle"><History size={16} /> Altas y bajas por mes</h4>
        <p className="fp-ayuda">Ingresos según la fecha de ingreso de cada deportista. Las bajas y reactivaciones se registran desde noviembre de 2026.</p>
        <div className="fp-tabla-scroll">
          <table className="fp-tabla">
            <thead><tr><th>Mes</th><th>Ingresos</th><th>Bajas</th><th>Reactivados</th></tr></thead>
            <tbody>
              {meses.map((m) => (
                <tr key={m.clave}><td>{m.etiqueta}</td><td className="fp-num">{m.ingresos}</td><td className="fp-num">{m.bajas}</td><td className="fp-num">{m.reactivaciones}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
        <h5 className="fp-subtitulo">Últimos cambios de estado</h5>
        {ultimasBajas.length === 0 ? <p className="tc-vacio">Todavía no hay cambios registrados.</p> : (
          <div className="fp-tabla-scroll">
            <table className="fp-tabla">
              <thead><tr><th>Fecha</th><th>Deportista</th><th>Categoría</th><th>Cambio</th><th>Motivo</th></tr></thead>
              <tbody>
                {ultimasBajas.map((h) => (
                  <tr key={h.id}>
                    <td>{new Date(h.fecha).toLocaleDateString('es-CL')}</td>
                    <td>{h.nombre || h.identificador}</td>
                    <td>{[h.categoria, h.rama].filter(Boolean).join(' · ')}</td>
                    <td>{estaActivo({ estado: h.estado_nuevo }) ? 'Reactivado' : 'Baja'}</td>
                    <td className="fp-notas">{h.motivo || ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
