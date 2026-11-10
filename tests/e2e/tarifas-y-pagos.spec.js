// Tarifas con historial (subió de $25.000 a $30.000 en septiembre), pago
// manual por "monto pagado" repartido en orden, y borrar un pago desde la
// ficha (solo admin/super admin).
import { test, expect } from '@playwright/test';
import { CUENTAS, JUGADORES, crearPool, crearDatosPrueba, limpiarDatosPrueba, iniciarSesion } from './fixtures/cuentasPrueba.js';

const pool = crearPool();
test.describe.configure({ mode: 'serial' });
test.setTimeout(90000);
test.beforeAll(async () => {
  await crearDatosPrueba(pool);
  // Marzo pagado con la tarifa de entonces ($25.000).
  await pool.query(
    `INSERT INTO pagos_mensualidades (rut_jugador, rut_pagos, concepto_pago, cantidad_meses_pagados, meses_correspondientes, monto_total_pagado, estado_pago)
     VALUES ($1, $2, 'Mensualidad', 1, 'marzo-2026', 25000, 'aprobado')`,
    [JUGADORES.pupilo.rut, CUENTAS.apoderado.rut]
  );
});
test.afterAll(async () => {
  await pool.query("DELETE FROM configuracion_sistema WHERE clave = 'tarifas_mensualidad'").catch(() => {});
  await limpiarDatosPrueba(pool);
  await pool.end();
});

const irATesoreria = async (page) => {
  await iniciarSesion(page, CUENTAS.super_admin.rut);
  await page.getByRole('button', { name: 'Tesorería' }).first().click();
};
const lineaPupilo = (page) => page.locator('article.tc-fila', { hasText: 'E2E Apoderado' }).locator('.tc-linea', { hasText: 'E2E Pupilo' });

test('Tarifas: $25.000 hasta agosto y $30.000 desde septiembre; marzo pagado con $25.000 queda pagado', async ({ page }) => {
  await irATesoreria(page);
  await page.getByRole('tab', { name: /Tarifas/ }).click();
  const primera = page.locator('.tf-fila').first();
  await primera.getByLabel('Un pupilo').fill('25000');
  await primera.getByLabel('Hermanos (c/u)').fill('20000');
  await page.getByRole('button', { name: /Nueva tarifa desde un mes/ }).click();
  const segunda = page.locator('.tf-fila').nth(1);
  await segunda.getByLabel(/Mes de inicio de la tarifa 2/).fill('2026-09');
  await segunda.getByLabel('Un pupilo').fill('30000');
  await segunda.getByLabel('Hermanos (c/u)').fill('25000');
  await page.getByRole('button', { name: /Guardar tarifas/ }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Guardar' }).click();
  await expect(page.getByText('Tarifas guardadas. La deuda se recalculó.')).toBeVisible({ timeout: 10000 });

  const { rows: [conf] } = await pool.query("SELECT valor FROM configuracion_sistema WHERE clave = 'tarifas_mensualidad'");
  expect(conf.valor.historial.map((t) => [t.desde, t.uno])).toEqual([['2026-01', 25000], ['2026-09', 30000]]);

  await page.getByRole('tab', { name: /Por cobrar/ }).click();
  await page.getByLabel('Buscar en Tesorería').fill('E2E Pupilo');
  const linea = lineaPupilo(page);
  await expect(linea).toBeVisible({ timeout: 20000 });
  // Ene, Feb, Abr–Ago a $25.000 (7) + Sep, Oct a $30.000 = $235.000; marzo no aparece.
  await expect(linea.locator('.tc-estado')).toHaveText('$235.000');
  await expect(linea.locator('.tc-meses')).not.toContainText('Mar');
});

test('Registrar monto pagado: $40.000 completa abril y abona $15.000 a mayo', async ({ page }) => {
  await irATesoreria(page);
  await page.getByLabel('Buscar en Tesorería').fill('E2E Pupilo');
  await lineaPupilo(page).getByRole('button', { name: /Pago/ }).click();
  await page.getByRole('button', { name: 'Abr', exact: true }).click();
  await page.getByRole('button', { name: 'May', exact: true }).click();
  await page.getByRole('radio', { name: 'Registrar monto pagado' }).click();
  await page.getByLabel('Monto pagado').fill('40000');
  await expect(page.locator('.pf-reparto')).toContainText('$15.000 (faltan $10.000)');
  await page.getByRole('button', { name: 'Registrar y Confirmar' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Registrar y confirmar' }).click();
  await expect(page.getByText(/meses registrados y confirmados/)).toBeVisible({ timeout: 15000 });
  const { rows } = await pool.query(
    "SELECT meses_correspondientes, monto_total_pagado FROM pagos_mensualidades WHERE rut_jugador = $1 AND meses_correspondientes ILIKE ANY (ARRAY['abril%', 'mayo%']) ORDER BY id",
    [JUGADORES.pupilo.rut]
  );
  expect(rows.map((r) => [r.meses_correspondientes, Number(r.monto_total_pagado)])).toEqual([['Abril 2026', 25000], ['Mayo 2026', 15000]]);
});

test('borrar un pago desde la ficha (admin)', async ({ page }) => {
  await iniciarSesion(page, CUENTAS.super_admin.rut);
  await page.getByRole('button', { name: 'Usuarios y Cuentas' }).first().click();
  await page.getByPlaceholder('Nombre, RUT, rama o categoría').fill('E2E Pupilo');
  await page.getByRole('button', { name: /Ver ficha/ }).first().click();
  await page.getByRole('dialog').getByRole('tab', { name: /Pagos/ }).click();
  await page.getByRole('button', { name: /Borrar pago de Mayo 2026/ }).click();
  await page.getByRole('dialog', { name: 'Borrar pago' }).getByRole('button', { name: 'Borrar pago' }).click();
  await expect(page.getByText('Pago borrado.')).toBeVisible({ timeout: 15000 });
  const { rows } = await pool.query("SELECT 1 FROM pagos_mensualidades WHERE rut_jugador = $1 AND meses_correspondientes ILIKE 'mayo%'", [JUGADORES.pupilo.rut]);
  expect(rows).toHaveLength(0);
});

test('una familia no puede borrar pagos (403)', async ({ request }) => {
  const login = await request.post('http://localhost:3000/api/auth/login', { data: { rut: CUENTAS.apoderado.rut, password: 'E2eRoles2026!' } });
  const { token } = await login.json();
  const { rows: [p] } = await pool.query('SELECT id FROM pagos_mensualidades WHERE rut_jugador = $1 LIMIT 1', [JUGADORES.pupilo.rut]);
  const r = await request.delete(`http://localhost:3000/api/pagos-mensualidades/${p.id}`, { headers: { Authorization: `Bearer ${token}` } });
  expect(r.status()).toBe(403);
});
