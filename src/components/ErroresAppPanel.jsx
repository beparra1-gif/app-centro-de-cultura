import { useEffect, useState } from 'react';
import { AlertTriangle, RefreshCcw, Trash2 } from 'lucide-react';
import * as api from '../api/client';
import { showToast } from '../utils/toast';
import { confirmAction } from '../utils/confirmDialog';

// Panel → Sistema → Errores recientes: lo que se rompió en el navegador de
// alguien (pantalla "Algo salió mal" o errores no controlados), con quién,
// dónde y cuántas veces. Reemplaza tener que pedir capturas.

const fecha = (iso) => (iso ? new Date(iso).toLocaleString('es-CL', { dateStyle: 'medium', timeStyle: 'short' }) : '—');
const dispositivo = (ua = '') => {
  if (/iphone|ipad/i.test(ua)) return 'iPhone/iPad';
  if (/android/i.test(ua)) return 'Android';
  if (/windows/i.test(ua)) return 'Windows';
  if (/mac os/i.test(ua)) return 'Mac';
  return ua ? 'Otro' : '—';
};

export default function ErroresAppPanel() {
  const [errores, setErrores] = useState(null);
  const [abierto, setAbierto] = useState(null);
  const [cargando, setCargando] = useState(false);

  const cargar = async () => {
    setCargando(true);
    try {
      const datos = await api.erroresAppAPI.listar();
      setErrores(Array.isArray(datos) ? datos : []);
    } catch (error) {
      showToast({ message: error.message || 'No se pudieron leer los errores.', type: 'error' });
      setErrores([]);
    } finally {
      setCargando(false);
    }
  };
  useEffect(() => { void cargar(); }, []);

  const limpiar = async () => {
    const confirmado = await confirmAction({
      title: 'Vaciar errores',
      message: 'Se borrará la lista de errores registrados. Úsalo después de revisarlos o corregirlos.',
      confirmText: 'Vaciar',
    });
    if (!confirmado) return;
    try {
      await api.erroresAppAPI.limpiar();
      showToast({ message: 'Lista de errores vaciada.', type: 'success' });
      await cargar();
    } catch (error) {
      showToast({ message: error.message || 'No se pudo vaciar.', type: 'error' });
    }
  };

  return (
    <div className="fade-in">
      <div className="tesoreria-cabecera">
        <h2>Errores recientes</h2>
        <div className="id-acciones-descarga">
          <button type="button" className="btn-secondary tc-btn" onClick={cargar} disabled={cargando}><RefreshCcw size={13} /> Actualizar</button>
          {errores?.length > 0 && <button type="button" className="btn-secondary tc-btn" onClick={limpiar}><Trash2 size={13} /> Vaciar</button>}
        </div>
      </div>
      <p className="uc-ayuda">Errores que vieron las personas en su teléfono o computador. Si un mismo error se repite, se suma en “veces”.</p>

      {errores === null && <p className="tc-vacio">Cargando…</p>}
      {errores?.length === 0 && <p className="tc-vacio">Sin errores registrados. 🎉</p>}
      <div className="ea-lista">
        {(errores || []).map((e) => (
          <article key={e.id} className="rs-card ea-item">
            <button type="button" className="ea-cabecera" onClick={() => setAbierto(abierto === e.id ? null : e.id)} aria-expanded={abierto === e.id}>
              <AlertTriangle size={16} aria-hidden="true" />
              <span className="ea-texto">
                <strong>{e.mensaje}</strong>
                <small>
                  {fecha(e.ultimo_en)} · {e.pantalla || 'pantalla desconocida'} · {e.nombre || e.rut || 'sin sesión'}{e.rol ? ` (${e.rol})` : ''} · {dispositivo(e.navegador)}
                </small>
              </span>
              {e.veces > 1 && <span className="pn-badge">{e.veces}<small> veces</small></span>}
            </button>
            {abierto === e.id && (
              <pre className="ea-detalle">{`Primera vez: ${fecha(e.creado_en)}\nDirección: ${e.url || '—'}\n\n${e.detalle || 'Sin detalle técnico.'}`}</pre>
            )}
          </article>
        ))}
      </div>
    </div>
  );
}
