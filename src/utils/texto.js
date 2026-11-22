// Comparar rama, categoría, etc. sin distinguir mayúsculas, tildes ni
// espacios: "masculina", "Masculina" y "MASCULINA" son la misma rama.
export const claveTexto = (v = '') => String(v ?? '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

export const mismoTexto = (a, b) => claveTexto(a) === claveTexto(b);

// Valores únicos sin repetir variantes de mayúsculas (se queda con la primera forma).
export const unicosSinMayusculas = (valores = []) => {
  const vistos = new Map();
  valores.filter((v) => String(v ?? '').trim()).forEach((v) => {
    if (!vistos.has(claveTexto(v))) vistos.set(claveTexto(v), String(v).trim());
  });
  return [...vistos.values()];
};
