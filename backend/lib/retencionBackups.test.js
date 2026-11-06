import { describe, it, expect } from 'vitest';
const { clasificarBackupsPorRetencion } = require('./retencionBackups');

const AHORA = new Date('2026-11-06T12:00:00Z');
const DIA = 24 * 60 * 60 * 1000;
const politica = { diarios: 7, semanales: 8, mensuales: 12 };

// Historial parecido al real: 4 backups por día (cada 6 h) durante 150 días.
const historial = () => {
  const objetos = [];
  for (let d = 0; d < 150; d += 1) {
    for (let h = 0; h < 4; h += 1) {
      objetos.push({ Key: `ccf-db-backups/d${d}-h${h}.json`, LastModified: new Date(AHORA - d * DIA - h * 6 * 3600 * 1000), Size: 68 * 1048576 });
    }
  }
  return objetos;
};

describe('clasificarBackupsPorRetencion', () => {
  it('conserva todos los de los últimos 7 días', () => {
    const { conservar } = clasificarBackupsPorRetencion(historial(), politica, AHORA);
    const recientes = conservar.filter((o) => (AHORA - new Date(o.LastModified)) / DIA <= 7);
    expect(recientes.length).toBeGreaterThanOrEqual(28);
  });

  it('reduce cientos de copias a unas pocas decenas', () => {
    const objetos = historial();
    const { conservar, borrar } = clasificarBackupsPorRetencion(objetos, politica, AHORA);
    expect(objetos.length).toBe(600);
    expect(conservar.length).toBeLessThan(50);
    expect(conservar.length + borrar.length).toBe(600);
  });

  it('a lo más uno por semana entre el día 8 y la semana 8', () => {
    const { conservar } = clasificarBackupsPorRetencion(historial(), politica, AHORA);
    const semanales = conservar.filter((o) => {
      const dias = (AHORA - new Date(o.LastModified)) / DIA;
      return dias > 7 && dias <= 56;
    });
    expect(semanales.length).toBeLessThanOrEqual(8);
    expect(semanales.length).toBeGreaterThanOrEqual(6);
  });

  it('nunca borra el backup más reciente aunque la política sea 0', () => {
    const objetos = [{ Key: 'a', LastModified: new Date(AHORA - 400 * DIA), Size: 1 }];
    const { conservar } = clasificarBackupsPorRetencion(objetos, { diarios: 0, semanales: 0, mensuales: 0 }, AHORA);
    expect(conservar.map((o) => o.Key)).toEqual(['a']);
  });
});
