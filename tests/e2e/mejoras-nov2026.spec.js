// Registro de errores, cumpleaños del mes, posibles hermanos, "Deshacer"
// tras un pago manual y orden recordado entre visitas.
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
const MELLIZOS = [
  { rut: `99700031-${dv(99700031)}`, nombres: 'E2E MellizoA' },
  { rut: `99700032-${dv(99700032)}`, nombres: 'E2E MellizoB' },
];
const MENSAJE_ERROR = `E2E error de prueba ${Date.now()}`;
const hoy = new Date();
const cumpleHoy = `2014-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`;

test.describe.configure({ mode: 'serial' });
test.setTimeout(90000);
test.beforeAll(async () => {
  await crearDatosPrueba(pool);
  for (const m of MELLIZOS) {
    await pool.query('DELETE FROM jugadores WHERE rut_jugador = $1', [m.rut]);
    await pool.query(
      `INSERT INTO jugadores (rut_jugador, nombres, apellido_paterno, apellido_materno, rama, categoria, fecha_nacimiento, estado, fecha_ingreso, num_emergencia)
       VALUES ($1, $2, 'Gemelo', 'Iguales', 'MASCULINA', 'SUB-13', $3, 'ACTIVO', '2026-01-10', '+56 9 8765 4321')`,
      [m.rut, m.nombres, cumpleHoy]
    );
  }
});
test.afterAll(async () => {
  await pool.query('DELETE FROM errores_app WHERE mensaje LIKE $1', ['E2E error de prueba%']);
  await pool.query('DELETE FROM pagos_mensualidades WHERE rut_jugador = ANY($1)', [MELLIZOS.map((m) => m.rut)]);
  await pool.query('DELETE FROM jugadores WHERE rut_jugador = ANY($1)', [MELLIZOS.map((m) => m.rut)]);
  await limpiarDatosPrueba(pool);
  await pool.end();
});

test('un error del navegador queda en Panel → Errores recientes', async ({ page }) => {
  await iniciarSesion(page, CUENTAS.super_admin.rut);
  // Simula un error no controlado en la app.
  await page.evaluate((msg) => { setTimeout(() => { throw new Error(msg); }, 0); }, MENSAJE_ERROR);
  await expect.poll(async () => (await pool.query('SELECT veces, rol FROM errores_app WHERE mensaje = $1', [MENSAJE_ERROR])).rows[0]?.rol, { timeout: 10000 }).toBe('super_admin');

  await page.reload();
  await page.getByRole('button', { name: /Errores recientes/ }).click();
  const item = page.locator('.ea-item', { hasText: MENSAJE_ERROR });
  await expect(item).toBeVisible();
  await item.locator('.ea-cabecera').click();
  await expect(item.locator('.ea-detalle')).toContainText('Error');
});

test('sin sesión no se puede leer la lista de errores', async ({ request }) => {
  const r = await request.get('http://localhost:3000/api/admin/errores-app');
  expect(r.status()).toBe(401);
});

test('cumpleaños del mes en el Panel, con el de hoy destacado', async ({ page }) => {
  await iniciarSesion(page, CUENTAS.super_admin.rut);
  const seccion = page.getByRole('region', { name: 'Cumpleaños del mes' });
  // Deportistas y cuentas llegan después del primer pintado (en dev puede tardar).
  await expect(seccion.locator('.cm-cumple.hoy', { hasText: 'E2E MellizoA' })).toBeVisible({ timeout: 30000 });
  await seccion.locator('.cm-cumple', { hasText: 'E2E MellizoA' }).click();
  await expect(page.getByRole('dialog').getByRole('heading', { name: /E2E MellizoA/ })).toBeVisible();
});

