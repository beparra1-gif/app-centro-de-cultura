// src/api/client.js
// Cliente HTTP para conectar con el backend

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

// Funciones auxiliares
const handleResponse = async (response) => {
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Error en la solicitud');
  }
  return response.json();
};

// ========== COMUNICACIONES ==========

export const comunicacionesAPI = {
  // Obtener todas
  getAll: async () => {
    const response = await fetch(`${API_BASE_URL}/comunicaciones`);
    return handleResponse(response);
  },

  // Obtener una
  getById: async (id) => {
    const response = await fetch(`${API_BASE_URL}/comunicaciones/${id}`);
    return handleResponse(response);
  },

  // Crear
  create: async (data) => {
    const response = await fetch(`${API_BASE_URL}/comunicaciones`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return handleResponse(response);
  },

  // Actualizar
  update: async (id, data) => {
    const response = await fetch(`${API_BASE_URL}/comunicaciones/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return handleResponse(response);
  },

  // Eliminar
  delete: async (id) => {
    const response = await fetch(`${API_BASE_URL}/comunicaciones/${id}`, {
      method: 'DELETE'
    });
    return handleResponse(response);
  }
};

// ========== COMENTARIOS ==========

export const comentariosAPI = {
  // Obtener comentarios de una comunicación
  getByComId: async (comId) => {
    const response = await fetch(`${API_BASE_URL}/comunicaciones/${comId}/comentarios`);
    return handleResponse(response);
  },

  // Crear comentario
  create: async (comId, data) => {
    const response = await fetch(`${API_BASE_URL}/comunicaciones/${comId}/comentarios`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return handleResponse(response);
  },

  // Like
  like: async (comentId) => {
    const response = await fetch(`${API_BASE_URL}/comentarios/${comentId}/like`, {
      method: 'PUT'
    });
    return handleResponse(response);
  }
};

// ========== PAGOS ==========

export const pagosAPI = {
  // Obtener todos
  getAll: async () => {
    const response = await fetch(`${API_BASE_URL}/pagos`);
    return handleResponse(response);
  },

  // Obtener por usuario
  getByUsuario: async (usuarioId) => {
    const response = await fetch(`${API_BASE_URL}/pagos/usuario/${usuarioId}`);
    return handleResponse(response);
  },

  // Crear
  create: async (data) => {
    const response = await fetch(`${API_BASE_URL}/pagos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return handleResponse(response);
  },

  // Validar (admin)
  validar: async (pagoId, estado) => {
    const response = await fetch(`${API_BASE_URL}/pagos/${pagoId}/validar`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ estado })
    });
    return handleResponse(response);
  }
};

// ========== USUARIOS ==========

export const usuariosAPI = {
  // Obtener todos
  getAll: async () => {
    const response = await fetch(`${API_BASE_URL}/usuarios`);
    return handleResponse(response);
  },

  // Obtener uno
  getById: async (id) => {
    const response = await fetch(`${API_BASE_URL}/usuarios/${id}`);
    return handleResponse(response);
  },

  // Crear
  create: async (data) => {
    const response = await fetch(`${API_BASE_URL}/usuarios`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return handleResponse(response);
  }
};

// ========== WHATSAPP ==========

export const whatsappAPI = {
  // Obtener contactos
  getContactos: async () => {
    const response = await fetch(`${API_BASE_URL}/whatsapp/contactos`);
    return handleResponse(response);
  },

  // Agregar contacto
  agregarContacto: async (nombre, numero) => {
    const response = await fetch(`${API_BASE_URL}/whatsapp/contactos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre, numero })
    });
    return handleResponse(response);
  },

  // Eliminar contacto
  eliminarContacto: async (id) => {
    const response = await fetch(`${API_BASE_URL}/whatsapp/contactos/${id}`, {
      method: 'DELETE'
    });
    return handleResponse(response);
  },

  // Enviar mensaje
  enviarMensaje: async (numero, mensaje, tipo) => {
    const response = await fetch(`${API_BASE_URL}/whatsapp/enviar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ numero, mensaje, tipo })
    });
    return handleResponse(response);
  }
};

// ========== REPORTES ==========

