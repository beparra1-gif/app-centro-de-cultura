import { useEffect, useState } from 'react';
import * as api from '../api/client';

// Para UNA fecha puntual: trae arriendos + instancias de entrenamiento de
// ese día y las combina ordenadas por hora — usado por los formularios de
// reserva/horario/excepción para mostrar el "hueco libre" antes de escribir
// la hora. No es la validación real (esa la hace el backend al guardar),
// es solo un adelanto visual.
export function useHorasOcupadasEnFecha(fecha) {
  const [ocupaciones, setOcupaciones] = useState([]);
  const [cargando, setCargando] = useState(false);

  useEffect(() => {
    if (!fecha) {
      (async () => { setOcupaciones([]); })();
      return;
    }
    let cancelado = false;
    (async () => {
      setCargando(true);
      try {
        const [arriendos, instancias] = await Promise.all([
          api.arriendosCanchaAPI.getAll({ desde: fecha, hasta: fecha }).catch(() => []),
          api.horariosEntrenamientoAPI.getInstancias({ desde: fecha, hasta: fecha }).catch(() => []),
        ]);
        if (cancelado) return;
        const deArriendos = (Array.isArray(arriendos) ? arriendos : [])
          .filter((a) => a.estado_pago !== 'anulado')
          .map((a) => ({
            origen: 'arriendo',
            horaInicio: String(a.hora_inicio || '').slice(0, 5),
            horaFin: String(a.hora_fin || '').slice(0, 5),
            etiqueta: a.nombre_arrendatario,
          }));
        const deInstancias = (Array.isArray(instancias) ? instancias : []).map((i) => ({
          origen: 'entrenamiento',
          horaInicio: String(i.hora_inicio || '').slice(0, 5),
          horaFin: String(i.hora_fin || '').slice(0, 5),
          etiqueta: `${i.rama} ${Array.isArray(i.categorias) ? i.categorias.join('/') : ''}`,
        }));
        setOcupaciones([...deArriendos, ...deInstancias].sort((a, b) => a.horaInicio.localeCompare(b.horaInicio)));
      } finally {
        if (!cancelado) setCargando(false);
      }
    })();
    return () => { cancelado = true; };
  }, [fecha]);

  return { ocupaciones, cargando };
}
