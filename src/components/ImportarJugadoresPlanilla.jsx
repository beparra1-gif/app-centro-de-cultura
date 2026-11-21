import { useState } from 'react';
import { RefreshCcw, UserPlus } from 'lucide-react';
import * as api from '../api/client';
import { showToast } from '../utils/toast';
import { confirmAction } from '../utils/confirmDialog';
import { RAMAS_DISPONIBLES } from '../utils/categoriasDeportivas';

// Usuarios y Cuentas → Vincular apoderados (solo super admin): pega las filas
// copiadas de la planilla "Datos jugadores" (Nombre, RUT, Nacimiento,
// Ingreso, Nombre apoderado, RUT apoderado). Revisar muestra el plan; nada
// cambia hasta "Aplicar". Ver backend/lib/importarJugadoresPlanilla.js.

function Lista({ titulo, items, render, abierta = false }) {
  if (!items?.length) return null;
  return (
    <details className="ip-lista" open={abierta}>
      <summary>{titulo} ({items.length})</summary>
      <ul>{items.map((it, i) => <li key={i}>{render(it)}</li>)}</ul>
    </details>
  );
}

const fecha = (iso) => (iso ? iso.split('-').reverse().join('-') : '—');
const avisos = (a) => (a?.length ? <> · <span className="ip-error">{a.join('; ')}</span></> : null);

