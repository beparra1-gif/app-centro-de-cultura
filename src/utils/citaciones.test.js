import { describe, it, expect } from 'vitest';
import { calcularResumenCitacion, puedeJugadorResponderPropiaCitacion, mensajeWhatsappCitacion, mensajeGrupoCitacion } from './citaciones';

const cita = {
  tipo_competencia: 'Liga', competencia_nombre: 'ARBAM', rival_nombre: 'Club X',
  dia_citacion: '2026-11-28', hora_citacion: '09:00:00', hora_presentacion: '08:30:00', hora_maxima_confirmacion: '2026-11-27T22:00',
};

describe('citaciones', () => {
  it('calcula el % de aceptadas sobre los titulares y deja la banca aparte', () => {
    const r = calcularResumenCitacion([
      { respuesta: 'si' }, { respuesta: 'si' }, { respuesta: 'no', justificacion: 'enferma' },
      { respuesta: 'pendiente' },
      { respuesta: 'pendiente', rol_convocatoria: 'banca' }, { respuesta: 'no', rol_convocatoria: 'banca' },
    ]);
    expect(r).toMatchObject({ total: 4, confirmados: 2, justificados: 1, pendientes: 1, progreso: 75, aceptadas: 50, banca: 2, bancaDisponible: 1 });
  });

  it('solo el deportista autogestionado responde su propia citación', () => {
    expect(puedeJugadorResponderPropiaCitacion({ autogestionado: true })).toBe(true);
    expect(puedeJugadorResponderPropiaCitacion({ fecha_nacimiento: '2000-01-01' })).toBe(false);
  });

  it('arma el mensaje del grupo en el formato del club, con un solo enlace y sin mapa', () => {
    const texto = mensajeGrupoCitacion({
      ...cita, categoria_base: 'SUB-15', rama: 'femenina', competencia_nombre: 'Asoc valpo', lugar_nombre: 'Gimnasio Los leones',
      lugar_direccion: 'Av. X 1', hora_citacion: '16:00:00', hora_presentacion: '15:00:00', dia_citacion: '2026-11-21', token_publico: 'tok123',
      convocados: [{ nombre: 'Magdalena Morales', token_respuesta: 'x1' }, { nombre: 'Byana Galvez' }, { nombre: 'Bea', rol_convocatoria: 'banca' }],
    });
    expect(texto).toBe([
      '⚪️🔵 CITACIÓN OFICIAL U-15 ⚪️🔵',
      '',
      '🏆 Competencia: Asoc valpo',
      '📅 Día: Sábado 21',
      '📍 Lugar: Gimnasio Los leones',
      '⏰ Hora : 16:00',
      '🕙 Hora de llegada: 15:00',
      '',
      '👥 JUGADORAS CITADAS',
      '',
      '• Magdalena Morales',
      '• Byana Galvez',
      '',
      '🔁 EN BANCA (reserva)',
      '',
      '• Bea',
      '',
      'Acá enlace para confirmar citación',
      'http://localhost:3000/?partido=tok123',
    ].join('\n'));
    expect(texto).not.toContain('maps');
    expect(texto).not.toContain('x1');
  });

  it('el recordatorio personal usa el mismo enlace único', () => {
    const texto = mensajeWhatsappCitacion({ ...cita, token_publico: 'tok123' }, { nombre: 'Ana', apoderado_nombre: 'María José', token_respuesta: 'personal' });
    expect(texto).toContain('Hola María, Ana está citada/o.');
    expect(texto).toContain('/?partido=tok123');
    expect(texto).not.toContain('personal');
  });
});
