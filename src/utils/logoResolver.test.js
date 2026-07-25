import { describe, it, expect } from 'vitest';
import { esNuestroClub, normalizarSlugLogo } from './logoResolver';

describe('normalizarSlugLogo', () => {
  it('pasa a minúsculas, quita tildes y reemplaza espacios por guiones', () => {
    expect(normalizarSlugLogo('Centro de Cultura Física')).toBe('centro-de-cultura-fisica');
  });

  it('recorta guiones al inicio/final', () => {
    expect(normalizarSlugLogo('  Club Ñuñoa!!  ')).toBe('club-nunoa');
  });
});

describe('esNuestroClub', () => {
  it('reconoce el nombre completo del club', () => {
    expect(esNuestroClub('Centro de Cultura Física')).toBe(true);
  });

  it('reconoce el alias "CCF" (antes solo lo reconocía LogoPicker, no el filtro del Muro)', () => {
    expect(esNuestroClub('CCF')).toBe(true);
    expect(esNuestroClub('ccf')).toBe(true);
  });

  it('reconoce variantes con mayúsculas y tildes', () => {
    expect(esNuestroClub('CENTRO DE CULTURA FÍSICA')).toBe(true);
    expect(esNuestroClub('Club Centro de Cultura Física')).toBe(true);
  });

  it('rechaza nombres de equipos rivales', () => {
    expect(esNuestroClub('La Ligua')).toBe(false);
    expect(esNuestroClub('Club Deportivo Vikingos')).toBe(false);
  });

  it('nombre vacío no es nuestro club', () => {
    expect(esNuestroClub('')).toBe(false);
    expect(esNuestroClub()).toBe(false);
  });
});
