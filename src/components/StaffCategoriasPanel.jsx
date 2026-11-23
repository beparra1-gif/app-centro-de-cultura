import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Pencil, Plus, Users, X } from 'lucide-react';
import * as api from '../api/client';
import { showToast } from '../utils/toast';
import { confirmAction } from '../utils/confirmDialog';
import { estaActivo } from '../utils/estadoActivo';
import useModalAccesible from '../utils/useModalAccesible';
import { normalizarRol } from '../security/accessControl';
import { ordenarCategorias } from '../utils/informeDeuda';
import { mismoTexto, unicosSinMayusculas } from '../utils/texto';
import { enAlcanceStaff, parRamaCategoria } from '../utils/categoriasStaff';

// Usuarios y Cuentas → "Staff": qué categorías de cada RAMA tiene cada
// entrenador (ej. SUB-13 masculino y SUB-13/15/17 femenino). Se guarda en
// cuentas.categorias_asignadas como pares "RAMA|CATEGORÍA"; [] = ve todo.
// Un entrenador puede tener varias y una categoría varios entrenadores.

const nombreDe = (c) => `${c.nombres || ''} ${c.apellido_paterno || ''}`.trim() || c.rut;
const lista = (v) => (Array.isArray(v) ? v : []);
const titulo = (t = '') => String(t).charAt(0).toUpperCase() + String(t).slice(1).toLowerCase();

// Pares marcados de una cuenta; las asignaciones antiguas (solo categoría, o
// con ramas_asignadas) se muestran marcadas en las ramas que correspondan.
const paresDe = (cuenta, ramas, categorias) => ramas.flatMap((r) => categorias
  .filter((c) => lista(cuenta.categorias_asignadas).length && enAlcanceStaff(cuenta, { rama: r, categoria: c }))
  .map((c) => parRamaCategoria(r, c)));

const resumenPares = (pares) => {
  if (!pares.length) return 'Todas las ramas y categorías';
  const porRama = new Map();
  pares.forEach((p) => { const [r, c] = p.split('|'); porRama.set(r, [...(porRama.get(r) || []), c]); });
  return [...porRama.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([r, cs]) => `${titulo(r)}: ${cs.sort(ordenarCategorias).join(', ')}`).join(' · ');
};

function VentanaAsignacion({ cuenta, ramas, categoriasPorRama, onCerrar, onGuardar, onEditarCuenta }) {
  useModalAccesible(true, onCerrar);
  const iniciales = paresDe(cuenta, ramas, [...new Set(Object.values(categoriasPorRama).flat())]);
  const [pares, setPares] = useState(iniciales);
  const [nivel, setNivel] = useState(cuenta.nivel_entrenador || '');
  const [guardando, setGuardando] = useState(false);
  const tiene = (p) => pares.some((x) => mismoTexto(x, p));
  const alternar = (p) => setPares((prev) => (prev.some((x) => mismoTexto(x, p)) ? prev.filter((x) => !mismoTexto(x, p)) : [...prev, p]));
  const cambiado = JSON.stringify([...pares].sort()) !== JSON.stringify([...iniciales].sort()) || nivel.trim() !== (cuenta.nivel_entrenador || '');

  const guardar = async () => {
    setGuardando(true);
    const ok = await onGuardar(cuenta, pares, nivel.trim());
    setGuardando(false);
    if (ok) onCerrar();
  };

  return createPortal(
    <div className="fp-fondo" onClick={onCerrar} role="presentation">
      <div className="fp-ventana sc-ventana" role="dialog" aria-modal="true" aria-labelledby="sc-titulo" onClick={(e) => e.stopPropagation()}>
        <header className="fp-cabecera">
          <span className="tc-avatar" aria-hidden="true"><Users size={18} /></span>
          <div className="fp-cabecera-texto">
            <h3 id="sc-titulo">{nombreDe(cuenta)}</h3>
            <p>Hoy: {resumenPares(iniciales)}</p>
          </div>
          <button type="button" className="fp-cerrar" onClick={onCerrar} aria-label="Cerrar"><X size={20} /></button>
        </header>
        <div className="fp-cuerpo">
          <div className="form-group">
            <label htmlFor="sc-nivel">Nivel de entrenador oficial</label>
            <input id="sc-nivel" className="form-input" maxLength={80} value={nivel} onChange={(e) => setNivel(e.target.value)} placeholder="Ej: Entrenador Nivel 2 FEB" />
          </div>
          <label className="fc-opcion fc-todas">
            <input type="checkbox" checked={pares.length === 0} onChange={() => setPares([])} /> Todas las ramas y categorías (sin restricción)
          </label>
          {ramas.map((r) => (
            <fieldset key={r} className="sc-fieldset">
              <legend>Rama {titulo(r)}</legend>
              <div className="sc-casillas">
                {(categoriasPorRama[r] || []).map((c) => {
                  const p = parRamaCategoria(r, c);
                  return (
                    <label key={p} className="fc-opcion">
                      <input type="checkbox" checked={tiene(p)} onChange={() => alternar(p)} aria-label={`${c} ${titulo(r)}`} /> {c}
                    </label>
                  );
                })}
              </div>
            </fieldset>
          ))}
          <p className="sc-resultado" aria-live="polite">
            <strong>{cambiado ? 'Quedará a cargo de:' : 'A cargo de:'}</strong> {resumenPares(pares)}
          </p>
        </div>
        <footer className="fp-pie">
          {onEditarCuenta && <button type="button" className="btn-secondary tc-btn" onClick={() => { onCerrar(); onEditarCuenta(cuenta); }}>Editar cuenta</button>}
          <button type="button" className="btn-secondary tc-btn" onClick={onCerrar}>Cancelar</button>
          <button type="button" className="btn-electric tc-btn" disabled={!cambiado || guardando} onClick={guardar}>{guardando ? 'Guardando…' : 'Guardar'}</button>
        </footer>
      </div>
    </div>,
    document.body
  );
}

