import { useEffect, useMemo, useState } from 'react';
import * as api from '../api/client';
import LogoAvatar from './LogoAvatar';
import { normalizarSlugLogo } from '../utils/logoResolver';

/**
 * LogoPicker — selects a logo URL by entity name, without manual URL input.
 *
 * Props:
 *   label       - field label
 *   nombre      - current entity name (controlled)
 *   onNombre    - callback when name changes (fn(nombre))
 *   logoUrl     - resolved logo URL (controlled, set externally)
 *   onLogoUrl   - callback when logo URL resolves or changes (fn(url))
 *   tipo        - logo type hint ('club' | 'torneo' | 'competencia')
 *   placeholder - input placeholder
 *   logoSize    - avatar preview size (default 40)
 *   extraOptions - optional static list of {nombre, logoUrl} to merge with dynamic list
 */
function LogoPicker({
  label = '',
  nombre = '',
  onNombre,
  logoUrl = '',
  onLogoUrl,
  tipo = 'club',
  placeholder = 'Escribe el nombre...',
  logoSize = 40,
  extraOptions = [],
}) {
  const [logosDisponibles, setLogosDisponibles] = useState([]);
  const [clubes, setClubes] = useState([]);
  const [mostrarSugerencias, setMostrarSugerencias] = useState(false);
  const [cargando, setCargando] = useState(false);

  useEffect(() => {
    let activo = true;
    const cargar = async () => {
      setCargando(true);
      try {
        const [logosRes, clubesRes] = await Promise.allSettled([
          api.assetsAPI.listLogos(),
          api.clubesAPI.getAll(),
        ]);
        if (!activo) return;
        if (logosRes.status === 'fulfilled') setLogosDisponibles(logosRes.value?.logos || []);
        if (clubesRes.status === 'fulfilled' && Array.isArray(clubesRes.value)) setClubes(clubesRes.value);
      } finally {
        if (activo) setCargando(false);
      }
    };
    cargar();
    return () => { activo = false; };
  }, []);

  const opciones = useMemo(() => {
    const byNombre = new Map();

    // Static extras (highest priority)
    for (const item of extraOptions) {
      const key = normalizarSlugLogo(item.nombre);
      if (key) byNombre.set(key, { nombre: item.nombre, logoUrl: item.logoUrl || '' });
    }

    // Clubs from DB
    for (const c of clubes) {
      const key = normalizarSlugLogo(c.nombre_club);
      if (key && !byNombre.has(key)) {
        byNombre.set(key, { nombre: c.nombre_club, logoUrl: c.logo_url || c.club_logo_url || '' });
      }
    }

    // Files from /public/logos mapped to names
    for (const logo of logosDisponibles) {
      const limpio = logo.nombre
        .replace(/^(club|torneo|campeonato|competencia)-/i, '')
        .replace(/-/g, ' ')
        .trim();
      const key = normalizarSlugLogo(limpio);
      if (key && !byNombre.has(key)) {
        byNombre.set(key, { nombre: limpio, logoUrl: logo.url });
      }
    }

    return [...byNombre.values()].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  }, [logosDisponibles, clubes, extraOptions]);

  const sugerencias = useMemo(() => {
    const q = normalizarSlugLogo(nombre);
    if (!q || q.length < 2) return opciones.slice(0, 8);
    return opciones.filter((o) => normalizarSlugLogo(o.nombre).includes(q)).slice(0, 10);
  }, [nombre, opciones]);

  const handleChange = (e) => {
    const val = e.target.value;
    onNombre(val);
    // Auto-resolve logo if exact match found
    const exacta = opciones.find((o) => normalizarSlugLogo(o.nombre) === normalizarSlugLogo(val));
    if (exacta && exacta.logoUrl) {
      onLogoUrl(exacta.logoUrl);
    } else if (!val) {
      onLogoUrl('');
    }
    setMostrarSugerencias(true);
  };

  const seleccionar = (opcion) => {
    onNombre(opcion.nombre);
    onLogoUrl(opcion.logoUrl || '');
    setMostrarSugerencias(false);
  };

  return (
    <div className="form-group" style={{ position: 'relative' }}>
      {label && <label>{label}</label>}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <LogoAvatar
          nombre={nombre}
          logoUrl={logoUrl}
          tipo={tipo}
          size={logoSize}
          borderRadius="10px"
        />
        <input
          className="form-input"
          style={{ flex: 1 }}
          value={nombre}
          placeholder={cargando ? 'Cargando...' : placeholder}
          onChange={handleChange}
          onFocus={() => setMostrarSugerencias(true)}
          onBlur={() => setTimeout(() => setMostrarSugerencias(false), 180)}
          autoComplete="off"
        />
      </div>

      {mostrarSugerencias && sugerencias.length > 0 && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          right: 0,
          zIndex: 999,
          background: 'rgba(255,255,255,0.98)',
          border: '1px solid rgba(0,122,255,0.18)',
          borderRadius: '14px',
          boxShadow: '0 8px 24px rgba(15,23,42,0.14)',
          maxHeight: '230px',
          overflowY: 'auto',
          marginTop: '4px',
        }}>
          {sugerencias.map((op) => (
            <div
              key={`${op.nombre}-${op.logoUrl}`}
              onMouseDown={() => seleccionar(op)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '10px 12px',
                cursor: 'pointer',
                borderBottom: '1px solid rgba(0,0,0,0.06)',
                transition: 'background 0.15s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(0,122,255,0.07)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = ''; }}
            >
              <LogoAvatar nombre={op.nombre} logoUrl={op.logoUrl} tipo={tipo} size={28} borderRadius="8px" />
              <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--texto-principal)' }}>{op.nombre}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default LogoPicker;
