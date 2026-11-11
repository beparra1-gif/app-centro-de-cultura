import { useEffect, useState } from 'react';

// Estado que se recuerda en este dispositivo (orden y filtros de listas).
// Si el navegador no deja guardar (modo privado, almacenamiento lleno),
// funciona igual que un useState normal. `validar` descarta valores viejos
// con una forma que ya no corresponde.
export default function usePreferenciaLocal(clave, inicial, validar = () => true) {
  const claveCompleta = `ccf.pref.${clave}`;
  const [valor, setValor] = useState(() => {
    try {
      const guardado = window.localStorage.getItem(claveCompleta);
      if (guardado === null) return inicial;
      const leido = JSON.parse(guardado);
      return validar(leido) ? leido : inicial;
    } catch {
      return inicial;
    }
  });
  useEffect(() => {
    try { window.localStorage.setItem(claveCompleta, JSON.stringify(valor)); } catch { /* sin almacenamiento */ }
  }, [claveCompleta, valor]);
  return [valor, setValor];
}

// Validador para { orden, dir } de SelectorOrden.
export const esOrdenValido = (opciones) => (v) => Boolean(v) && opciones.includes(v.orden) && ['asc', 'desc'].includes(v.dir);
