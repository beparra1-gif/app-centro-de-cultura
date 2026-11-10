// Ventanas emergentes (utils/useModalAccesible.js): bloquean el scroll del
// fondo mientras están abiertas y se cierran con Escape.
import { test, expect } from '@playwright/test';
import { CUENTAS, PASSWORD_PRUEBA, crearPool, crearDatosPrueba, limpiarDatosPrueba, iniciarSesion } from './fixtures/cuentasPrueba.js';

const pool = crearPool();
test.beforeAll(async () => { await crearDatosPrueba(pool); });
test.afterAll(async () => { await limpiarDatosPrueba(pool); await pool.end(); });

test('modal "Cerrar sesión" bloquea el fondo y se cierra con Escape', async ({ page }) => {
  await iniciarSesion(page, CUENTAS.apoderado.rut);
  // "Cerrar sesión" vive ahora dentro de Configuración (engranaje).
  await page.getByTitle('Configuración y Perfil').click();
  await page.getByRole('button', { name: 'Cerrar sesión' }).click();
  const dialogo = page.getByRole('dialog', { name: 'Cerrar sesión' });
  await expect(dialogo).toBeVisible();
  await expect(page.locator('body')).toHaveClass(/modal-abierto/);
  await expect(page.locator('.ios-main')).toHaveCSS('overflow-y', 'hidden');

  await page.keyboard.press('Escape');
  await expect(dialogo).toHaveCount(0);
  await expect(page.locator('body')).not.toHaveClass(/modal-abierto/);
  // Sigue con la sesión abierta (Escape = cancelar, no confirmar).
  await expect(page.getByText(`${CUENTAS.apoderado.nombres} Prueba`).first()).toBeVisible();
});

test('Configuración de un admin muestra Mi Perfil, acceso a permisos y se cierra con Escape', async ({ page }) => {
  await iniciarSesion(page, CUENTAS.super_admin.rut);
  await page.getByTitle('Configuración y Perfil').click();
  // Antes un admin veía SOLO la matriz de permisos y nunca llegaba a Mi Perfil.
  await expect(page.getByText('Mi Perfil')).toBeVisible();
  await expect(page.getByRole('button', { name: /Permisos por usuario/ })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Cerrar sesión' })).toBeVisible();
  await expect(page.locator('body')).not.toHaveClass(/modal-abierto/);
  await page.keyboard.press('Escape');
  await expect(page.getByText('Mi Perfil')).toHaveCount(0);
});

test('cambiar contraseña desde Configuración (antes era un botón "Próximamente")', async ({ page, request }) => {
  await iniciarSesion(page, CUENTAS.socio.rut);
  await page.getByTitle('Configuración y Perfil').click();
  await page.getByRole('button', { name: 'Cambiar contraseña' }).click();
  await page.getByPlaceholder('Contraseña actual').fill(PASSWORD_PRUEBA);
  await page.getByPlaceholder('Nueva contraseña (mín. 5)').fill('NuevaE2e2026!');
  await page.getByPlaceholder('Repite la nueva contraseña').fill('NuevaE2e2026!');
  await page.getByRole('button', { name: 'Guardar nueva contraseña' }).click();
  await expect(page.getByText('Contraseña actualizada.')).toBeVisible({ timeout: 10000 });
  const login = await request.post(`${process.env.E2E_API_URL || 'http://localhost:3000/api'}/auth/login`, { data: { rut: CUENTAS.socio.rut, password: 'NuevaE2e2026!' } });
  expect(login.status()).toBe(200);
});
