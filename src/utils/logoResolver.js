const extensionesLogo = ['svg', 'png', 'webp', 'jpg', 'jpeg'];
const prefijosLogo = ['club', 'torneo', 'campeonato', 'competencia'];

const obtenerOrigenApi = () => {
  try {
    const envUrl = String(import.meta.env.VITE_API_URL || '').trim();
    if (!envUrl) return '';
    const apiUrl = new URL(envUrl, window.location.origin);
    return apiUrl.origin;
  } catch {
    return '';
  }
};

export const absolutizarLogoUrl = (url = '') => {
  const raw = String(url || '').trim();
  if (!raw) return '';
  if (/^(data:|blob:|https?:)/i.test(raw)) return raw;
  if (!raw.startsWith('/')) return raw;

  const origenApi = obtenerOrigenApi();
  if (!origenApi) return raw;
  return `${origenApi}${raw}`;
};

export const normalizarSlugLogo = (texto = '') => {
  return String(texto)
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
};

export const obtenerInicialesLogo = (texto = '') => {
  const palabras = String(texto)
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 3);

  if (palabras.length === 0) return 'CCF';

  return palabras
    .map((palabra) => palabra[0])
    .join('')
    .toUpperCase();
};

export const construirLogoCandidates = ({ nombre = '', logoUrl = '', slug = '', tipo = '' } = {}) => {
  const candidatos = [];
  const urlDirecta = absolutizarLogoUrl(logoUrl);
  const slugBase = normalizarSlugLogo(slug || nombre);
  const tipoBase = normalizarSlugLogo(tipo);
  const nombreNormalizado = normalizarSlugLogo(nombre);
  const origenApi = obtenerOrigenApi();
  const agregarCandidato = (url) => {
    if (!url) return;
    candidatos.push(url);
    if (origenApi && url.startsWith('/')) {
      candidatos.push(`${origenApi}${url}`);
    }
  };

  const esNuestroClub = [
    'centro-de-cultura-fisica',
    'club-centro-de-cultura-fisica',
    'ccf',
    'club-cultura-fisica',
  ].some((alias) => nombreNormalizado === alias || nombreNormalizado.includes(alias));

  if (urlDirecta) {
    candidatos.push(urlDirecta);
  }

  if (esNuestroClub) {
    agregarCandidato('/logos/club-logo.png');
    agregarCandidato('/api/logo-assets/file/club-logo.png');
  }

  if (slugBase) {
    extensionesLogo.forEach((extension) => {
      agregarCandidato(`/logos/${slugBase}.${extension}`);
      agregarCandidato(`/api/logo-assets/file/${slugBase}.${extension}`);
    });
  }

  if (slugBase) {
    const prefijos = tipoBase ? [tipoBase, ...prefijosLogo.filter((prefijo) => prefijo !== tipoBase)] : prefijosLogo;
    prefijos.forEach((prefijo) => {
      extensionesLogo.forEach((extension) => {
        agregarCandidato(`/logos/${prefijo}-${slugBase}.${extension}`);
        agregarCandidato(`/api/logo-assets/file/${prefijo}-${slugBase}.${extension}`);
      });
    });
  }

  return [...new Set(candidatos)];
};

export const normalizarNombreLogo = (texto = '') => {
  return String(texto || '').trim();
};