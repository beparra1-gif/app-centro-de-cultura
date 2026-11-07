import { useEffect, useState } from 'react';
import { FileSpreadsheet, RefreshCcw } from 'lucide-react';
import * as api from '../api/client';
import { showToast } from '../utils/toast';
import { confirmAction } from '../utils/confirmDialog';

// Tesorería → Validar pagos (solo super admin): trae los pagos 2026 de la
// planilla de Tesorería del club (hojas "Pagos deportistas" y "Pagos Socio")
// que falten en la base, crea las fichas de deportistas que falten (desde
// "Base Principal") y limpia duplicados. Revisar muestra el plan; nada
// cambia hasta "Aplicar". Con la carga automática, el servidor agrega lo
// nuevo cada 30 min (los duplicados se borran solo a mano).
// Ver backend/lib/importarPagosPlanilla.js.

const CLAVE_URL = 'ccf.importarPagos.url';
const pesos = (n) => `$${Math.round(Number(n) || 0).toLocaleString('es-CL')}`;
const leerUrlGuardada = () => { try { return localStorage.getItem(CLAVE_URL) || ''; } catch { return ''; } };
const fechaHora = (iso) => (iso ? new Date(iso).toLocaleString('es-CL', { dateStyle: 'short', timeStyle: 'short' }) : '');

function Lista({ titulo, items, render, abierta = false }) {
  if (!items?.length) return null;
  return (
    <details className="ip-lista" open={abierta}>
      <summary>{titulo} ({items.length})</summary>
      <ul>{items.map((it, i) => <li key={i}>{render(it)}</li>)}</ul>
    </details>
  );
}

function EstadoAutomatico({ config }) {
  const u = config?.ultimaEjecucion;
  if (!config?.activo) return <p className="ip-ayuda">La carga automática está apagada.</p>;
  if (!u) return <p className="ip-ayuda">Activa. La primera carga corre en los próximos minutos.</p>;
  if (!u.ok) return <p className="ip-ayuda ip-error">Última carga ({fechaHora(u.fecha)}) falló: {u.error}</p>;
  return (
    <p className="ip-ayuda">
      Última carga: {fechaHora(u.fecha)} · {u.creados || 0} deportistas creados · {u.agregados || 0} pagos agregados
      {u.omitidos ? ` · ${u.omitidos} filas omitidas` : ''}
      {u.duplicadosPendientes ? ` · ${u.duplicadosPendientes} duplicados por revisar` : ''}
    </p>
  );
}

