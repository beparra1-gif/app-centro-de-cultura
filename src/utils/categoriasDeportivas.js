import { mismoTexto } from './texto';

// Catálogo único de categorías por rama — antes vivía duplicado como objeto
// local en SuperAdminPanel.jsx; ahora también lo usa el formulario de
// Horarios de Entrenamiento. No es una tabla editable (decisión explícita:
// reusar la lista fija existente en vez de armar un catálogo nuevo).
export const CATEGORIAS_POR_RAMA = {
  Mixta: ['SUB-13', 'SUB-15', 'SUB-17', 'SUB-19'],
  Femenina: ['SUB-13', 'SUB-15', 'SUB-17', 'SUB-19'],
  Masculina: ['SUB-13', 'SUB-15', 'SUB-17', 'SUB-19'],
  Adulto: ['General'],
};

export const RAMAS_DISPONIBLES = Object.keys(CATEGORIAS_POR_RAMA);

// Sin distinguir mayúsculas: "MASCULINA" y "Masculina" son la misma rama.
export const categoriasDeRama = (rama) => CATEGORIAS_POR_RAMA[Object.keys(CATEGORIAS_POR_RAMA).find((k) => mismoTexto(k, rama))] || [];
