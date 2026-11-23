import { useEffect, useId, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Bell, X } from 'lucide-react';
import * as api from '../api/client';
import { showToast } from '../utils/toast';
import { esBanca, puedeJugadorResponderPropiaCitacion } from '../utils/citaciones';
import { activarAvisos, estadoAvisos } from '../utils/notificacionesPush';
import TarjetaPartido from './TarjetaPartido';

// Ventana que aparece al abrir la app cuando una jugadora/jugador de la
// familia fue citado y nadie ha respondido: confirmar o indicar el motivo
// ahí mismo. También ofrece activar los avisos nativos en el teléfono.

const normRut = (r) => String(r || '').replace(/[.\s-]/g, '').toUpperCase();
const CLAVE_VISTAS = 'ccf-citaciones-pospuestas';

const leerPospuestas = () => {
  try { return new Set(JSON.parse(sessionStorage.getItem(CLAVE_VISTAS) || '[]')); } catch { return new Set(); }
};

function BotonAvisos() {
  const [estado, setEstado] = useState('cargando');
  useEffect(() => {
    let activo = true;
    estadoAvisos().then((e) => { if (activo) setEstado(e); }).catch(() => { if (activo) setEstado('no-soportado'); });
    return () => { activo = false; };
  }, []);
  if (estado === 'cargando' || estado === 'activado' || estado === 'no-soportado') return null;
  if (estado === 'instalar-ios') {
    return <p className="pf-ayuda">Para recibir avisos en este iPhone: toca Compartir → "Agregar a inicio" y abre la app desde ese ícono.</p>;
  }
  if (estado === 'bloqueado') {
    return <p className="pf-ayuda">Los avisos están bloqueados para esta app en el navegador; actívalos en los ajustes del sitio para recibir las citaciones al instante.</p>;
  }
  return (
    <button
      type="button"
      className="btn-secondary tc-btn"
      onClick={async () => {
        try {
          await activarAvisos();
          setEstado('activado');
          showToast({ message: 'Listo: te avisaremos en este teléfono cuando haya citaciones.', type: 'success' });
        } catch (e) {
          showToast({ message: e.message || 'No se pudieron activar los avisos.', type: 'error' });
          setEstado(await estadoAvisos().catch(() => 'no-soportado'));
        }
      }}
    >
      <Bell size={14} /> Activar avisos en este teléfono
    </button>
  );
}

function Pendiente({ cita, convocado, puedeResponder, onRespondida }) {
  const [rechazando, setRechazando] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [guardando, setGuardando] = useState(false);
  const idMotivo = useId();
  const responder = async (respuesta) => {
    setGuardando(true);
    try {
      const actualizado = await api.citacionesAPI.responder(cita.id, convocado.rut_jugador, { respuesta, justificacion: respuesta === 'no' ? motivo : undefined });
      onRespondida(cita.id, { ...convocado, ...actualizado });
      showToast({ message: respuesta === 'si' ? `Asistencia de ${convocado.nombre} confirmada.` : 'Quedó registrado el motivo.', type: 'success' });
    } catch (e) {
      showToast({ message: e.message || 'No se pudo guardar la respuesta.', type: 'error' });
    } finally {
      setGuardando(false);
    }
  };
  return (
    <div style={{ borderTop: '1px solid var(--borde)', paddingTop: '12px', marginTop: '12px' }}>
      <p style={{ margin: '0 0 8px', fontWeight: 800 }}>
        {convocado.nombre} {esBanca(convocado) ? 'quedó en la banca (reserva)' : 'fue citada/o'}
      </p>
      <TarjetaPartido cita={cita} />
      {!puedeResponder ? (
        <p className="pf-ayuda">Tu apoderado debe confirmar o indicar el motivo si no puedes ir.</p>
      ) : !rechazando ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '10px' }}>
          <button type="button" className="btn-electric" disabled={guardando} onClick={() => responder('si')}>{esBanca(convocado) ? 'Estará disponible' : 'Confirmo asistencia'}</button>
          <button type="button" className="btn-secondary" disabled={guardando} onClick={() => setRechazando(true)}>No podrá asistir</button>
        </div>
      ) : (
        <form onSubmit={(e) => { e.preventDefault(); void responder('no'); }} style={{ marginTop: '10px' }}>
          <div className="form-group">
            <label htmlFor={idMotivo}>Motivo de la inasistencia</label>
            <textarea id={idMotivo} className="form-input" rows={2} required maxLength={500} value={motivo} onChange={(e) => setMotivo(e.target.value)} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <button type="submit" className="btn-electric" disabled={guardando || !motivo.trim()}>Enviar</button>
            <button type="button" className="btn-secondary" onClick={() => setRechazando(false)}>Volver</button>
          </div>
        </form>
      )}
    </div>
  );
}

