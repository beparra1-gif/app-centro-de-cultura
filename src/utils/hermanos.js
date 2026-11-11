// Familias de deportistas (hermanos). Dos fichas son de la misma familia si
// comparten RUT de apoderado, correo de apoderado o grupo_familiar. Este
// último lo marca el admin a mano desde la ficha ("Apoderado y hermanos")
// para ordenar hermanos que todavía no tienen apoderado asignado.
//
// Se agrupa con union-find: así una ficha con apoderado y su hermano sin
// apoderado (unidos solo por grupo_familiar) quedan en la MISMA familia,
// aunque cada uno tenga claves distintas.

const normRut = (rut = '') => String(rut || '').replace(/\./g, '').replace(/-/g, '').trim().toUpperCase();
const normCorreo = (c = '') => {
  const v = String(c || '').trim().toLowerCase();
  return v.includes('@') && !v.endsWith('@actualizar.local') ? v : '';
};
export const normGrupoFamiliar = (g = '') => String(g || '').trim();

const clavesDe = (j = {}) => [
  normRut(j.rut_apoderado) && `rut:${normRut(j.rut_apoderado)}`,
  normCorreo(j.correo_apoderado) && `correo:${normCorreo(j.correo_apoderado)}`,
  normGrupoFamiliar(j.grupo_familiar) && `grupo:${normGrupoFamiliar(j.grupo_familiar)}`,
].filter(Boolean);

// Devuelve Map(rutJugadorNormalizado → claveFamilia).
export const agruparFamilias = (jugadores = []) => {
  const padre = new Map();
  const raiz = (x) => {
    let r = x;
    while (padre.get(r) !== r) r = padre.get(r);
    let y = x;
    while (padre.get(y) !== r) { const s = padre.get(y); padre.set(y, r); y = s; }
    return r;
  };
  const unir = (a, b) => {
    if (!padre.has(a)) padre.set(a, a);
    if (!padre.has(b)) padre.set(b, b);
    const ra = raiz(a);
    const rb = raiz(b);
    if (ra !== rb) padre.set(rb, ra);
  };
  (jugadores || []).forEach((j) => {
    const rut = normRut(j?.rut_jugador);
    if (!rut) return;
    const nodo = `jugador:${rut}`;
    if (!padre.has(nodo)) padre.set(nodo, nodo);
    clavesDe(j).forEach((k) => unir(nodo, k));
  });
  const resultado = new Map();
  (jugadores || []).forEach((j) => {
    const rut = normRut(j?.rut_jugador);
    if (rut) resultado.set(rut, raiz(`jugador:${rut}`));
  });
  return resultado;
};

// Hermanos de `jugador` dentro de `jugadores` (sin incluirlo a él).
export const hermanosDe = (jugador, jugadores = []) => {
  if (!jugador) return [];
  const rutPropio = normRut(jugador.rut_jugador);
  const lista = (jugadores || []).some((j) => normRut(j.rut_jugador) === rutPropio) ? jugadores : [...jugadores, jugador];
  const familias = agruparFamilias(lista);
  const clave = familias.get(rutPropio);
  if (!clave) return [];
  return lista.filter((j) => normRut(j.rut_jugador) !== rutPropio && familias.get(normRut(j.rut_jugador)) === clave);
};

// Fichas a actualizar para dejar a `lista` como una sola familia: usa el
// grupo_familiar que alguno ya tenga (o uno nuevo) y arrastra a quienes ya
// compartían grupo con ellos. Devuelve { grupo, actualizar: [jugador...] }.
export const planUnirHermanos = (lista = [], todos = []) => {
  const rutN = (r) => normRut(r);
  const existente = lista.map((j) => normGrupoFamiliar(j.grupo_familiar)).find(Boolean);
  const grupo = existente || `fam-${rutN(lista[0]?.rut_jugador)}`;
  const gruposPrevios = new Set(lista.map((j) => normGrupoFamiliar(j.grupo_familiar)).filter((g) => g && g !== grupo));
  const candidatos = [...lista, ...todos.filter((j) => gruposPrevios.has(normGrupoFamiliar(j.grupo_familiar)))];
  const vistos = new Set();
  const actualizar = candidatos.filter((j) => {
    const r = rutN(j.rut_jugador);
    if (!r || vistos.has(r)) return false;
    vistos.add(r);
    return normGrupoFamiliar(j.grupo_familiar) !== grupo;
  });
  return { grupo, actualizar };
};
