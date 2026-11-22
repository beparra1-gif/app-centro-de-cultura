// Reemplazo de window.confirm(): mismo patrón de singleton imperativo que
// src/utils/toast.js. confirmAction() devuelve una Promise<boolean> que
// ConfirmDialog.jsx resuelve cuando el usuario elige aceptar/cancelar.
let listener = null;

// pedirTexto ({ etiqueta, placeholder }): además pide un texto opcional y
// resuelve con ese texto (puede ser '') al aceptar, o false al cancelar.
export const confirmAction = ({ title = 'Confirmar', message, confirmText = 'Confirmar', cancelText = 'Cancelar', danger = false, pedirTexto = null }) => {
  return new Promise((resolve) => {
    if (!listener) {
      if (pedirTexto) {
        const texto = window.prompt(`${message} ${pedirTexto.etiqueta || ''}`, '');
        resolve(texto === null ? false : texto.trim());
        return;
      }
      resolve(window.confirm(message));
      return;
    }
    listener({ title, message, confirmText, cancelText, danger, pedirTexto, resolve });
  });
};

export const subscribeConfirmDialog = (fn) => {
  listener = fn;
  return () => {
    if (listener === fn) listener = null;
  };
};
