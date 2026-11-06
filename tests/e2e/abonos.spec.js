// Abonos a la mensualidad: se suman por mes hasta completar la cuota, la
// grilla muestra cuánto falta, un abono completa los meses en orden y la
// deuda descuenta lo ya abonado.
import { test, expect } from '@playwright/test';
import { CUENTAS, JUGADORES, crearPool, crearDatosPrueba, limpiarDatosPrueba, iniciarSesion } from './fixtures/cuentasPrueba.js';

const pool = crearPool();
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');

test.describe.configure({ mode: 'serial' });
test.setTimeout(90000);
test.beforeAll(async () => {
  await crearDatosPrueba(pool);
  // Abono aprobado de $10.000 sobre la cuota de enero ($30.000).
  await pool.query(
    `INSERT INTO pagos_mensualidades (rut_jugador, rut_pagos, concepto_pago, cantidad_meses_pagados, meses_correspondientes, monto_total_pagado, estado_pago)
     VALUES ($1, $2, 'Mensualidad', 1, 'ene-2026', 10000, 'aprobado')`,
    [JUGADORES.pupilo.rut, CUENTAS.apoderado.rut]
  );
});
test.afterAll(async () => { await limpiarDatosPrueba(pool); await pool.end(); });

const grilla = (page) => page.locator('div.mb-15', { has: page.getByText(/Mensualidad Deportista/) });
const mes = (page, nombre) => grilla(page).locator('button.mes-box', { hasText: nombre });

const irAMiCuenta = async (page) => {
  await iniciarSesion(page, CUENTAS.apoderado.rut);
  await page.locator('.nav-item', { hasText: 'Mi Cuenta' }).click();
  await expect(page.getByText('Panel de Pagos 2026')).toBeVisible({ timeout: 10000 });
};

test('un abono parcial no completa el mes: muestra cuánto falta y descuenta la deuda', async ({ page }) => {
  await irAMiCuenta(page);
  await expect(mes(page, 'Ene')).toHaveClass(/mes-parcial/);
  await expect(mes(page, 'Ene')).toContainText('$20.000');
  // 10 meses (ene–oct) adeudados, pero enero solo debe $20.000: 9×30.000 + 20.000.
  await expect(page.getByText('10 meses adeudados')).toBeVisible();
  await expect(page.getByText('-$290.000')).toBeVisible();
  // Resumen del mes en curso.
  await expect(grilla(page).locator('.resumen-mes-actual')).toContainText(/abonado \$0 de \$30\.000/);
  await expect(grilla(page).locator('.resumen-mes-actual')).toContainText('Faltan $30.000');
});

test('un abono completa los meses en orden (primero el saldo de enero)', async ({ page }) => {
  await irAMiCuenta(page);
  await mes(page, 'Ene').click();
  await mes(page, 'Feb').click();
  // Pago completo de lo seleccionado = saldo de enero + febrero.
  await expect(page.locator('.barra-pago-fija')).toContainText('$50.000');
  await page.getByRole('button', { name: 'Abono Parcial', exact: true }).click();
  await page.getByPlaceholder('Ej: 15000').fill('40000');
  await page.locator('input[type="file"]').last().setInputFiles({ name: 'comprobante.png', mimeType: 'image/png', buffer: PNG });
  await expect(page.getByText(/ha recibido tu comprobante/i)).toBeVisible({ timeout: 15000 });

  const filas = (await pool.query(
    "SELECT meses_correspondientes, monto_total_pagado FROM pagos_mensualidades WHERE rut_jugador = $1 AND estado_pago = 'pendiente' ORDER BY id",
    [JUGADORES.pupilo.rut]
  )).rows.map((r) => [r.meses_correspondientes, Number(r.monto_total_pagado)]);
  expect(filas).toEqual([['ene-2026', 20000], ['feb-2026', 20000]]);
});

test('aprobado el abono: enero pagado y febrero con saldo de $10.000', async ({ page }) => {
  await pool.query("UPDATE pagos_mensualidades SET estado_pago = 'aprobado' WHERE rut_jugador = $1", [JUGADORES.pupilo.rut]);
  await irAMiCuenta(page);
  await expect(mes(page, 'Ene')).toHaveClass(/mes-pagado/);
  await expect(mes(page, 'Feb')).toHaveClass(/mes-parcial/);
  await expect(mes(page, 'Feb')).toContainText('$10.000');
  // Deuda: feb $10.000 + mar–oct 8×30.000.
  await expect(page.getByText('-$250.000')).toBeVisible();
});
