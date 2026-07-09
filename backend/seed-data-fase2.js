const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:Inayami.2028@localhost:5432/ccf_db'
});

async function seedPhase2() {
  try {
    console.log('📋 Insertando datos de prueba FASE 2...\n');

    // 1. Estadísticas (Stats de jugadores en partidos)
    await pool.query(`
      INSERT INTO estadisticas (id_partido, rut_jugador, puntos, rebotes, asistencias, robos, tapones, faltas_cometidas, porcentaje_efectividad, minutos_jugados, valoracion)
      VALUES 
        (1, '12345678-1', 25, 8, 4, 2, 1, 2, 85.5, 32, 28),
        (1, '98765432-1', 18, 12, 3, 1, 0, 3, 72.0, 28, 24),
        (1, '55555555-1', 22, 6, 7, 3, 2, 1, 88.0, 35, 31)
    `);
    console.log('✅ 3 Registros de Estadísticas insertados');

    // 2. Evaluaciones
    await pool.query(`
      INSERT INTO evaluaciones (rut_jugador, evaluador_rut, fecha_evaluacion, tipo_evaluacion, puntaje_tecnica, puntaje_actitud, puntaje_condicion, puntaje_mental, comentarios)
      VALUES 
        ('12345678-1', '55555555-1', CURRENT_DATE, 'técnica', 8, 9, 7, 8, 'Buen control de balón y toma de decisiones'),
        ('98765432-1', '55555555-1', CURRENT_DATE, 'técnica', 7, 8, 8, 7, 'Mejora física notable, debe trabajar defensa'),
        ('66666666-1', '55555555-1', CURRENT_DATE, 'técnica', 8, 7, 9, 8, 'Excelente condición y actitud competitiva')
    `);
    console.log('✅ 3 Evaluaciones insertadas');

    // 3. Gamificación Puntos
    await pool.query(`
      INSERT INTO gamificacion_puntos (rut_jugador, tipo_logro, puntos_obtenidos, descripcion)
      VALUES 
        ('12345678-1', 'triple_double', 100, 'Anotó triple-doble en partido'),
        ('98765432-1', 'cinco_rebotes', 50, '5+ rebotes en un cuarto'),
        ('55555555-1', 'asistencias_equipo', 75, 'Registró 7 asistencias'),
        ('66666666-1', 'defensa_destacada', 60, 'Robo de balón decisivo')
    `);
    console.log('✅ 4 Logros de Gamificación insertados');

    // 4. Marcas/Tiempo
    await pool.query(`
      INSERT INTO marcas_tiempo (rut_jugador, categoria, tipo_marca, valor_marca, unidad, fecha_marca)
      VALUES 
        ('12345678-1', 'U19', 'puntos_partido', 25, 'puntos', CURRENT_DATE),
        ('98765432-1', 'U17', 'rebotes_partido', 12, 'rebotes', CURRENT_DATE),
        ('55555555-1', 'U20', 'asistencias', 7, 'asistencias', CURRENT_DATE),
        ('66666666-1', 'U19', 'bloqueos', 4, 'bloqueos', CURRENT_DATE)
    `);
    console.log('✅ 4 Marcas/Récords insertadas');

    // 5. Resultados
    await pool.query(`
      INSERT INTO resultados (id_partido, equipo_ganador, puntos_local, puntos_visitante, diferencia_puntos, validado_por)
      VALUES 
        (1, 'CCF Viña', 83, 76, 7, 'Pedro López'),
        (2, 'CCF Viña', 2, 1, 1, 'Miguel García')
    `);
    console.log('✅ 2 Resultados insertados');

    // 6. Quiz Preguntas
    await pool.query(`
      INSERT INTO quiz_preguntas (titulo, tipo_quiz, rama, pregunta, opciones_json, respuesta_correcta, dificultad)
      VALUES 
        ('Regla del Doble Dribles', 'basquet', 'básquet', '¿Cuántos dribles permite la regla del doble drible?', '["Ninguno","Uno","Dos","Tres"]', 'Ninguno', 'fácil'),
        ('Faltas Personales', 'basquet', 'básquet', '¿Cuántas faltas personales se permite antes de eliminar?', '["5 faltas","6 faltas","4 faltas","7 faltas"]', '6 faltas', 'fácil'),
        ('Táctica Zona', 'tactica', 'básquet', '¿Cuál es el objetivo principal de una defensa 2-3?', '["Proteger pintura","Cubrir perímetro","Asfixiar ataque","Forzar rebote"]', 'Proteger pintura', 'media')
    `);
    console.log('✅ 3 Preguntas de Quiz insertadas');

    // 7. Pizarra Táctica
    await pool.query(`
      INSERT INTO pizarra_tactica (id_partido, entrenador_rut, nombre_tactica, descripcion, formacion, zona_defensa, zona_ataque)
      VALUES 
        (1, '55555555-1', 'Defensa 2-3', 'Proteger área interior, generar transiciones', '2-3', 'interior', 'transición'),
        (1, '55555555-1', 'Pick and Roll', 'Uso de bloqueos para crear oportunidades', 'ataque', 'perímetro', 'perímetro')
    `);
    console.log('✅ 2 Tácticas insertadas');

    // 8. Migración de Pagos
    await pool.query(`
      INSERT INTO migracion_pagos (rut_jugador, nombre_jugador, mes_pago, año_pago, monto_pago, estado_pago, metodo_pago, migrado_desde)
      VALUES 
        ('12345678-1', 'Juan López García', 'enero', 2024, 50000, 'pagado', 'transferencia', 'sistema_anterior'),
        ('98765432-1', 'María González Martínez', 'febrero', 2024, 50000, 'pagado', 'efectivo', 'sistema_anterior'),
        ('55555555-1', 'Carlos Rodríguez Sánchez', 'marzo', 2024, 50000, 'pendiente', 'cheque', 'sistema_anterior')
    `);
    console.log('✅ 3 Registros de Migración insertados');

    // 9. Jugadores Visita
    await pool.query(`
      INSERT INTO jugadores_visita (rut_visita, nombres, apellido_paterno, apellido_materno, club_procedencia, rama, categoria, posicion, contacto_apoderado, telefono_contacto, fecha_visita)
      VALUES 
        ('11111111-1', 'Diego', 'Fuentes', 'López', 'Liceo 1', 'básquet', 'U19', 'base', 'maria@example.com', '+56912345678', CURRENT_DATE),
        ('22222222-1', 'Alejandro', 'Silva', 'Rojas', 'Club Municipal', 'básquet', 'U17', 'alero', 'juan@example.com', '+56987654321', CURRENT_DATE)
    `);
    console.log('✅ 2 Jugadores en Visita insertados');

    console.log('\n✅ ¡Datos de prueba FASE 2 insertados exitosamente!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

seedPhase2();
