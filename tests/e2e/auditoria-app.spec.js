// Auditoría de toda la app por rol (a ancho de celular): errores de consola y
// de JavaScript, llamadas a la API que fallan, desborde horizontal y
// accesibilidad WCAG 2.1 A/AA (axe-core, impacto serio o crítico).
// Uso: AUDITORIA=1 npx playwright test tests/e2e/auditoria-app.spec.js
// Deja el detalle en test-results/auditoria-app.json.
import fs from 'node:fs';
import { test, expect } from '@playwright/test';
import { CUENTAS, crearPool, crearDatosPrueba, limpiarDatosPrueba, iniciarSesion } from './fixtures/cuentasPrueba.js';

test.skip(!process.env.AUDITORIA, 'Auditoría completa: ejecutar con AUDITORIA=1');
const pool = process.env.AUDITORIA ? crearPool() : null;
const AXE = 'https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.10.0/axe.min.js';
const informe = [];

test.describe.configure({ mode: 'serial' });
test.setTimeout(300000);
test.use({ viewport: { width: 390, height: 844 } });
test.beforeAll(async () => { if (pool) await crearDatosPrueba(pool); });
test.afterAll(async () => {
  if (pool) { await limpiarDatosPrueba(pool); await pool.end(); }
  fs.mkdirSync('test-results', { recursive: true });
  fs.writeFileSync('test-results/auditoria-app.json', JSON.stringify(informe, null, 1));
});

const vigilar = (page) => {
  const problemas = { consola: [], js: [], red: [] };
  page.on('console', (m) => { if (m.type() === 'error') problemas.consola.push(m.text().slice(0, 200)); });
  page.on('pageerror', (e) => problemas.js.push(String(e.message).slice(0, 200)));
  page.on('response', (r) => {
    const url = r.url();
    if (url.includes('/api/') && r.status() >= 400 && r.status() !== 401) problemas.red.push(`${r.status()} ${r.request().method()} ${url.replace(/^https?:\/\/[^/]+/, '')}`);
  });
  return problemas;
};

const auditar = async (page, rol, pantalla, problemas) => {
  await page.waitForTimeout(900);
  const desborde = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  let axe = [];
  try {
    if (!(await page.evaluate(() => Boolean(window.axe)))) await page.addScriptTag({ url: AXE });
    axe = await page.evaluate(async () => {
      const r = await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] } });
      return r.violations
        .filter((v) => ['serious', 'critical'].includes(v.impact))
        .map((v) => ({ regla: v.id, impacto: v.impact, ayuda: v.help, nodos: v.nodes.length, ejemplo: v.nodes[0]?.target?.join(' ').slice(0, 120), detalle: v.nodes.slice(0, 4).map((n) => `${n.target.join(' ').slice(-60)} :: ${(n.any[0]?.message || n.failureSummary || '').slice(0, 160)}`) }));
    });
  } catch (e) { axe = [{ regla: 'axe-no-disponible', ayuda: e.message.slice(0, 120) }]; }
  informe.push({
    rol, pantalla, desborde: desborde > 1 ? desborde : 0,
    consola: [...new Set(problemas.consola)], js: [...new Set(problemas.js)], red: [...new Set(problemas.red)], axe,
  });
  problemas.consola.length = 0; problemas.js.length = 0; problemas.red.length = 0;
};

const recorrerNav = async (page, rol, problemas) => {
  const secciones = (await page.locator('.nav-item').allInnerTexts()).map((s) => s.trim()).filter(Boolean);
  for (const s of secciones) {
    await page.locator('.nav-item', { hasText: s }).first().click();
    await auditar(page, rol, `nav: ${s}`, problemas);
  }
};

test('super admin: menú, panel y secciones de gestión', async ({ page }) => {
  const problemas = vigilar(page);
  await iniciarSesion(page, CUENTAS.super_admin.rut);
  await auditar(page, 'super_admin', 'inicio', problemas);
  await recorrerNav(page, 'super_admin', problemas);
  await page.locator('.nav-item', { hasText: 'Panel' }).first().click();
  const destinos = await page.locator('.pn-item strong').allInnerTexts();
  for (const destino of destinos) {
    await page.locator('.nav-item', { hasText: 'Panel' }).first().click();
    await page.locator('.pn-item', { hasText: destino }).first().click();
    await auditar(page, 'super_admin', `panel: ${destino}`, problemas);
    if (destino === 'Tesorería') {
      for (const tab of ['Validar pagos', 'Resumen', 'Informes', 'Tarifas']) {
        await page.getByRole('tab', { name: new RegExp(tab) }).click();
        await auditar(page, 'super_admin', `tesorería: ${tab}`, problemas);
      }
    }
    if (destino === 'Usuarios y Cuentas') {
      for (const tab of ['Cuentas', 'Vincular apoderados', 'Registrar nuevo']) {
        await page.getByRole('button', { name: new RegExp(`^${tab}`) }).first().click();
        await auditar(page, 'super_admin', `usuarios: ${tab}`, problemas);
      }
    }
  }
  expect(informe.length).toBeGreaterThan(5);
});

for (const rol of ['apoderado', 'socio_apoderado', 'socio', 'staff', 'jugador']) {
  test(`${rol}: todas sus secciones`, async ({ page }) => {
    const problemas = vigilar(page);
    await iniciarSesion(page, CUENTAS[rol].rut);
    await auditar(page, rol, 'inicio', problemas);
    await recorrerNav(page, rol, problemas);
  });
}
