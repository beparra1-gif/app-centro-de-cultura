const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:Inayami.2028@localhost:5432/ccf_db'
});

async function seedPhase3() {
  try {
    console.log('📋 Insertando datos de prueba FASE 3...\n');

    // 1. Staff
    await pool.query(`
      INSERT INTO staff (rut_staff, nombres, apellido_paterno, apellido_materno, cargo, rama, email, telefono, fecha_ingreso)
      VALUES 
        ('99999999-1', 'Pedro', 'López', 'García', 'Entrenador', 'básquet', 'pedro@ccf.cl', '+56912345678', CURRENT_DATE),
        ('88888888-1', 'Miguel', 'García', 'Martínez', 'Entrenador', 'fútbol', 'miguel@ccf.cl', '+56987654321', CURRENT_DATE),
        ('77777777-1', 'Claudia', 'Rodríguez', 'López', 'Kinesióloga', 'general', 'claudia@ccf.cl', '+56911223344', CURRENT_DATE),
        ('66666666-2', 'Roberto', 'Silva', 'Pérez', 'Director Técnico', 'básquet', 'roberto@ccf.cl', '+56922334455', CURRENT_DATE)
    `);
    console.log('✅ 4 Miembros de Staff insertados');

    // 2. Torneos
    await pool.query(`
      INSERT INTO torneos (nombre_torneo, rama, categoria, fecha_inicio, fecha_fin, ubicacion, organizador, cantidad_equipos, formato, estado)
      VALUES 
        ('Torneo Viña 2025', 'básquet', 'U19', CURRENT_DATE, CURRENT_DATE + INTERVAL '30 days', 'Gimnasio Municipal', 'Municipalidad', 8, 'eliminación directa', 'activo'),
        ('Liga Local Fútbol', 'fútbol', 'U20', CURRENT_DATE, CURRENT_DATE + INTERVAL '60 days', 'Cancha Principal', 'Federación Regional', 12, 'liga', 'activo')
    `);
    console.log('✅ 2 Torneos insertados');

    // 3. Caja Evento
    await pool.query(`
      INSERT INTO caja_evento_kiosco (id_evento, tipo_movimiento, concepto, monto_ingreso, metodo_pago, responsable)
      SELECT id_evento, 'ingreso', 'Venta de alimentos', 150000, 'efectivo', 'José Pérez'
      FROM eventos LIMIT 1
    `);
    console.log('✅ 1 Movimiento de Caja insertado');

    // 4. Inventario
    await pool.query(`
      INSERT INTO catalogo_inventario (codigo_articulo, nombre_articulo, categoria, cantidad_total, cantidad_disponible, precio_unitario, ubicacion, proveedor, fecha_ingreso)
      VALUES 
        ('BALON001', 'Balón Basketball', 'Deportes', 10, 10, 35000, 'Bodega A', 'Distribuidora Deportiva', CURRENT_DATE),
        ('BALON002', 'Balón Fútbol', 'Deportes', 15, 12, 28000, 'Bodega A', 'Distribuidora Deportiva', CURRENT_DATE),
        ('UNIFORME001', 'Camiseta CCF', 'Uniformes', 50, 45, 15000, 'Bodega B', 'Confecciones Silva', CURRENT_DATE),
        ('CONOS001', 'Cono Entrenamiento', 'Accesorios', 30, 28, 5000, 'Bodega A', 'Importadora Chang', CURRENT_DATE)
    `);
    console.log('✅ 4 Artículos de Inventario insertados');

    // 5. Egresos
    await pool.query(`
      INSERT INTO egresos (fecha_egreso, concepto, categoria, monto_egreso, responsable, estado, observaciones)
      VALUES 
        (CURRENT_DATE, 'Arriendo Gimnasio Julio', 'Instalaciones', 500000, 'Director', 'aprobado', 'Mensual'),
        (CURRENT_DATE, 'Servicios Básicos', 'Utilidades', 120000, 'Administrador', 'pendiente', 'Agua, Luz, Internet'),
        (CURRENT_DATE, 'Póliza Seguro', 'Seguros', 80000, 'Director', 'aprobado', 'Cobertura Completa')
    `);
    console.log('✅ 3 Egresos insertados');

    // 6. Clubes
    await pool.query(`
      INSERT INTO clubes (nombre_club, ciudad, rama, contacto_principal, telefono_contacto, email_club, fecha_registro)
      VALUES 
        ('Liceo 1', 'Viña del Mar', 'básquet', 'Juan Pérez', '+56912345678', 'liceo1@example.com', CURRENT_DATE),
        ('Club Municipal', 'Viña del Mar', 'básquet', 'María González', '+56987654321', 'municipal@example.com', CURRENT_DATE),
        ('Academia Regional', 'Valparaíso', 'fútbol', 'Carlos López', '+56911223344', 'academia@example.com', CURRENT_DATE)
    `);
    console.log('✅ 3 Clubes insertados');

    // 7. Lesiones
    await pool.query(`
      INSERT INTO lesiones (rut_jugador, tipo_lesion, descripcion, fecha_lesion, fecha_recuperacion_estimada, medico_tratante, estado_lesion)
      VALUES 
        ('12345678-1', 'Esguince Tobillo', 'Esguince grado 1 en tobillo izquierdo', CURRENT_DATE - INTERVAL '5 days', CURRENT_DATE + INTERVAL '10 days', 'Dr. Carlos Méndez', 'activa'),
        ('98765432-1', 'Tendinitis', 'Tendinitis en rodilla derecha', CURRENT_DATE - INTERVAL '2 days', CURRENT_DATE + INTERVAL '14 days', 'Dra. Patricia López', 'activa')
    `);
    console.log('✅ 2 Lesiones insertadas');

    // 8. Disciplina
    await pool.query(`
      INSERT INTO disciplina (rut_jugador, tipo_sancion, razon_sancion, fecha_sancion, duracion_dias, multa_aplicada, aplicada_por, estado)
      VALUES 
        ('66666666-1', 'Amonestación', 'Conducta antideportiva', CURRENT_DATE - INTERVAL '3 days', 1, 0, 'Pedro López', 'cumplida'),
        ('55555555-1', 'Suspensión', 'Falta grave en entrenamiento', CURRENT_DATE, 3, 50000, 'Miguel García', 'activa')
    `);
    console.log('✅ 2 Sanciones de Disciplina insertadas');

    // 9. Entrenamientos
    await pool.query(`
      INSERT INTO entrenamientos (rama, categoria, fecha_entrenamiento, hora_inicio, hora_fin, lugar, entrenador_a_cargo, tema_entrenamiento, capacidad)
      VALUES 
        ('básquet', 'U19', CURRENT_DATE, '18:30', '20:00', 'Gimnasio Municipal', 'Pedro López', 'Tácticas de ataque', 15),
        ('fútbol', 'U20', CURRENT_DATE, '19:00', '20:30', 'Cancha Principal', 'Miguel García', 'Control de balón', 22),
        ('básquet', 'U17', CURRENT_DATE + INTERVAL '1 day', '17:00', '18:30', 'Gimnasio Municipal', 'Roberto Silva', 'Condición física', 12)
    `);
    console.log('✅ 3 Entrenamientos insertados');

    // 10. Asistencia Eventos Detalle
    await pool.query(`
      INSERT INTO asistencia_eventos_detalle (id_evento, rut_persona, tipo_persona, estado_confirmacion, transporte_requerido, fecha_confirmacion)
      SELECT id_evento, '12345678-1', 'jugador', 'confirmado', false, NOW()
      FROM eventos LIMIT 1
    `);
    console.log('✅ 1 Asistencia a Evento insertada');

    console.log('\n✅ ¡Datos de prueba FASE 3 insertados exitosamente!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

seedPhase3();
