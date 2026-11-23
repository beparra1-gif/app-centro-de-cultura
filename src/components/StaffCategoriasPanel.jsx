import { useMemo, useState } from 'react';
import { Plus, X } from 'lucide-react';
import * as api from '../api/client';
import { showToast } from '../utils/toast';
import { confirmAction } from '../utils/confirmDialog';
import { estaActivo } from '../utils/estadoActivo';
import { normalizarRol } from '../security/accessControl';
import { ordenarCategorias } from '../utils/informeDeuda';
import { mismoTexto, unicosSinMayusculas } from '../utils/texto';
import FiltroCategorias from './FiltroCategorias';

// Usuarios y Cuentas → "Staff": qué entrenadores tiene cada categoría y qué
// categorías tiene cada entrenador. Es la misma lista que "Categorías a
// cargo" de Editar cuenta (cuentas.categorias_asignadas): un entrenador
// puede tener varias categorías y una categoría varios entrenadores.
// [] = sin restricción (ve todas), por eso quitarle la última categoría a
// alguien se confirma: pasaría a ver todas.

const nombreDe = (c) => `${c.nombres || ''} ${c.apellido_paterno || ''}`.trim() || c.rut;
const asignadas = (c) => (Array.isArray(c.categorias_asignadas) ? c.categorias_asignadas : []);

