import html2canvas from 'html2canvas';
import * as api from '../api/client';

// Compartido entre TarjetaJugadorPanel (la tarjeta propia, editable) y
// TarjetaColeccionable (tarjetas ajenas del álbum, solo lectura) — antes
// vivían duplicadas dentro de TarjetaJugadorPanel.jsx; se movieron aquí para
// que el álbum pueda dibujar el mismo diseño exacto (marco, rareza, recorte
// de foto) sin repetir las coordenadas medidas a pixel por tier.

// Los 5 marcos (public/tarjetas-marcos/) son PNG sin fondo (transparente
// fuera y dentro del marco, 2800x4968 los 5 por igual).
export const EXPORT_WIDTH = 750;
export const EXPORT_HEIGHT = Math.round(EXPORT_WIDTH * (4968 / 2800)); // 1330

// foto: bordes del hueco transparente real DENTRO de cada PNG. escudo: el
// círculo metálico ya dibujado en el marco (arriba a la izquierda), donde va
// el logo del club. Medidos por pixel-scan automático (canal alfa) por tier.
export const MARCO_POR_RAREZA = {
  BRONCE: { src: '/tarjetas-marcos/bronce.png', foto: { left: 8.29, right: 7.68, top: 4.01, bottom: 3.53 }, escudo: { left: 10.04, top: 5.97, diametro: 27.45 } },
  PLATA: { src: '/tarjetas-marcos/plata.png', foto: { left: 8.32, right: 7.93, top: 3.87, bottom: 3.71 }, escudo: { left: 9.73, top: 5.91, diametro: 27.92 } },
  ORO: { src: '/tarjetas-marcos/oro.png', foto: { left: 7.82, right: 8.25, top: 4.03, bottom: 3.55 }, escudo: { left: 9.44, top: 6.02, diametro: 28.03 } },
  PLATINO: { src: '/tarjetas-marcos/platino.png', foto: { left: 8.89, right: 8.61, top: 4.64, bottom: 4.05 }, escudo: { left: 8.93, top: 5.31, diametro: 29.36 } },
  DIAMANTE: { src: '/tarjetas-marcos/diamante.png', foto: { left: 8.86, right: 8.61, top: 4.54, bottom: 4.03 }, escudo: { left: 9.20, top: 5.34, diametro: 29.06 } },
  VISITA: { src: '/tarjetas-marcos/plata.png', foto: { left: 8.32, right: 7.93, top: 3.87, bottom: 3.71 }, escudo: { left: 9.73, top: 5.91, diametro: 27.92 } },
};

export const DISENOS_MARCO = {
  clasico: { etiqueta: 'Clásico', extraBorder: null, extraShadow: null, extraFilter: null },
  neon: { etiqueta: 'Neón', extraBorder: '2px solid #39FF88', extraShadow: '0 0 4px 1px rgba(57,255,136,0.55), 0 0 26px 6px rgba(57,255,136,0.35)', extraFilter: null },
  vintage: { etiqueta: 'Vintage', extraBorder: '2px solid #C9A66B', extraShadow: '0 0 0 4px rgba(201,166,107,0.2)', extraFilter: 'sepia(0.3) saturate(1.1)' },
  holografico: { etiqueta: 'Holográfico', extraBorder: '2px solid rgba(255,255,255,0.65)', extraShadow: '0 0 6px 2px rgba(255,105,180,0.45), 0 0 18px 6px rgba(120,190,255,0.4), 0 0 30px 10px rgba(255,230,120,0.3)', extraFilter: null },
};

