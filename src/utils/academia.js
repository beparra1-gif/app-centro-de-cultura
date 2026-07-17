// Mismo criterio ya usado (y correcto) para materiales: rama 'General' o sin
// categorias_objetivo = visible para toda la rama del pupilo; con
// categorias_objetivo, el pupilo debe calzar. Se comparte entre materiales,
// pizarras y quiz para que los tres filtren exactamente igual.
export const contenidoAcademiaVisible = (item, pupiloActivo) => {
  const ramaItem = String(item?.rama || 'General').toLowerCase();
  const ramaPupilo = String(pupiloActivo?.rama || '').toLowerCase();
  if (ramaItem !== 'general' && ramaItem !== ramaPupilo) return false;

  const categoriasObjetivo = Array.isArray(item?.categorias_objetivo)
    ? item.categorias_objetivo.map((c) => String(c).toLowerCase())
    : [];
  if (categoriasObjetivo.length === 0) return true;
  return categoriasObjetivo.includes(String(pupiloActivo?.categoria || '').toLowerCase());
};

export const filtraPorRamaCategoria = (items = [], pupiloActivo) => (
  (items || []).filter((item) => contenidoAcademiaVisible(item, pupiloActivo))
);
