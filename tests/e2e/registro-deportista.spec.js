// Registrar deportista por secciones: con fecha de nacimiento la categoría se
// asigna sola (y se guarda); sin fecha se elige de la lista.
import { test, expect } from '@playwright/test';
import { CUENTAS, crearPool, crearDatosPrueba, limpiarDatosPrueba, iniciarSesion } from './fixtures/cuentasPrueba.js';
import { categoriaPorNacimiento } from '../../src/utils/categoriaPorEdad.js';

const pool = crearPool();
// RUTs ficticios válidos (fuera del rango real del club).
const CON_FECHA = '99702001-4';
const SIN_FECHA = '99702002-2';
test.describe.configure({ mode: 'serial' });
test.beforeAll(async () => { await crearDatosPrueba(pool); });
test.afterAll(async () => {
  await pool.query('DELETE FROM jugadores WHERE rut_jugador = ANY($1)', [[CON_FECHA, SIN_FECHA]]);
  await limpiarDatosPrueba(pool);
  await pool.end();
});

const campo = (page, etiqueta) => page.locator('.form-group', { has: page.locator('label', { hasText: etiqueta }) }).locator('input, select').first();

const abrirRegistro = async (page) => {
  await iniciarSesion(page, CUENTAS.super_admin.rut);
  await page.getByRole('button', { name: 'Usuarios y Cuentas' }).first().click();
  await page.getByRole('button', { name: /^Registrar nuevo/ }).first().click();
  await expect(page.getByRole('radio', { name: /Deportista/ })).toHaveAttribute('aria-checked', 'true');
};

test('con fecha de nacimiento la categoría es automática y se guarda', async ({ page }) => {
  await abrirRegistro(page);
  for (const titulo of ['Datos personales', 'Apoderado', 'Deportivo', 'Físico y tallas', 'Salud y emergencia', 'Club y cobro']) {
    await expect(page.locator('.uc-seccion legend', { hasText: titulo })).toBeVisible();
  }
  await campo(page, 'RUT *').fill(CON_FECHA);
  await campo(page, 'Nombres *').fill('E2E Categoria');
  await campo(page, 'Apellido paterno *').fill('Automatica');
  await campo(page, 'Fecha de nacimiento').fill('2014-05-05');
  const esperada = categoriaPorNacimiento('2014-05-05');
  await expect(page.locator('.cc-auto')).toContainText(esperada);
  if (process.env.CAPTURAS) await page.locator('.uc-seccion', { hasText: 'Deportivo' }).first().screenshot({ path: 'test-results/registro-deportivo.png' });
  await campo(page, 'Estatura').fill('150');
  await page.getByRole('button', { name: 'Guardar nuevo usuario' }).click();
  await expect(page.getByText('Jugador creado correctamente.')).toBeVisible({ timeout: 15000 });
  const fila = (await pool.query('SELECT categoria, fecha_nacimiento, estatura, estado FROM jugadores WHERE rut_jugador = $1', [CON_FECHA])).rows[0];
  expect(fila.categoria).toBe(esperada);
  expect(fila.fecha_nacimiento).toBeTruthy();
  expect(Number(fila.estatura)).toBe(150);
  expect(fila.estado).toBe('ACTIVO');
});

test('sin fecha se elige la categoría de la lista', async ({ page }) => {
  await abrirRegistro(page);
  await campo(page, 'RUT *').fill(SIN_FECHA);
  await campo(page, 'Nombres *').fill('E2E Categoria');
  await campo(page, 'Apellido paterno *').fill('Manual');
  await page.getByRole('button', { name: 'Guardar nuevo usuario' }).click();
  await expect(page.getByText(/elige la categoría/)).toBeVisible();
  await page.locator('#categoria-nuevo').selectOption('SUB-15');
  await page.getByRole('button', { name: 'Guardar nuevo usuario' }).click();
  await expect(page.getByText('Jugador creado correctamente.')).toBeVisible({ timeout: 15000 });
  const fila = (await pool.query('SELECT categoria FROM jugadores WHERE rut_jugador = $1', [SIN_FECHA])).rows[0];
  expect(fila.categoria).toBe('SUB-15');
});
