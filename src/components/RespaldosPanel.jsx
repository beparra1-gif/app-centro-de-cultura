import { useEffect, useState } from 'react';
import { Database, Play, RefreshCcw } from 'lucide-react';
import * as api from '../api/client';
import { showToast } from '../utils/toast';
import { confirmAction } from '../utils/confirmDialog';

// Panel → Sistema → Respaldos (solo super admin): último respaldo, simulación
// en vivo de la limpieza de copias antiguas en Spaces y el interruptor para
// activarla. Borrar respaldos no tiene vuelta atrás: se confirma siempre.

const fecha = (iso) => (iso ? new Date(iso).toLocaleString('es-CL', { dateStyle: 'medium', timeStyle: 'short' }) : '—');

export default function RespaldosPanel() {
  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [ocupado, setOcupado] = useState(false);

  const cargar = async () => {
    setCargando(true);
    try {
      setDatos(await api.respaldosAPI.estado());
    } catch (error) {
      showToast({ message: error.message || 'No se pudo leer el estado de los respaldos.', type: 'error' });
    } finally {
      setCargando(false);
    }
  };
  useEffect(() => { void cargar(); }, []);

  const cambiarLimpieza = async (activar) => {
    const sim = datos?.simulacion;
    const confirmado = await confirmAction({
      title: activar ? 'Activar limpieza automática' : 'Desactivar limpieza automática',
      message: activar
        ? `Desde el próximo respaldo se borrarán las copias antiguas y se conservarán las de los últimos ${datos.retencion.politica.diarios} días, una por semana (${datos.retencion.politica.semanales} semanas) y una por mes (${datos.retencion.politica.mensuales} meses).${sim ? ` Hoy se borrarían ${sim.borrar} copias (${sim.borrarMB} MB) y quedarían ${sim.conservar}.` : ''} Lo borrado no se puede recuperar.`
        : 'Las copias antiguas dejarán de borrarse (solo se simulará).',
      confirmText: activar ? 'Activar limpieza' : 'Desactivar',
    });
    if (!confirmado) return;
    setOcupado(true);
    try {
      await api.respaldosAPI.configurar({ retencionAplicar: activar });
      showToast({ message: activar ? 'Limpieza automática activada.' : 'Limpieza automática desactivada.', type: 'success' });
      await cargar();
    } catch (error) {
      showToast({ message: error.message || 'No se pudo guardar.', type: 'error' });
    } finally {
      setOcupado(false);
    }
  };

  const respaldarAhora = async () => {
    const confirmado = await confirmAction({
      title: 'Respaldar ahora',
      message: 'Se hará un respaldo completo de la base y se subirá a Spaces. Puede tardar un par de minutos.',
      confirmText: 'Respaldar',
    });
    if (!confirmado) return;
    setOcupado(true);
    try {
      await api.respaldosAPI.ejecutar();
      showToast({ message: 'Respaldo listo y subido a Spaces.', type: 'success' });
      await cargar();
    } catch (error) {
      showToast({ message: error.message || 'El respaldo falló.', type: 'error' });
    } finally {
      setOcupado(false);
    }
  };

  if (cargando && !datos) return <p className="tc-vacio">Cargando estado de los respaldos…</p>;
  if (!datos) return null;
  const sim = datos.simulacion;
  const ultimo = datos.ultimo;

  return (
    <div className="fade-in">
      <div className="tesoreria-cabecera">
        <h2>Respaldos</h2>
        <button type="button" className="btn-secondary tc-btn" onClick={cargar} disabled={cargando}><RefreshCcw size={13} /> Actualizar</button>
      </div>

      <div className="cm-kpis rs-kpis">
        <div><span>Respaldo automático</span><strong>{datos.habilitado ? 'Activo' : 'Apagado'}</strong><small>Todos los días a las 04:00 UTC (≈ 01:00 en Chile)</small></div>
        <div><span>Copia en Spaces</span><strong>{datos.almacenamiento.subeASpaces && datos.almacenamiento.configurado ? 'Sí' : 'No'}</strong><small>{datos.almacenamiento.bucket || 'Sin bucket configurado'}</small></div>
        <div><span>Último respaldo</span><strong>{ultimo ? (ultimo.status === 'success' ? 'Correcto' : 'Con error') : 'Sin datos'}</strong><small>{ultimo ? fecha(ultimo.finishedAt || ultimo.startedAt) : 'Se reinicia con cada despliegue'}</small></div>
        <div><span>Limpieza automática</span><strong>{datos.retencion.activa ? 'Activa' : 'Simulación'}</strong><small>{datos.retencion.actualizado ? `Cambiada el ${fecha(datos.retencion.actualizado)}` : 'Nunca cambiada'}</small></div>
      </div>

      <section className="rs-card">
        <h3><Database size={16} /> Copias guardadas en Spaces</h3>
        {sim ? (
          <>
            <p>
              Hay <b>{sim.totalObjetos}</b> copias ({sim.totalMB} MB). Con la política actual se conservarían <b>{sim.conservar}</b> ({sim.conservarMB} MB):
              todas las de los últimos {sim.politica.diarios} días, una por semana durante {sim.politica.semanales} semanas y una por mes durante {sim.politica.mensuales} meses.
            </p>
            <p className={sim.borrar ? 'rs-alerta' : ''}>
              {sim.borrar ? <>Se borrarían <b>{sim.borrar}</b> copias antiguas ({sim.borrarMB} MB).</> : 'No hay copias para borrar.'}
            </p>
          </>
        ) : (
          <p>{datos.errorSimulacion ? `No se pudo leer el bucket: ${datos.errorSimulacion}` : 'La subida a Spaces no está configurada.'}</p>
        )}
        <div className="id-acciones">
          {datos.retencion.activa ? (
            <button type="button" className="btn-secondary tc-btn" disabled={ocupado || (!datos.retencion.desdePanel && datos.retencion.activa)} onClick={() => cambiarLimpieza(false)}>
              Desactivar limpieza
            </button>
          ) : (
            <button type="button" className="btn-electric tc-btn" disabled={ocupado || !sim} onClick={() => cambiarLimpieza(true)}>
              Activar limpieza automática
            </button>
          )}
          <button type="button" className="btn-secondary tc-btn" disabled={ocupado || datos.enCurso} onClick={respaldarAhora}>
            <Play size={13} /> {datos.enCurso ? 'Respaldo en curso…' : 'Respaldar ahora'}
          </button>
        </div>
        {datos.retencion.activa && !datos.retencion.desdePanel && (
          <small className="pf-ayuda">La limpieza está activada por una variable de DigitalOcean (BACKUP_S3_RETENCION_APLICAR); se desactiva allí.</small>
        )}
      </section>
    </div>
  );
}
