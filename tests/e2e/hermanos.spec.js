// Hermanos sin apoderado: el admin los une desde la ficha ("Apoderado y
// hermanos") con grupo_familiar, para ordenar la familia antes de tener la
// cuenta del apoderado. Al asignar apoderado a uno, el otro lo hereda.
import { test, expect } from '@playwright/test';
import { CUENTAS, crearPool, crearDatosPrueba, limpiarDatosPrueba, iniciarSesion } from './fixtures/cuentasPrueba.js';

const pool = crearPool();
const dv = (cuerpo) => {
  let suma = 0;
  let mul = 2;
  for (const d of String(cuerpo).split('').reverse()) { suma += Number(d) * mul; mul = mul === 7 ? 2 : mul + 1; }
  const r = 11 - (suma % 11);
  return r === 11 ? '0' : r === 10 ? 'K' : String(r);
};
const A = { rut: `99700021-${dv(99700021)}`, nombres: 'E2E HermanoA' };
const B = { rut: `99700022-${dv(99700022)}`, nombres: 'E2E HermanoB' };

test.describe.configure({ mode: 'serial' });
test.setTimeout(90000);
test.beforeAll(async () => {
  await crearDatosPrueba(pool);
  for (const j of [A, B]) {
    await pool.query('DELETE FROM jugadores WHERE rut_jugador = $1', [j.rut]);
    await pool.query(
      `INSERT INTO jugadores (rut_jugador, nombres, apellido_paterno, rama, categoria, fecha_nacimiento, estado, fecha_ingreso)
       VALUES ($1, $2, 'Prueba', 'MASCULINA', 'SUB-13', '2013-02-02', 'ACTIVO', '2026-01-10')`,
      [j.rut, j.nombres]
    );
  }
});
test.afterAll(async () => {
  await pool.query('DELETE FROM jugadores WHERE rut_jugador = ANY($1)', [[A.rut, B.rut]]);
  await limpiarDatosPrueba(pool);
  await pool.end();
});

const grupos = async () => (await pool.query(
  'SELECT rut_jugador, grupo_familiar, rut_apoderado FROM jugadores WHERE rut_jugador = ANY($1) ORDER BY rut_jugador',
  [[A.rut, B.rut]]
)).rows;

const abrirFichaA = async (page) => {
  await page.getByPlaceholder('Nombre, RUT, rama o categoría').fill('E2E HermanoA');
  await page.getByRole('button', { name: /Ver ficha/ }).first().click();
  await page.getByRole('dialog').getByRole('tab', { name: /Apoderado y hermanos/ }).click();
};

test('marcar y quitar hermanos sin apoderado', async ({ page }) => {
  await iniciarSesion(page, CUENTAS.super_admin.rut);
  await page.getByRole('button', { name: 'Usuarios y Cuentas' }).first().click();
  await abrirFichaA(page);
  const ficha = page.getByRole('dialog');
  await expect(ficha.getByText('Sin hermanos vinculados.')).toBeVisible();

  await ficha.getByLabel(/Agregar hermano/).selectOption(B.rut);
  await ficha.getByRole('button', { name: /Agregar/ }).click();
  await expect(ficha.getByRole('button', { name: /^E2E HermanoB Prueba/ })).toBeVisible({ timeout: 15000 });
  const [ga, gb] = await grupos();
  expect(ga.grupo_familiar).toBeTruthy();
  expect(ga.grupo_familiar).toBe(gb.grupo_familiar);

  await ficha.getByRole('button', { name: /Quitar a E2E HermanoB/ }).click();
  await page.getByRole('dialog', { name: /Quitar hermano/ }).getByRole('button', { name: 'Quitar' }).click()
    .catch(async () => { await page.getByRole('button', { name: 'Quitar', exact: true }).last().click(); });
  await expect(ficha.getByText('Sin hermanos vinculados.')).toBeVisible({ timeout: 15000 });
  const despues = await grupos();
  expect(despues.every((j) => !j.grupo_familiar)).toBe(true);
});

test('al asignar apoderado a uno, pregunta antes de dárselo a sus hermanos', async ({ page }) => {
  await pool.query('UPDATE jugadores SET grupo_familiar = $1 WHERE rut_jugador = ANY($2)', ['fam-e2e', [A.rut, B.rut]]);
  await iniciarSesion(page, CUENTAS.super_admin.rut);
  await page.getByRole('button', { name: 'Usuarios y Cuentas' }).first().click();
  await page.getByPlaceholder('Nombre, RUT, rama o categoría').fill('E2E HermanoA');
  await page.getByRole('button', { name: 'Asignar apoderado' }).first().click();
  const select = page.locator('select').filter({ has: page.locator('option', { hasText: 'E2E Apoderado' }) }).first();
  const valor = await select.locator('option', { hasText: 'E2E Apoderado' }).first().getAttribute('value');
  await select.selectOption(valor);
  await page.getByRole('button', { name: 'Confirmar asignación' }).click();
  // Nunca se asigna solo: aparece la pregunta.
  await page.getByRole('button', { name: 'Sí, a todos' }).click();
  await expect(page.getByText(/y su hermano\/a/).first()).toBeVisible({ timeout: 15000 });
  const filas = await grupos();
  expect(filas.every((j) => j.rut_apoderado === CUENTAS.apoderado.rut)).toBe(true);
});
