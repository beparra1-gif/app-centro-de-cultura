// src/api/client.js
// Cliente HTTP para conectar con el backend

const resolveApiBaseUrl = () => {
  const envUrl = String(import.meta.env.VITE_API_URL || '').trim();
  if (envUrl) return envUrl.replace(/\/$/, '');

  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    if (host === 'localhost' || host === '127.0.0.1') {
      return 'http://localhost:3000/api';
    }
  }

  return '/api';
};

const API_BASE_URL = resolveApiBaseUrl();
export const API_BASE_URL_CONFIG = API_BASE_URL;

const normalizarRut = (rut = '') => String(rut).replace(/\./g, '').replace(/-/g, '').trim().toUpperCase();

const construirHeadersActor = (actor = null) => {
  const headers = {};
  const id = actor?.id;
  const rol = String(actor?.rol || actor?.perfil_principal || '').trim().toLowerCase();
  const rut = normalizarRut(actor?.rut || '');

  if (id != null && String(id).trim() !== '') {
    headers['x-user-id'] = String(id).trim();
  }
  if (rol) {
    headers['x-user-role'] = rol;
  }
  if (rut) {
    headers['x-user-rut'] = rut;
  }

  return headers;
};

// Funciones auxiliares
const handleResponse = async (response) => {
  if (!response.ok) {
    let message = 'Error en la solicitud';
    try {
      const error = await response.json();
      message = error.error || error.message || message;
    } catch {
      message = `Error ${response.status}: ${response.statusText || 'Respuesta no válida'}`;
    }
    throw new Error(message);
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

// ========== AUTH ==========

export const authAPI = {
  login: async (rut, password) => {
    const payload = { rut, password };
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (response.ok) {
      return response.json();
    }

    // Fallback for production schema drifts: if player login with 12345 fails, create minimal account and retry once.
    if (response.status === 401 && String(password || '') === '12345') {
      try {
        const jugadoresResponse = await fetch(`${API_BASE_URL}/jugadores`);
        if (!jugadoresResponse.ok) {
          return handleResponse(response);
        }

        const jugadores = await jugadoresResponse.json();
        const rutBuscado = normalizarRut(rut);
        const jugador = Array.isArray(jugadores)
          ? jugadores.find((item) => normalizarRut(item?.rut_jugador) === rutBuscado)
          : null;

        if (!jugador || String(jugador.estado || 'ACTIVO').toUpperCase() === 'BAJA') {
          return handleResponse(response);
        }

        const createPayload = {
          correo: `${rutBuscado.toLowerCase() || 'sin-rut'}@actualizar.local`,
          rut,
          password: '12345',
          nombres: jugador.nombres || null,
          apellido_paterno: jugador.apellido_paterno || null,
          rol: 'jugador',
          perfil_principal: 'jugador',
          estado: 'activo',
          forzar_clave: true,
          requiere_foto_perfil: false,
        };

        const createResponse = await fetch(`${API_BASE_URL}/cuentas`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(createPayload)
        });

        if (!createResponse.ok && createResponse.status !== 409) {
          return handleResponse(response);
        }

        const retryResponse = await fetch(`${API_BASE_URL}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        return handleResponse(retryResponse);
      } catch {
        return handleResponse(response);
      }
    }

    return handleResponse(response);
  },

  changePassword: async ({ rut, currentPassword, newPassword }) => {
    const response = await fetch(`${API_BASE_URL}/auth/change-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rut, currentPassword, newPassword })
    });
    return handleResponse(response);
  }
};

// ========== CUENTAS ==========

