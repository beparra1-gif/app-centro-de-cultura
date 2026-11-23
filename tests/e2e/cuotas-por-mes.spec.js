// Editar deportista → "Personalizar mensualidad por mes": se cargan montos
// en meses puntuales, se guardan en cuotas_por_mes y la ficha los muestra;
// los meses vacíos siguen con la cuota normal. Con CAPTURAS_DIR, pantallazo.
import { test, expect } from '@playwright/test';
import { JUGADORES, CUENTAS, crearPool, crearDatosPrueba, limpiarDatosPrueba, iniciarSesion } from './fixtures/cuentasPrueba.js';

const pool = crearPool();
const OUT = process.env.CAPTURAS_DIR;
test.setTimeout(120000);
test.beforeAll(async () => { await crearDatosPrueba(pool); });
test.afterAll(async () => { await limpiarDatosPrueba(pool); await pool.end(); });

test('personalizar la mensualidad de marzo y julio de un deportista', async ({ page }) => {
  await pool.query("UPDATE jugadores SET cuotas_por_mes = '{}' WHERE rut_jugador = $1", [JUGADORES.pupilo.rut]);
  await page.setViewportSize({ width: 1280, height: 900 });
  await iniciarSesion(page, CUENTAS.super_admin.rut);
  await page.getByRole('button', { name: 'Usuarios y Cuentas' }).first().click();
  await page.getByPlaceholder('Nombre, RUT, rama o categoría').fill(JUGADORES.pupilo.rut);
  await page.getByRole('button', { name: 'Modificar' }).first().click();

  const editor = page.getByRole('dialog', { name: 'Editar deportista' });
  await editor.getByLabel(/Personalizar mensualidad por mes/).check();
  await editor.getByLabel('Cuota de Mar 2026').fill('10000');
  await editor.getByLabel('Cuota de Jul 2026').fill('0');
  await editor.getByLabel('Cuota de Mar 2026').scrollIntoViewIfNeeded();
  if (OUT) await page.screenshot({ path: `${OUT}/7-cuotas-por-mes.png` });
  await editor.getByRole('button', { name: 'Guardar cambios' }).click();
  await expect(page.getByText('Jugador actualizado correctamente.')).toBeVisible({ timeout: 10000 });

  const { rows: [j] } = await pool.query('SELECT cuotas_por_mes FROM jugadores WHERE rut_jugador = $1', [JUGADORES.pupilo.rut]);
  expect(j.cuotas_por_mes).toEqual({ '2026-03': 10000, '2026-07': 0 });

  await page.getByRole('button', { name: 'Ver ficha' }).first().click();
  await expect(page.getByRole('dialog').getByText('03/26: $10.000 · 07/26: $0')).toBeVisible();

  // Desmarcar borra la personalización.
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Modificar' }).first().click();
  await editor.getByLabel(/Personalizar mensualidad por mes/).uncheck();
  await editor.getByRole('button', { name: 'Guardar cambios' }).click();
  await expect.poll(async () => (await pool.query('SELECT cuotas_por_mes FROM jugadores WHERE rut_jugador = $1', [JUGADORES.pupilo.rut])).rows[0].cuotas_por_mes).toEqual({});
});
