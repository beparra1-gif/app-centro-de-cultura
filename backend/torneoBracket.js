// Emparejamiento de un cuadro de eliminación directa que soporta cualquier
// cantidad de equipos >= 2, no solo potencias de 2. Para n equipos, se
// calcula la potencia de 2 más chica >= n (nextPow2) y byes = nextPow2 - n.
// Como n no es potencia de 2, siempre se cumple n > nextPow2/2, así que
// byes < nextPow2/2 — ningún equipo necesita más de un pase directo (nunca
// hay que saltar dos rondas seguidas). Los primeros "byes" cruces del
// cuadro completo se resuelven como pase directo a la ronda 2 (un equipo
// avanza sin jugar); el resto son partidos reales de la ronda 1.
function calcularEmparejamientos(equipos) {
  const n = equipos.length;
  if (n < 2) {
    throw new Error('Se necesitan al menos 2 equipos.');
  }
  const nextPow2 = Math.pow(2, Math.ceil(Math.log2(n)));
  const byes = nextPow2 - n;
  const totalPairs = nextPow2 / 2;

  const partidosReales = []; // { posicion, local, visita } -> ronda 1
  const pasesDirectos = []; // { posicion, esLocal, equipo } -> ronda 2
  let cursor = 0;
  for (let pair = 0; pair < totalPairs; pair++) {
    if (pair < byes) {
      pasesDirectos.push({ posicion: Math.floor(pair / 2), esLocal: pair % 2 === 0, equipo: equipos[cursor++] });
    } else {
      partidosReales.push({ posicion: pair, local: equipos[cursor++], visita: equipos[cursor++] });
    }
  }

  return { partidosReales, pasesDirectos, totalRondas: Math.ceil(Math.log2(n)) };
}

module.exports = { calcularEmparejamientos };
