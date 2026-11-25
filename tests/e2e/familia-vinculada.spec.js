// Vincular familia: ambos padres socios, una hija a nombre de cada uno.
// Tras vincular desde la ficha de la cuenta: cada padre ve a las dos hijas,
// Tesorería muestra UNA fila con las dos cuotas de socio, las hijas quedan
// como hermanas y desvincular lo deshace.
import { test, expect } from '@playwright/test';
import { CUENTAS, JUGADORES, PASSWORD_PRUEBA, crearPool, crearDatosPrueba, limpiarDatosPrueba, iniciarSesion, abrirMiCuenta } from './fixtures/cuentasPrueba.js';

const API = process.env.E2E_API_URL || 'http://localhost:3000/api';

const pool = crearPool();
const MADRE = CUENTAS.socio_apoderado; // apoderada de JUGADORES.hijoSocio
const PADRE = CUENTAS.socio;
const HIJA2 = { rut: '', nombres: 'E2E HijaPadre' };

test.describe.configure({ mode: 'serial' });
test.setTimeout(90000);
test.beforeAll(async () => {
  await crearDatosPrueba(pool);
  const cuerpo = '99700021';
  let suma = 0; let mul = 2;
  for (const d of cuerpo.split('').reverse()) { suma += Number(d) * mul; mul = mul === 7 ? 2 : mul + 1; }
  const r = 11 - (suma % 11);
  HIJA2.rut = `${cuerpo}-${r === 11 ? '0' : r === 10 ? 'K' : r}`;
  await pool.query('DELETE FROM jugadores WHERE rut_jugador = $1', [HIJA2.rut]);
  await pool.query(
    `INSERT INTO jugadores (rut_jugador, nombres, apellido_paterno, rama, categoria, fecha_nacimiento, estado, rut_apoderado, fecha_ingreso)
     VALUES ($1, $2, 'Prueba', 'FEMENINA', 'SUB-13', '2013-04-04', 'ACTIVO', $3, '2026-01-10')`,
    [HIJA2.rut, HIJA2.nombres, PADRE.rut]
  );
});
test.afterAll(async () => {
  await pool.query(`UPDATE cuentas SET grupo_familiar = NULL WHERE rut = ANY($1)`, [[MADRE.rut, PADRE.rut]]);
  await pool.query('DELETE FROM jugadores WHERE rut_jugador = $1', [HIJA2.rut]);
  await limpiarDatosPrueba(pool);
  await pool.end();
});

const grupoDe = async (tabla, col, rut) => (await pool.query(`SELECT grupo_familiar FROM ${tabla} WHERE ${col} = $1`, [rut])).rows[0]?.grupo_familiar || null;

test('el admin vincula a los dos padres desde la ficha de la cuenta', async ({ page }) => {
  await iniciarSesion(page, CUENTAS.super_admin.rut);
  await page.getByRole('button', { name: 'Usuarios y Cuentas' }).first().click();
  // Ficha de la hija → su apoderada (la madre) → pestaña Pupilos.
  await page.getByPlaceholder('Nombre, RUT, rama o categoría').fill('E2E HijoSocio');
  await page.getByRole('button', { name: /Ver ficha/ }).first().click();
  const ficha = page.getByRole('dialog');
  await ficha.getByRole('tab', { name: /Apoderado/ }).click();
  await ficha.getByRole('button', { name: /E2E SocioApoderado/ }).click();
  await ficha.getByRole('tab', { name: /Deportistas/ }).click();
  await expect(ficha.getByText('Sin otra cuenta vinculada.')).toBeVisible();
  await ficha.getByLabel(/Vincular con otra cuenta/).selectOption(PADRE.rut);
  await ficha.getByRole('button', { name: /^Vincular$/ }).click();
  await expect(ficha.getByRole('button', { name: new RegExp(`E2E Socio .*${PADRE.rut}`) })).toBeVisible({ timeout: 15000 });

  const grupo = await grupoDe('cuentas', 'rut', MADRE.rut);
  expect(grupo).toBeTruthy();
  expect(await grupoDe('cuentas', 'rut', PADRE.rut)).toBe(grupo);
  // Las hijas de cada uno quedan como hermanas (tarifa de hermanas hijas de socio).
  expect(await grupoDe('jugadores', 'rut_jugador', JUGADORES.hijoSocio.rut)).toBe(grupo);
  expect(await grupoDe('jugadores', 'rut_jugador', HIJA2.rut)).toBe(grupo);
});

test('Tesorería muestra a la familia en una sola fila con las dos cuotas de socio', async ({ page }) => {
  await iniciarSesion(page, CUENTAS.super_admin.rut);
  await page.getByRole('button', { name: 'Tesorería' }).first().click();
  await page.getByLabel('Estado').first().selectOption('todos').catch(() => {});
  await page.getByPlaceholder(/Buscar/).first().fill('E2E HijaPadre');
  const fila = page.locator('.tc-fila', { hasText: 'Familia vinculada' });
  await expect(fila).toHaveCount(1);
  await expect(fila.getByText(/Cuota de socio · E2E SocioApoderado/)).toBeVisible();
  await expect(fila.getByText(/Cuota de socio · E2E Socio\b/)).toBeVisible();
  await expect(fila.getByText('E2E HijoSocio Prueba')).toBeVisible();
  await expect(fila.getByText('E2E HijaPadre Prueba')).toBeVisible();
});

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');

