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

// Usuarios y Cuentas → "Staff": rama y categorías a cargo de cada entrenador
// (cuentas.ramas_asignadas y categorias_asignadas, [] = todas). Ve a los
// deportistas cuya categoría Y rama estén asignadas. Un entrenador puede
// tener varias y una categoría varios entrenadores. Se edita en una ventana
// al elegir al entrenador (con casillas a la vista, no un desplegable).

const nombreDe = (c) => `${c.nombres || ''} ${c.apellido_paterno || ''}`.trim() || c.rut;
const lista = (v) => (Array.isArray(v) ? v : []);
const titulo = (t = '') => String(t).charAt(0).toUpperCase() + String(t).slice(1).toLowerCase();
const resumen = (c) => {
  const ramas = lista(c.ramas_asignadas);
  const cats = lista(c.categorias_asignadas);
  return `${ramas.length ? ramas.map(titulo).join(' y ') : 'Todas las ramas'} · ${cats.length ? [...cats].sort(ordenarCategorias).join(', ') : 'todas las categorías'}`;
};
const alternar = (arr, v) => (arr.some((x) => mismoTexto(x, v)) ? arr.filter((x) => !mismoTexto(x, v)) : [...arr, v]);

function Casillas({ leyenda, opciones, valor, setValor, todas, formato = (o) => o }) {
  return (
    <fieldset className="sc-fieldset">
      <legend>{leyenda}</legend>
      <label className="fc-opcion fc-todas"><input type="checkbox" checked={valor.length === 0} onChange={() => setValor([])} /> {todas}</label>
      <div className="sc-casillas">
        {opciones.map((o) => (
          <label key={o} className="fc-opcion"><input type="checkbox" checked={valor.some((v) => mismoTexto(v, o))} onChange={() => setValor(alternar(valor, o))} /> {formato(o)}</label>
        ))}
      </div>
    </fieldset>
  );
}

