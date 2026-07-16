import { useRef, useState } from 'react';
import html2canvas from 'html2canvas';
import { Eraser, Pencil, Move, Trash2, UserPlus, Circle } from 'lucide-react';

const CANCHAS = {
  media: { url: '/canchas/media-cancha.svg', alto: 560, ancho: 600, etiqueta: 'Media cancha' },
  completa: { url: '/canchas/cancha-completa.svg', alto: 1120, ancho: 600, etiqueta: 'Cancha completa' },
};

const TIPOS_FICHA = {
  atacante: { color: '#007AFF', letra: 'A', etiqueta: 'Atacante' },
  defensor: { color: '#FF3B30', letra: 'X', etiqueta: 'Defensor' },
  balon: { color: '#FF9500', letra: '', etiqueta: 'Balón' },
};

let contadorFicha = 0;

function PizarraTacticaCanvas({ onCapturar }) {
  const [cancha, setCancha] = useState('media');
  const [fichas, setFichas] = useState([]);
  const [modoDibujo, setModoDibujo] = useState(false);
  const [trazos, setTrazos] = useState([]);
  const [trazoActual, setTrazoActual] = useState(null);
  const boardRef = useRef(null);
  const dragRef = useRef(null);

  const config = CANCHAS[cancha];

  const agregarFicha = (tipo) => {
    contadorFicha += 1;
    setFichas((prev) => [...prev, { id: contadorFicha, tipo, x: 50, y: 50 }]);
  };

  const quitarFicha = (id) => {
    setFichas((prev) => prev.filter((f) => f.id !== id));
  };

  const limpiarTodo = () => {
    setFichas([]);
    setTrazos([]);
  };

  const obtenerPosicionRelativa = (clientX, clientY) => {
    const rect = boardRef.current.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100)),
      y: Math.max(0, Math.min(100, ((clientY - rect.top) / rect.height) * 100)),
    };
  };

  const iniciarArrastreFicha = (id) => (e) => {
    if (modoDibujo) return;
    e.preventDefault();
    dragRef.current = id;
  };

  const manejarMovimientoTablero = (e) => {
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const pos = obtenerPosicionRelativa(clientX, clientY);

    if (dragRef.current != null) {
      setFichas((prev) => prev.map((f) => (f.id === dragRef.current ? { ...f, x: pos.x, y: pos.y } : f)));
      return;
    }

    if (modoDibujo) {
      setTrazoActual((prev) => (prev ? [...prev, pos] : prev));
    }
  };

  const iniciarDibujo = (e) => {
    if (!modoDibujo) return;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    setTrazoActual([obtenerPosicionRelativa(clientX, clientY)]);
  };

  const finalizarInteraccion = () => {
    setTrazoActual((actual) => {
      if (actual && actual.length > 1) {
        setTrazos((prev) => [...prev, actual]);
      }
      return null;
    });
    dragRef.current = null;
  };

  const deshacerTrazo = () => {
    setTrazos((prev) => prev.slice(0, -1));
  };

  const capturarPizarra = async () => {
    if (!boardRef.current) return;
    const canvas = await html2canvas(boardRef.current, { backgroundColor: '#F4EFE4', scale: 2 });
    canvas.toBlob((blob) => {
      if (blob && typeof onCapturar === 'function') onCapturar(blob);
    }, 'image/png');
  };

  const puntosATexto = (puntos) => puntos.map((p) => `${p.x},${p.y}`).join(' ');

  return (
    <div>
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '10px' }}>
        {Object.entries(CANCHAS).map(([key, c]) => (
          <button
            key={key}
            type="button"
            className="filter-chip"
            style={{
              border: '1px solid rgba(0,122,255,0.24)',
              background: cancha === key ? 'var(--azul-electrico)' : 'rgba(0,122,255,0.08)',
              color: cancha === key ? 'white' : 'var(--azul-electrico)',
              fontWeight: '800',
            }}
            onClick={() => setCancha(key)}
          >
            {c.etiqueta}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '10px' }}>
        <button type="button" className="btn-secondary" style={{ width: 'auto', padding: '8px 12px', fontSize: '11px' }} onClick={() => agregarFicha('atacante')}>
          <UserPlus size={13} /> Atacante
        </button>
        <button type="button" className="btn-secondary" style={{ width: 'auto', padding: '8px 12px', fontSize: '11px' }} onClick={() => agregarFicha('defensor')}>
          <UserPlus size={13} /> Defensor
        </button>
        <button type="button" className="btn-secondary" style={{ width: 'auto', padding: '8px 12px', fontSize: '11px' }} onClick={() => agregarFicha('balon')}>
          <Circle size={13} /> Balón
        </button>
        <button
          type="button"
          className="btn-secondary"
          style={{ width: 'auto', padding: '8px 12px', fontSize: '11px', background: modoDibujo ? 'var(--azul-electrico)' : undefined, color: modoDibujo ? 'white' : undefined }}
          onClick={() => setModoDibujo((v) => !v)}
        >
          {modoDibujo ? <Move size={13} /> : <Pencil size={13} />} {modoDibujo ? 'Mover fichas' : 'Dibujar jugada'}
        </button>
        <button type="button" className="btn-secondary" style={{ width: 'auto', padding: '8px 12px', fontSize: '11px' }} onClick={deshacerTrazo} disabled={trazos.length === 0}>
          <Eraser size={13} /> Deshacer trazo
        </button>
        <button type="button" className="btn-secondary" style={{ width: 'auto', padding: '8px 12px', fontSize: '11px', borderColor: 'rgba(255,59,48,0.35)', color: '#b91c1c' }} onClick={limpiarTodo}>
          <Trash2 size={13} /> Limpiar todo
        </button>
      </div>

      <div
        ref={boardRef}
        onMouseDown={iniciarDibujo}
        onMouseMove={manejarMovimientoTablero}
        onMouseUp={finalizarInteraccion}
        onMouseLeave={finalizarInteraccion}
        onTouchStart={iniciarDibujo}
        onTouchMove={manejarMovimientoTablero}
        onTouchEnd={finalizarInteraccion}
        style={{
          position: 'relative', width: '100%', maxWidth: '420px', margin: '0 auto',
          aspectRatio: `${config.ancho} / ${config.alto}`, borderRadius: '16px', overflow: 'hidden',
          border: '1px solid rgba(0,0,0,0.08)', touchAction: 'none', cursor: modoDibujo ? 'crosshair' : 'default',
          userSelect: 'none',
        }}
      >
        <img src={config.url} alt="Cancha de básquetbol" draggable={false} style={{ width: '100%', height: '100%', display: 'block', pointerEvents: 'none' }} />

        <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
          {trazos.map((trazo, idx) => (
            <polyline key={`trazo-${idx}`} points={puntosATexto(trazo)} fill="none" stroke="#C1272D" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
          ))}
          {trazoActual && (
            <polyline points={puntosATexto(trazoActual)} fill="none" stroke="#C1272D" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
          )}
        </svg>

        {fichas.map((ficha) => {
          const tipo = TIPOS_FICHA[ficha.tipo];
          const esBalon = ficha.tipo === 'balon';
          return (
            <div
              key={ficha.id}
              onMouseDown={iniciarArrastreFicha(ficha.id)}
              onTouchStart={iniciarArrastreFicha(ficha.id)}
              onDoubleClick={() => quitarFicha(ficha.id)}
              title="Doble clic para quitar"
              style={{
                position: 'absolute', left: `${ficha.x}%`, top: `${ficha.y}%`, transform: 'translate(-50%, -50%)',
                width: esBalon ? '20px' : '28px', height: esBalon ? '20px' : '28px', borderRadius: '999px',
                background: tipo.color, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '12px', fontWeight: '900', cursor: modoDibujo ? 'crosshair' : 'grab',
                boxShadow: '0 2px 6px rgba(0,0,0,0.3)', border: '2px solid white',
              }}
            >
              {tipo.letra}
            </div>
          );
        })}
      </div>

      <p style={{ textAlign: 'center', fontSize: '11px', color: 'var(--texto-secundario)', fontWeight: '700', marginTop: '8px' }}>
        Arrastra las fichas para ubicarlas · doble clic para quitar una · "Dibujar jugada" para trazar líneas de movimiento
      </p>

      <button className="btn-electric mt-10" onClick={capturarPizarra} type="button">
        Capturar pizarra
      </button>
    </div>
  );
}

export default PizarraTacticaCanvas;
