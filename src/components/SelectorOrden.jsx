import { ArrowDownUp } from 'lucide-react';
import { OPCIONES_ORDEN, dirInicialDe } from '../utils/ordenarPersonas';

// "Ordenar por" + botón para invertir el sentido. `opciones` limita los
// criterios a los que tienen sentido en cada lista.
export default function SelectorOrden({ valor, onCambiar, opciones = OPCIONES_ORDEN.map((o) => o.id), className = '' }) {
  const actual = OPCIONES_ORDEN.find((o) => o.id === valor.orden) || OPCIONES_ORDEN[0];
  const sentido = valor.dir === 'desc' ? actual.desc : actual.asc;
  return (
    <div className={`selector-orden ${className}`}>
      <select
        className="form-input"
        aria-label="Ordenar por"
        value={valor.orden}
        onChange={(e) => onCambiar({ orden: e.target.value, dir: dirInicialDe(e.target.value) })}
      >
        {OPCIONES_ORDEN.filter((o) => opciones.includes(o.id)).map((o) => (
          <option key={o.id} value={o.id}>Ordenar: {o.label}</option>
        ))}
      </select>
      <button
        type="button"
        className="btn-secondary tc-btn"
        onClick={() => onCambiar({ ...valor, dir: valor.dir === 'desc' ? 'asc' : 'desc' })}
        aria-label={`Invertir orden (ahora: ${sentido})`}
        title="Invertir orden"
      >
        <ArrowDownUp size={14} /> {sentido}
      </button>
    </div>
  );
}
