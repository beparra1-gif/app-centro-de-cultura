// Reemplazo de window.confirm(): mismo patrón de singleton imperativo que
// src/utils/toast.js. confirmAction() devuelve una Promise<boolean> que
// ConfirmDialog.jsx resuelve cuando el usuario elige aceptar/cancelar.
let listener = null;

export const confirmAction = ({ title = 'Confirmar', message, confirmText = 'Confirmar', cancelText = 'Cancelar', danger = false }) => {
  return new Promise((resolve) => {
    if (!listener) {
      resolve(window.confirm(message));
      return;
    }
    listener({ title, message, confirmText, cancelText, danger, resolve });
  });
};

export const subscribeConfirmDialog = (fn) => {
  listener = fn;
  return () => {
    if (listener === fn) listener = null;
  };
};
