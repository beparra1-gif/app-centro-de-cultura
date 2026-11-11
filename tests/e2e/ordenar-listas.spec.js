// "Ordenar por" en Informes de deuda, Tesorería y Usuarios y Cuentas.
import { test, expect } from '@playwright/test';
import { CUENTAS, crearPool, crearDatosPrueba, limpiarDatosPrueba, iniciarSesion } from './fixtures/cuentasPrueba.js';

const pool = crearPool();
test.describe.configure({ mode: 'serial' });
test.setTimeout(90000);
test.beforeAll(async () => { await crearDatosPrueba(pool); });
test.afterAll(async () => { await limpiarDatosPrueba(pool); await pool.end(); });

// Pupilo 2013, HijoSocio 2011, Jugador 2009 (fixtures).
const nombresEn = async (locator) => (await locator.allTextContents()).map((t) => t.trim());

test('informe de deportistas: por edad sin agrupar, y se puede invertir', async ({ page }) => {
  await iniciarSesion(page, CUENTAS.super_admin.rut);
  await page.getByRole('button', { name: 'Tesorería' }).first().click();
  await page.getByRole('tab', { name: /Informes/ }).click();
  await page.getByLabel('Estado').selectOption('todos');
  await page.getByLabel('Buscar en el informe').fill('e2e');
  await page.getByLabel('Ordenar por').selectOption('edad');
  await page.getByLabel('Agrupar por categoría').uncheck();
  const tabla = page.locator('.id-tabla');
  await expect(tabla.locator('.id-grupo')).toHaveCount(0);
  const filas = tabla.locator('tbody th.id-nombre');
  let orden = await nombresEn(filas);
  expect(orden[0]).toMatch(/E2E Pupilo/);
  expect(orden[orden.length - 1]).toMatch(/E2E Jugador/);
  await expect(page.locator('.id-cabecera p')).toContainText('Orden: Edad (Menor edad primero)');

  await page.getByRole('button', { name: /Invertir orden/ }).click();
  orden = await nombresEn(filas);
  expect(orden[0]).toMatch(/E2E Jugador/);
});

test('Usuarios y Cuentas: deportistas por fecha de nacimiento', async ({ page }) => {
  await iniciarSesion(page, CUENTAS.super_admin.rut);
  await page.getByRole('button', { name: 'Usuarios y Cuentas' }).first().click();
  await page.getByPlaceholder('Nombre, RUT, rama o categoría').fill('E2E');
  await page.getByLabel('Ordenar por').selectOption('nacimiento');
  const nombres = await nombresEn(page.locator('.fp-nombre-link'));
  expect(nombres[0]).toMatch(/E2E Jugador/);
  expect(nombres[nombres.length - 1]).toMatch(/E2E Pupilo/);
});

test('Tesorería Por cobrar: ordenar por apellido A→Z', async ({ page }) => {
  await iniciarSesion(page, CUENTAS.super_admin.rut);
  await page.getByRole('button', { name: 'Tesorería' }).first().click();
  await page.getByLabel('Buscar en Tesorería').fill('e2e');
  await page.getByRole('button', { name: 'Todas', exact: true }).click();
  await page.getByLabel('Ordenar por').selectOption('apellido');
  await expect(page.getByRole('button', { name: /Invertir orden \(ahora: A → Z\)/ })).toBeVisible();
  await expect(page.locator('article.tc-fila').first()).toBeVisible();
});
