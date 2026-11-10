import { CATEGORIAS_FORMATIVAS, categoriaPorNacimiento, rangoAniosCategoria } from '../utils/categoriaPorEdad';

// Categoría del deportista: si hay fecha (o año) de nacimiento se calcula sola
// y queda bloqueada; si no, se elige de la lista. Un valor antiguo fuera de la
// lista (p. ej. "U15") se muestra igual para no perderlo.
export default function CampoCategoria({ fechaNacimiento, anioNacimiento, valor, onCambiar, requerido = false, id = 'campo-categoria' }) {
  const auto = categoriaPorNacimiento(fechaNacimiento, { anioRespaldo: anioNacimiento });
  const opciones = valor && !CATEGORIAS_FORMATIVAS.includes(valor) ? [...CATEGORIAS_FORMATIVAS, valor] : CATEGORIAS_FORMATIVAS;
  return (
    <div className="form-group">
      <label htmlFor={id}>Categoría{requerido ? ' *' : ''}</label>
      {auto ? (
        <>
          <div id={id} className="form-input cc-auto" aria-live="polite">{auto}<span className="cc-auto-chip">Automática</span></div>
          <small className="pf-ayuda">Por año de nacimiento ({rangoAniosCategoria(auto)}). Borra la fecha para elegirla a mano.</small>
        </>
      ) : (
        <>
          <select id={id} className="form-input" value={valor || ''} onChange={(e) => onCambiar(e.target.value)}>
            <option value="">Elige categoría…</option>
            {opciones.map((c) => <option key={c} value={c}>{c}{rangoAniosCategoria(c) ? ` (${rangoAniosCategoria(c)})` : ''}</option>)}
          </select>
          <small className="pf-ayuda">Sin fecha de nacimiento: elígela a mano. Con fecha se calcula sola.</small>
        </>
      )}
    </div>
  );
}
