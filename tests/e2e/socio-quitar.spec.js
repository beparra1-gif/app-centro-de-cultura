// Editar cuenta: el admin puede quitar (y devolver) la condición de socio
// activo a cualquier perfil, incluso a una cuenta con perfil "Socio". Antes
// la casilla estaba bloqueada y se deducía del perfil.
import { test, expect } from '@playwright/test';
import { CUENTAS, crearPool, crearDatosPrueba, limpiarDatosPrueba, iniciarSesion } from './fixtures/cuentasPrueba.js';

const pool = crearPool();
test.describe.configure({ mode: 'serial' });
test.setTimeout(120000);
test.beforeAll(async () => { await crearDatosPrueba(pool); });
test.afterAll(async () => { await limpiarDatosPrueba(pool); await pool.end(); });

const esSocio = async () => (await pool.query('SELECT es_socio, rol FROM cuentas WHERE rut = $1', [CUENTAS.socio.rut])).rows[0];

const editarSocio = async (page, marcar) => {
  await page.getByRole('button', { name: 'Usuarios y Cuentas' }).first().click();
  await page.getByRole('button', { name: /^Cuentas/ }).click();
  await page.getByPlaceholder('Nombre, correo, RUT o rol').fill('E2E Socio');
  await page.getByRole('button', { name: 'Modificar' }).first().click();
  const editor = page.getByRole('dialog', { name: 'Editar cuenta' });
  const casilla = editor.getByLabel('Socio activo del club (paga cuota de socio)');
  await expect(casilla).toBeEnabled();
  if (marcar) await casilla.check(); else await casilla.uncheck();
  await editor.getByRole('button', { name: 'Guardar cambios' }).click();
  await expect(page.getByText('Cuenta actualizada correctamente.')).toBeVisible({ timeout: 10000 });
};

test('quitar y devolver el socio activo a una cuenta con perfil Socio', async ({ page }) => {
  expect(await esSocio()).toEqual({ es_socio: true, rol: 'socio' });
  await iniciarSesion(page, CUENTAS.super_admin.rut);
  await editarSocio(page, false);
  await expect.poll(async () => (await esSocio()).es_socio).toBe(false);
  expect((await esSocio()).rol).toBe('socio');

  await page.reload();
  await editarSocio(page, true);
  await expect.poll(async () => (await esSocio()).es_socio).toBe(true);
});
