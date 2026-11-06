import { useEffect, useState } from 'react';
import { MailCheck, ShieldCheck } from 'lucide-react';
import * as api from '../api/client';
import { showToast } from '../utils/toast';
import useModalAccesible from '../utils/useModalAccesible';
import { FECHA_AVISO, SECCIONES_AVISO, VERSION_AVISO, casillasPara } from '../legal/avisoPrivacidad';

// Pasos obligatorios después de iniciar sesión (no se cierra con Escape):
//  - 'consentimiento': aviso de privacidad (Ley 19.628 / 21.719). Sin aceptar
//    lo obligatorio no se puede usar la app; "No acepto" cierra la sesión.
//  - 'correo': registrar y verificar un correo con un código, para que la
//    persona pueda recuperar su clave sola. "No tengo correo" lo pospone.
function PrimerIngresoModal({ paso, onConsentimientoAceptado, onCorreoConfirmado, onOmitirCorreo, onRechazar }) {
  useModalAccesible(Boolean(paso), () => {}, { cerrarConEscape: false });
  const [casillas, setCasillas] = useState({});
  const [guardando, setGuardando] = useState(false);
  const [correo, setCorreo] = useState('');
  const [codigo, setCodigo] = useState('');
  const [destino, setDestino] = useState('');
  // Tramo de edad (art. 16 quáter): define qué casillas se muestran. null
  // mientras se consulta; ante error se usa 'adulto' (el backend vuelve a
  // validar el tramo real al aceptar).
  const [tramo, setTramo] = useState(null);

  useEffect(() => {
    if (paso !== 'consentimiento') return undefined;
    let vigente = true;
    api.consentimientoAPI.estado()
      .then((r) => { if (vigente) setTramo(r?.tramo || 'adulto'); })
      .catch(() => { if (vigente) setTramo('adulto'); });
    return () => { vigente = false; };
  }, [paso]);

  if (!paso) return null;

  const casillasVisibles = casillasPara(tramo || 'adulto');
  const obligatoriasOk = Boolean(tramo) && casillasVisibles.filter((c) => c.obligatorio).every((c) => casillas[c.campo]);

  const aceptar = async () => {
    if (!obligatoriasOk) return;
    setGuardando(true);
    try {
      await api.consentimientoAPI.aceptar({
        version: VERSION_AVISO,
        acepta_tratamiento: Boolean(casillas.acepta_tratamiento),
        acepta_datos_salud: Boolean(casillas.acepta_datos_salud),
        autoriza_imagen: Boolean(casillas.autoriza_imagen),
        declara_lectura: Boolean(casillas.declara_lectura),
      });
      onConsentimientoAceptado?.({ version: VERSION_AVISO, autoriza_imagen: Boolean(casillas.autoriza_imagen) });
    } catch (error) {
      showToast({ message: error.message || 'No se pudo registrar tu aceptación.', type: 'error' });
    } finally {
      setGuardando(false);
    }
  };

  const enviarCodigoCorreo = async (event) => {
    event.preventDefault();
    setGuardando(true);
    try {
      const respuesta = await api.cuentasAPI.solicitarVerificacionCorreo(correo.trim());
      setDestino(respuesta?.destino || correo.trim());
      showToast({ message: `Te enviamos un código a ${respuesta?.destino || 'tu correo'}.`, type: 'success' });
    } catch (error) {
      showToast({ message: error.message || 'No se pudo enviar el código.', type: 'error' });
    } finally {
      setGuardando(false);
    }
  };

  const confirmarCorreo = async (event) => {
    event.preventDefault();
    setGuardando(true);
    try {
      const respuesta = await api.cuentasAPI.confirmarCorreo(codigo);
      showToast({ message: 'Correo confirmado. Si olvidas tu clave, podrás recuperarla con él.', type: 'success' });
      onCorreoConfirmado?.(respuesta?.correo || correo.trim());
    } catch (error) {
      showToast({ message: error.message || 'No se pudo confirmar el correo.', type: 'error' });
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="modal-overlay-alert modal-animado-fondo primer-ingreso-fondo" role="dialog" aria-modal="true" aria-labelledby="primer-ingreso-titulo">
      <div className="modal-alert-card modal-animado primer-ingreso-card">
        {paso === 'consentimiento' ? (
          <>
            <div className="primer-ingreso-encabezado">
              <ShieldCheck size={28} aria-hidden="true" />
              <h3 id="primer-ingreso-titulo">Protección de tus datos personales</h3>
            </div>
            <p className="primer-ingreso-intro">
              {tramo === 'nino' || tramo === 'adolescente14'
                ? 'Antes de continuar, lee cómo el Club usa tus datos. Tu madre, padre o apoderado también recibe este aviso.'
                : 'Antes de continuar, lee cómo el Club usa tus datos y los de los deportistas a tu cargo (Ley N° 19.628, modificada por la Ley N° 21.719).'}
            </p>
            <div className="primer-ingreso-texto" tabIndex={0} aria-label="Texto del aviso de privacidad">
              {SECCIONES_AVISO.map((seccion) => (
                <section key={seccion.titulo}>
                  <h4>{seccion.titulo}</h4>
                  <p>{seccion.texto}</p>
                </section>
              ))}
              <p className="primer-ingreso-version">Versión {VERSION_AVISO} · {FECHA_AVISO}</p>
            </div>
            <div className="primer-ingreso-casillas">
              {!tramo && <p className="primer-ingreso-intro">Cargando…</p>}
              {tramo && casillasVisibles.map((casilla) => (
                <label key={casilla.campo} className="primer-ingreso-casilla">
                  <input
                    type="checkbox"
                    checked={Boolean(casillas[casilla.campo])}
                    onChange={(e) => setCasillas((prev) => ({ ...prev, [casilla.campo]: e.target.checked }))}
                  />
                  <span>{casilla.texto}{casilla.obligatorio && <strong aria-label="obligatorio"> *</strong>}</span>
                </label>
              ))}
            </div>
            <div className="primer-ingreso-acciones">
              <button type="button" className="btn-electric" disabled={!obligatoriasOk || guardando} onClick={aceptar}>
                {guardando ? 'Guardando…' : 'Acepto y continúo'}
              </button>
              <button type="button" className="btn-volver-texto" onClick={onRechazar} disabled={guardando}>
                No acepto (cerrar sesión)
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="primer-ingreso-encabezado">
              <MailCheck size={28} aria-hidden="true" />
              <h3 id="primer-ingreso-titulo">Registra tu correo</h3>
            </div>
            <p className="primer-ingreso-intro">
              Así podrás recuperar tu contraseña sin depender del club. Te enviaremos un código para confirmar que el correo es tuyo.
            </p>
            {!destino ? (
              <form onSubmit={enviarCodigoCorreo} className="primer-ingreso-form">
                <input type="email" className="form-input" placeholder="tu@correo.cl" autoComplete="email" value={correo} onChange={(e) => setCorreo(e.target.value)} required />
                <button type="submit" className="btn-electric" disabled={guardando}>{guardando ? 'Enviando…' : 'Enviar código'}</button>
              </form>
            ) : (
              <form onSubmit={confirmarCorreo} className="primer-ingreso-form">
                <p className="primer-ingreso-intro">Ingresa el código que enviamos a <strong>{destino}</strong>.</p>
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  className="form-input"
                  placeholder="Código de 6 dígitos"
                  aria-label="Código de 6 dígitos"
                  value={codigo}
                  onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ''))}
                  required
                />
                <button type="submit" className="btn-electric" disabled={guardando}>{guardando ? 'Confirmando…' : 'Confirmar correo'}</button>
                <button type="button" className="btn-volver-texto" onClick={() => { setDestino(''); setCodigo(''); }}>Usar otro correo</button>
              </form>
            )}
            <button type="button" className="btn-volver-texto mt-10" onClick={onOmitirCorreo} disabled={guardando}>
              No tengo correo / Ahora no
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default PrimerIngresoModal;
