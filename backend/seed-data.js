const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:Inayami.2028@localhost:5432/ccf_db'
});

async function seedData() {
  try {
    console.log('📋 Insertando datos de prueba...\n');

    // 1. Jugadores
    await pool.query(`
      INSERT INTO jugadores (rut_jugador, nombres, apellido_paterno, apellido_materno, rama, categoria, correo_apoderado, estado)
      VALUES 
        ('12345678-1', 'Juan', 'López', 'García', 'básquet', 'U19', 'juan@email.com', 'activo'),
        ('98765432-1', 'María', 'González', 'Martínez', 'básquet', 'U17', 'maria@email.com', 'activo'),
        ('55555555-1', 'Carlos', 'Rodríguez', 'Sánchez', 'fútbol', 'U20', 'carlos@email.com', 'activo'),
        ('66666666-1', 'Ana', 'Pérez', 'López', 'fútbol', 'U19', 'ana@email.com', 'activo')
      ON CONFLICT (rut_jugador) DO NOTHING
    `);
    console.log('✅ 4 Jugadores insertados');

    // 2. Convocatorias (citaciones)
    await pool.query(`
      INSERT INTO convocatorias (rama, categoria, competencia, dia_partido, hora_citacion, hora_partido, lugar, entrenador, estado)
      VALUES 
        ('básquet', 'U19', 'Torneo Viña', '2025-07-15', '18:30', '19:00', 'Gimnasio Municipal', 'Pedro López', 'activa'),
        ('fútbol', 'U20', 'Liga Local', '2025-07-16', '17:00', '17:30', 'Cancha Principal', 'Miguel García', 'activa')
      ON CONFLICT DO NOTHING
    `);
    console.log('✅ 2 Convocatorias insertadas');

    // 3. Eventos
    await pool.query(`
      INSERT INTO eventos (fecha, hora, titulo, lugar, descripcion)
      VALUES 
        ('2025-07-20', '10:00', 'Entrenamiento Especial', 'Gimnasio', 'Sesión de acondicionamiento'),
        ('2025-07-25', '15:00', 'Reunión Padres', 'Sala Reuniones', 'Información semestral')
      ON CONFLICT DO NOTHING
    `);
    console.log('✅ 2 Eventos insertados');

    // 4. Asistencia
    await pool.query(`
      INSERT INTO asistencia (fecha, rama, categoria, rut_jugador, estado_asistencia, observacion, entrenador_cargo)
      VALUES 
        ('2025-07-09', 'básquet', 'U19', '12345678-1', 'asistente', 'Buena ejecución', 'Pedro López'),
        ('2025-07-09', 'básquet', 'U19', '98765432-1', 'ausente', 'Ausencia justificada', 'Pedro López'),
        ('2025-07-09', 'fútbol', 'U20', '55555555-1', 'asistente', 'Excelente desempeño', 'Miguel García')
      ON CONFLICT DO NOTHING
    `);
    console.log('✅ 3 Registros de Asistencia insertados');

    // 5. Pagos Mensualidades
    await pool.query(`
      INSERT INTO pagos_mensualidades (rut_jugador, correo_apoderado, concepto_pago, cantidad_meses_pagados, meses_correspondientes, monto_total_pagado, comprobante_url, estado_pago, notas_tesoreria)
      VALUES 
        ('12345678-1', 'juan@email.com', 'Mensualidad Básquet', 1, 'julio 2025', 50000, 'https://example.com/comprobante1.pdf', 'aprobado', 'Pago completado'),
        ('98765432-1', 'maria@email.com', 'Mensualidad Básquet', 2, 'junio-julio 2025', 100000, 'https://example.com/comprobante2.pdf', 'pendiente', 'En validación')
      ON CONFLICT DO NOTHING
    `);
    console.log('✅ 2 Pagos de Mensualidades insertados');

    // 6. Partidos En Vivo
    await pool.query(`
      INSERT INTO partidos_live (fecha_hora, cancha_sede, categoria_rama, equipo_local, equipo_visitante, rut_planillero, estado_juego, pts_local, pts_visitante, periodo_actual)
      VALUES 
        ('2025-07-15T19:00:00', 'Gimnasio Municipal', 'U19 Básquet', 'CCF Viña', 'Liceo 1', '12345678-1', 'en_juego', 45, 38, 3),
        ('2025-07-16T17:30:00', 'Cancha Principal', 'U20 Fútbol', 'CCF Viña', 'Local FC', '55555555-1', 'pendiente', 0, 0, 0)
      ON CONFLICT DO NOTHING
    `);
    console.log('✅ 2 Partidos En Vivo insertados');

    // 7. Alertas
    await pool.query(`
      INSERT INTO alertas (fecha_emision, tipo, fecha_afectada, hora_afectada, categoria_destino, mensaje, entrenador_autor)
      VALUES 
        (NOW(), 'entrenamiento', '2025-07-15', '18:30', 'U19 Básquet', 'Traer botellón de agua', 'Pedro López'),
        (NOW(), 'torneo', '2025-07-20', '10:00', 'U20 Fútbol', 'Confirmar participación', 'Miguel García')
      ON CONFLICT DO NOTHING
    `);
    console.log('✅ 2 Alertas insertadas');

    console.log('\n✅ ¡Datos de prueba insertados exitosamente!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

seedData();
