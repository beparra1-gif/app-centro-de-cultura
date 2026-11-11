// Reemplazo de alert() nativo: singleton imperativo a nivel de módulo,
// mismo patrón que setAuthToken/setUnauthorizedHandler en src/api/client.js
// (este proyecto no usa React Context en ningún lado).
let idCounter = 0;
let listeners = [];

// type: 'success' | 'error' | 'info' | 'warning'
// accion (opcional): { label, onClick } — un botón en el aviso, ej. "Deshacer".
export const showToast = ({ message, type = 'info', duration = 4000, accion = null }) => {
  const toast = { id: ++idCounter, message, type, duration, accion };
  listeners.forEach((listener) => listener(toast));
  return toast.id;
};

export const subscribeToast = (listener) => {
  listeners.push(listener);
  return () => {
    listeners = listeners.filter((l) => l !== listener);
  };
};
