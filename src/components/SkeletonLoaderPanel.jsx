// Esqueleto de carga (bloques grises con brillo, ver .skeleton-* en App.css).
// variante 'pantalla' (default): encabezado + 3 tarjetas, para pantallas
// completas. 'lista': 3 filas cortas, para una sección dentro de una pantalla.
// Reemplaza los textos planos "Cargando…" que se veían como pantalla rota.
const BLOQUE = { background: 'rgba(0,0,0,0.05)' };

function SkeletonLoaderPanel({ variante = 'pantalla', etiqueta = 'Cargando' }) {
  if (variante === 'lista') {
    return (
      <div className="skeleton-container fade-in" role="status" aria-label={etiqueta} style={{ gap: '10px', padding: '6px 0' }}>
        {[100, 85, 92].map((ancho) => (
          <div key={ancho} className="skeleton-card" style={{ ...BLOQUE, height: '44px', width: `${ancho}%`, borderRadius: 'var(--radius-md)' }} />
        ))}
      </div>
    );
  }
  return (
    <div className="skeleton-container fade-in" role="status" aria-label={etiqueta} style={{ padding: '15px' }}>
      <div className="skeleton-header" style={{ ...BLOQUE, height: '30px', width: '50%', borderRadius: 'var(--radius-pill)', marginBottom: '20px' }}></div>
      <div className="skeleton-card" style={{ ...BLOQUE, height: '150px', borderRadius: 'var(--radius-lg)', marginBottom: '15px' }}></div>
      <div className="skeleton-card" style={{ ...BLOQUE, height: '100px', borderRadius: 'var(--radius-lg)', marginBottom: '15px' }}></div>
      <div className="skeleton-card" style={{ ...BLOQUE, height: '200px', borderRadius: 'var(--radius-lg)' }}></div>
    </div>
  );
}

export default SkeletonLoaderPanel;
