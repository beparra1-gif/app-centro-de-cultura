import { useEffect, useMemo, useState } from 'react';
import * as api from '../api/client';
import { showToast } from './toast';
import { colorBarraPorRama } from './coloresRama';

export const COLOR_BARRA_ARRIENDO = {
  pendiente: '#FF9500',
  pagado: '#34C759',
  anulado: '#8E8E93',
};

// Fetch combinado (arriendos + instancias de entrenamiento) para un rango de
// fechas, con los eventos ya normalizados para CalendarioGrilla. Un solo
// lugar para esta lógica — antes vivía duplicada en CanchaArriendoPanel.jsx
// y HorariosEntrenamientoPanel.jsx (cada uno con su propio fetch).
// puedeCancha=false evita pedir /arriendos-cancha (evita un 403 innecesario
// para cuentas que solo tienen el permiso de horarios_entrenamiento).
export function useCalendarioCanchaEntrenamientos({ puedeCancha }) {
  const [rango, setRango] = useState({ desde: '', hasta: '' });
  const [arriendos, setArriendos] = useState([]);
  const [entrenamientos, setEntrenamientos] = useState([]);
  const [cargando, setCargando] = useState(false);

  const cargarRango = async (desde, hasta) => {
    if (!desde || !hasta) return;
    setCargando(true);
    try {
      const [datosArriendos, datosEntrenamientos] = await Promise.all([
        puedeCancha ? api.arriendosCanchaAPI.getAll({ desde, hasta }) : Promise.resolve([]),
        api.horariosEntrenamientoAPI.getInstancias({ desde, hasta }).catch(() => []),
      ]);
      setArriendos(Array.isArray(datosArriendos) ? datosArriendos : []);
      setEntrenamientos(Array.isArray(datosEntrenamientos) ? datosEntrenamientos : []);
    } catch (error) {
      showToast({ message: error.message || 'No se pudo cargar el calendario.', type: 'error' });
      setArriendos([]);
      setEntrenamientos([]);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    if (!rango.desde || !rango.hasta) return;
    (async () => { await cargarRango(rango.desde, rango.hasta); })();
  }, [rango.desde, rango.hasta, puedeCancha]);

  const eventos = useMemo(() => {
    const eventosArriendos = arriendos.map((a) => ({
      id: `arriendo-${a.id_arriendo}`,
      fecha: String(a.fecha).slice(0, 10),
      horaInicio: String(a.hora_inicio || '00:00').slice(0, 5),
      horaFin: String(a.hora_fin || '00:00').slice(0, 5),
      titulo: a.nombre_arrendatario,
      subtitulo: a.telefono_contacto || '',
      color: COLOR_BARRA_ARRIENDO[a.estado_pago] || COLOR_BARRA_ARRIENDO.pendiente,
      tipo: 'arriendo',
      raw: a,
    }));
    const eventosEntrenamientos = entrenamientos.map((e) => ({
      id: `entreno-${e.id_horario}_${e.fecha}`,
      fecha: e.fecha,
      horaInicio: String(e.hora_inicio || '00:00').slice(0, 5),
      horaFin: String(e.hora_fin || '00:00').slice(0, 5),
      titulo: `${e.rama} ${Array.isArray(e.categorias) ? e.categorias.join('/') : ''}`,
      subtitulo: Array.isArray(e.entrenadores) ? e.entrenadores.join(', ') : '',
      color: colorBarraPorRama(e.rama),
      tipo: 'entrenamiento',
      raw: e,
    }));
    return [...eventosArriendos, ...eventosEntrenamientos];
  }, [arriendos, entrenamientos]);

  const manejarRangoVisible = (desde, hasta) => {
    setRango((prev) => (prev.desde === desde && prev.hasta === hasta ? prev : { desde, hasta }));
  };

  const recargar = () => cargarRango(rango.desde, rango.hasta);

  return { rango, manejarRangoVisible, eventos, cargando, recargar };
}