export default function StaffCategoriasPanel({ cuentas = [], jugadores = [], onRecargar, onEditar }) {
  const [vista, setVista] = useState('entrenador');
  const [abierto, setAbierto] = useState(null);

  const staff = useMemo(() => cuentas
    .filter((c) => estaActivo(c) && normalizarRol(c.rol) === 'staff')
    .sort((a, b) => nombreDe(a).localeCompare(nombreDe(b), 'es')), [cuentas]);
  const activos = useMemo(() => jugadores.filter(estaActivo), [jugadores]);
  const ramas = useMemo(() => unicosSinMayusculas(activos.map((j) => j.rama)).map((r) => r.toUpperCase()).sort(), [activos]);
  // Categorías que existen en cada rama (según los deportistas activos).
  const categoriasPorRama = useMemo(() => Object.fromEntries(ramas.map((r) => [
    r, unicosSinMayusculas(activos.filter((j) => mismoTexto(j.rama, r)).map((j) => j.categoria)).sort(ordenarCategorias),
  ])), [ramas, activos]);
  const todasCategorias = useMemo(() => [...new Set(Object.values(categoriasPorRama).flat())], [categoriasPorRama]);
  const paresCuenta = (c) => paresDe(c, ramas, todasCategorias);

  const guardar = async (cuenta, pares, nivel) => {
    if (pares.length === 0 && lista(cuenta.categorias_asignadas).length) {
      const ok = await confirmAction({
        title: 'Sin asignación',
        message: `${nombreDe(cuenta)} quedará sin categorías asignadas: verá TODOS los deportistas en Pasar lista, Evaluar y Citaciones.`,
        confirmText: 'Sí, ver todos',
      });
      if (!ok) return false;
    }
    try {
      // Los pares ya llevan la rama: ramas_asignadas (formato anterior) se limpia.
      await api.cuentasAPI.update(cuenta.id, { categorias_asignadas: pares, ramas_asignadas: [], ...(typeof nivel === 'string' ? { nivel_entrenador: nivel } : {}) });
      await onRecargar?.();
      showToast({ message: `${nombreDe(cuenta)}: ${resumenPares(pares)}.`, type: 'success' });
      return true;
    } catch (error) {
      showToast({ message: error.message || 'No se pudo guardar.', type: 'error' });
      return false;
    }
  };

  if (staff.length === 0) {
    return <div className="card"><p className="tc-vacio">No hay cuentas con perfil Staff. Asigna el perfil “Staff” a los entrenadores en la pestaña Cuentas y vuelve aquí.</p></div>;
  }

  const cuentaAbierta = abierto && (staff.find((c) => c.id === abierto) || null);

  return (
    <div className="rp-panel">
      <div className="card">
        <p className="fp-ayuda">
          Toca un entrenador para elegir sus categorías en cada rama (por ejemplo SUB-13 masculino y SUB-13, SUB-15 y SUB-17 femenino).
          Verá en Pasar lista, Evaluar y Citaciones solo a esos deportistas. Una categoría puede tener varios entrenadores.
        </p>
        <div className="segment-control" role="tablist" aria-label="Ver staff">
          {[['entrenador', 'Por entrenador'], ['categoria', 'Por categoría']].map(([v, t]) => (
            <button key={v} type="button" role="tab" aria-selected={vista === v} className={`segment-btn ${vista === v ? 'active' : ''}`} onClick={() => setVista(v)}>{t}</button>
          ))}
        </div>
      </div>

      {vista === 'entrenador' && (
        <div className="card">
          {staff.map((c) => (
            <button key={c.id} type="button" className="sc-fila" onClick={() => setAbierto(c.id)}>
              <span className="sc-fila-texto">
                <strong>{nombreDe(c)}{c.nivel_entrenador ? ` · ${c.nivel_entrenador}` : ''}</strong>
                <small>{resumenPares(paresCuenta(c))}</small>
              </span>
              <span className="sc-fila-accion"><Pencil size={14} aria-hidden="true" /> Asignar</span>
            </button>
          ))}
        </div>
      )}

      {vista === 'categoria' && ramas.map((r) => (
        <div key={r} className="rp-panel">
          <h4 className="sc-rama">Rama {titulo(r)}</h4>
          {(categoriasPorRama[r] || []).map((cat) => {
            const par = parRamaCategoria(r, cat);
            const aCargo = staff.filter((c) => lista(c.categorias_asignadas).length && paresCuenta(c).some((p) => mismoTexto(p, par)));
            const todas = staff.filter((c) => !lista(c.categorias_asignadas).length);
            // Quien ya ve todo no se ofrece: agregarle una categoría lo restringiría a esa sola.
            const disponibles = staff.filter((c) => !aCargo.includes(c) && lista(c.categorias_asignadas).length > 0);
            return (
              <section key={par} className="card sc-categoria">
                <div className="sc-cabecera">
                  <h4>{cat} · {titulo(r)}</h4>
                  <small>{activos.filter((j) => mismoTexto(j.rama, r) && mismoTexto(j.categoria, cat)).length} deportistas activos</small>
                </div>
                <div className="sc-chips">
                  {aCargo.length === 0 && todas.length === 0 && <span className="fp-ayuda">Sin entrenador asignado.</span>}
                  {[...aCargo, ...todas].map((c) => (
                    <button key={c.id} type="button" className="sc-chip" onClick={() => setAbierto(c.id)} title={resumenPares(paresCuenta(c))}>
                      {nombreDe(c)}{aCargo.includes(c) ? '' : ' (todas)'}
                    </button>
                  ))}
                </div>
                {disponibles.length > 0 && (
                  <div className="sc-agregar">
                    <Plus size={14} aria-hidden="true" />
                    <select
                      className="form-input"
                      value=""
                      aria-label={`Agregar entrenador a ${cat} ${titulo(r)}`}
                      onChange={(e) => {
                        const c = staff.find((x) => String(x.id) === e.target.value);
                        if (c) guardar(c, [...paresCuenta(c), par]);
                      }}
                    >
                      <option value="">Agregar entrenador…</option>
                      {disponibles.map((c) => <option key={c.id} value={c.id}>{nombreDe(c)}</option>)}
                    </select>
                  </div>
                )}
              </section>
            );
          })}
        </div>
      ))}

      {cuentaAbierta && (
        <VentanaAsignacion
          key={cuentaAbierta.id}
          cuenta={cuentaAbierta}
          ramas={ramas}
          categoriasPorRama={categoriasPorRama}
          onCerrar={() => setAbierto(null)}
          onGuardar={guardar}
          onEditarCuenta={onEditar}
        />
      )}
    </div>
  );
}
