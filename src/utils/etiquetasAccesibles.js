// Accesibilidad (WCAG 4.1.2 / 3.3.2): muchos formularios usan
// <div className="form-group"><label>Texto</label><input/select/textarea/></div>
// sin vincular la etiqueta, y hay botones de solo ícono con `title` pero sin
// nombre accesible: un lector de pantalla los anunciaba sin nombre. En vez de
// tocar cientos de campos uno por uno, esto les asigna el nombre visible:
//  - campo sin id/aria-label/aria-labelledby dentro de un .form-group (o
//    justo después de su <label>) → aria-label = texto de la etiqueta;
//  - botón sin texto ni aria-label pero con title → aria-label = title.
// Nunca pisa un nombre que ya exista.

const tieneNombre = (el) => Boolean(
  el.getAttribute('aria-label') || el.getAttribute('aria-labelledby')
  || (el.id && el.ownerDocument.querySelector(`label[for="${CSS.escape(el.id)}"]`))
  || el.closest('label')
);

const textoEtiqueta = (label) => String(label?.textContent || '').replace(/\s+/g, ' ').replace(/\s*\*\s*$/, '').trim();

export const etiquetarCampos = (raiz = document) => {
  raiz.querySelectorAll('input:not([type="hidden"]), select, textarea').forEach((campo) => {
    if (tieneNombre(campo)) return;
    const grupo = campo.closest('.form-group');
    let label = grupo ? grupo.querySelector(':scope > label') : null;
    if (!label && campo.previousElementSibling?.tagName === 'LABEL') label = campo.previousElementSibling;
    const vecino = ['checkbox', 'radio'].includes(campo.type)
      ? textoEtiqueta(campo.nextElementSibling) || textoEtiqueta(campo.parentElement)
      : '';
    const primeraOpcion = campo.tagName === 'SELECT' ? textoEtiqueta(campo.options?.[0]) : '';
    const texto = textoEtiqueta(label) || vecino || campo.getAttribute('placeholder') || campo.getAttribute('title') || primeraOpcion;
    if (texto) campo.setAttribute('aria-label', texto);
  });
  raiz.querySelectorAll('button').forEach((boton) => {
    if (boton.getAttribute('aria-label') || String(boton.textContent || '').trim()) return;
    const titulo = boton.getAttribute('title');
    if (titulo) { boton.setAttribute('aria-label', titulo); return; }
    // Solo un ícono de lucide (su clase trae el nombre: "lucide-chevron-left").
    const clase = String(boton.querySelector('svg')?.getAttribute('class') || '');
    const icono = Object.keys(NOMBRE_POR_ICONO).find((k) => clase.includes(`lucide-${k}`));
    if (icono) boton.setAttribute('aria-label', NOMBRE_POR_ICONO[icono]);
  });
};

const NOMBRE_POR_ICONO = {
  'chevron-left': 'Anterior', 'chevron-right': 'Siguiente', 'arrow-left': 'Volver', 'x': 'Cerrar',
  'trash': 'Eliminar', 'pencil': 'Editar', 'plus': 'Agregar', 'search': 'Buscar', 'refresh': 'Actualizar',
  'download': 'Descargar', 'eye': 'Ver', 'settings': 'Configuración', 'bell': 'Notificaciones',
};

// Observa cambios del DOM (pantallas que se montan después) con un
// rAF de por medio para no correr en cada mutación.
export const observarEtiquetas = () => {
  if (typeof window === 'undefined' || typeof MutationObserver === 'undefined') return () => {};
  let pendiente = 0;
  const programar = () => {
    if (pendiente) return;
    pendiente = window.requestAnimationFrame(() => { pendiente = 0; etiquetarCampos(document); });
  };
  const observador = new MutationObserver(programar);
  observador.observe(document.body, { childList: true, subtree: true });
  programar();
  return () => { observador.disconnect(); if (pendiente) window.cancelAnimationFrame(pendiente); };
};
