// Permisos individuales: el super admin habilita/quita un módulo a una cuenta
// puntual desde "Control de Permisos". Verifica que (1) se guarda SOLO la
// diferencia con el rol base (no el mapa completo), (2) la cuenta afectada
// ve el cambio sin volver a iniciar sesión, y (3) el backend lo aplica.
import { test, expect } from '@playwright/test';
import { CUENTAS, PASSWORD_PRUEBA, crearPool, crearDatosPrueba, limpiarDatosPrueba, iniciarSesion } from './fixtures/cuentasPrueba.js';

const pool = crearPool();
const API = 'http://localhost:3000/api';

test.describe.configure({ mode: 'serial' });
test.setTimeout(120000);
test.beforeAll(async () => { await crearDatosPrueba(pool); });
test.afterAll(async () => { await limpiarDatosPrueba(pool); await pool.end(); });

const overrideDe = async (rut) => (await pool.query('SELECT permisos_override FROM cuentas WHERE rut = $1', [rut])).rows[0]?.permisos_override || {};

const tokenDe = async (request, rut) => {
  const r = await request.post(`${API}/auth/login`, { data: { rut, password: PASSWORD_PRUEBA } });
  return (await r.json()).token;
};

const alternarModulo = async (page, nombreCuenta, modulo) => {
  // Engranaje → "Permisos por usuario" lleva a Admin → Permisos (vista
  // completa). Si ya estamos ahí, se reutiliza.
  if (!(await page.getByPlaceholder('Buscar...').isVisible())) {
    await page.getByTitle('Configuración y Perfil').click();
    await page.getByRole('button', { name: /Permisos por usuario/ }).click();
  }
  await page.getByPlaceholder('Buscar...').fill(nombreCuenta);
  const tarjeta = page.locator('div', { has: page.getByText(nombreCuenta, { exact: true }) })
    .filter({ has: page.getByRole('button', { name: modulo, exact: true }) }).last();
  await tarjeta.getByRole('button', { name: modulo, exact: true }).click();
  await tarjeta.getByRole('button', { name: /Guardar cambios/ }).click();
  await expect(tarjeta.getByRole('button', { name: /Guardar cambios/ })).toHaveCount(0, { timeout: 10000 });
};

test('super admin habilita Kiosco a un apoderado y este lo ve sin re-login', async ({ browser, request }) => {
  const nombreApoderado = `${CUENTAS.apoderado.nombres} Prueba`;
  // Sesión del apoderado abierta ANTES del cambio.
  const ctxApoderado = await browser.newContext();
  const apoderado = await ctxApoderado.newPage();
  await iniciarSesion(apoderado, CUENTAS.apoderado.rut);
  await expect(apoderado.locator('.nav-item', { hasText: 'Kiosco' })).toHaveCount(0);

  const token = await tokenDe(request, CUENTAS.apoderado.rut);
  const antes = await request.get(`${API}/kiosco-productos`, { headers: { Authorization: `Bearer ${token}` } });
  expect(antes.status()).toBe(403);

  const ctxAdmin = await browser.newContext();
  const admin = await ctxAdmin.newPage();
  await iniciarSesion(admin, CUENTAS.super_admin.rut);
  await alternarModulo(admin, nombreApoderado, 'Kiosco');

  // Solo la diferencia con el rol base.
  expect(await overrideDe(CUENTAS.apoderado.rut)).toEqual({ kiosco: true });
  // Backend: el mismo token ya tiene acceso (el override se lee en cada request).
  const despues = await request.get(`${API}/kiosco-productos`, { headers: { Authorization: `Bearer ${token}` } });
  expect(despues.status()).toBe(200);
  // Frontend: aparece en la sesión ya abierta (refresco de permisos propios).
  await expect(apoderado.locator('.nav-item', { hasText: 'Kiosco' })).toBeVisible({ timeout: 30000 });

  // Quitar el permiso: vuelve al rol base.
  await alternarModulo(admin, nombreApoderado, 'Kiosco');
  expect(await overrideDe(CUENTAS.apoderado.rut)).toEqual({});
  const revocado = await request.get(`${API}/kiosco-productos`, { headers: { Authorization: `Bearer ${token}` } });
  expect(revocado.status()).toBe(403);
  await expect(apoderado.locator('.nav-item', { hasText: 'Kiosco' })).toHaveCount(0, { timeout: 30000 });

  await ctxAdmin.close();
  await ctxApoderado.close();
});

test('quitar un módulo del rol base a un staff se aplica en backend', async ({ request }) => {
  await pool.query("UPDATE cuentas SET permisos_override = '{\"citaciones\": false}'::jsonb WHERE rut = $1", [CUENTAS.staff.rut]);
  const token = await tokenDe(request, CUENTAS.staff.rut);
  const r = await request.get(`${API}/eventos`, { headers: { Authorization: `Bearer ${token}` } });
  expect(r.status()).toBe(403);
  await pool.query("UPDATE cuentas SET permisos_override = '{}'::jsonb WHERE rut = $1", [CUENTAS.staff.rut]);
  const r2 = await request.get(`${API}/eventos`, { headers: { Authorization: `Bearer ${token}` } });
  expect(r2.status()).toBe(200);
});

test('si un admin cambia el perfil con la sesión abierta, se pide volver a ingresar', async ({ page }) => {
  await iniciarSesion(page, CUENTAS.apoderado.rut);
  await pool.query("UPDATE cuentas SET rol = 'staff', perfil_principal = 'staff' WHERE rut = $1", [CUENTAS.apoderado.rut]);
  await expect(page.getByText(/Tu perfil fue actualizado/)).toBeVisible({ timeout: 35000 });
  await expect(page.getByText('Ingreso Usuarios CCF')).toBeVisible();
  await pool.query("UPDATE cuentas SET rol = 'apoderado', perfil_principal = 'apoderado' WHERE rut = $1", [CUENTAS.apoderado.rut]);
});
