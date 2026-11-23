// "Marcar todas como leídas": el contador de la campana se va a cero, queda
// guardado en el servidor y no vuelve al recargar. Solo toca las propias.
import { test, expect } from '@playwright/test';
import { CUENTAS, crearPool, crearDatosPrueba, limpiarDatosPrueba, iniciarSesion } from './fixtures/cuentasPrueba.js';

const pool = crearPool();
const TITULO = 'E2E Notif Leidas';

test.describe.configure({ mode: 'serial' });
test.beforeAll(async () => {
  await crearDatosPrueba(pool);
  await pool.query('DELETE FROM notificaciones_app WHERE titulo = $1', [TITULO]);
  for (const rut of [CUENTAS.apoderado.rut, CUENTAS.apoderado.rut, CUENTAS.socio.rut]) {
    await pool.query("INSERT INTO notificaciones_app (rut_destinatario, tipo, titulo, cuerpo) VALUES ($1, 'datos', $2, 'x')", [rut, TITULO]);
  }
});
test.afterAll(async () => {
  await pool.query('DELETE FROM notificaciones_app WHERE titulo = $1', [TITULO]);
  await limpiarDatosPrueba(pool);
  await pool.end();
});

const noLeidasDe = async (rut) => (await pool.query(
  'SELECT COUNT(*)::int AS n FROM notificaciones_app WHERE titulo = $1 AND rut_destinatario = $2 AND leida IS NOT TRUE', [TITULO, rut],
)).rows[0].n;

test('marcar todas como leídas limpia el contador y se mantiene al recargar', async ({ page }) => {
  await iniciarSesion(page, CUENTAS.apoderado.rut);
  const campana = page.getByRole('button', { name: /^Notificaciones/ });
  await expect(campana).toHaveAccessibleName(/sin leer/, { timeout: 15000 });
  await campana.click();
  await page.getByRole('button', { name: /Marcar todas como leídas/ }).click();
  await expect(campana).toHaveAccessibleName('Notificaciones');
  await expect.poll(() => noLeidasDe(CUENTAS.apoderado.rut)).toBe(0);
  // Las de otra cuenta no se tocan.
  expect(await noLeidasDe(CUENTAS.socio.rut)).toBe(1);

  await page.reload();
  await expect(page.getByTitle('Configuración y Perfil')).toBeVisible({ timeout: 15000 });
  await page.waitForTimeout(1500);
  await expect(page.getByRole('button', { name: /^Notificaciones/ })).toHaveAccessibleName('Notificaciones');
});
