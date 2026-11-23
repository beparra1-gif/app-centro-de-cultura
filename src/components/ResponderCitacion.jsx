import { useEffect, useId, useState } from 'react';
import * as api from '../api/client';
import TarjetaPartido from './TarjetaPartido';

// Página pública que abre el enlace de WhatsApp (?citacion=TOKEN): el
// apoderado confirma o indica el motivo de la inasistencia sin iniciar sesión.

const fechaLegible = (iso) => {
  const [a, m, d] = String(iso || '').slice(0, 10).split('-').map(Number);
  if (!a) return '';
  return new Date(a, m - 1, d).toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long' });
};
const hora = (h) => String(h || '').slice(0, 5);

export default function ResponderCitacion({ token }) {
  const [cita, setCita] = useState(null);
  const [error, setError] = useState('');
  const [motivo, setMotivo] = useState('');
  const [rechazando, setRechazando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [aviso, setAviso] = useState('');
  const idMotivo = useId();

  useEffect(() => {
    let activo = true;
    api.citacionesAPI.verPorEnlace(token)
      .then((c) => { if (activo) setCita(c); })
      .catch((e) => { if (activo) setError(e.message || 'El enlace no es válido.'); });
    return () => { activo = false; };
  }, [token]);

  const responder = async (respuesta) => {
    setGuardando(true);
    setAviso('');
    try {
      const actualizada = await api.citacionesAPI.responderPorEnlace(token, { respuesta, justificacion: respuesta === 'no' ? motivo : '' });
      setCita(actualizada);
      setRechazando(false);
      setAviso(respuesta === 'si' ? '¡Gracias! Asistencia confirmada.' : 'Gracias por avisar. Quedó registrado el motivo.');
    } catch (e) {
      setAviso(e.message || 'No se pudo guardar la respuesta.');
    } finally {
      setGuardando(false);
    }
  };

  const banca = cita?.rol === 'banca';
  const estado = cita?.respuesta === 'si'
    ? (banca ? 'Disponible como reserva' : 'Asistencia confirmada')
    : cita?.respuesta === 'no'
      ? (cita.respondido_automaticamente ? 'No asiste (no respondió a tiempo)' : 'No asistirá')
      : 'Sin responder';

  return (
    <main style={{ minHeight: '100vh', background: 'var(--fondo-app, #f2f4f8)', padding: '24px 16px', color: 'var(--texto-principal)' }}>
      <div className="card card-estatica" style={{ maxWidth: '520px', margin: '0 auto' }} data-testid="responder-citacion">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
          <img src="/logos/club-logo.png" alt="" width="56" height="56" />
          <div>
            <h1 style={{ fontSize: '19px', margin: 0 }}>{banca ? 'Banca (reserva)' : 'Citación'}</h1>
            <p className="pf-ayuda" style={{ margin: 0 }}>Centro de Cultura Física Viña del Mar</p>
          </div>
        </div>
        {!cita && !error && <p role="status">Cargando…</p>}
        {error && <p role="alert" style={{ color: '#B42318', fontWeight: 700 }}>{error}</p>}
        {cita && (
          <>
            <p style={{ fontSize: '17px', fontWeight: 800, margin: '4px 0 10px' }}>{cita.deportista}</p>
            <TarjetaPartido cita={cita} />
            {cita.hora_maxima_confirmacion && !banca && (
              <p className="pf-ayuda">Plazo para responder: {fechaLegible(cita.hora_maxima_confirmacion)} a las {hora(cita.hora_maxima_confirmacion.split('T')[1])}</p>
            )}
            <p role="status" style={{ fontWeight: 800, color: cita.respuesta === 'si' ? 'var(--verde-victoria)' : cita.respuesta === 'no' ? '#B42318' : '#8A4B00', margin: '14px 0 4px' }}>
              {estado}
            </p>
            {cita.respuesta === 'no' && cita.justificacion && <p className="pf-ayuda" style={{ marginTop: 0 }}>Motivo: {cita.justificacion}</p>}
            {aviso && <p role="alert" style={{ fontWeight: 700 }}>{aviso}</p>}

            {cita.plazo_vencido ? (
              <p className="pf-ayuda">El plazo para responder ya venció. Si hay un cambio, escríbele al responsable de la citación.</p>
            ) : !rechazando ? (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '12px' }}>
                <button type="button" className="btn-electric" disabled={guardando} onClick={() => responder('si')}>
                  {banca ? 'Estará disponible' : 'Confirmo asistencia'}
                </button>
                <button type="button" className="btn-secondary" disabled={guardando} onClick={() => setRechazando(true)}>No podrá asistir</button>
              </div>
            ) : (
              <form onSubmit={(e) => { e.preventDefault(); void responder('no'); }} style={{ marginTop: '12px' }}>
                <div className="form-group">
                  <label htmlFor={idMotivo}>Motivo de la inasistencia</label>
                  <textarea id={idMotivo} className="form-input" rows={3} required maxLength={500} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ej: enfermedad, viaje, prueba en el colegio" />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <button type="submit" className="btn-electric" disabled={guardando || !motivo.trim()}>Enviar</button>
                  <button type="button" className="btn-secondary" onClick={() => setRechazando(false)}>Volver</button>
                </div>
              </form>
            )}
            <p className="pf-ayuda" style={{ marginTop: '16px' }}>Puedes cambiar tu respuesta con este mismo enlace mientras el plazo esté abierto.</p>
          </>
        )}
      </div>
    </main>
  );
}
