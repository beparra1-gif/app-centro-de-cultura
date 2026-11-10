// Muro: las familias ven lo que deben y "Subir comprobante de pago" las
// lleva a Mi Cuenta con los meses adeudados ya marcados.
import { test, expect } from '@playwright/test';
import { CUENTAS, crearPool, crearDatosPrueba, limpiarDatosPrueba, iniciarSesion } from './fixtures/cuentasPrueba.js';

const pool = crearPool();
test.describe.configure({ mode: 'serial' });
test.setTimeout(90000);
test.beforeAll(async () => { await crearDatosPrueba(pool); });
test.afterAll(async () => { await limpiarDatosPrueba(pool); await pool.end(); });

test('apoderado: el Muro muestra la deuda y lleva a pagar con los meses marcados', async ({ page }) => {
  await iniciarSesion(page, CUENTAS.apoderado.rut);
  const bloque = page.locator('.prm-card');
  await expect(bloque).toBeVisible();
  await expect(bloque.getByRole('heading')).toContainText(/Tienes \$[\d.]+ pendiente/);
  const total = (await bloque.getByRole('heading').textContent()).match(/\$[\d.]+/)[0];
  await bloque.getByRole('button', { name: 'Subir comprobante de pago' }).click();
  await expect(page.getByText('Panel de Pagos 2026')).toBeVisible({ timeout: 10000 });
  // La barra de pago aparece sola, con el mismo total que mostraba el Muro.
  await expect(page.locator('.barra-pago-fija')).toContainText(total);
});

test('socio y apoderado: también deja marcada la cuota de socio', async ({ page }) => {
  await iniciarSesion(page, CUENTAS.socio_apoderado.rut);
  const bloque = page.locator('.prm-card');
  await expect(bloque.locator('li', { hasText: 'Cuota de socio' })).toBeVisible();
  const total = (await bloque.getByRole('heading').textContent()).match(/\$[\d.]+/)[0];
  await bloque.getByRole('button', { name: 'Subir comprobante de pago' }).click();
  await expect(page.locator('.barra-pago-fija')).toContainText(total, { timeout: 10000 });
});

test('Mi Cuenta: descarga el certificado de pagos en PDF', async ({ page }) => {
  await iniciarSesion(page, CUENTAS.apoderado.rut);
  await page.locator('.nav-item', { hasText: 'Mi Cuenta' }).click();
  const [descarga] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: /Certificado de pagos/ }).click(),
  ]);
  expect(descarga.suggestedFilename()).toMatch(/^certificado-pagos-\d+[0-9kK]?-\d{4}-\d{2}-\d{2}\.pdf$/);
});
