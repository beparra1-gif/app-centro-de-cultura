// Detección compartida de qué tipo de contenido es una URL, usada tanto por
// Academia (materiales/videos) como por el muro de Comunicaciones, para no
// duplicar la misma detección de YouTube/Vimeo/imagen en cada lado.

export const esUrlYoutube = (url = '') => /youtube\.com\/watch\?v=|youtu\.be\//.test(url);
export const esUrlVimeo = (url = '') => /vimeo\.com\//.test(url);
export const esUrlVideo = (url = '') => esUrlYoutube(url) || esUrlVimeo(url);

export const obtenerIdYoutube = (url = '') => {
  const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)/);
  return match ? match[1] : null;
};

export const obtenerIdVimeo = (url = '') => {
  const match = url.match(/vimeo\.com\/(\d+)/);
  return match ? match[1] : null;
};

// Extensión de imagen conocida, o una URL propia de /api/logo-assets/file/
// (donde suben las imágenes de Comunicaciones/comprobantes/perfil).
export const esUrlImagen = (url = '') => /\.(png|jpe?g|webp|gif|svg)(\?|$)/i.test(url) || /logo-assets\/file\//.test(url);