export default function ImportarPagosPlanilla({ onAplicado }) {
  const [url, setUrl] = useState(leerUrlGuardada);
  const [plan, setPlan] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [abierto, setAbierto] = useState(false);
  const [auto, setAuto] = useState(null);
  const [guardandoAuto, setGuardandoAuto] = useState(false);

  useEffect(() => {
    if (!abierto || auto) return;
    let activo = true;
    api.pagosMensualidadesAPI.obtenerImportacionAutomatica()
      .then((config) => {
        if (!activo) return;
        setAuto(config);
        if (config?.url) setUrl((actual) => actual || config.url);
      })
      .catch(() => {});
    return () => { activo = false; };
  }, [abierto, auto]);

  const revisar = async () => {
    if (!url.trim()) { showToast({ message: 'Pega el enlace de la planilla.', type: 'error' }); return; }
    setCargando(true);
    setPlan(null);
    try {
      const resultado = await api.pagosMensualidadesAPI.revisarImportacionPlanilla(url.trim());
      setPlan(resultado);
      try { localStorage.setItem(CLAVE_URL, url.trim()); } catch { /* sin almacenamiento */ }
    } catch (error) {
      showToast({ message: error.message || 'No se pudo leer la planilla.', type: 'error' });
    } finally {
      setCargando(false);
    }
  };

  const aplicar = async () => {
    const r = plan.resumen;
    const confirmado = await confirmAction({
      title: 'Aplicar importación de pagos',
      message: `Se crearán ${r.crearDeportistas || 0} fichas de deportistas, se agregarán ${r.agregarDeportistas + r.agregarSocios} pagos (${r.agregarDeportistas} de deportistas y ${r.agregarSocios} de socios) como APROBADOS y se borrarán ${r.duplicadosBorrar} pagos duplicados importados. Los pagos registrados desde la app no se tocan. ¿Continuar?`,
      confirmText: 'Aplicar',
    });
    if (!confirmado) return;
    setCargando(true);
    try {
      const res = await api.pagosMensualidadesAPI.aplicarImportacionPlanilla({ url: url.trim(), resumen: r });
      showToast({ message: `Listo: ${res.creados} deportistas creados, ${res.agregados} pagos agregados y ${res.borrados} duplicados borrados.`, type: 'success' });
      setPlan(null);
      await onAplicado?.();
    } catch (error) {
      showToast({ message: error.message || 'No se pudo aplicar la importación.', type: 'error' });
    } finally {
      setCargando(false);
    }
  };

  const cambiarAuto = async (activo) => {
    if (activo && !url.trim()) { showToast({ message: 'Pega primero el enlace de la planilla.', type: 'error' }); return; }
    setGuardandoAuto(true);
    try {
      const config = await api.pagosMensualidadesAPI.guardarImportacionAutomatica({ url: url.trim(), activo });
      setAuto(config);
      const u = config.ultimaEjecucion;
      showToast({
        message: activo
          ? `Carga automática activada${u?.ok ? `: ${u.creados || 0} deportistas creados y ${u.agregados || 0} pagos agregados ahora.` : '.'}`
          : 'Carga automática desactivada.',
        type: 'success',
      });
      if (activo) await onAplicado?.();
    } catch (error) {
      showToast({ message: error.message || 'No se pudo guardar la carga automática.', type: 'error' });
    } finally {
      setGuardandoAuto(false);
    }
  };

  const r = plan?.resumen;
  const hayCambios = r && ((r.crearDeportistas || 0) + r.agregarDeportistas + r.agregarSocios + r.duplicadosBorrar) > 0;

  return (
    <section className="ip-card">
      <button type="button" className="ip-toggle" onClick={() => setAbierto((v) => !v)} aria-expanded={abierto}>
        <FileSpreadsheet size={18} color="var(--azul-electrico)" />
        <span>
          <strong>Importar pagos desde la planilla de Tesorería</strong>
          <small>
            {auto?.activo ? 'Carga automática activa · ' : ''}
            Agrega los pagos 2026 que falten, crea los deportistas que no estén y limpia duplicados.
          </small>
        </span>
      </button>

      {abierto && (
        <div className="ip-cuerpo">
          <label htmlFor="ip-url" className="ip-label">Enlace de la planilla (compartida “cualquiera con el enlace”)</label>
          <div className="ip-fila-url">
            <input id="ip-url" type="url" className="form-input" placeholder="https://docs.google.com/spreadsheets/d/…" value={url} onChange={(e) => { setUrl(e.target.value); setPlan(null); }} />
            <button type="button" className="btn-secondary tc-btn" onClick={revisar} disabled={cargando}>
              <RefreshCcw size={13} /> {cargando && !plan ? 'Leyendo…' : 'Revisar'}
            </button>
          </div>
          <p className="ip-ayuda">Lee “Pagos deportistas” (RUT en columna D, mes en E), “Pagos Socio” (RUT en C —o F si falta—, mes en D) y “Base Principal” (para crear fichas). Solo filas VALIDADO de 2026.</p>

          <div className="ip-auto">
            <label className="ip-auto-check">
              <input
                type="checkbox"
                checked={Boolean(auto?.activo)}
                disabled={guardandoAuto || !auto}
                onChange={(e) => cambiarAuto(e.target.checked)}
              />
              <span>{guardandoAuto ? 'Guardando…' : 'Cargar automáticamente cada 30 minutos'}</span>
            </label>
            <EstadoAutomatico config={auto} />
          </div>

          {r && (
            <>
              <div className="ip-resumen">
                <div><span>Deportistas nuevos</span><strong>{r.crearDeportistas || 0}</strong></div>
                <div><span>Pagos deportistas</span><strong>{r.agregarDeportistas}</strong></div>
                <div><span>Pagos socios</span><strong>{r.agregarSocios}</strong></div>
                <div><span>Ya estaban</span><strong>{r.yaEstaban}</strong></div>
                <div><span>Duplicados a borrar</span><strong>{r.duplicadosBorrar}</strong></div>
                <div><span>Omitidos</span><strong>{r.omitidos}</strong></div>
              </div>
              <p className="ip-ayuda">Monto a agregar: {pesos(r.montoAgregar)}</p>

              <Lista
                titulo="Deportistas que se crean (desde Base Principal)"
                items={plan.crearDeportistas}
                abierta
                render={(c) => <><b>{c.nombre}</b> · {c.rut} · {c.fechaNacimiento ? `nac. ${c.fechaNacimiento.split('-').reverse().join('-')}` : 'sin fecha de nacimiento'} · {[c.rama, c.categoria].filter(Boolean).join(' ')}</>}
              />
              <Lista
                titulo="Pagos a agregar"
                items={plan.agregar}
                render={(a) => <>{a.tipo === 'socio' ? 'Cuota socio' : 'Mensualidad'} · <b>{a.nombre}</b> · {a.mes} · {pesos(a.monto)}{a.sinMonto ? ' (sin monto en la planilla)' : ''}</>}
              />
              <Lista
                titulo="Duplicados que se borran"
                items={plan.duplicadosBorrar}
                render={(d) => <>#{d.id} · <b>{d.nombre || d.rut}</b> · {d.mes} · {pesos(d.monto)} — se queda {d.seQueda}</>}
              />
              <Lista
                titulo="Omitidos (no se importan)"
                items={plan.omitidos}
                abierta
                render={(o) => <>{o.tipo === 'socio' ? 'Socio' : 'Deportista'} · fila {o.fila} · <b>{o.nombre || o.rut}</b> {o.mesTexto ? `· ${o.mesTexto}` : ''} — {o.motivo}</>}
              />
              <Lista
                titulo="Avisos"
                items={plan.avisos}
                render={(a) => <><b>{a.nombre}</b> · {a.mes} — {a.detalle}</>}
              />

              <button type="button" className="btn-electric ip-aplicar" onClick={aplicar} disabled={cargando || !hayCambios}>
                {cargando ? 'Aplicando…' : hayCambios ? 'Aplicar importación' : 'No hay nada que cambiar'}
              </button>
            </>
          )}
        </div>
      )}
    </section>
  );
}