// citaciones: nominaCita de App. rutsPupilos: RUT de los pupilos de la cuenta.
export default function CitacionesPendientesModal({ citaciones = [], rutsPupilos = [], rutPropio = '', forzarApertura = false, onActualizar }) {
  const pendientes = useMemo(() => {
    const pupilos = new Set(rutsPupilos.map(normRut));
    const propio = normRut(rutPropio);
    return (citaciones || []).flatMap((cita) => (cita.convocados || [])
      .filter((c) => c.respuesta === 'pendiente' && (pupilos.has(normRut(c.rut_jugador)) || normRut(c.rut_jugador) === propio))
      .map((c) => ({
        cita,
        convocado: c,
        clave: `${cita.id}-${normRut(c.rut_jugador)}`,
        // El apoderado siempre responde; el propio deportista solo si es autogestionado.
        puedeResponder: pupilos.has(normRut(c.rut_jugador)) || puedeJugadorResponderPropiaCitacion(c),
      })));
  }, [citaciones, rutsPupilos, rutPropio]);

  const [pospuestas, setPospuestas] = useState(leerPospuestas);
  const visibles = forzarApertura ? pendientes : pendientes.filter((p) => !pospuestas.has(p.clave));
  const [cerrada, setCerrada] = useState(false);
  if (cerrada || visibles.length === 0) return null;

  const posponer = () => {
    const siguiente = new Set([...pospuestas, ...pendientes.map((p) => p.clave)]);
    try { sessionStorage.setItem(CLAVE_VISTAS, JSON.stringify([...siguiente])); } catch { /* sin almacenamiento: se vuelve a mostrar */ }
    setPospuestas(siguiente);
    setCerrada(true);
  };
  const onRespondida = (citaId, convocado) => onActualizar?.((prev) => (prev || []).map((c) => (c.id !== citaId ? c : {
    ...c,
    convocados: (c.convocados || []).map((x) => (normRut(x.rut_jugador) === normRut(convocado.rut_jugador) ? { ...x, ...convocado } : x)),
  })));

  return createPortal(
    <div className="fp-fondo" role="presentation">
      <div className="fp-ventana" role="dialog" aria-modal="true" aria-labelledby="titulo-citaciones-pendientes" style={{ width: 'min(520px, 100%)' }} data-testid="citaciones-pendientes">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px 0' }}>
          <h2 id="titulo-citaciones-pendientes" style={{ margin: 0, fontSize: '18px' }}>
            {visibles.length === 1 ? 'Tienes una citación por responder' : `Tienes ${visibles.length} citaciones por responder`}
          </h2>
          <button type="button" className="btn-secondary tc-btn" aria-label="Cerrar" onClick={posponer}><X size={16} /></button>
        </div>
        <div style={{ padding: '0 16px 16px', overflowY: 'auto' }}>
          {visibles.map((p) => <Pendiente key={p.clave} {...p} onRespondida={onRespondida} />)}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginTop: '14px' }}>
            <BotonAvisos />
            <button type="button" className="btn-secondary tc-btn" onClick={posponer}>Responder más tarde</button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
