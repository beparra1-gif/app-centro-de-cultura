// Un deportista (estado ACTIVO / INACTIVO / BAJA) o una cuenta (activo /
// inactivo) que no está activo no debe aparecer en ningún listado operativo:
// deuda y Por cobrar, informes, citaciones, pasar lista, búsquedas, etc.
// Sigue visible en Usuarios y Cuentas, que es desde donde se reactiva.
const ESTADOS_INACTIVOS = new Set(['inactivo', 'inactiva', 'baja', 'retirado', 'retirada', 'suspendido', 'suspendida', 'eliminado']);

export const estaActivo = (entidad = {}) => !ESTADOS_INACTIVOS.has(String(entidad?.estado || '').trim().toLowerCase());

export const soloActivos = (lista) => (Array.isArray(lista) ? lista.filter(estaActivo) : []);