export default function ImportarJugadoresPlanilla({ onAplicado }) {
  const [abierto, setAbierto] = useState(false);
  const [texto, setTexto] = useState('');
  const [rama, setRama] = useState('');
  const [plan, setPlan] = useState(null);
  const [cargando, setCargando] = useState(false);

  const revisar = async () => {
    if (!texto.trim()) { showToast({ message: 'Pega las filas de la planilla.', type: 'error' }); return; }
    setCargando(true);
    setPlan(null);
    try {
      setPlan(await api.jugadoresAPI.importarPlanilla({ texto, rama: rama || null }));
    } catch (error) {
      showToast({ message: error.message || 'No se pudieron revisar las filas.', type: 'error' });
    } finally {
      setCargando(false);
    }
  };

  const aplicar = async () => {
    const r = plan.resumen;
    const confirmado = await confirmAction({
      title: 'Importar jugadores',
      message: `Se crearán ${r.crear} fichas de jugadores, se completarán ${r.completar} fichas existentes (solo datos vacíos) y se crearán ${r.crearApoderados} cuentas de apoderado (sin clave: activan con el código del club). ¿Continuar?`,
      confirmText: 'Aplicar',
    });
    if (!confirmado) return;
    setCargando(true);
    try {
      const res = await api.jugadoresAPI.importarPlanilla({ texto, rama: rama || null, aplicar: true, resumen: r });
      showToast({ message: `Listo: ${res.creados} jugadores creados, ${res.completados} completados y ${res.apoderadosCreados} apoderados creados.`, type: 'success' });
      setPlan(null);
      setTexto('');
      await onAplicado?.();
    } catch (error) {
      showToast({ message: error.message || 'No se pudo aplicar la importación.', type: 'error' });
    } finally {
      setCargando(false);
    }
  };

  const r = plan?.resumen;
  const hayCambios = r && r.crear + r.completar + r.crearApoderados > 0;

  return (
    <section className="ip-card">
      <button type="button" className="ip-toggle" onClick={() => setAbierto((v) => !v)} aria-expanded={abierto}>
        <UserPlus size={18} color="var(--azul-electrico)" />
        <span>
          <strong>Importar jugadores desde una planilla</strong>
          <small>Crea los jugadores que falten y los vincula con su apoderado (uno por RUT, aunque tenga varios hijos).</small>
        </span>
      </button>

      {abierto && (
        <div className="ip-cuerpo">
          <label htmlFor="ijp-texto" className="ip-label">Filas copiadas de la planilla (columnas: Nombre, RUT, Nacimiento, Ingreso, Nombre apoderado, RUT apoderado)</label>
          <textarea id="ijp-texto" className="form-input" rows={6} value={texto} onChange={(e) => { setTexto(e.target.value); setPlan(null); }} placeholder="Selecciona las celdas en Excel o Google Sheets, copia y pega aquí" />
          <div className="ip-fila-url" style={{ marginTop: 8 }}>
            <select aria-label="Rama de los jugadores nuevos" className="form-input" value={rama} onChange={(e) => { setRama(e.target.value); setPlan(null); }}>
              <option value="">Rama de los nuevos: sin rama</option>
              {RAMAS_DISPONIBLES.map((x) => <option key={x} value={x}>Rama de los nuevos: {x}</option>)}
            </select>
            <button type="button" className="btn-secondary tc-btn" onClick={revisar} disabled={cargando}>
              <RefreshCcw size={13} /> {cargando && !plan ? 'Revisando…' : 'Revisar'}
            </button>
          </div>
          <p className="ip-ayuda">Los jugadores que ya existen no se sobrescriben: solo se completan fecha de nacimiento, fecha de ingreso y apoderado si están vacíos. La categoría de los nuevos se calcula por edad.</p>

          {r && (
            <>
              <div className="ip-resumen">
                <div><span>Jugadores nuevos</span><strong>{r.crear}</strong></div>
                <div><span>Fichas a completar</span><strong>{r.completar}</strong></div>
                <div><span>Ya estaban</span><strong>{r.yaEstaban}</strong></div>
                <div><span>Apoderados</span><strong>{r.apoderados}</strong></div>
                <div><span>Apoderados nuevos</span><strong>{r.crearApoderados}</strong></div>
                <div><span>Omitidos</span><strong>{r.omitidos}</strong></div>
              </div>

              <Lista
                titulo="Jugadores que se crean"
                items={plan.crear}
                abierta
                render={(c) => <><b>{c.nombre}</b> · {c.ficha.rut_jugador} · nac. {fecha(c.ficha.fecha_nacimiento)} · ingreso {fecha(c.ficha.fecha_ingreso)} · {[c.ficha.rama, c.ficha.categoria].filter(Boolean).join(' ') || 'sin categoría'} · apoderado: {c.apoderado || 'ninguno'}{avisos(c.avisos)}</>}
              />
              <Lista
                titulo="Fichas que se completan"
                items={plan.completar}
                render={(f) => <><b>{f.nombre}</b> · {f.rut} — {Object.keys(f.cambios).filter((k) => k !== 'correo_apoderado').map((k) => k.replace('_', ' ')).join(', ')}{avisos(f.avisos)}</>}
              />
              <Lista
                titulo="Apoderados (uno por RUT)"
                items={plan.apoderados}
                abierta
                render={(a) => <><b>{a.nombre}</b> · {a.rut} · {a.existe ? 'cuenta existente' : 'cuenta nueva'} · {a.hijos.length > 1 ? `${a.hijos.length} hijos` : '1 hijo'}{a.variantes.length > 1 ? ` · escrito como: ${a.variantes.join(' / ')}` : ''}</>}
              />
              <Lista
                titulo="Apoderado distinto al registrado (no se cambia)"
                items={plan.conflictos}
                abierta
                render={(c) => <><b>{c.nombre}</b> · {c.rut} — registrado {c.actual}, planilla {c.planilla}</>}
              />
              <Lista titulo="Ya estaban completos" items={plan.yaEstaban} render={(y) => <><b>{y.nombre}</b> · {y.rut}{avisos(y.avisos)}</>} />
              <Lista titulo="Omitidos" items={plan.omitidos} abierta render={(o) => <>Fila {o.fila} · <b>{o.nombre || o.rut}</b> — {o.motivo}</>} />

              <button type="button" className="btn-electric ip-aplicar" onClick={aplicar} disabled={cargando || !hayCambios}>
                {cargando ? 'Aplicando…' : hayCambios ? 'Aplicar' : 'No hay cambios que aplicar'}
              </button>
            </>
          )}
        </div>
      )}
    </section>
  );
}