test('agrupar hermanos a mano: nada se agrupa solo, el admin marca y agrupa', async ({ page }) => {
  await iniciarSesion(page, CUENTAS.super_admin.rut);
  await page.getByRole('button', { name: 'Usuarios y Cuentas' }).first().click();
  await page.getByRole('button', { name: /Vincular apoderados/ }).click();
  // Mismos apellidos y teléfono, pero no hay sugerencias automáticas.
  await expect(page.getByText(/Posibles hermanos/)).toHaveCount(0);
  await page.getByRole('button', { name: /Agrupar hermanos sin apoderado/ }).click();
  await page.getByLabel('Buscar para agrupar hermanos').fill('mellizo');
  await page.getByRole('checkbox', { name: /E2E MellizoA/ }).check();
  await page.getByRole('checkbox', { name: /E2E MellizoB/ }).check();
  await page.getByRole('button', { name: 'Agrupar como hermanos' }).click();
  await expect(page.locator('.ph-grupos', { hasText: 'Hermanos Gemelo' })).toBeVisible({ timeout: 15000 });
  const { rows } = await pool.query('SELECT DISTINCT grupo_familiar FROM jugadores WHERE rut_jugador = ANY($1)', [MELLIZOS.map((m) => m.rut)]);
  expect(rows).toHaveLength(1);
  expect(rows[0].grupo_familiar).toBeTruthy();
});

test('Por cobrar: los hermanos sin apoderado salen en una sola fila', async ({ page }) => {
  await iniciarSesion(page, CUENTAS.super_admin.rut);
  await page.getByRole('button', { name: 'Tesorería' }).first().click();
  await page.getByLabel('Buscar en Tesorería').fill('mellizo');
  await page.getByRole('button', { name: 'Todas', exact: true }).click();
  const filas = page.locator('article.tc-fila');
  await expect(filas).toHaveCount(1);
  await expect(filas.first()).toContainText('Hermanos Gemelo');
  await expect(filas.first()).toContainText('2 hermanos');
});

test('pago manual: "Deshacer" borra el pago recién registrado', async ({ page }) => {
  await iniciarSesion(page, CUENTAS.super_admin.rut);
  await page.getByRole('button', { name: 'Tesorería' }).first().click();
  await page.getByLabel('Buscar en Tesorería').fill(JUGADORES.pupilo.nombres);
  await page.getByRole('button', { name: 'Todas', exact: true }).click();
  await page.locator('.tc-linea', { hasText: JUGADORES.pupilo.nombres }).getByRole('button', { name: /Pago/ }).click();
  await page.getByRole('button', { name: 'Ene', exact: true }).click();
  await page.getByRole('button', { name: 'Registrar y Confirmar' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Registrar y confirmar' }).click();
  const deshacer = page.getByRole('button', { name: 'Deshacer' });
  await expect(deshacer).toBeVisible({ timeout: 15000 });
  const contar = async () => Number((await pool.query('SELECT COUNT(*) FROM pagos_mensualidades WHERE rut_jugador = $1', [JUGADORES.pupilo.rut])).rows[0].count);
  expect(await contar()).toBe(1);
  await deshacer.click();
  await expect(page.getByText('Pago deshecho.')).toBeVisible({ timeout: 15000 });
  expect(await contar()).toBe(0);
});

test('el orden elegido se recuerda al volver', async ({ page }) => {
  await iniciarSesion(page, CUENTAS.super_admin.rut);
  await page.getByRole('button', { name: 'Usuarios y Cuentas' }).first().click();
  await page.getByLabel('Ordenar por').selectOption('edad');
  await page.reload();
  await page.getByRole('button', { name: 'Usuarios y Cuentas' }).first().click();
  await expect(page.getByLabel('Ordenar por')).toHaveValue('edad');
});

test('Muro: una familia ve los cumpleaños de hoy, con foto y sin año ni edad', async ({ page, request }) => {
  await pool.query('UPDATE jugadores SET foto_jugador = $1 WHERE rut_jugador = $2', ['data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2210%22 height=%2210%22%3E%3Crect width=%2210%22 height=%2210%22 fill=%22red%22/%3E%3C/svg%3E', MELLIZOS[0].rut]);
  await iniciarSesion(page, CUENTAS.apoderado.rut);
  const card = page.getByRole('region', { name: 'Cumpleaños del club' });
  const hoyA = card.locator('.mc-hoy-persona', { hasText: 'E2E MellizoA' });
  await expect(hoyA).toBeVisible({ timeout: 30000 });
  await expect(hoyA.locator('img')).toHaveCount(1);
  await expect(card.locator('.mc-hoy-persona', { hasText: 'E2E MellizoB' }).locator('img')).toHaveCount(0);
  await expect(card).not.toContainText('2014');

  const sinSesion = await request.get('http://localhost:3000/api/cumpleanos?mes=1');
  expect(sinSesion.status()).toBe(401);
});