export const cuentasAPI = {
  // Obtener todas
  getAll: async () => {
    const response = await fetch(`${API_BASE_URL}/cuentas`);
    return handleResponse(response);
  },

  // Obtener incompletas
  getIncompletas: async () => {
    const response = await fetch(`${API_BASE_URL}/cuentas/incompletas`);
    return handleResponse(response);
  },

  // Obtener por ID
  getById: async (id) => {
    const response = await fetch(`${API_BASE_URL}/cuentas/${id}`);
    return handleResponse(response);
  },

  // Crear
  create: async (data) => {
    const payload = { ...data };
    if (Object.prototype.hasOwnProperty.call(payload, 'logo_url')) {
      delete payload.logo_url;
    }
    const response = await fetch(`${API_BASE_URL}/cuentas`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    return handleResponse(response);
  },

  // Actualizar
  update: async (id, data) => {
    const payload = { ...data };
    if (Object.prototype.hasOwnProperty.call(payload, 'logo_url')) {
      delete payload.logo_url;
    }
    const response = await fetch(`${API_BASE_URL}/cuentas/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    return handleResponse(response);
  },

  // Eliminar definitivamente (solo super admin)
  delete: async (id, actor = null) => {
    const response = await fetch(`${API_BASE_URL}/cuentas/${id}`, {
      method: 'DELETE',
      headers: {
        ...construirHeadersActor(actor),
      },
    });
    return handleResponse(response);
  }
};

// Utilitario de validación RUT chileno para formularios del frontend
export const validarRutChileno = (rut = '') => {
  const limpio = String(rut).replace(/\./g, '').replace(/-/g, '').trim().toUpperCase();
  if (!/^\d{7,8}[0-9K]$/.test(limpio)) return false;

  const cuerpo = limpio.slice(0, -1);
  const dv = limpio.slice(-1);

  let suma = 0;
  let multiplo = 2;
  for (let i = cuerpo.length - 1; i >= 0; i -= 1) {
    suma += Number(cuerpo[i]) * multiplo;
    multiplo = multiplo === 7 ? 2 : multiplo + 1;
  }

  const resto = 11 - (suma % 11);
  const esperado = resto === 11 ? '0' : resto === 10 ? 'K' : String(resto);
  return dv === esperado;
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

export const adminAPI = {
  getSyncStatus: async (token) => {
    const response = await fetch(`${API_BASE_URL}/admin/sync-sheets/status`, {
      headers: {
        'x-sync-token': token,
      },
    });
    return handleResponse(response);
  },

  getOpsStatus: async (token) => {
    const response = await fetch(`${API_BASE_URL}/admin/ops-status`, {
      headers: {
        'x-sync-token': token,
      },
    });
    return handleResponse(response);
  },

  getBackupStatus: async (token) => {
    const response = await fetch(`${API_BASE_URL}/admin/backup-status`, {
      headers: {
        'x-sync-token': token,
      },
    });
    return handleResponse(response);
  },

  runBackupNow: async (token) => {
    const response = await fetch(`${API_BASE_URL}/admin/backup-run`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-sync-token': token,
      },
    });
    return handleResponse(response);
  },

  syncSheets: async (token) => {
    const response = await fetch(`${API_BASE_URL}/admin/sync-sheets`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-sync-token': token,
      },
    });
    return handleResponse(response);
  },

  getDataQualityDetails: async (token) => {
    const response = await fetch(`${API_BASE_URL}/admin/data-quality/details`, {
      headers: {
        'x-sync-token': token,
      },
    });
    return handleResponse(response);
  },

  getJugadoresRutConflicts: async (token) => {
    const response = await fetch(`${API_BASE_URL}/admin/jugadores-rut-conflicts`, {
      headers: {
        'x-sync-token': token,
      },
    });
    return handleResponse(response);
  },

  resolveJugadoresRutConflict: async (token, payload) => {
    const response = await fetch(`${API_BASE_URL}/admin/jugadores-rut-conflicts/resolve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-sync-token': token,
      },
      body: JSON.stringify(payload),
    });
    return handleResponse(response);
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
  },

  // Actualizar por RUT
  update: async (rut, datos) => {
    const response = await fetch(`${API_BASE_URL}/jugadores/${rut}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(datos)
    });
    return handleResponse(response);
  },

  // Eliminar definitivamente (solo super admin)
  delete: async (rut, actor = null) => {
    const response = await fetch(`${API_BASE_URL}/jugadores/${rut}`, {
      method: 'DELETE',
      headers: {
        ...construirHeadersActor(actor),
      },
    });
    return handleResponse(response);
  },
};

// ========== PAGOS MENSUALIDADES (FASE 1) ==========

export const pagosMensualidadesAPI = {
  // Obtener todos
  getAll: async () => {
    const response = await fetch(`${API_BASE_URL}/pagos-mensualidades`);
    return handleResponse(response);
  },

  // Obtener por ID
  getById: async (id) => {
    const response = await fetch(`${API_BASE_URL}/pagos-mensualidades/${id}`);
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

  // Actualizar
  update: async (id, datos) => {
    const response = await fetch(`${API_BASE_URL}/pagos-mensualidades/${id}`, {
      method: 'PUT',
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
  },

  // Actualizar partido completo
  update: async (id, datos) => {
    const response = await fetch(`${API_BASE_URL}/partidos-live/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(datos)
    });
    return handleResponse(response);
  },

  // Borrar
  delete: async (id) => {
    const response = await fetch(`${API_BASE_URL}/partidos-live/${id}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' }
    });
    return handleResponse(response);
  },

  // Historial mesa con filtros
  getMesaHistorial: async (filtros = {}) => {
    const params = new URLSearchParams();
    Object.entries(filtros || {}).forEach(([k, v]) => {
      if (v == null) return;
      const text = String(v).trim();
      if (!text) return;
      params.set(k, text);
    });
    const suffix = params.toString() ? `?${params.toString()}` : '';
    const response = await fetch(`${API_BASE_URL}/partidos-live/historial${suffix}`);
    return handleResponse(response);
  },

  // Finalizar partido con payload completo de mesa
  finalizarMesa: async (id, datos) => {
    const response = await fetch(`${API_BASE_URL}/partidos-live/${id}/finalizar-mesa`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(datos),
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

// ========== ACTIVOS VISUALES ==========

export const assetsAPI = {
  uploadLogo: async (formData, { onProgress } = {}) => {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${API_BASE_URL}/logo-assets`);

      if (typeof onProgress === 'function') {
        xhr.upload.onprogress = (event) => {
          if (!event.lengthComputable) return;
          const porcentaje = Math.round((event.loaded / event.total) * 100);
          onProgress(Math.max(0, Math.min(100, porcentaje)));
        };
      }

      xhr.onload = () => {
        let payload = null;
        try {
          payload = xhr.responseText ? JSON.parse(xhr.responseText) : null;
        } catch {
          payload = null;
        }

        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(payload || {});
          return;
        }

        const errorMsg = payload?.error || payload?.message || `Error ${xhr.status}: ${xhr.statusText || 'Respuesta no válida'}`;
        reject(new Error(errorMsg));
      };

      xhr.onerror = () => reject(new Error('Error de red al subir el logo.'));
      xhr.onabort = () => reject(new Error('La subida del logo fue cancelada.'));
      xhr.send(formData);
    });
  },

  listLogos: async () => {
    const response = await fetch(`${API_BASE_URL}/logo-assets/list`);
    return handleResponse(response);
  },

  deleteLogo: async (filename) => {
    const safeFilename = encodeURIComponent(String(filename || '').trim());
    const response = await fetch(`${API_BASE_URL}/logo-assets/${safeFilename}`, {
      method: 'DELETE',
    });
    return handleResponse(response);
  },
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