export const reportesAPI = {
  // Engagement
  getEngagement: async () => {
    const response = await fetch(`${API_BASE_URL}/reportes/engagement`);
    return handleResponse(response);
  },

  // Top comunicaciones
  getTopComunicaciones: async () => {
    const response = await fetch(`${API_BASE_URL}/reportes/top-comunicaciones`);
    return handleResponse(response);
  }
};

// ========== ENCUESTAS ==========

export const encuestasAPI = {
  // Obtener todas
  getAll: async () => {
    const response = await fetch(`${API_BASE_URL}/encuestas`);
    return handleResponse(response);
  },

  // Crear
  create: async (pregunta, opciones) => {
    const response = await fetch(`${API_BASE_URL}/encuestas`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pregunta, opciones })
    });
    return handleResponse(response);
  },

  // Votar
  votar: async (encuestaId, opcion) => {
    const response = await fetch(`${API_BASE_URL}/encuestas/${encuestaId}/votar`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ opcion })
    });
    return handleResponse(response);
  }
};

// ========== HEALTH CHECK ==========

export const healthCheck = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/health`);
    return response.ok;
  } catch {
    return false;
  }
};

// ========== JUGADORES (FASE 1) ==========

export const jugadoresAPI = {
  // Obtener todos
  getAll: async () => {
    const response = await fetch(`${API_BASE_URL}/jugadores`);
    return handleResponse(response);
  },

  // Obtener por RUT
  getByRut: async (rut) => {
    const response = await fetch(`${API_BASE_URL}/jugadores/${rut}`);
    return handleResponse(response);
  },

  // Crear
  create: async (datos) => {
    const response = await fetch(`${API_BASE_URL}/jugadores`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(datos)
    });
    return handleResponse(response);
  }
};

// ========== PAGOS MENSUALIDADES (FASE 1) ==========

export const pagosMensualidadesAPI = {
  // Obtener todos
  getAll: async () => {
    const response = await fetch(`${API_BASE_URL}/pagos-mensualidades`);
    return handleResponse(response);
  },

  // Crear
  create: async (datos) => {
    const response = await fetch(`${API_BASE_URL}/pagos-mensualidades`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(datos)
    });
    return handleResponse(response);
  },

  // Validar pago
  validar: async (id, estado) => {
    const response = await fetch(`${API_BASE_URL}/pagos-mensualidades/${id}/validar`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ estado_pago: estado })
    });
    return handleResponse(response);
  }
};

// ========== CONVOCATORIAS (FASE 1) ==========

export const convocatoriasAPI = {
  // Obtener todas
  getAll: async () => {
    const response = await fetch(`${API_BASE_URL}/convocatorias`);
    return handleResponse(response);
  },

  // Crear
  create: async (datos) => {
    const response = await fetch(`${API_BASE_URL}/convocatorias`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(datos)
    });
    return handleResponse(response);
  }
};

// ========== EVENTOS (FASE 1) ==========

export const eventosAPI = {
  // Obtener todos
  getAll: async () => {
    const response = await fetch(`${API_BASE_URL}/eventos`);
    return handleResponse(response);
  },

  // Crear
  create: async (datos) => {
    const response = await fetch(`${API_BASE_URL}/eventos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(datos)
    });
    return handleResponse(response);
  }
};

// ========== ASISTENCIA (FASE 1) ==========

export const asistenciaAPI = {
  // Obtener todas
  getAll: async () => {
    const response = await fetch(`${API_BASE_URL}/asistencia`);
    return handleResponse(response);
  },

  // Registrar
  create: async (datos) => {
    const response = await fetch(`${API_BASE_URL}/asistencia`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(datos)
    });
    return handleResponse(response);
  }
};

// ========== PARTIDOS EN VIVO (FASE 1) ==========

