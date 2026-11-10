import { describe, it, expect } from 'vitest';
import { etiquetarCampos } from './etiquetasAccesibles';

describe('etiquetarCampos', () => {
  it('da nombre a campos de .form-group y a botones de ícono con title, sin pisar nombres existentes', () => {
    document.body.innerHTML = `
      <div class="form-group"><label>Rama *</label><select id="s1"></select></div>
      <div class="form-group"><label>Nombre</label><input aria-label="Ya tiene"></div>
      <label for="x">Vinculado</label><input id="x">
      <button title="Configuración"><svg></svg></button>
      <button>Texto visible</button>`;
    etiquetarCampos(document);
    expect(document.querySelector('select').getAttribute('aria-label')).toBe('Rama');
    expect(document.querySelector('input[aria-label]').getAttribute('aria-label')).toBe('Ya tiene');
    expect(document.querySelector('#x').hasAttribute('aria-label')).toBe(false);
    expect(document.querySelector('button[title]').getAttribute('aria-label')).toBe('Configuración');
    expect(document.querySelectorAll('button')[1].hasAttribute('aria-label')).toBe(false);
  });
});
