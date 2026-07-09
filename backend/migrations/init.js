const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

const createSchema = async () => {
  try {
    console.log('📊 Creando esquema de base de datos...\n');

    // Tabla: usuarios
    await pool.query(`
      CREATE TABLE IF NOT EXISTS usuarios (
        id SERIAL PRIMARY KEY,
        nombre VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE,
        telefono VARCHAR(20),
        rol VARCHAR(50) DEFAULT 'jugador',
        activo BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Tabla usuarios creada');

    // Tabla: comunicaciones
    await pool.query(`
      CREATE TABLE IF NOT EXISTS comunicaciones (
        id SERIAL PRIMARY KEY,
        titulo VARCHAR(255) NOT NULL,
        cuerpo_texto TEXT,
        tipo VARCHAR(50),
        rama VARCHAR(50),
        categoria VARCHAR(50),
        urgencia VARCHAR(50) DEFAULT 'Baja',
        solicita_asistencia BOOLEAN DEFAULT false,
        reacciones JSONB DEFAULT '{}',
        asistencias JSONB DEFAULT '[]',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Tabla comunicaciones creada');

    // Tabla: comentarios
    await pool.query(`
      CREATE TABLE IF NOT EXISTS comentarios (
        id SERIAL PRIMARY KEY,
        comunicacion_id INT REFERENCES comunicaciones(id) ON DELETE CASCADE,
        usuario_id INT REFERENCES usuarios(id) ON DELETE SET NULL,
        texto TEXT NOT NULL,
        parent_id INT REFERENCES comentarios(id) ON DELETE CASCADE,
        likes INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Tabla comentarios creada');

    // Tabla: pagos
    await pool.query(`
      CREATE TABLE IF NOT EXISTS pagos (
        id SERIAL PRIMARY KEY,
        usuario_id INT REFERENCES usuarios(id),
        monto DECIMAL(10,2) NOT NULL,
        tipo VARCHAR(50),
        estado VARCHAR(50) DEFAULT 'pendiente',
        comprobante VARCHAR(255),
        fecha_pago TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Tabla pagos creada');

    // Tabla: encuestas
    await pool.query(`
      CREATE TABLE IF NOT EXISTS encuestas (
        id SERIAL PRIMARY KEY,
        pregunta TEXT NOT NULL,
        opciones JSONB,
        votos JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Tabla encuestas creada');

    // Tabla: contactos_whatsapp
    await pool.query(`
      CREATE TABLE IF NOT EXISTS contactos_whatsapp (
        id SERIAL PRIMARY KEY,
        nombre VARCHAR(255) NOT NULL,
        numero VARCHAR(20) UNIQUE NOT NULL,
        activo BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Tabla contactos_whatsapp creada');

    // Tabla: historial_whatsapp
    await pool.query(`
      CREATE TABLE IF NOT EXISTS historial_whatsapp (
        id SERIAL PRIMARY KEY,
        numero VARCHAR(20),
        mensaje TEXT,
        tipo VARCHAR(50),
        estado VARCHAR(50) DEFAULT 'enviado',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Tabla historial_whatsapp creada');

    // Tabla: notificaciones
    await pool.query(`
      CREATE TABLE IF NOT EXISTS notificaciones (
        id SERIAL PRIMARY KEY,
        usuario_id INT REFERENCES usuarios(id),
        tipo VARCHAR(50),
        titulo VARCHAR(255),
        descripcion TEXT,
        leida BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Tabla notificaciones creada');

    // ========== TABLAS FASE 1: CRÍTICAS ==========

    // Tabla: jugadores
    await pool.query(`
      CREATE TABLE IF NOT EXISTS jugadores (
        rut_jugador VARCHAR(20) PRIMARY KEY,
        correo_apoderado VARCHAR(255),
        correo_jugador VARCHAR(255),
        password_jugador VARCHAR(255),
        forzar_clave_jugador BOOLEAN DEFAULT false,
        parentesco_apoderado VARCHAR(50),
        nombres VARCHAR(255),
        apellido_paterno VARCHAR(255),
        apellido_materno VARCHAR(255),
        fecha_nacimiento DATE,
        año_nacimiento INT,
        colegio VARCHAR(255),
        rama VARCHAR(50),
        categoria VARCHAR(50),
        posicion_de_juego VARCHAR(50),
        estatura DECIMAL(5,2),
        peso DECIMAL(5,2),
        mano_habil VARCHAR(20),
        numero_camiseta INT,
        club_anterior VARCHAR(255),
        fecha_ingreso DATE,
        mes_inicio_cobro VARCHAR(50),
        beca BOOLEAN DEFAULT false,
        valor_mensualidad DECIMAL(10,2),
        matricula_pagada BOOLEAN DEFAULT false,
        talla_camiseta VARCHAR(10),
        talla_short VARCHAR(10),
        polera_entregada BOOLEAN DEFAULT false,
        poleron_entregado BOOLEAN DEFAULT false,
        derechos_imagen BOOLEAN DEFAULT false,
        prevision VARCHAR(50),
        tipo_sangre VARCHAR(10),
        alergias TEXT,
        nombre_emergencia VARCHAR(255),
        parentesco_emergencia VARCHAR(50),
        num_emergencia VARCHAR(20),
        estado VARCHAR(50) DEFAULT 'activo',
        foto_jugador VARCHAR(255),
        estado_deportivo VARCHAR(50),
        fecha_inicio_baja DATE,
        fecha_fin_baja DATE,
        xp_puntos INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Tabla jugadores creada');

    // Tabla: cuentas (Apoderados + Staff)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS cuentas (
        id SERIAL PRIMARY KEY,
        correo VARCHAR(255) UNIQUE NOT NULL,
        rut VARCHAR(20) UNIQUE NOT NULL,
        password VARCHAR(255),
        nombres VARCHAR(255),
        apellido_paterno VARCHAR(255),
        apellido_materno VARCHAR(255),
        fecha_nacimiento DATE,
        estado_civil VARCHAR(50),
        direccion VARCHAR(255),
        comuna VARCHAR(100),
        prefijo_tel VARCHAR(10),
        telefono VARCHAR(20),
        profesion_oficio VARCHAR(100),
        nombre_segundo_contacto VARCHAR(255),
        parentesco_segundo_contacto VARCHAR(50),
        num_segundo_contacto VARCHAR(20),
        es_socio BOOLEAN DEFAULT false,
        fecha_ingreso_socio DATE,
        rol VARCHAR(50),
        forzar_clave BOOLEAN DEFAULT false,
        foto_perfil_url VARCHAR(255),
        estado VARCHAR(50) DEFAULT 'activo',
        autorizacion_imagen BOOLEAN DEFAULT false,
        dia_pago_acordado INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Tabla cuentas creada');

    // Tabla: pagos_mensualidades (Mejorada)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS pagos_mensualidades (
        id SERIAL PRIMARY KEY,
        fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        correo_apoderado VARCHAR(255),
        concepto_pago VARCHAR(100),
        cantidad_meses_pagados INT,
        meses_correspondientes VARCHAR(500),
        monto_total_pagado DECIMAL(10,2),
        comprobante_url VARCHAR(255),
        estado_pago VARCHAR(50) DEFAULT 'pendiente',
        fecha_aprobacion TIMESTAMP,
        notas_tesoreria TEXT,
        rut_jugador VARCHAR(20) REFERENCES jugadores(rut_jugador),
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Tabla pagos_mensualidades creada');

    // Tabla: convocatorias (Citaciones)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS convocatorias (
        id_conv SERIAL PRIMARY KEY,
        fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        rama VARCHAR(50),
        categoria VARCHAR(50),
        competencia VARCHAR(255),
        dia_partido DATE,
        hora_citacion TIME,
        hora_partido TIME,
        lugar VARCHAR(255),
        titulares TEXT,
        reservas TEXT,
        entrenador VARCHAR(255),
        estado VARCHAR(50) DEFAULT 'activa',
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Tabla convocatorias creada');

    // Tabla: eventos
    await pool.query(`
      CREATE TABLE IF NOT EXISTS eventos (
        id_evento SERIAL PRIMARY KEY,
        fecha DATE,
        hora TIME,
        titulo VARCHAR(255),
        lugar VARCHAR(255),
        descripcion TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Tabla eventos creada');

    // Tabla: asistencia
    await pool.query(`
      CREATE TABLE IF NOT EXISTS asistencia (
        id_asistencia SERIAL PRIMARY KEY,
        fecha DATE,
        rama VARCHAR(50),
        categoria VARCHAR(50),
        rut_jugador VARCHAR(20) REFERENCES jugadores(rut_jugador),
        estado_asistencia VARCHAR(50),
        observacion TEXT,
        entrenador_cargo VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Tabla asistencia creada');

    // Tabla: asistencia_eventos
    await pool.query(`
      CREATE TABLE IF NOT EXISTS asistencia_eventos (
        id SERIAL PRIMARY KEY,
        id_asistencia INT,
        id_evento INT REFERENCES eventos(id_evento),
        rut_jugador VARCHAR(20) REFERENCES jugadores(rut_jugador),
        estado_confirmacion VARCHAR(50),
        motivo_ausencia TEXT,
        necesita_transporte BOOLEAN DEFAULT false,
        cupos_autos_ofrecidos INT DEFAULT 0,
        reserva_bus_acompañante BOOLEAN DEFAULT false,
        asistencia_real_cancha BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Tabla asistencia_eventos creada');

    // Tabla: partidos_live
    await pool.query(`
      CREATE TABLE IF NOT EXISTS partidos_live (
        id_partido SERIAL PRIMARY KEY,
        id_torneo INT,
        fecha_hora TIMESTAMP,
        cancha_sede VARCHAR(255),
        categoria_rama VARCHAR(50),
        equipo_local VARCHAR(255),
        equipo_visitante VARCHAR(255),
        modo_estadistica VARCHAR(50),
        periodo_actual INT,
        pts_local INT DEFAULT 0,
        pts_visitante INT DEFAULT 0,
        faltas_local_cuarto INT DEFAULT 0,
        faltas_visita_cuarto INT DEFAULT 0,
        tiempos_muertos_local INT DEFAULT 3,
        tiempos_muertos_visita INT DEFAULT 3,
        estado_juego VARCHAR(50),
        link_transmision_vivo VARCHAR(255),
        rut_planillero VARCHAR(20),
        flecha_posesion VARCHAR(50),
        bonus_local INT DEFAULT 0,
        bonus_visitante INT DEFAULT 0,
        reloj_partido VARCHAR(10),
        arbitro_principal VARCHAR(255),
        arbitro_asistente VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Tabla partidos_live creada');

    // Tabla: alertas
    await pool.query(`
      CREATE TABLE IF NOT EXISTS alertas (
        id_alerta SERIAL PRIMARY KEY,
        fecha_emision TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        tipo VARCHAR(50),
        fecha_afectada DATE,
        hora_afectada TIME,
        categoria_destino VARCHAR(50),
        mensaje TEXT,
        entrenador_autor VARCHAR(255)
      )
    `);
    console.log('✅ Tabla alertas creada');

    // ==================== FASE 2: TABLAS ADICIONALES ====================

    // Tabla: estadisticas (Stats de partidos y jugadores)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS estadisticas (
        id_estadistica SERIAL PRIMARY KEY,
        id_partido INT REFERENCES partidos_live(id_partido),
        rut_jugador VARCHAR(20) REFERENCES jugadores(rut_jugador),
        puntos INT DEFAULT 0,
        rebotes INT DEFAULT 0,
        asistencias INT DEFAULT 0,
        robos INT DEFAULT 0,
        tapones INT DEFAULT 0,
        faltas_cometidas INT DEFAULT 0,
        dobles_faltas INT DEFAULT 0,
        porcentaje_efectividad DECIMAL(5,2) DEFAULT 0,
        minutos_jugados INT DEFAULT 0,
        valoracion INT DEFAULT 0,
        notas TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Tabla estadisticas creada');

    // Tabla: evaluaciones (Evaluaciones de jugadores)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS evaluaciones (
        id_evaluacion SERIAL PRIMARY KEY,
        rut_jugador VARCHAR(20) REFERENCES jugadores(rut_jugador),
        evaluador_rut VARCHAR(20),
        fecha_evaluacion DATE,
        tipo_evaluacion VARCHAR(50),
        puntaje_tecnica INT,
        puntaje_actitud INT,
        puntaje_condicion INT,
        puntaje_mental INT,
        comentarios TEXT,
        recomendaciones TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Tabla evaluaciones creada');

    // Tabla: gamificacion_puntos (Sistema de puntos/logros)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS gamificacion_puntos (
        id_logro SERIAL PRIMARY KEY,
        rut_jugador VARCHAR(20) REFERENCES jugadores(rut_jugador),
        tipo_logro VARCHAR(100),
        puntos_obtenidos INT,
        descripcion TEXT,
        fecha_logro TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        validado BOOLEAN DEFAULT false,
        validador_rut VARCHAR(20),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Tabla gamificacion_puntos creada');

    // Tabla: marcas_tiempo (Récords y marcas)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS marcas_tiempo (
        id_marca SERIAL PRIMARY KEY,
        rut_jugador VARCHAR(20) REFERENCES jugadores(rut_jugador),
        categoria VARCHAR(50),
        tipo_marca VARCHAR(100),
        valor_marca DECIMAL(10,2),
        unidad VARCHAR(20),
        fecha_marca DATE,
        id_partido INT REFERENCES partidos_live(id_partido),
        validado BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Tabla marcas_tiempo creada');

    // Tabla: resultados (Resultados finales de partidos)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS resultados (
        id_resultado SERIAL PRIMARY KEY,
        id_partido INT REFERENCES partidos_live(id_partido),
        equipo_ganador VARCHAR(255),
        puntos_local INT,
        puntos_visitante INT,
        diferencia_puntos INT,
        fecha_resultado TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        validado_por VARCHAR(255),
        acta_url VARCHAR(255),
        observaciones TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Tabla resultados creada');

    // Tabla: quiz_preguntas (Preguntas de tests/evaluaciones)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS quiz_preguntas (
        id_pregunta SERIAL PRIMARY KEY,
        titulo VARCHAR(255),
        tipo_quiz VARCHAR(50),
        rama VARCHAR(50),
        categoria VARCHAR(50),
        pregunta TEXT,
        opciones_json JSON,
        respuesta_correcta VARCHAR(255),
        puntos_valor INT DEFAULT 10,
        dificultad VARCHAR(20),
        activo BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Tabla quiz_preguntas creada');

    // Tabla: pizarra_tactica (Tácticas y anotaciones)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS pizarra_tactica (
        id_tactica SERIAL PRIMARY KEY,
        id_partido INT REFERENCES partidos_live(id_partido),
        entrenador_rut VARCHAR(20),
        nombre_tactica VARCHAR(255),
        descripcion TEXT,
        dibujo_url VARCHAR(255),
        formacion VARCHAR(50),
        zona_defensa VARCHAR(50),
        zona_ataque VARCHAR(50),
        video_url VARCHAR(255),
        efectividad INT,
        fecha_tactica TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Tabla pizarra_tactica creada');

    // Tabla: migracion_pagos (Registro histórico de pagos antiguos)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS migracion_pagos (
        id_migracion SERIAL PRIMARY KEY,
        rut_jugador VARCHAR(20),
        nombre_jugador VARCHAR(255),
        mes_pago VARCHAR(20),
        año_pago INT,
        monto_pago DECIMAL(10,2),
        estado_pago VARCHAR(50),
        fecha_registro_original DATE,
        metodo_pago VARCHAR(50),
        comprobante_antiguo VARCHAR(255),
        observaciones TEXT,
        migrado_desde VARCHAR(50),
        fecha_migracion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Tabla migracion_pagos creada');

    // Tabla: jugadores_visita (Jugadores visitantes/pruebas)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS jugadores_visita (
        id_visita SERIAL PRIMARY KEY,
        rut_visita VARCHAR(20),
        nombres VARCHAR(255),
        apellido_paterno VARCHAR(255),
        apellido_materno VARCHAR(255),
        club_procedencia VARCHAR(255),
        rama VARCHAR(50),
        categoria VARCHAR(50),
        posicion VARCHAR(50),
        contacto_apoderado VARCHAR(255),
        telefono_contacto VARCHAR(20),
        fecha_visita DATE,
        prueba_realizada BOOLEAN DEFAULT false,
        observaciones TEXT,
        resultado_prueba VARCHAR(255),
        reclutado BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Tabla jugadores_visita creada');

    // ==================== FASE 3: TABLAS ADMINISTRATIVAS ====================

    // Tabla: auditoria (Log de todas las acciones)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS auditoria (
        id_auditoria SERIAL PRIMARY KEY,
        usuario_id INT,
        tabla_afectada VARCHAR(100),
        tipo_accion VARCHAR(50),
        registro_id INT,
        valores_anteriores JSON,
        valores_nuevos JSON,
        fecha_accion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        ip_usuario VARCHAR(45),
        descripcion TEXT
      )
    `);
    console.log('✅ Tabla auditoria creada');

    // Tabla: staff (Personal del club)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS staff (
        id_staff SERIAL PRIMARY KEY,
        rut_staff VARCHAR(20) UNIQUE,
        nombres VARCHAR(255),
        apellido_paterno VARCHAR(255),
        apellido_materno VARCHAR(255),
        cargo VARCHAR(100),
        rama VARCHAR(50),
        especialidad VARCHAR(100),
        email VARCHAR(255),
        telefono VARCHAR(20),
        fecha_ingreso DATE,
        activo BOOLEAN DEFAULT true,
        salario DECIMAL(10,2),
        contrato_url VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Tabla staff creada');

    // Tabla: torneos (Torneos y competiciones)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS torneos (
        id_torneo SERIAL PRIMARY KEY,
        nombre_torneo VARCHAR(255),
        rama VARCHAR(50),
        categoria VARCHAR(50),
        fecha_inicio DATE,
        fecha_fin DATE,
        ubicacion VARCHAR(255),
        organizador VARCHAR(255),
        cantidad_equipos INT,
        formato VARCHAR(50),
        estado VARCHAR(50),
        ganador VARCHAR(255),
        subcampeón VARCHAR(255),
        premios TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Tabla torneos creada');

    // Tabla: caja_evento_kiosco (Movimientos de caja en eventos)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS caja_evento_kiosco (
        id_caja SERIAL PRIMARY KEY,
        id_evento INT REFERENCES eventos(id_evento),
        tipo_movimiento VARCHAR(50),
        concepto VARCHAR(255),
        monto_ingreso DECIMAL(10,2) DEFAULT 0,
        monto_egreso DECIMAL(10,2) DEFAULT 0,
        metodo_pago VARCHAR(50),
        responsable VARCHAR(255),
        observaciones TEXT,
        fecha_movimiento TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Tabla caja_evento_kiosco creada');

    // Tabla: catalogo_inventario (Inventario del club)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS catalogo_inventario (
        id_articulo SERIAL PRIMARY KEY,
        codigo_articulo VARCHAR(50) UNIQUE,
        nombre_articulo VARCHAR(255),
        categoria VARCHAR(100),
        descripcion TEXT,
        cantidad_total INT DEFAULT 0,
        cantidad_disponible INT DEFAULT 0,
        cantidad_dañado INT DEFAULT 0,
        precio_unitario DECIMAL(10,2),
        fecha_ingreso DATE,
        fecha_ultimo_movimiento DATE,
        ubicacion VARCHAR(100),
        proveedor VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Tabla catalogo_inventario creada');

    // Tabla: egresos (Gastos/Egresos del club)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS egresos (
        id_egreso SERIAL PRIMARY KEY,
        fecha_egreso DATE,
        concepto VARCHAR(255),
        categoria VARCHAR(100),
        monto_egreso DECIMAL(10,2),
        responsable VARCHAR(255),
        comprobante_url VARCHAR(255),
        estado VARCHAR(50),
        aprobado_por VARCHAR(255),
        observaciones TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Tabla egresos creada');

    // Tabla: clubes (Otros clubes/rivales)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS clubes (
        id_club SERIAL PRIMARY KEY,
        nombre_club VARCHAR(255),
        ciudad VARCHAR(100),
        rama VARCHAR(50),
        contacto_principal VARCHAR(255),
        telefono_contacto VARCHAR(20),
        email_club VARCHAR(255),
        sitio_web VARCHAR(255),
        representante_legal VARCHAR(255),
        fecha_registro DATE,
        activo BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Tabla clubes creada');

    // Tabla: encuestas_respuestas (Respuestas a encuestas)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS encuestas_respuestas (
        id_respuesta SERIAL PRIMARY KEY,
        id_encuesta INT REFERENCES encuestas(id),
        rut_respondente VARCHAR(20),
        opcion_seleccionada VARCHAR(255),
        comentario_adicional TEXT,
        fecha_respuesta TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Tabla encuestas_respuestas creada');

    // Tabla: asistencia_eventos_detalle (Detalle de asistencia a eventos)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS asistencia_eventos_detalle (
        id_detalle SERIAL PRIMARY KEY,
        id_evento INT REFERENCES eventos(id_evento),
        rut_persona VARCHAR(20),
        tipo_persona VARCHAR(50),
        estado_confirmacion VARCHAR(50),
        transporte_requerido BOOLEAN DEFAULT false,
        observaciones TEXT,
        fecha_confirmacion TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Tabla asistencia_eventos_detalle creada');

    // Tabla: lesiones (Control de lesiones de jugadores)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS lesiones (
        id_lesion SERIAL PRIMARY KEY,
        rut_jugador VARCHAR(20) REFERENCES jugadores(rut_jugador),
        tipo_lesion VARCHAR(100),
        descripcion TEXT,
        fecha_lesion DATE,
        fecha_recuperacion_estimada DATE,
        fecha_recuperacion_real DATE,
        diagnostico_medico TEXT,
        medico_tratante VARCHAR(255),
        estado_lesion VARCHAR(50),
        notas_seguimiento TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Tabla lesiones creada');

    // Tabla: disciplina (Sanciones/Disciplina de jugadores)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS disciplina (
        id_sancion SERIAL PRIMARY KEY,
        rut_jugador VARCHAR(20) REFERENCES jugadores(rut_jugador),
        tipo_sancion VARCHAR(100),
        razon_sancion TEXT,
        fecha_sancion DATE,
        duracion_dias INT,
        fecha_levantamiento DATE,
        multa_aplicada DECIMAL(10,2) DEFAULT 0,
        aplicada_por VARCHAR(255),
        estado VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Tabla disciplina creada');

    // Tabla: entrenamientos (Sesiones de entrenamiento)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS entrenamientos (
        id_entrenamiento SERIAL PRIMARY KEY,
        rama VARCHAR(50),
        categoria VARCHAR(50),
        fecha_entrenamiento DATE,
        hora_inicio TIME,
        hora_fin TIME,
        lugar VARCHAR(255),
        entrenador_a_cargo VARCHAR(255),
        tema_entrenamiento VARCHAR(255),
        capacidad INT,
        asistencia INT,
        observaciones TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Tabla entrenamientos creada');

    console.log('\n✅ ¡Esquema completo creado exitosamente!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err);
    process.exit(1);
  }
};

createSchema();
