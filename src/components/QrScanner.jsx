import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import jsQR from 'jsqr';
import { AlertTriangle, Camera, Check, X } from 'lucide-react';

// Lee el QR de asistencia que ya genera TarjetaJugadorPanel.jsx
// ({ tipo: 'asistencia_ccf', rut, nombre, categoria }) usando la cámara
// trasera del dispositivo. Se usa jsqr (decodificador QR puro en JS) en vez
// de la API nativa BarcodeDetector porque esta última no existe en Safari/iOS
// — el staff del club usa celulares variados, no se puede asumir Chrome/Android.
//
// Portal a document.body: mismo motivo que PagoForm.jsx — .ios-main tiene un
// transform permanente que atraparía un overlay position:fixed dentro de su
// propio alto scrolleable en vez del viewport real.
function QrScanner({ titulo = 'Escanear QR', tipoEsperado = 'asistencia_ccf', onScan, onClose }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const rafRef = useRef(null);
  const pausadoRef = useRef(false);

  const [error, setError] = useState('');
  const [ultimoOk, setUltimoOk] = useState(null); // { nombre } — flash verde momentáneo
  const [ultimoInvalido, setUltimoInvalido] = useState(false); // flash rojo momentáneo

  useEffect(() => {
    let cancelado = false;

    const iniciar = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError('Este dispositivo o navegador no permite acceder a la cámara.');
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false,
        });
        if (cancelado) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        rafRef.current = requestAnimationFrame(tick);
      } catch {
        setError('No se pudo acceder a la cámara. Revisa los permisos del navegador.');
      }
    };

    const tick = () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (video && canvas && video.readyState === video.HAVE_ENOUGH_DATA && !pausadoRef.current) {
        const escala = Math.min(1, 480 / video.videoWidth);
        canvas.width = Math.round(video.videoWidth * escala);
        canvas.height = Math.round(video.videoHeight * escala);
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const codigo = jsQR(imageData.data, imageData.width, imageData.height);
        if (codigo?.data) {
          procesarCodigo(codigo.data);
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    };

    const procesarCodigo = (texto) => {
      let payload = null;
      try {
        payload = JSON.parse(texto);
      } catch {
        // no es un QR con JSON — se trata igual que "no reconocido" abajo
      }

      if (payload?.tipo !== tipoEsperado || !payload?.rut) {
        // Sin esta pausa, un QR ajeno frente a la cámara dispararía este
        // mismo chequeo en cada frame (30-60/seg) sin que el staff sepa por
        // qué "no pasa nada" — antes simplemente no daba ningún aviso.
        pausadoRef.current = true;
        setUltimoInvalido(true);
        setTimeout(() => {
          pausadoRef.current = false;
          setUltimoInvalido(false);
        }, 1200);
        return;
      }

      pausadoRef.current = true;
      setUltimoOk({ nombre: payload.nombre || payload.rut });
      onScan(payload);
      setTimeout(() => {
        pausadoRef.current = false;
        setUltimoOk(null);
      }, 1500);
    };

    iniciar();

    return () => {
      cancelado = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, [onScan, tipoEsperado]);

  return createPortal(
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.85)', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px',
    }}>
      <div style={{ width: '100%', maxWidth: '420px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
        <h3 style={{ margin: 0, color: 'white', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '16px' }}>
          <Camera size={20} /> {titulo}
        </h3>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}>
          <X size={26} color="white" strokeWidth={1.5} />
        </button>
      </div>

      <div style={{ position: 'relative', width: '100%', maxWidth: '420px', aspectRatio: '3 / 4', borderRadius: '16px', overflow: 'hidden', background: '#000' }}>
        {error ? (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', textAlign: 'center', color: 'white', fontSize: '13px', fontWeight: '600' }}>
            {error}
          </div>
        ) : (
          <>
            <video ref={videoRef} muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            <div style={{ position: 'absolute', inset: '12%', border: '3px solid rgba(255,255,255,0.7)', borderRadius: '18px', pointerEvents: 'none' }} />
            {ultimoOk && (
              <div style={{ position: 'absolute', inset: 0, background: 'rgba(52,199,89,0.35)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                <Check size={48} color="white" strokeWidth={3} />
                <strong style={{ color: 'white', fontSize: '14px' }}>{ultimoOk.nombre}</strong>
              </div>
            )}
            {ultimoInvalido && (
              <div style={{ position: 'absolute', inset: 0, background: 'rgba(255,59,48,0.35)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                <AlertTriangle size={40} color="white" strokeWidth={3} />
                <strong style={{ color: 'white', fontSize: '13px', textAlign: 'center', padding: '0 20px' }}>QR no reconocido — intenta de nuevo</strong>
              </div>
            )}
          </>
        )}
      </div>
      <canvas ref={canvasRef} style={{ display: 'none' }} />
      <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: '12px', marginTop: '14px', textAlign: 'center' }}>
        Apunta la cámara al QR de la Tarjeta del jugador.
      </p>
    </div>,
    document.body
  );
}

export default QrScanner;