// 5 niveles de rareza (Bronce/Plata/Oro/Platino/Diamante). Función pura: no
// depende de props/estado de ningún componente.
export const obtenerEstiloRarezaPorNivel = (nivel) => {
  const nivelNumero = Number(nivel) || 0;

  if (nivelNumero > 40) {
    return {
      texto: 'DIAMANTE',
      estilo: {
        background: 'linear-gradient(145deg, #0C4A6E 0%, #66D9FF 45%, #F2FDFF 100%)',
        accent: '#F2FDFF',
        border: 'rgba(255,255,255,0.55)',
        glow: '0 0 0 2px rgba(255,255,255,0.55), 0 0 22px 4px rgba(150,220,255,0.4), 0 0 34px 10px rgba(255,190,250,0.22)',
        pattern: 'repeating-linear-gradient(115deg, rgba(255,255,255,0.18) 0px, rgba(255,255,255,0.18) 2px, transparent 2px, transparent 10px), repeating-linear-gradient(25deg, rgba(180,240,255,0.16) 0px, rgba(180,240,255,0.16) 1px, transparent 1px, transparent 16px)',
        sparkle: true,
      },
    };
  }
  if (nivelNumero > 30) {
    return {
      texto: 'PLATINO',
      estilo: {
        background: 'linear-gradient(145deg, #4A5560 0%, #B9C6D1 45%, #F4F9FC 100%)',
        accent: '#EAF6FF',
        border: 'rgba(230,245,255,0.5)',
        glow: '0 0 0 1px rgba(230,245,255,0.4), 0 0 14px 2px rgba(210,235,255,0.3)',
        pattern: 'repeating-linear-gradient(115deg, rgba(255,255,255,0.12) 0px, rgba(255,255,255,0.12) 2px, transparent 2px, transparent 13px)',
      },
    };
  }
  if (nivelNumero > 20) {
    return {
      texto: 'ORO',
      estilo: {
        background: 'linear-gradient(145deg, #5C3D00 0%, #C9910B 45%, #FFD873 100%)',
        accent: '#FFEFC2',
        border: 'rgba(255,241,199,0.45)',
        glow: '0 0 0 1px rgba(255,241,199,0.3), 0 0 12px 2px rgba(255,201,77,0.25)',
        pattern: 'repeating-linear-gradient(115deg, rgba(255,255,255,0.12) 0px, rgba(255,255,255,0.12) 2px, transparent 2px, transparent 12px), repeating-linear-gradient(25deg, rgba(255,241,199,0.10) 0px, rgba(255,241,199,0.10) 1px, transparent 1px, transparent 18px)',
      },
    };
  }
  if (nivelNumero > 10) {
    return {
      texto: 'PLATA',
      estilo: {
        background: 'linear-gradient(145deg, #3E4750 0%, #8E97A0 45%, #E7ECEF 100%)',
        accent: '#F5F8FA',
        border: 'rgba(255,255,255,0.35)',
        glow: '0 0 0 1px rgba(255,255,255,0.25)',
        pattern: 'repeating-linear-gradient(115deg, rgba(255,255,255,0.09) 0px, rgba(255,255,255,0.09) 2px, transparent 2px, transparent 14px)',
      },
    };
  }
  return {
    texto: 'BRONCE',
    estilo: {
      background: 'linear-gradient(145deg, #3D2413 0%, #8B5A2B 45%, #C9793F 100%)',
      accent: '#F0C199',
      border: 'rgba(255,214,170,0.4)',
      glow: '0 0 0 1px rgba(255,214,170,0.25)',
      pattern: 'repeating-linear-gradient(115deg, rgba(255,255,255,0.06) 0px, rgba(255,255,255,0.06) 2px, transparent 2px, transparent 14px)',
    },
  };
};

// Rutas que el backend devuelve como /api/logo-assets/file/... (guardado
// BYTEA en DB) necesitan resolverse contra el origen del backend, no del
// frontend: en dev corren en puertos distintos (Vite no proxya /api).
export const resolverUrlFoto = (foto = '') => {
  if (!foto || !foto.startsWith('/api/')) return foto;
  const origen = String(api.API_BASE_URL_CONFIG || '').replace(/\/api\/?$/, '');
  return `${origen}${foto}`;
};

export const canvasABlob = (canvas) => new Promise((resolve, reject) => {
  canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('No se pudo generar la imagen.'))), 'image/png');
});

export const descargarBlob = (blob, nombreArchivo) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = nombreArchivo;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Revocar después de un tick: algunos navegadores inician la descarga de
  // forma asíncrona y revocar de inmediato la corta a mitad de camino.
  setTimeout(() => URL.revokeObjectURL(url), 2000);
};

export const capturarRefExport = async (targetRef) => {
  if (!targetRef.current) throw new Error('No se pudo preparar la tarjeta para exportar.');
  return html2canvas(targetRef.current, {
    backgroundColor: null,
    scale: 2,
    useCORS: true,
    width: targetRef.current.offsetWidth,
    height: targetRef.current.offsetHeight,
  });
};