export const partidosLiveAPI = {
  // Obtener todos
  getAll: async () => {
    const response = await fetch(`${API_BASE_URL}/partidos-live`);
    return handleResponse(response);
  },

  // Crear
  create: async (datos) => {
    const response = await fetch(`${API_BASE_URL}/partidos-live`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(datos)
    });
    return handleResponse(response);
  },

  // Actualizar marcador
  updateScore: async (id, datos) => {
    const response = await fetch(`${API_BASE_URL}/partidos-live/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(datos)
    });
    return handleResponse(response);
  }
};

// ========== ESTADÍSTICAS (FASE 2) ==========

export const estadisticasAPI = {
  // Obtener de un partido
  getByPartido: async (partidoId) => {
    const response = await fetch(`${API_BASE_URL}/estadisticas/partido/${partidoId}`);
    return handleResponse(response);
  },

  // Crear
  create: async (datos) => {
    const response = await fetch(`${API_BASE_URL}/estadisticas`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(datos)
    });
    return handleResponse(response);
  }
};

// ========== EVALUACIONES (FASE 2) ==========

export const evaluacionesAPI = {
  // Obtener de un jugador
  getByJugador: async (rut) => {
    const response = await fetch(`${API_BASE_URL}/evaluaciones/jugador/${rut}`);
    return handleResponse(response);
  },

  // Crear
  create: async (datos) => {
    const response = await fetch(`${API_BASE_URL}/evaluaciones`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(datos)
    });
    return handleResponse(response);
  }
};

// ========== GAMIFICACIÓN (FASE 2) ==========

export const gamificacionAPI = {
  // Obtener de un jugador
  getByJugador: async (rut) => {
    const response = await fetch(`${API_BASE_URL}/gamificacion/${rut}`);
    return handleResponse(response);
  },

  // Crear logro
  create: async (datos) => {
    const response = await fetch(`${API_BASE_URL}/gamificacion`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(datos)
    });
    return handleResponse(response);
  }
};

// ========== MARCAS/RÉCORDS (FASE 2) ==========

export const marcasAPI = {
  // Obtener de un jugador
  getByJugador: async (rut) => {
    const response = await fetch(`${API_BASE_URL}/marcas/${rut}`);
    return handleResponse(response);
  },

  // Registrar marca
  create: async (datos) => {
    const response = await fetch(`${API_BASE_URL}/marcas`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(datos)
    });
    return handleResponse(response);
  }
};

// ========== RESULTADOS (FASE 2) ==========

export const resultadosAPI = {
  // Obtener de un partido
  getByPartido: async (partidoId) => {
    const response = await fetch(`${API_BASE_URL}/resultados/partido/${partidoId}`);
    return handleResponse(response);
  },

  // Crear
  create: async (datos) => {
    const response = await fetch(`${API_BASE_URL}/resultados`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(datos)
    });
    return handleResponse(response);
  }
};

// ========== QUIZ (FASE 2) ==========

export const quizAPI = {
  // Obtener todas
  getAll: async () => {
    const response = await fetch(`${API_BASE_URL}/quiz`);
    return handleResponse(response);
  },

  // Crear
  create: async (datos) => {
    const response = await fetch(`${API_BASE_URL}/quiz`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(datos)
    });
    return handleResponse(response);
  }
};

// ========== PIZARRA TÁCTICA (FASE 2) ==========

export const pizarraAPI = {
  // Obtener de un partido
  getByPartido: async (partidoId) => {
    const response = await fetch(`${API_BASE_URL}/pizarra/partido/${partidoId}`);
    return handleResponse(response);
  },

  // Crear
  create: async (datos) => {
    const response = await fetch(`${API_BASE_URL}/pizarra`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(datos)
    });
    return handleResponse(response);
  }
};

// ========== MIGRACIÓN PAGOS (FASE 2) ==========

export const migracionPagosAPI = {
  // Obtener todos
  getAll: async () => {
    const response = await fetch(`${API_BASE_URL}/migracion-pagos`);
    return handleResponse(response);
  },

  // Crear
  create: async (datos) => {
    const response = await fetch(`${API_BASE_URL}/migracion-pagos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(datos)
    });
    return handleResponse(response);
  }
};

// ========== JUGADORES VISITA (FASE 2) ==========

export const jugadoresVisitaAPI = {
  // Obtener todos
  getAll: async () => {
    const response = await fetch(`${API_BASE_URL}/jugadores-visita`);
    return handleResponse(response);
  },

  // Crear
  create: async (datos) => {
    const response = await fetch(`${API_BASE_URL}/jugadores-visita`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(datos)
    });
    return handleResponse(response);
  },

  // Actualizar
  update: async (id, datos) => {
    const response = await fetch(`${API_BASE_URL}/jugadores-visita/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(datos)
    });
    return handleResponse(response);
  }
};

// ========== AUDITORIA (FASE 3) ==========

export const auditoriaAPI = {
  getAll: async () => {
    const response = await fetch(`${API_BASE_URL}/auditoria`);
    return handleResponse(response);
  }
};

// ========== STAFF (FASE 3) ==========

export const staffAPI = {
  getAll: async () => {
    const response = await fetch(`${API_BASE_URL}/staff`);
    return handleResponse(response);
  },
  create: async (datos) => {
    const response = await fetch(`${API_BASE_URL}/staff`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(datos)
    });
    return handleResponse(response);
  }
};

// ========== TORNEOS (FASE 3) ==========

export const torneosAPI = {
  getAll: async () => {
    const response = await fetch(`${API_BASE_URL}/torneos`);
    return handleResponse(response);
  },
  create: async (datos) => {
    const response = await fetch(`${API_BASE_URL}/torneos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(datos)
    });
    return handleResponse(response);
  }
};

