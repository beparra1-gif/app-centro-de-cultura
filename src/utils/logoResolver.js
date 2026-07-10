const extensionesLogo = ['svg', 'png', 'webp', 'jpg', 'jpeg'];
const prefijosLogo = ['club', 'torneo', 'campeonato', 'competencia'];

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
  const urlDirecta = String(logoUrl || '').trim();
  const slugBase = normalizarSlugLogo(slug || nombre);
  const tipoBase = normalizarSlugLogo(tipo);
  const nombreNormalizado = normalizarSlugLogo(nombre);

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
    candidatos.push('/logos/club-logo.png');
  }

  if (slugBase) {
    extensionesLogo.forEach((extension) => {
      candidatos.push(`/logos/${slugBase}.${extension}`);
    });
  }

  if (slugBase) {
    const prefijos = tipoBase ? [tipoBase, ...prefijosLogo.filter((prefijo) => prefijo !== tipoBase)] : prefijosLogo;
    prefijos.forEach((prefijo) => {
      extensionesLogo.forEach((extension) => {
        candidatos.push(`/logos/${prefijo}-${slugBase}.${extension}`);
      });
    });
  }

  return [...new Set(candidatos)];
};

export const normalizarNombreLogo = (texto = '') => {
  return String(texto || '').trim();
};