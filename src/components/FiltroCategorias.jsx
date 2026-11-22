import { useEffect, useRef } from 'react';
import { ChevronDown } from 'lucide-react';
import { mismoTexto } from '../utils/texto';

// Filtro de categorías con selección múltiple, para todas las listas que
// filtran por categoría. valor = categorías elegidas; [] = todas.
// Se abre como desplegable (no ocupa una fila de botones con 10+ categorías)
// y se cierra al tocar fuera.
export default function FiltroCategorias({ opciones = [], valor = [], onCambiar, etiqueta = 'Categorías', className = '' }) {
  const ref = useRef(null);
  useEffect(() => {
    const cerrar = (e) => { if (ref.current?.open && !ref.current.contains(e.target)) ref.current.open = false; };
    document.addEventListener('pointerdown', cerrar);
    return () => document.removeEventListener('pointerdown', cerrar);
  }, []);

  const elegida = (c) => valor.some((v) => mismoTexto(v, c));
  const alternar = (c) => onCambiar(elegida(c) ? valor.filter((v) => !mismoTexto(v, c)) : [...valor, c]);
  const resumen = valor.length === 0 ? `Todas las ${etiqueta.toLowerCase()}` : valor.length <= 3 ? valor.join(', ') : `${valor.length} ${etiqueta.toLowerCase()}`;

  return (
    <details ref={ref} className={`fc-filtro ${className}`}>
      <summary className="form-input" aria-label={`${etiqueta}: ${resumen}`}>
        <span>{resumen}</span>
        <ChevronDown size={15} aria-hidden="true" />
      </summary>
      <div className="fc-panel" role="group" aria-label={etiqueta}>
        <label className="fc-opcion fc-todas">
          <input type="checkbox" checked={valor.length === 0} onChange={() => onCambiar([])} /> Todas
        </label>
        {opciones.map((c) => (
          <label key={c} className="fc-opcion">
            <input type="checkbox" checked={elegida(c)} onChange={() => alternar(c)} /> {c}
          </label>
        ))}
        {opciones.length === 0 && <p className="fc-vacio">Sin categorías</p>}
      </div>
    </details>
  );
}
