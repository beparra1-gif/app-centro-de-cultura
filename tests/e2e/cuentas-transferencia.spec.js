// Mi Cuenta muestra la cuenta para mensualidad de deportistas a quien tiene
// deportistas, y la de cuota de socio solo a quien es socio.
import { test, expect } from '@playwright/test';
import { CUENTAS, crearPool, crearDatosPrueba, limpiarDatosPrueba, iniciarSesion, abrirMiCuenta } from './fixtures/cuentasPrueba.js';

const pool = crearPool();
test.describe.configure({ mode: 'serial' });
test.setTimeout(90000);
test.beforeAll(async () => { await crearDatosPrueba(pool); });
test.afterAll(async () => { await limpiarDatosPrueba(pool); await pool.end(); });

const DEPORTISTAS = 'Cuenta para mensualidad de deportistas';
const SOCIOS = 'Cuenta para cuota de socio';

test('apoderado: solo la cuenta de deportistas, y se copia', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await iniciarSesion(page, CUENTAS.apoderado.rut);
  await abrirMiCuenta(page);
  const cuenta = page.getByRole('region', { name: DEPORTISTAS });
  await expect(cuenta).toContainText('23572143511');
  await expect(page.getByRole('region', { name: SOCIOS })).toHaveCount(0);
  await cuenta.getByRole('button', { name: 'Copiar datos de la cuenta' }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain('N° cuenta: 23572143511');
});

test('socio con deportista: ambas cuentas', async ({ page }) => {
  await iniciarSesion(page, CUENTAS.socio_apoderado.rut);
  await abrirMiCuenta(page);
  await expect(page.getByRole('region', { name: DEPORTISTAS })).toBeVisible();
  await expect(page.getByRole('region', { name: SOCIOS })).toContainText('23561739862');
  await page.getByRole('region', { name: SOCIOS }).screenshot({ path: 'test-results/cuenta-socios.png' });
  await page.getByRole('region', { name: DEPORTISTAS }).screenshot({ path: 'test-results/cuenta-deportistas.png' });
});