function VentanaAsignacion({ cuenta, ramasDisponibles, categoriasDisponibles, onCerrar, onGuardar, onEditarCuenta }) {
  useModalAccesible(true, onCerrar);
  const [ramas, setRamas] = useState(lista(cuenta.ramas_asignadas));
  const [categorias, setCategorias] = useState(lista(cuenta.categorias_asignadas));
  const [guardando, setGuardando] = useState(false);
  const cambiado = JSON.stringify([ramas, categorias]) !== JSON.stringify([lista(cuenta.ramas_asignadas), lista(cuenta.categorias_asignadas)]);

  const guardar = async () => {
    setGuardando(true);
    const ok = await onGuardar(cuenta, { ramas, categorias });
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
            <p>Hoy: {resumen(cuenta)}</p>
          </div>
          <button type="button" className="fp-cerrar" onClick={onCerrar} aria-label="Cerrar"><X size={20} /></button>
        </header>
        <div className="fp-cuerpo">
          <Casillas leyenda="Rama" opciones={ramasDisponibles} valor={ramas} setValor={setRamas} todas="Todas las ramas" formato={titulo} />
          <Casillas leyenda="Categorías" opciones={categoriasDisponibles} valor={categorias} setValor={setCategorias} todas="Todas las categorías" />
          <p className="sc-resultado" aria-live="polite">
            <strong>{cambiado ? 'Quedará a cargo de:' : 'A cargo de:'}</strong> {resumen({ ramas_asignadas: ramas, categorias_asignadas: categorias })}
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
  const ramas = useMemo(() => unicosSinMayusculas([...activos.map((j) => j.rama), ...staff.flatMap((c) => lista(c.ramas_asignadas))]).sort(), [activos, staff]);
  const categorias = useMemo(() => unicosSinMayusculas([...activos.map((j) => j.categoria), ...staff.flatMap((c) => lista(c.categorias_asignadas))]).sort(ordenarCategorias), [activos, staff]);

  const guardar = async (cuenta, { ramas: r, categorias: c }) => {
    if (r.length === 0 && c.length === 0 && (lista(cuenta.ramas_asignadas).length || lista(cuenta.categorias_asignadas).length)) {
      const ok = await confirmAction({
        title: 'Sin asignación',
        message: `${nombreDe(cuenta)} quedará sin rama ni categorías asignadas: verá TODOS los deportistas en Pasar lista, Evaluar y Citaciones.`,
        confirmText: 'Sí, ver todos',
      });
      if (!ok) return false;
    }
    try {
      await api.cuentasAPI.update(cuenta.id, { ramas_asignadas: r, categorias_asignadas: c });
      await onRecargar?.();
      showToast({ message: `${nombreDe(cuenta)}: ${resumen({ ramas_asignadas: r, categorias_asignadas: c })}.`, type: 'success' });
      return true;
    } catch (error) {
      showToast({ message: error.message || 'No se pudo guardar.', type: 'error' });
      return false;
    }
  };

  if (staff.length === 0) {
    return <div className="card"><p className="tc-vacio">No hay cuentas con perfil Staff. Asigna el perfil “Staff” a los entrenadores en la pestaña Cuentas y vuelve aquí.</p></div>;
  }

  // Cuenta fresca (tras recargar) para la ventana abierta.
  const cuentaAbierta = abierto && (staff.find((c) => c.id === abierto) || null);

  return (
    <div className="rp-panel">
      <div className="card">
        <p className="fp-ayuda">
          Toca un entrenador para asignarle rama y categorías. Verá en Pasar lista, Evaluar y Citaciones solo a los deportistas
          de esa rama y esas categorías. Un entrenador puede tener varias y una categoría puede tener varios entrenadores.
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
                <strong>{nombreDe(c)}</strong>
                <small>{resumen(c)}</small>
              </span>
              <span className="sc-fila-accion"><Pencil size={14} aria-hidden="true" /> Asignar</span>
            </button>
          ))}
        </div>
      )}

      {vista === 'categoria' && categorias.map((cat) => {
        const aCargo = staff.filter((c) => lista(c.categorias_asignadas).some((a) => mismoTexto(a, cat)));
        const todas = staff.filter((c) => lista(c.categorias_asignadas).length === 0);
        // Quien ya ve todas no se ofrece: agregarle una categoría lo restringiría a esa sola.
        const disponibles = staff.filter((c) => !aCargo.includes(c) && lista(c.categorias_asignadas).length > 0);
        return (
          <section key={cat} className="card sc-categoria">
            <div className="sc-cabecera">
              <h4>{cat}</h4>
              <small>{activos.filter((j) => mismoTexto(j.categoria, cat)).length} deportistas activos</small>
            </div>
            <div className="sc-chips">
              {aCargo.length === 0 && todas.length === 0 && <span className="fp-ayuda">Sin entrenador asignado.</span>}
              {[...aCargo, ...todas].map((c) => (
                <button key={c.id} type="button" className="sc-chip" onClick={() => setAbierto(c.id)} title={resumen(c)}>
                  {nombreDe(c)}{lista(c.ramas_asignadas).length ? ` · ${lista(c.ramas_asignadas).map(titulo).join('/')}` : ''}{aCargo.includes(c) ? '' : ' (todas)'}
                </button>
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
                    if (c) guardar(c, { ramas: lista(c.ramas_asignadas), categorias: [...lista(c.categorias_asignadas), cat] });
                  }}
                >
                  <option value="">Agregar entrenador…</option>
                  {disponibles.map((c) => <option key={c.id} value={c.id}>{nombreDe(c)} ({resumen(c)})</option>)}
                </select>
              </div>
            )}
          </section>
        );
      })}

      {cuentaAbierta && (
        <VentanaAsignacion
          key={cuentaAbierta.id}
          cuenta={cuentaAbierta}
          ramasDisponibles={ramas}
          categoriasDisponibles={categorias}
          onCerrar={() => setAbierto(null)}
          onGuardar={guardar}
          onEditarCuenta={onEditar}
        />
      )}
    </div>
  );
}