test('la ficha de la cuenta muestra la cuota de socio de ambos padres', async ({ page }) => {
  await iniciarSesion(page, CUENTAS.super_admin.rut);
  await page.getByRole('button', { name: 'Usuarios y Cuentas' }).first().click();
  await page.getByPlaceholder('Nombre, RUT, rama o categoría').fill('E2E HijoSocio');
  await page.getByRole('button', { name: /Ver ficha/ }).first().click();
  const ficha = page.getByRole('dialog');
  await ficha.getByRole('tab', { name: /Apoderado/ }).click();
  await ficha.getByRole('button', { name: /E2E SocioApoderado/ }).click();
  await ficha.getByRole('tab', { name: /Pagos/ }).click();
  await expect(ficha.getByText(/Cuota de socio · E2E SocioApoderado/)).toBeVisible();
  await expect(ficha.getByText(/Cuota de socio · E2E Socio Prueba/)).toBeVisible();
  await expect(ficha.getByText(/Mensualidad · E2E HijaPadre/)).toBeVisible();
});

test('la madre paga en un solo comprobante su cuota, la del padre y la mensualidad de una hija', async ({ page }) => {
  await pool.query('DELETE FROM pagos_mensualidades WHERE rut_pagos = ANY($1)', [[MADRE.rut, PADRE.rut]]);
  await iniciarSesion(page, MADRE.rut);
  await abrirMiCuenta(page);
  const grillaDe = (titulo) => page.locator('.mb-20, .mb-15', { has: page.getByRole('heading', { name: titulo }) }).locator('.grid-12-meses, .lista-12-meses');
  await grillaDe(/1\. Cuotas de Socio/).locator('button.mes-box', { hasText: 'Ene' }).click();
  await grillaDe(/Cuota de Socio · E2E Socio/).locator('button.mes-box', { hasText: 'Ene' }).click();
  await grillaDe(/Mensualidad Deportista: E2E/).first().locator('button.mes-box', { hasText: 'Ene' }).click();
  const cuentaSocios = page.getByRole('region', { name: 'Cuenta para cuota de socio' });
  await expect(cuentaSocios).toContainText('Transfiere');
  await page.locator('input[type="file"]').last().setInputFiles({ name: 'comprobante.png', mimeType: 'image/png', buffer: PNG });
  await expect(page.getByText(/ha recibido tu comprobante/i)).toBeVisible({ timeout: 15000 });
  const { rows } = await pool.query(
    `SELECT rut_pagos, concepto_pago, comprobante_url FROM pagos_mensualidades WHERE rut_pagos = ANY($1) AND meses_correspondientes = 'ene-2026' ORDER BY concepto_pago, rut_pagos`,
    [[MADRE.rut, PADRE.rut]]
  );
  expect(rows.filter((r) => r.concepto_pago === 'Mensualidad Socio').map((r) => r.rut_pagos).sort()).toEqual([MADRE.rut, PADRE.rut].sort());
  expect(rows.some((r) => r.concepto_pago === 'Mensualidad')).toBe(true);
  expect(new Set(rows.map((r) => r.comprobante_url)).size).toBe(1);
});

for (const [quien, cuenta] of [['el padre', PADRE], ['la madre', MADRE]]) {
  test(`${quien} ve a las dos hijas como sus pupilos`, async ({ page }) => {
    const respuesta = page.waitForResponse((r) => r.url().endsWith('/api/jugadores') && r.request().method() === 'GET');
    await iniciarSesion(page, cuenta.rut);
    const jugadores = await (await respuesta).json();
    const propios = jugadores.filter((j) => j.es_pupilo_propio).map((j) => j.rut_jugador).sort();
    expect(propios).toEqual([JUGADORES.hijoSocio.rut, HIJA2.rut].sort());
    // Y en Mi Cuenta aparecen las dos.
    await abrirMiCuenta(page);
    await expect(page.getByText(/E2E HijoSocio/).first()).toBeVisible();
    await expect(page.getByText(/E2E HijaPadre/).first()).toBeVisible();
  });
}

test('el padre puede editar a la hija que está a nombre de la madre; desvincular lo quita', async ({ request }) => {
  const login = async (rut) => {
    const r = await request.post(`${API}/auth/login`, { data: { rut, password: PASSWORD_PRUEBA } });
    const token = (await r.json()).token;
    expect(token).toBeTruthy();
    return token;
  };
  const tokenPadre = await login(PADRE.rut);
  const editar = () => request.put(`${API}/jugadores/${encodeURIComponent(JUGADORES.hijoSocio.rut)}`, {
    headers: { Authorization: `Bearer ${tokenPadre}` },
    data: { alergias: 'ninguna' },
  });
  expect((await editar()).status()).toBe(200);

  const tokenAdmin = await login(CUENTAS.super_admin.rut);
  const r = await request.delete(`${API}/cuentas/${encodeURIComponent(PADRE.rut)}/familia`, { headers: { Authorization: `Bearer ${tokenAdmin}` } });
  expect(r.status()).toBe(200);
  expect(await grupoDe('cuentas', 'rut', PADRE.rut)).toBeNull();
  expect((await editar()).status()).toBe(403);
});
