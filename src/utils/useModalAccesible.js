import { useEffect, useRef } from 'react';

// Comportamiento común de ventanas emergentes (antes cada modal tenía el
// suyo y ninguno cerraba con Escape ni bloqueaba el scroll del fondo):
//  - Escape cierra SOLO la ventana de más arriba (pila de modales abiertos).
//  - Mientras haya alguna abierta, el fondo no hace scroll. El scroll de la
//    app vive en main.ios-main (no en body), por eso la clase va al body y el
//    CSS bloquea .ios-main (ver .modal-abierto en App.css).
//  - Al cerrar, el foco vuelve al elemento que la abrió (teclado/lectores).
// cerrarConEscape=false para modales obligatorios (ej. onboarding);
// bloquearFondo=false para paneles flotantes tipo menú (Configuración).
const pila = [];

const actualizarBloqueo = () => {
  document.body.classList.toggle('modal-abierto', pila.some((t) => t.bloquearFondo));
};

export default function useModalAccesible(abierto, onCerrar, { cerrarConEscape = true, bloquearFondo = true } = {}) {
  const onCerrarRef = useRef(onCerrar);
  useEffect(() => {
    onCerrarRef.current = onCerrar;
  }, [onCerrar]);

  useEffect(() => {
    if (!abierto) return undefined;
    const token = { bloquearFondo };
    pila.push(token);
    actualizarBloqueo();
    const focoPrevio = document.activeElement;

    const alPresionarTecla = (event) => {
      if (event.key !== 'Escape' || !cerrarConEscape) return;
      if (pila[pila.length - 1] !== token) return;
      event.stopPropagation();
      onCerrarRef.current?.();
    };
    document.addEventListener('keydown', alPresionarTecla);

    return () => {
      document.removeEventListener('keydown', alPresionarTecla);
      const idx = pila.indexOf(token);
      if (idx >= 0) pila.splice(idx, 1);
      actualizarBloqueo();
      if (focoPrevio && typeof focoPrevio.focus === 'function' && document.contains(focoPrevio)) {
        focoPrevio.focus({ preventScroll: true });
      }
    };
  }, [abierto, cerrarConEscape, bloquearFondo]);
}