export default function StaffCategoriasPanel({ cuentas = [], jugadores = [], onRecargar, onEditar }) {
  const [vista, setVista] = useState('categoria');
  const [guardando, setGuardando] = useState(null);
  const [borradores, setBorradores] = useState({});

  const staff = useMemo(() => cuentas
    .filter((c) => estaActivo(c) && normalizarRol(c.rol) === 'staff')
    .sort((a, b) => nombreDe(a).localeCompare(nombreDe(b), 'es')), [cuentas]);

  const categorias = useMemo(() => unicosSinMayusculas([
    ...jugadores.filter(estaActivo).map((j) => j.categoria),
    ...staff.flatMap(asignadas),
  ]).sort(ordenarCategorias), [jugadores, staff]);

  const deportistasPorCategoria = useMemo(() => {
    const m = new Map();
    jugadores.filter(estaActivo).forEach((j) => {
      const c = categorias.find((x) => mismoTexto(x, j.categoria));
      if (c) m.set(c, (m.get(c) || 0) + 1);
    });
    return m;
  }, [jugadores, categorias]);

  const sinRestriccion = staff.filter((c) => asignadas(c).length === 0);

  const guardar = async (cuenta, lista) => {
    if (lista.length === 0 && asignadas(cuenta).length > 0) {
      const ok = await confirmAction({
        title: 'Sin categorías',
        message: `${nombreDe(cuenta)} quedará sin categorías asignadas, y eso significa que verá TODAS las categorías en Pasar lista, Evaluar y Citaciones.`,
        confirmText: 'Sí, ver todas',
      });
      if (!ok) return false;
    }
    setGuardando(cuenta.id);
    try {
      await api.cuentasAPI.update(cuenta.id, { categorias_asignadas: lista });
      await onRecargar?.();
      setBorradores((prev) => { const sig = { ...prev }; delete sig[cuenta.id]; return sig; });
      showToast({ message: `Categorías de ${nombreDe(cuenta)} guardadas.`, type: 'success' });
      return true;
    } catch (error) {
      showToast({ message: error.message || 'No se pudo guardar.', type: 'error' });
      return false;
    } finally {
      setGuardando(null);
    }
  };

  if (staff.length === 0) {
    return (
      <div className="card">
        <p className="tc-vacio">No hay cuentas con perfil Staff. Asigna el perfil “Staff” a los entrenadores en la pestaña Cuentas y vuelve aquí.</p>
      </div>
    );
  }

  return (
    <div className="rp-panel">
      <div className="card">
        <p className="fp-ayuda">
          Cada entrenador ve en Pasar lista, Evaluar y Citaciones solo sus categorías. Un entrenador puede tener varias
          categorías y una categoría puede tener varios entrenadores. Quien no tiene ninguna asignada ve todas.
        </p>
        <div className="segment-control" role="tablist" aria-label="Ver staff">
          {[['categoria', 'Por categoría'], ['entrenador', 'Por entrenador']].map(([v, t]) => (
            <button key={v} type="button" role="tab" aria-selected={vista === v} className={`segment-btn ${vista === v ? 'active' : ''}`} onClick={() => setVista(v)}>{t}</button>
          ))}
        </div>
        {sinRestriccion.length > 0 && (
          <p className="fp-ayuda" style={{ marginTop: 10 }}>
            <strong>Ven todas las categorías:</strong> {sinRestriccion.map(nombreDe).join(', ')}
          </p>
        )}
      </div>

      {vista === 'categoria' && categorias.map((cat) => {
        const aCargo = staff.filter((c) => asignadas(c).some((a) => mismoTexto(a, cat)));
        const disponibles = staff.filter((c) => asignadas(c).length > 0 && !aCargo.includes(c));
        return (
          <section key={cat} className="card sc-categoria">
            <div className="sc-cabecera">
              <h4>{cat}</h4>
              <small>{deportistasPorCategoria.get(cat) || 0} deportistas activos</small>
            </div>
            <div className="sc-chips">
              {aCargo.length === 0 && <span className="fp-ayuda">Sin entrenador asignado{sinRestriccion.length ? ' (la ven quienes tienen todas)' : ''}.</span>}
              {aCargo.map((c) => (
                <span key={c.id} className="sc-chip">
                  {nombreDe(c)}
                  <button
                    type="button"
                    aria-label={`Quitar a ${nombreDe(c)} de ${cat}`}
                    disabled={guardando === c.id}
                    onClick={() => guardar(c, asignadas(c).filter((a) => !mismoTexto(a, cat)))}
                  >
                    <X size={13} />
                  </button>
                </span>
              ))}
            </div>
            {disponibles.length > 0 && (
              <div className="sc-agregar">
                <Plus size={14} aria-hidden="true" />
                <select
                  className="form-input"
                  value=""
                  aria-label={`Agregar entrenador a ${cat}`}
                  onChange={(e) => {
                    const c = staff.find((x) => String(x.id) === e.target.value);
                    if (c) guardar(c, [...asignadas(c), cat]);
                  }}
                >
                  <option value="">Agregar entrenador…</option>
                  {disponibles.map((c) => <option key={c.id} value={c.id}>{nombreDe(c)} ({asignadas(c).join(', ')})</option>)}
                </select>
              </div>
            )}
          </section>
        );
      })}

      {vista === 'entrenador' && staff.map((c) => {
        const valor = borradores[c.id] ?? asignadas(c);
        const cambiado = JSON.stringify(valor) !== JSON.stringify(asignadas(c));
        return (
          <section key={c.id} className="card sc-categoria">
            <div className="sc-cabecera">
              <h4>{nombreDe(c)}</h4>
              <small>{c.rut}{c.telefono ? ` · ${c.prefijo_tel || '+56'} ${c.telefono}` : ''}</small>
            </div>
            <div className="rp-acciones">
              <FiltroCategorias
                className="fc-flex"
                opciones={categorias}
                valor={valor}
                onCambiar={(v) => setBorradores((prev) => ({ ...prev, [c.id]: v }))}
                etiqueta="Categorías a cargo"
              />
              {cambiado && (
                <>
                  <button type="button" className="btn-electric tc-btn" disabled={guardando === c.id} onClick={() => guardar(c, valor)}>
                    {guardando === c.id ? 'Guardando…' : 'Guardar'}
                  </button>
                  <button type="button" className="btn-secondary tc-btn" onClick={() => setBorradores((prev) => { const sig = { ...prev }; delete sig[c.id]; return sig; })}>Deshacer</button>
                </>
              )}
              {onEditar && <button type="button" className="btn-secondary tc-btn" onClick={() => onEditar(c)}>Editar cuenta</button>}
            </div>
          </section>
        );
      })}
    </div>
  );
}