// ========== CAJA EVENTO (FASE 3) ==========

export const cajaEventoAPI = {
  getByEvento: async (eventoId) => {
    const response = await fetch(`${API_BASE_URL}/caja-evento/${eventoId}`);
    return handleResponse(response);
  },
  create: async (datos) => {
    const response = await fetch(`${API_BASE_URL}/caja-evento`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(datos)
    });
    return handleResponse(response);
  }
};

// ========== INVENTARIO (FASE 3) ==========

export const inventarioAPI = {
  getAll: async () => {
    const response = await fetch(`${API_BASE_URL}/inventario`);
    return handleResponse(response);
  },
  create: async (datos) => {
    const response = await fetch(`${API_BASE_URL}/inventario`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(datos)
    });
    return handleResponse(response);
  }
};

// ========== EGRESOS (FASE 3) ==========

export const egresosAPI = {
  getAll: async () => {
    const response = await fetch(`${API_BASE_URL}/egresos`);
    return handleResponse(response);
  },
  create: async (datos) => {
    const response = await fetch(`${API_BASE_URL}/egresos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(datos)
    });
    return handleResponse(response);
  }
};

// ========== CLUBES (FASE 3) ==========

export const clubesAPI = {
  getAll: async () => {
    const response = await fetch(`${API_BASE_URL}/clubes`);
    return handleResponse(response);
  },
  create: async (datos) => {
    const response = await fetch(`${API_BASE_URL}/clubes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(datos)
    });
    return handleResponse(response);
  }
};

// ========== LESIONES (FASE 3) ==========

export const lesionesAPI = {
  getAll: async () => {
    const response = await fetch(`${API_BASE_URL}/lesiones`);
    return handleResponse(response);
  },
  create: async (datos) => {
    const response = await fetch(`${API_BASE_URL}/lesiones`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(datos)
    });
    return handleResponse(response);
  }
};

// ========== DISCIPLINA (FASE 3) ==========

export const disciplinaAPI = {
  getAll: async () => {
    const response = await fetch(`${API_BASE_URL}/disciplina`);
    return handleResponse(response);
  },
  create: async (datos) => {
    const response = await fetch(`${API_BASE_URL}/disciplina`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(datos)
    });
    return handleResponse(response);
  }
};

// ========== ENTRENAMIENTOS (FASE 3) ==========

export const entrenamientosAPI = {
  getAll: async () => {
    const response = await fetch(`${API_BASE_URL}/entrenamientos`);
    return handleResponse(response);
  },
  create: async (datos) => {
    const response = await fetch(`${API_BASE_URL}/entrenamientos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(datos)
    });
    return handleResponse(response);
  }
};

// ========== ENCUESTAS RESPUESTAS (FASE 3) ==========

export const encuestasRespuestasAPI = {
  getByEncuesta: async (encuestaId) => {
    const response = await fetch(`${API_BASE_URL}/encuestas/${encuestaId}/respuestas`);
    return handleResponse(response);
  },
  create: async (encuestaId, datos) => {
    const response = await fetch(`${API_BASE_URL}/encuestas/${encuestaId}/respuesta`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(datos)
    });
    return handleResponse(response);
  }
};

// ========== ASISTENCIA EVENTOS (FASE 3) ==========

export const asistenciaEventosAPI = {
  getByEvento: async (eventoId) => {
    const response = await fetch(`${API_BASE_URL}/asistencia-eventos/${eventoId}`);
    return handleResponse(response);
  },
  create: async (datos) => {
    const response = await fetch(`${API_BASE_URL}/asistencia-eventos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(datos)
    });
    return handleResponse(response);
  }
};
