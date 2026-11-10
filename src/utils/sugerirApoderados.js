// Vincular apoderados en masa: para cada deportista sin cuenta de apoderado
// vinculada, propone las cuentas más probables con el motivo. La mayoría de
// las fichas venían sin vínculo y eso deja a la familia sin ver sus pagos,
// rompe la tarifa de hermanos y deja los avisos de cobro sin teléfono.
//
// Pistas (de más a menos fuerte):
//  - teléfono de emergencia de la ficha = teléfono de la cuenta
//  - nombre del contacto de emergencia = nombre de la cuenta
//  - la cuenta comparte un apellido con el deportista
// "Segura" = pista de teléfono o de nombre y sin empate con otra cuenta.

const ROLES_NO_APODERADO = new Set(['jugador', 'deportista', 'mesa', 'visita']);
const sinTildes = (t = '') => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
const digitos = (t = '') => String(t || '').replace(/\D/g, '').slice(-8);
const norm = (rut = '') => String(rut || '').replace(/[.\s-]/g, '').trim().toUpperCase();

export const estaVinculado = (jugador = {}, cuentas = []) => {
  const rut = norm(jugador.rut_apoderado);
  const correo = sinTildes(jugador.correo_apoderado);
  return cuentas.some((c) => (rut && norm(c.rut) === rut) || (correo.includes('@') && sinTildes(c.correo) === correo));
};

const puntaje = (jugador, cuenta) => {
  const motivos = [];
  let total = 0;
  const telJugador = digitos(jugador.num_emergencia);
  if (telJugador.length === 8 && telJugador === digitos(cuenta.telefono)) {
    total += 60;
    motivos.push('mismo teléfono que el contacto de emergencia');
  }
  const emergencia = sinTildes(jugador.nombre_emergencia);
  const nombreCuenta = sinTildes(`${cuenta.nombres || ''} ${cuenta.apellido_paterno || ''}`);
  const primerNombre = sinTildes(cuenta.nombres).split(' ')[0];
  if (emergencia && primerNombre && emergencia.includes(primerNombre) && emergencia.includes(sinTildes(cuenta.apellido_paterno))) {
    total += 50;
    motivos.push(`contacto de emergencia: ${jugador.nombre_emergencia}`);
  } else if (emergencia && nombreCuenta && emergencia === nombreCuenta) {
    total += 50;
    motivos.push(`contacto de emergencia: ${jugador.nombre_emergencia}`);
  }
  const apellidosJugador = [jugador.apellido_paterno, jugador.apellido_materno].map(sinTildes).filter(Boolean);
  const apellidoCuenta = sinTildes(cuenta.apellido_paterno);
  if (apellidoCuenta && apellidosJugador.includes(apellidoCuenta)) {
    total += 30;
    motivos.push(`apellido ${cuenta.apellido_paterno}`);
  }
  return { total, motivos };
};

export const sugerirApoderados = ({ jugadores = [], cuentas = [], maximo = 3 } = {}) => {
  const candidatas = cuentas.filter((c) => !ROLES_NO_APODERADO.has(sinTildes(c.rol || c.perfil_principal)));
  return jugadores
    .filter((j) => !estaVinculado(j, cuentas))
    .map((j) => {
      const sugerencias = candidatas
        .map((c) => ({ cuenta: c, ...puntaje(j, c) }))
        .filter((s) => s.total >= 30)
        .sort((a, b) => b.total - a.total || String(a.cuenta.nombres || '').localeCompare(String(b.cuenta.nombres || ''), 'es'))
        .slice(0, maximo);
      const [primera, segunda] = sugerencias;
      const segura = Boolean(primera && primera.total >= 50 && (!segunda || segunda.total < primera.total));
      return { jugador: j, sugerencias, segura };
    })
    .sort((a, b) => (Number(b.segura) - Number(a.segura))
      || ((b.sugerencias[0]?.total || 0) - (a.sugerencias[0]?.total || 0))
      || String(a.jugador.apellido_paterno || '').localeCompare(String(b.jugador.apellido_paterno || ''), 'es'));
};
