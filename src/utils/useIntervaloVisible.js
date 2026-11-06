import { useEffect, useRef } from 'react';

// setInterval que solo corre mientras la pestaña está visible. Al volver a
// la pestaña, si ya pasó el intervalo desde la última ejecución, corre de
// inmediato (así el dato se ve fresco sin esperar el siguiente tick).
//
// Antes los refrescos de 20 s (pagos, citaciones, jugadores, permisos)
// seguían corriendo con la app en segundo plano: un admin con la pestaña
// abierta bajaba ~560 KB cada 20 s aunque no la estuviera mirando, gastando
// datos/batería del teléfono y carga del servidor.
export default function useIntervaloVisible(callback, ms, deps = []) {
  const callbackRef = useRef(callback);
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    if (!ms) return undefined;
    let ultimaEjecucion = Date.now();
    let intervalId = null;

    const ejecutar = () => {
      ultimaEjecucion = Date.now();
      callbackRef.current?.();
    };
    const iniciar = () => {
      if (intervalId == null) intervalId = window.setInterval(ejecutar, ms);
    };
    const detener = () => {
      if (intervalId != null) {
        window.clearInterval(intervalId);
        intervalId = null;
      }
    };
    const alCambiarVisibilidad = () => {
      if (document.hidden) {
        detener();
        return;
      }
      if (Date.now() - ultimaEjecucion >= ms) ejecutar();
      iniciar();
    };

    if (!document.hidden) iniciar();
    document.addEventListener('visibilitychange', alCambiarVisibilidad);
    return () => {
      detener();
      document.removeEventListener('visibilitychange', alCambiarVisibilidad);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ms, ...deps]);
}
