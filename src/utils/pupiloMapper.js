// Transforma una fila cruda de la tabla jugadores en el objeto "pupilo" que
// consume el resto de la app (TarjetaJugadorPanel, PerfilTesoreriaPanel,
// etc.). Extraído de App.jsx para poder reusarlo también desde
// SuperAdminPanel.jsx (el buscador de Tesorería embebido necesita el mismo
// shape). Si se agrega un campo nuevo a `jugadores` que algún cálculo
// necesite, hay que sumarlo también acá — punto de falla silencioso ya
// confirmado dos veces (beca/exento_mensualidad).

export const obtenerAnioNacimientoJugador = (jugador = {}) => (
  jugador.anioNacimiento
  ?? jugador.anio_nacimiento
  ?? jugador.ano_nacimiento
  ?? jugador['año_nacimiento']
  ?? ''
);

export const obtenerNumeroCamisetaJugador = (jugador = {}, fallback = 0) => {
  const raw = (
    jugador.numeroCamiseta
    ?? jugador.numero_camiseta
    ?? jugador.numero
    ?? jugador.dorsal
    ?? fallback
  );

  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
};

export const mapearJugadorAPupilo = (j, idx = 0) => ({
  id: idx + 1,
  rut: j.rut_jugador,
  nombre: `${j.nombres || ''} ${j.apellido_paterno || ''} ${j.apellido_materno || ''}`.trim(),
  nombres: j.nombres || '',
  apellido_paterno: j.apellido_paterno || '',
  apellido_materno: j.apellido_materno || '',
  correo_apoderado: j.correo_apoderado || '',
  rut_apoderado: j.rut_apoderado || '',
  categoria: j.categoria || 'General',
  rama: j.rama || j.categoria_rama || 'General',
  genero: j.genero || j.sexo || '',
  nivel: Number(j.nivel_actual || 1),
  xp: Number(j.xp_total || 0),
  numeroCamiseta: obtenerNumeroCamisetaJugador(j, 0),
  posicion: j.posicion_de_juego || 'N/A',
  estatura: j.estatura || 'N/A',
  peso: j.peso || 'N/A',
  manoHabil: j.mano_habil || 'N/A',
  tallaCamiseta: j.talla_camiseta || 'N/A',
  tallaShort: j.talla_short || 'N/A',
  poleraEntregada: Boolean(j.polera_entregada),
  asistencia: j.asistencia || 'N/A',
  estadoDeportivo: j.estado_deportivo || 'Activo',
  beca: j.beca || 'Sin beca',
  exento_mensualidad: Boolean(j.exento_mensualidad),
  fecha_ingreso: j.fecha_ingreso || null,
  mes_inicio_cobro: j.mes_inicio_cobro || '',
  anio_ingreso: j.anio_ingreso ?? j.año_ingreso ?? null,
  valor_mensualidad: j.valor_mensualidad ?? null,
  anioNacimiento: obtenerAnioNacimientoJugador(j),
  foto_jugador: j.foto_jugador || j.foto_perfil_url || j.club_logo_url || '',
});
