// Capturas a ancho de celular de cada sección, por perfil (revisión de UX).
// Uso: CAPTURAS=1 npx playwright test tests/e2e/capturas-ux.spec.js
import { test, expect } from '@playwright/test';
import { CUENTAS, crearPool, crearDatosPrueba, limpiarDatosPrueba, iniciarSesion } from './fixtures/cuentasPrueba.js';

// Solo corre con CAPTURAS=1 (y CAPTURAS_DIR opcional): no es parte de la suite.
test.skip(!process.env.CAPTURAS, 'Capturas de revisión: ejecutar con CAPTURAS=1');
const pool = process.env.CAPTURAS ? crearPool() : null;
const OUT = process.env.CAPTURAS_DIR || 'test-results/capturas-ux';

test.describe.configure({ mode: 'serial' });
test.setTimeout(180000);
test.use({ viewport: { width: 390, height: 844 } });
test.beforeAll(async () => { if (pool) await crearDatosPrueba(pool); });
test.afterAll(async () => { if (pool) { await limpiarDatosPrueba(pool); await pool.end(); } });

const foto = async (page, nombre) => {
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${OUT}/${nombre}.png`, fullPage: true });
};
const nav = async (page, texto) => { await page.locator('.nav-item', { hasText: texto }).first().click(); };

test('super admin', async ({ page }) => {
  await iniciarSesion(page, CUENTAS.super_admin.rut);
  await foto(page, 'sa-01-inicio');
  const secciones = (await page.locator('.nav-item').allInnerTexts()).map((s) => s.trim()).filter(Boolean);
  console.log('NAV super_admin:', secciones.join(' | '));
  for (const tarjeta of ['Tesorería', 'Usuarios y Cuentas']) {
    await page.getByRole('button', { name: tarjeta }).first().click();
    await foto(page, `sa-tarjeta-${tarjeta.replace(/\s+/g, '-')}`);
    const volver = page.getByRole('button', { name: /Volver/ }).first();
    if (await volver.isVisible().catch(() => false)) await volver.click();
  }
  for (const s of secciones) {
    await nav(page, s);
    await foto(page, `sa-nav-${s.replace(/[^\w]+/g, '-')}`);
  }
});

test('apoderado', async ({ page }) => {
  await iniciarSesion(page, CUENTAS.apoderado.rut);
  const secciones = (await page.locator('.nav-item').allInnerTexts()).map((s) => s.trim()).filter(Boolean);
  console.log('NAV apoderado:', secciones.join(' | '));
  for (const s of secciones) {
    await nav(page, s);
    await foto(page, `ap-nav-${s.replace(/[^\w]+/g, '-')}`);
  }
});

test('staff', async ({ page }) => {
  await iniciarSesion(page, CUENTAS.staff.rut);
  const secciones = (await page.locator('.nav-item').allInnerTexts()).map((s) => s.trim()).filter(Boolean);
  console.log('NAV staff:', secciones.join(' | '));
  for (const s of secciones) {
    await nav(page, s);
    await foto(page, `st-nav-${s.replace(/[^\w]+/g, '-')}`);
  }
  expect(secciones.length).toBeGreaterThan(0);
});
