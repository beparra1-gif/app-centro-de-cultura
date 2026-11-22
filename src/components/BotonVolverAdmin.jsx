import { ChevronLeft } from 'lucide-react';

// Botón "← Volver" reusado por todas las pantallas de contenido de la nueva
// grilla de Panel — declarado fuera de SuperAdminPanel (no adentro) porque un
// componente con JSX (mayúscula inicial) creado DENTRO del render de otro
// pierde su identidad en cada re-render (lint real, no cosmético). Recibe
// onVolver ya resuelto (setVistaAdmin(destino)) en vez de destino+setter
// para no depender de nada del componente padre.
export default function BotonVolverAdmin({ onVolver, label = 'Volver' }) {
  return (
    <button
      type="button"
      onClick={onVolver}
      className="btn-secondary"
      style={{ width: 'auto', padding: '8px 14px', marginBottom: '14px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
    >
      <ChevronLeft size={15} /> {label}
    </button>
  );
}
