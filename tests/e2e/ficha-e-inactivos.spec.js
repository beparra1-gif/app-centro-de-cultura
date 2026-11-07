// Usuarios y Cuentas → "Ver ficha" (datos, pagos y vínculos navegables);
// tarifa de pupilo de socio aunque la ficha no esté vinculada a una cuenta;
// y los inactivos desaparecen de Tesorería e informes.
import { test, expect } from '@playwright/test';
import { CUENTAS, JUGADORES, crearPool, crearDatosPrueba, limpiarDatosPrueba, iniciarSesion } from './fixtures/cuentasPrueba.js';

const pool = crearPool();
const dv = (cuerpo) => {
  let suma = 0;
  let mul = 2;
  for (const d of String(cuerpo).split('').reverse()) { suma += Number(d) * mul; mul = mul === 7 ? 2 : mul + 1; }
  const r = 11 - (suma % 11);
  return r === 11 ? '0' : r === 10 ? 'K' : String(r);
};
// Pupilo de socio SIN cuenta de apoderado vinculada (caso mayoritario real).
const SUELTO = { rut: `99700013-${dv(99700013)}`, nombres: 'E2E Suelto' };

test.describe.configure({ mode: 'serial' });
test.setTimeout(90000);
test.beforeAll(async () => {
  await crearDatosPrueba(pool);
  await pool.query('DELETE FROM jugadores WHERE rut_jugador = $1', [SUELTO.rut]);
  await pool.query(
    `INSERT INTO jugadores (rut_jugador, nombres, apellido_paterno, rama, categoria, fecha_nacimiento, estado, fecha_ingreso, apoderado_socio)
     VALUES ($1, $2, 'Prueba', 'MASCULINA', 'SUB-11', '2015-04-04', 'ACTIVO', '2025-12-01', true)`,
    [SUELTO.rut, SUELTO.nombres]
  );
});
test.afterAll(async () => {
  await pool.query('DELETE FROM pagos_mensualidades WHERE rut_jugador = $1', [SUELTO.rut]);
  await pool.query('DELETE FROM jugadores WHERE rut_jugador = $1', [SUELTO.rut]);
  await limpiarDatosPrueba(pool);
  await pool.end();
});

const irA = async (page, tarjeta) => {
  await iniciarSesion(page, CUENTAS.super_admin.rut);
  await page.getByRole('button', { name: tarjeta }).first().click();
};

