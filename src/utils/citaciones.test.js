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

  it('incluye lugar con enlace de mapa y el mensaje del responsable', () => {
    const texto = mensajeWhatsappCitacion({ ...cita, lugar_nombre: 'Gimnasio Polideportivo', lugar_direccion: 'Av. Libertad 123, Viña del Mar', mensaje_adicional: 'Llevar camiseta blanca' }, { nombre: 'Ana', token_respuesta: 't' });
    expect(texto).toContain('📍 Gimnasio Polideportivo, Av. Libertad 123, Viña del Mar');
    expect(texto).toContain('https://www.google.com/maps/search/?api=1&query=Gimnasio%20Polideportivo');
    expect(texto).toContain('📝 Llevar camiseta blanca');
  });

  it('arma el WhatsApp personal con el enlace y el plazo', () => {
    const texto = mensajeWhatsappCitacion(cita, { nombre: 'Ana Pérez', apoderado_nombre: 'María José Soto', token_respuesta: 'abc123' });
    expect(texto).toContain('Hola María!');
    expect(texto).toContain('Ana Pérez fue *citada/o* a Liga ARBAM vs Club X');
    expect(texto).toContain('sábado 28 de noviembre · Citación (llegada) 08:30 · Partido 09:00');
    expect(texto).toContain('/?citacion=abc123');
    expect(texto).toContain('Plazo para responder: viernes 27 de noviembre a las 22:00');
    const banca = mensajeWhatsappCitacion(cita, { nombre: 'Bea', rol_convocatoria: 'banca', token_respuesta: 't' });
    expect(banca).toContain('*banca (reserva)*');
    expect(banca).not.toContain('Plazo');
  });

  it('el mensaje de grupo lista titulares y banca sin enlaces personales', () => {
    const texto = mensajeGrupoCitacion({ ...cita, convocados: [{ nombre: 'Ana', token_respuesta: 'x1' }, { nombre: 'Bea', rol_convocatoria: 'banca', token_respuesta: 'x2' }] });
    expect(texto).toContain('1. Ana');
    expect(texto).toContain('*En banca (reserva):*\n• Bea');
    expect(texto).not.toContain('x1');
  });
});
