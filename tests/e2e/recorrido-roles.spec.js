// Recorrido por tipo de usuario: login real por la UI con una cuenta de
// prueba por rol, visita cada sección del menú inferior y registra tiempos,
// errores de consola/página y peticiones fallidas. Requiere backend :3000 y
// frontend :5173 arriba contra la BD LOCAL (ver fixtures/cuentasPrueba.js).
import fs from 'node:fs';
import path from 'node:path';
import { test, expect } from '@playwright/test';
import { CUENTAS, crearPool, crearDatosPrueba, limpiarDatosPrueba, iniciarSesion } from './fixtures/cuentasPrueba.js';

const pool = crearPool();
const resumen = [];

test.beforeAll(async () => { await crearDatosPrueba(pool); });
test.afterAll(async () => {
  await limpiarDatosPrueba(pool);
  await pool.end();
  const salida = path.join('test-results', 'recorrido-roles.json');
  fs.mkdirSync(path.dirname(salida), { recursive: true });
  fs.writeFileSync(salida, JSON.stringify(resumen, null, 2));
});

// Respuestas 403 esperadas: la app pide al arrancar recursos que el rol no
// tiene (cargarDatos usa Promise.allSettled); no son errores de UX.
const ES_403_ESPERADO = (status) => status === 403;


for (const [rol, cuenta] of Object.entries(CUENTAS)) {
  test(`recorrido ${rol}`, async ({ page }, testInfo) => {
    const errores = [];
    const fallidas = [];
    const lentas = [];
    page.on('console', (m) => { if (m.type() === 'error') errores.push(m.text().slice(0, 200)); });
    page.on('pageerror', (e) => errores.push(`pageerror: ${e.message.slice(0, 200)}`));
    page.on('requestfinished', async (req) => {
      const t = req.timing();
      const ms = Math.round(t.responseEnd);
      if (req.url().includes('/api/') && ms > 800) lentas.push(`${req.method()} ${new URL(req.url()).pathname} ${ms}ms`);
      const res = await req.response();
      if (res && res.status() >= 400 && !ES_403_ESPERADO(res.status())) {
        fallidas.push(`${req.method()} ${new URL(req.url()).pathname} → ${res.status()}`);
      }
    });

    const msLogin = await iniciarSesion(page, cuenta.rut);
    await page.waitForTimeout(1500);
    const secciones = (await page.locator('.nav-item').allInnerTexts()).map((s) => s.trim()).filter(Boolean);
    const tiempos = {};
    for (const nombre of secciones) {
      const t0 = Date.now();
      await page.locator('.nav-item', { hasText: nombre }).first().click();
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(1200);
      tiempos[nombre] = Date.now() - t0 - 1200;
      await page.screenshot({ path: testInfo.outputPath(`${rol}-${nombre.replace(/\W+/g, '_')}.png`) });
    }

    const r = { rol, msLogin, secciones, tiempos, errores: [...new Set(errores)], fallidas: [...new Set(fallidas)], lentas };
    resumen.push(r);
    console.log(JSON.stringify(r));
    expect(r.errores.filter((e) => e.startsWith('pageerror')), 'errores de JavaScript en la página').toEqual([]);
  });
}
