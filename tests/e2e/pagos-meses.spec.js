// Flujo de pago de mensualidades de punta a punta (BD LOCAL):
// 1) el apoderado ve la deuda de su pupilo, marca Ene+Feb y envía un
//    comprobante (imagen) — se suben como archivo y crean 2 pagos pendientes;
// 2) el admin los ve en Tesorería → "Comprobantes enviados" y los aprueba;
// 3) el apoderado vuelve a entrar y ve Ene/Feb como pagados y la deuda baja.
import { test, expect } from '@playwright/test';
import { CUENTAS, JUGADORES, crearPool, crearDatosPrueba, limpiarDatosPrueba, iniciarSesion } from './fixtures/cuentasPrueba.js';

const pool = crearPool();
// PNG 1x1 válido.
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');

test.describe.configure({ mode: 'serial' });
test.setTimeout(90000);
test.beforeAll(async () => { await crearDatosPrueba(pool); });
test.afterAll(async () => { await limpiarDatosPrueba(pool); await pool.end(); });

const pagosDelPupilo = async () => (await pool.query(
  'SELECT id, meses_correspondientes, monto_total_pagado, estado_pago, comprobante_url, rut_pagos FROM pagos_mensualidades WHERE rut_jugador = $1 ORDER BY id',
  [JUGADORES.pupilo.rut]
)).rows;

const grillaPupilo = (page) => page.locator('.grid-12-meses, .lista-12-meses').last();

test('apoderado informa pago de Ene+Feb con comprobante', async ({ page }, testInfo) => {
  await iniciarSesion(page, CUENTAS.apoderado.rut);
  await page.locator('.nav-item', { hasText: 'Mi Cuenta' }).click();
  await expect(page.getByText('10 meses adeudados')).toBeVisible({ timeout: 10000 });

  const grilla = grillaPupilo(page);
  await grilla.locator('button.mes-box', { hasText: 'Ene' }).click();
  await grilla.locator('button.mes-box', { hasText: 'Feb' }).click();
  await expect(page.getByText('Total a Pagar:')).toBeVisible();
  // Barra fija de pago con el resumen de lo elegido.
  const barra = page.locator('.barra-pago-fija');
  await expect(barra).toBeVisible();
  await expect(barra).toContainText('2 meses');
  await expect(barra).toContainText('$60.000');
  // Marca del mes actual (una sola por grilla).
  await expect(grilla.locator('.mes-box.mes-actual')).toHaveCount(1);
  await page.screenshot({ path: testInfo.outputPath('1-seleccion.png'), fullPage: true });

  await page.locator('input[type="file"]').last().setInputFiles({ name: 'comprobante.png', mimeType: 'image/png', buffer: PNG });
  await expect(page.getByText(/ha recibido tu comprobante/i)).toBeVisible({ timeout: 15000 });

  const pagos = await pagosDelPupilo();
  expect(pagos.map((p) => p.meses_correspondientes)).toEqual(['ene-2026', 'feb-2026']);
  expect(pagos.every((p) => p.estado_pago === 'pendiente')).toBe(true);
  expect(pagos.every((p) => Number(p.monto_total_pagado) === 30000)).toBe(true);
  // Comprobante como archivo con nombre aleatorio, no base64.
  expect(pagos[0].comprobante_url).toMatch(/^\/api\/logo-assets\/file\/comprobante-/);
  expect(pagos[0].comprobante_url).not.toMatch(/^data:/);

  // Al recargar, los meses informados deben distinguirse de los impagos.
  await page.reload();
  await page.locator('.nav-item', { hasText: 'Mi Cuenta' }).click();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: testInfo.outputPath('2-tras-envio.png'), fullPage: true });
  const ene = grillaPupilo(page).locator('button.mes-box', { hasText: 'Ene' });
  await expect(ene).toHaveClass(/mes-en-revision/);
});

test('admin aprueba los comprobantes en Tesorería', async ({ page }, testInfo) => {
  await iniciarSesion(page, CUENTAS.admin.rut);
  await page.locator('.nav-item', { hasText: 'Admin' }).click();
  await page.getByText('Tesorería', { exact: true }).first().click();
  await expect(page.getByText(/Comprobantes enviados \(\d+\)/)).toBeVisible({ timeout: 10000 });

  for (let i = 0; i < 2; i++) {
    const tarjeta = page.locator('.card', { hasText: 'E2E Pupilo' }).first();
    await expect(tarjeta).toBeVisible({ timeout: 10000 });
    await tarjeta.getByRole('button', { name: /Aprobar/ }).click();
    await page.waitForTimeout(1200);
  }
  await page.screenshot({ path: testInfo.outputPath('3-admin-aprobado.png'), fullPage: true });
  const pagos = await pagosDelPupilo();
  expect(pagos.map((p) => p.estado_pago)).toEqual(['aprobado', 'aprobado']);
});

test('apoderado ve Ene/Feb pagados y deuda de 8 meses', async ({ page }, testInfo) => {
  await iniciarSesion(page, CUENTAS.apoderado.rut);
  await page.locator('.nav-item', { hasText: 'Mi Cuenta' }).click();
  await expect(page.getByText('8 meses adeudados')).toBeVisible({ timeout: 10000 });
  await expect(page.getByText('-$240.000')).toBeVisible();
  const grilla = grillaPupilo(page);
  await expect(grilla.locator('button.mes-box', { hasText: 'Ene' })).toHaveClass(/mes-pagado/);
  await expect(grilla.locator('button.mes-box', { hasText: 'Feb' })).toHaveClass(/mes-pagado/);
  await expect(grilla.locator('button.mes-box', { hasText: 'Mar' })).toHaveClass(/mes-pendiente/);
  await page.screenshot({ path: testInfo.outputPath('4-apoderado-pagado.png'), fullPage: true });
});

// Regla de inicio de cobro: el resumen de deuda ("N meses adeudados") y la
// grilla de meses deben contar EXACTAMENTE los mismos meses cobrables. Con
// ingreso a mitad de año antes no coincidían (el resumen cobraba el mes de
// ingreso y la grilla lo bloqueaba como "pre-ingreso"): la familia quedaba
// morosa de un mes que no podía pagar.
test('resumen de deuda y grilla cuentan los mismos meses (ingreso en marzo)', async ({ page }) => {
  await pool.query("UPDATE jugadores SET fecha_ingreso = '2026-03-01' WHERE rut_jugador = $1", [JUGADORES.pupilo.rut]);
  await pool.query('DELETE FROM pagos_mensualidades WHERE rut_jugador = $1', [JUGADORES.pupilo.rut]);
  await iniciarSesion(page, CUENTAS.apoderado.rut);
  await page.locator('.nav-item', { hasText: 'Mi Cuenta' }).click();
  const texto = await page.getByText(/\d+ mes(es)? adeudados?/).first().innerText({ timeout: 10000 });
  const mesesResumen = Number(texto.match(/\d+/)[0]);
  const mesesGrilla = await grillaPupilo(page).locator('button.mes-box.mes-pendiente').count();
  expect(mesesGrilla, `grilla=${mesesGrilla} vs resumen=${mesesResumen}`).toBe(mesesResumen);
  // Regla del club: se cobra DESDE el mes de ingreso (marzo..octubre = 8).
  expect(mesesResumen).toBe(8);
  const grilla = grillaPupilo(page);
  await expect(grilla.locator('button.mes-box', { hasText: 'Mar' })).toHaveClass(/mes-pendiente/);
  await expect(grilla.locator('button.mes-box', { hasText: 'Feb' })).toHaveClass(/mes-futuro-preingreso/);
});