test('Ver ficha: datos, pagos y navegación deportista ↔ apoderado', async ({ page }) => {
  await irA(page, 'Usuarios y Cuentas');
  await page.getByPlaceholder('Nombre, RUT, rama o categoría').fill('E2E HijoSocio');
  await page.getByRole('button', { name: /Ver ficha/ }).first().click();
  const ficha = page.getByRole('dialog');
  await expect(ficha.getByRole('heading', { name: /E2E HijoSocio/ })).toBeVisible();
  await expect(ficha.getByText('Pupilo de socio')).toBeVisible();
  // Hijo único de socia: $15.000.
  await expect(ficha.getByText('$15.000 (hijo de socio)')).toBeVisible();
  await ficha.getByRole('tab', { name: /Pagos/ }).click();
  await expect(ficha.getByText('Mensualidad 2026')).toBeVisible();
  await ficha.getByRole('tab', { name: /Apoderado/ }).click();
  await ficha.getByRole('button', { name: /E2E SocioApoderado/ }).click();
  await expect(ficha.getByRole('heading', { name: /E2E SocioApoderado/ })).toBeVisible();
  await ficha.getByRole('tab', { name: /Pupilos/ }).click();
  await expect(ficha.getByRole('button', { name: /E2E HijoSocio/ })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('pupilo de socio sin cuenta vinculada: se cobra $15.000, no $30.000', async ({ page }) => {
  await irA(page, 'Tesorería');
  await page.getByLabel('Buscar en Tesorería').fill('E2E Suelto');
  const fila = page.locator('article.tc-fila', { hasText: 'E2E Suelto' });
  // La deuda se calcula cuando terminan de cargar los pagos.
  await expect(fila).toBeVisible({ timeout: 20000 });
  // Ingresó en 2025: debe enero a octubre = 10 × $15.000.
  await expect(fila.locator('.tc-fila-total')).toContainText('$150.000');
});

test('un deportista inactivo desaparece de Por cobrar y de Informes (y sigue en Usuarios)', async ({ page }) => {
  await pool.query("UPDATE jugadores SET estado = 'INACTIVO' WHERE rut_jugador = $1", [SUELTO.rut]);
  await irA(page, 'Tesorería');
  await page.getByLabel('Buscar en Tesorería').fill('E2E Suelto');
  await page.getByRole('button', { name: 'Todas', exact: true }).click();
  await expect(page.locator('article.tc-fila', { hasText: 'E2E Suelto' })).toHaveCount(0);
  await page.getByRole('tab', { name: /Informes/ }).click();
  await page.getByLabel('Estado').selectOption('todos');
  await page.getByLabel('Buscar en el informe').fill('E2E Suelto');
  await expect(page.locator('.id-tabla tr', { hasText: 'E2E Suelto' })).toHaveCount(0);
  await page.getByRole('button', { name: /Volver/ }).first().click();
  await page.getByRole('button', { name: 'Usuarios y Cuentas' }).first().click();
  await page.getByPlaceholder('Nombre, RUT, rama o categoría').fill('E2E Suelto');
  // Por defecto se listan los activos; el inactivo está en su filtro, para reactivarlo.
  await expect(page.getByRole('button', { name: /E2E Suelto/ })).toHaveCount(0);
  await page.getByRole('button', { name: 'Inactivos / baja' }).click();
  await expect(page.getByRole('button', { name: /E2E Suelto/ })).toBeVisible();
  await expect(page.locator('.tc-perfil', { hasText: 'INACTIVO' }).first()).toBeVisible();
  void JUGADORES;
});

test('vincular apoderados: sugerencia por teléfono de emergencia y vínculo con un clic', async ({ page }) => {
  await pool.query("UPDATE jugadores SET estado = 'ACTIVO', num_emergencia = '+56900000000', nombre_emergencia = 'E2E Apoderado Prueba' WHERE rut_jugador = $1", [SUELTO.rut]);
  await irA(page, 'Usuarios y Cuentas');
  await page.getByRole('button', { name: /Vincular apoderados/ }).click();
  await page.getByLabel('Buscar deportista sin apoderado').fill('E2E Suelto');
  const fila = page.locator('.va-fila', { hasText: 'E2E Suelto' });
  const sugerencia = fila.locator('.va-sugerencia').filter({ has: page.locator('strong', { hasText: /^E2E Apoderado Prueba$/ }) });
  await expect(sugerencia).toContainText('contacto de emergencia');
  await sugerencia.getByRole('button', { name: /Vincular/ }).click();
  await expect(page.getByText(/quedó vinculado a E2E Apoderado Prueba/)).toBeVisible({ timeout: 10000 });
  const { rows: [j] } = await pool.query('SELECT rut_apoderado FROM jugadores WHERE rut_jugador = $1', [SUELTO.rut]);
  expect(j.rut_apoderado).toBe(CUENTAS.apoderado.rut);
});

test('cuentas: cambio rápido de perfil y edición en ventana', async ({ page }) => {
  await irA(page, 'Usuarios y Cuentas');
  await page.getByRole('button', { name: /^Cuentas/ }).click();
  await page.getByPlaceholder('Nombre, correo, RUT o rol').fill('E2E Staff');
  await page.getByLabel(/Perfil de E2E Staff/).selectOption('apoderado');
  await page.getByRole('dialog').getByRole('button', { name: 'Cambiar perfil' }).click();
  await expect(page.getByText('Perfil actualizado a Apoderado.')).toBeVisible({ timeout: 10000 });
  const { rows: [c] } = await pool.query('SELECT rol, perfil_principal FROM cuentas WHERE rut = $1', [CUENTAS.staff.rut]);
  expect(c).toEqual({ rol: 'apoderado', perfil_principal: 'apoderado' });
  await page.getByRole('button', { name: 'Modificar' }).first().click();
  await expect(page.getByRole('dialog', { name: 'Editar cuenta' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Editar cuenta' })).toHaveCount(0);
});
