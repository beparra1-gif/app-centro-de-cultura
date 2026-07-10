import { useMemo, useState } from 'react';
import { construirLogoCandidates, obtenerInicialesLogo, normalizarNombreLogo } from '../utils/logoResolver';

function LogoAvatar({
  nombre = '',
  logoUrl = '',
  slug = '',
  tipo = '',
  size = 40,
  className = '',
  borderRadius = '14px',
  fallbackText = '',
  title = '',
  style = {},
}) {
  const candidatos = useMemo(
    () => construirLogoCandidates({ nombre, logoUrl, slug, tipo }),
    [nombre, logoUrl, slug, tipo]
  );
  const [indice, setIndice] = useState(0);
  const [usarFallback, setUsarFallback] = useState(false);

  const logoActual = candidatos[indice] || '';
  const etiqueta = fallbackText || obtenerInicialesLogo(nombre);

  if (!logoActual || usarFallback) {
    return (
      <div
        className={className}
        title={title || normalizarNombreLogo(nombre)}
        style={{
          width: size,
          height: size,
          borderRadius,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          background: 'linear-gradient(135deg, rgba(0,122,255,0.12), rgba(52,199,89,0.12))',
          border: '1px solid rgba(0,0,0,0.08)',
          color: 'var(--azul-electrico)',
          fontWeight: '900',
          fontSize: Math.max(10, Math.round(size * 0.32)),
          flexShrink: 0,
          ...style,
        }}
      >
        {etiqueta}
      </div>
    );
  }

  return (
    <div
      className={className}
      title={title || normalizarNombreLogo(nombre)}
      style={{
        width: size,
        height: size,
        borderRadius,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        background: 'rgba(255,255,255,0.9)',
        border: '1px solid rgba(0,0,0,0.08)',
        flexShrink: 0,
        ...style,
      }}
    >
      <img
        src={logoActual}
        alt={title || normalizarNombreLogo(nombre)}
        onError={() => {
          if (indice < candidatos.length - 1) {
            setIndice((actual) => Math.min(actual + 1, candidatos.length - 1));
          } else {
            setUsarFallback(true);
          }
        }}
        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
      />
    </div>
  );
}

export default LogoAvatar;