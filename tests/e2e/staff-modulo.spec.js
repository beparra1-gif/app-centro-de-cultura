// Usuarios y Cuentas → Staff: el super admin elige a un entrenador y en la
// ventana le marca categorías por rama (1 de hombres, 1 de mujeres); el admin
// sin el permiso "Gestión de Staff" no ve la pestaña. Con CAPTURAS_DIR guarda pantallazos.
import { test, expect } from '@playwright/test';
import { CUENTAS, crearPool, crearDatosPrueba, limpiarDatosPrueba, iniciarSesion } from './fixtures/cuentasPrueba.js';

const pool = crearPool();
const OUT = process.env.CAPTURAS_DIR;
const foto = async (page, nombre) => { if (OUT) await page.screenshot({ path: `${OUT}/${nombre}.png` }); };

test.describe.configure({ mode: 'serial' });
test.setTimeout(120000);
test.beforeAll(async () => { await crearDatosPrueba(pool); });
test.afterAll(async () => { await limpiarDatosPrueba(pool); await pool.end(); });

test('super admin asigna categorías por rama a un entrenador desde la ventana', async ({ page }) => {
  await pool.query("UPDATE cuentas SET categorias_asignadas = '[]', ramas_asignadas = '[]' WHERE rut = $1", [CUENTAS.staff.rut]);
  await page.setViewportSize({ width: 1280, height: 900 });
  await iniciarSesion(page, CUENTAS.super_admin.rut);
  await page.getByRole('button', { name: 'Usuarios y Cuentas' }).first().click();
  await page.getByRole('button', { name: 'Staff', exact: true }).click();
  const fila = page.getByRole('button', { name: /E2E Staff/ });
  await expect(fila).toContainText('Todas las ramas y categorías');
  await foto(page, '1-staff-por-entrenador');

  await fila.click();
  const ventana = page.getByRole('dialog', { name: /E2E Staff/ });
  await ventana.getByLabel('SUB-13 Masculina', { exact: true }).check();
  await ventana.getByLabel('SUB-17 / SUB-18 Femenina', { exact: true }).check();
  await expect(ventana.getByText('Quedará a cargo de:')).toBeVisible();
  await expect(ventana).toContainText('Femenina: SUB-17 / SUB-18 · Masculina: SUB-13');
  await foto(page, '2-ventana-asignar');
  await ventana.getByRole('button', { name: 'Guardar' }).click();
  await expect(ventana).toBeHidden();
  await expect(fila).toContainText('Femenina: SUB-17 / SUB-18 · Masculina: SUB-13');
  await foto(page, '3-guardado');

  const { rows: [c] } = await pool.query('SELECT categorias_asignadas, ramas_asignadas FROM cuentas WHERE rut = $1', [CUENTAS.staff.rut]);
  expect(c).toEqual({ categorias_asignadas: ['MASCULINA|SUB-13', 'FEMENINA|SUB-17 / SUB-18'], ramas_asignadas: [] });

  await page.getByRole('tab', { name: 'Por categoría' }).click();
  await expect(page.locator('.sc-categoria', { hasText: 'SUB-13 · Masculina' }).locator('.sc-chips')).toContainText('E2E Staff');
  await expect(page.locator('.sc-categoria', { hasText: 'SUB-13 · Femenina' }).locator('.sc-chips')).not.toContainText('E2E Staff');
  await foto(page, '4-por-categoria');
  await pool.query("UPDATE cuentas SET categorias_asignadas = '[]', ramas_asignadas = '[]' WHERE rut = $1", [CUENTAS.staff.rut]);
});

test('un admin sin "Gestión de Staff" no ve la pestaña', async ({ page }) => {
  await iniciarSesion(page, CUENTAS.admin.rut);
  await page.getByRole('button', { name: 'Usuarios y Cuentas' }).first().click();
  await expect(page.getByRole('button', { name: /^Cuentas/ })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Staff', exact: true })).toHaveCount(0);
});
