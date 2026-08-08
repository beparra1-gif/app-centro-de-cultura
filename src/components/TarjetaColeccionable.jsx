import { useRef, useState } from 'react';
import { Download, Loader2, Mars, Venus } from 'lucide-react';
import {
  EXPORT_WIDTH,
  EXPORT_HEIGHT,
  MARCO_POR_RAREZA,
  DISENOS_MARCO,
  obtenerEstiloRarezaPorNivel,
  resolverUrlFoto,
  canvasABlob,
  descargarBlob,
  capturarRefExport,
} from '../utils/tarjetaColeccionable';
import { showToast } from '../utils/toast';

// Tarjeta coleccionable de OTRO jugador (álbum de figuritas): mismo diseño
// exacto que la tarjeta propia de TarjetaJugadorPanel (marco real por
// rareza, foto, nivel/XP, serie), pero de solo lectura — sin editor de
// encuadre ni subida de foto, porque quien la ve no es dueño de esos datos.
// Recibe un objeto plano (la forma que devuelve GET /jugadores/:rut/coleccion)
// en vez de leer de pupiloActivo/detalleJugador como hace el panel propio.
function TarjetaColeccionable({ jugador, ancho = 220, sombra = true, mostrarDescarga = false }) {
  const cardRef = useRef(null);
  const [descargando, setDescargando] = useState(false);

  if (!jugador) return null;

  const nombreCompleto = [jugador.nombres, jugador.apellido_paterno, jugador.apellido_materno]
    .map((parte) => String(parte || '').trim())
    .filter(Boolean)
    .join(' ') || 'Jugador';
  const nombreDisplay = nombreCompleto.split(/\s+/)[0] || 'Jugador';
  const nivelBase = Number(jugador.nivel || 1) || 1;
  const xpActual = Number(jugador.xp_total || 0);
  const { texto: textoRareza } = obtenerEstiloRarezaPorNivel(nivelBase);
  const marcoActivo = MARCO_POR_RAREZA[textoRareza] || MARCO_POR_RAREZA.BRONCE;
  const disenoActivo = DISENOS_MARCO[jugador.diseno_marco || 'clasico'] || DISENOS_MARCO.clasico;
  const fotoColeccion = resolverUrlFoto(jugador.foto_tarjeta_coleccion || jugador.foto_jugador || '');
  const descriptorGenero = `${jugador.genero || ''} ${jugador.sexo || ''} ${jugador.rama || ''}`.toLowerCase();
  const esFemenino = descriptorGenero.includes('femen') || descriptorGenero.includes('mujer');
  const anioNacimiento = jugador.año_nacimiento || jugador.anio_nacimiento || '';
  const hashSerial = (String(jugador.rut_jugador || nombreCompleto || 'ccf')
    .split('')
    .reduce((acc, char) => ((acc * 31) + char.charCodeAt(0)) % 9973, 0) % 500) + 1;
  const serialTexto = `${String(hashSerial).padStart(3, '0')}/500`;
  const clubLogoUrl = '/logos/club-logo.png';

  const escala = ancho / EXPORT_WIDTH;
  const alto = EXPORT_HEIGHT * escala;
  const s = (v) => `${Math.max(1, v * escala)}px`;

  const descargar = async () => {
    setDescargando(true);
    try {
      const canvas = await capturarRefExport(cardRef);
      const blob = await canvasABlob(canvas);
      const nombreArchivo = `tarjeta-${nombreDisplay.toLowerCase()}.png`;
      const archivo = new File([blob], nombreArchivo, { type: 'image/png' });
      if (navigator.canShare && navigator.canShare({ files: [archivo] })) {
        try {
          await navigator.share({ files: [archivo], title: `Tarjeta de ${nombreDisplay}`, text: '¡Mira esta tarjeta de mi álbum!' });
          return;
        } catch (shareError) {
          if (shareError?.name === 'AbortError') return;
        }
      }
      descargarBlob(blob, nombreArchivo);
    } catch {
      showToast({ message: 'No se pudo descargar esta tarjeta.', type: 'error' });
    } finally {
      setDescargando(false);
    }
  };

  return (
    <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
      <div
        ref={cardRef}
        style={{
          boxSizing: 'border-box',
          width: `${ancho}px`,
          height: `${alto}px`,
          position: 'relative',
          overflow: 'hidden',
          borderRadius: s(24),
          background: 'none',
          boxShadow: sombra ? '0 12px 24px rgba(15,23,42,0.3)' : undefined,
          filter: disenoActivo.extraFilter || undefined,
        }}
      >
        <div style={{
          position: 'absolute',
          left: `${marcoActivo.foto.left}%`, right: `${marcoActivo.foto.right}%`,
          top: `${marcoActivo.foto.top}%`, bottom: `${marcoActivo.foto.bottom}%`,
          overflow: 'hidden', background: '#F4F1EC', zIndex: 0,
        }}>
          {fotoColeccion ? (
            <img src={fotoColeccion} alt={`Foto de ${nombreDisplay}`} style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'contrast(1.08) saturate(1.15)' }} />
          ) : (
            <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: s(8), color: '#9A9186' }}>
              {esFemenino ? <Venus size={Math.max(14, 48 * escala)} /> : <Mars size={Math.max(14, 48 * escala)} />}
              <span style={{ fontSize: s(11), fontWeight: '800' }}>SIN FOTO</span>
            </div>
          )}

          <div style={{
            position: 'absolute', left: 0, right: 0, bottom: 0, height: '52%',
            padding: `${s(10)} ${s(14)} ${s(52)}`, color: 'white', textAlign: 'center',
            display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
            textShadow: '0 2px 8px rgba(0,0,0,0.95), 0 0 18px rgba(0,0,0,0.8)',
            background: 'linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.12) 20%, rgba(0,0,0,0.32) 45%, rgba(0,0,0,0.55) 70%, rgba(0,0,0,0.72) 100%)',
          }}>
            <h1 style={{ margin: 0, fontFamily: 'Orbitron, Segoe UI, sans-serif', fontSize: nombreCompleto.length > 20 ? s(40) : s(52), lineHeight: 1.15, letterSpacing: '0.4px', textTransform: 'uppercase' }}>{nombreCompleto}</h1>
            <div style={{ marginTop: s(22), display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: s(4), fontSize: s(15), fontWeight: '800', textTransform: 'uppercase', opacity: 0.95 }}>
              <div>Nivel<strong style={{ display: 'block', fontSize: s(36), fontWeight: '900' }}>{nivelBase}</strong></div>
              <div>Posición<strong style={{ display: 'block', fontSize: s(36), fontWeight: '900' }}>{jugador.posicion_de_juego || 'N/A'}</strong></div>
              <div>Estatura<strong style={{ display: 'block', fontSize: s(36), fontWeight: '900' }}>{jugador.estatura || 'N/A'}</strong></div>
              <div>Año<strong style={{ display: 'block', fontSize: s(36), fontWeight: '900' }}>{anioNacimiento || 'N/A'}</strong></div>
            </div>
          </div>
        </div>

        <img
          src={marcoActivo.src}
          alt=""
          style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'fill', zIndex: 1, pointerEvents: 'none' }}
        />

        <div style={{
          position: 'absolute', left: `${marcoActivo.escudo.left}%`, top: `${marcoActivo.escudo.top}%`,
          width: `${ancho * (marcoActivo.escudo.diametro / 100)}px`, height: `${ancho * (marcoActivo.escudo.diametro / 100)}px`,
          borderRadius: '50%', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: `${ancho * (marcoActivo.escudo.diametro / 100) * 0.09}px`, boxSizing: 'border-box',
          zIndex: 2,
        }}>
          <img src={clubLogoUrl} alt="Escudo del club" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
        </div>

        <div style={{
          position: 'absolute', top: `${marcoActivo.foto.top + 3}%`, right: `${marcoActivo.foto.right + 6}%`,
          display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: s(5),
          color: 'white', textShadow: '0 2px 6px rgba(0,0,0,0.9), 0 0 10px rgba(0,0,0,0.75)',
          zIndex: 2,
        }}>
          <div style={{ display: 'flex', gap: s(28) }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: s(19), fontWeight: '800', opacity: 0.9, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Nivel</div>
              <div style={{ fontSize: s(50), fontWeight: '900', lineHeight: 1.1 }}>{nivelBase}</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: s(19), fontWeight: '800', opacity: 0.9, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Exp</div>
              <div style={{ fontSize: s(50), fontWeight: '900', lineHeight: 1.1 }}>{xpActual}</div>
            </div>
          </div>
          <div style={{ fontSize: s(26), fontWeight: '900', marginTop: s(2) }}>#{serialTexto}</div>
        </div>
      </div>

      {mostrarDescarga && (
        <button
          type="button"
          onClick={descargar}
          disabled={descargando}
          className="btn-electric"
          style={{ width: 'auto', padding: '8px 16px', fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
        >
          {descargando ? <Loader2 size={14} className="spin" /> : <Download size={14} />}
          {descargando ? 'Generando...' : 'Descargar tarjeta'}
        </button>
      )}
    </div>
  );
}

export default TarjetaColeccionable;
