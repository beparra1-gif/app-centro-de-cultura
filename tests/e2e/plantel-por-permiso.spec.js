// Si el superadmin habilita "Asistencia Staff" (Pasar lista) a un apoderado,
// ese apoderado ve a TODO el plantel, no solo a su pupilo. Sigue sin poder
// informar pagos de otras familias ni recibir datos internos (motivo_baja).
import { test, expect } from '@playwright/test';
import { CUENTAS, JUGADORES, PASSWORD_PRUEBA, crearPool, crearDatosPrueba, limpiarDatosPrueba, iniciarSesion } from './fixtures/cuentasPrueba.js';

const pool = crearPool();
const API = process.env.E2E_API_URL || 'http://localhost:3000/api';
const normRut = (r) => String(r || '').replace(/[.\s-]/g, '').toUpperCase();

test.describe.configure({ mode: 'serial' });
test.beforeAll(async () => { await crearDatosPrueba(pool); });
test.afterAll(async () => { await limpiarDatosPrueba(pool); await pool.end(); });

const fijarOverride = (override) => pool.query('UPDATE cuentas SET permisos_override = $1 WHERE rut = $2', [override, CUENTAS.apoderado.rut]);

test('apoderado con Pasar lista recibe todo el plantel, sin pagos ajenos ni datos internos', async ({ request }) => {
  const token = (await (await request.post(`${API}/auth/login`, { data: { rut: CUENTAS.apoderado.rut, password: PASSWORD_PRUEBA } })).json()).token;
  const headers = { Authorization: `Bearer ${token}` };
  const rutsVisibles = async () => (await (await request.get(`${API}/jugadores`, { headers })).json()).map((j) => normRut(j.rut_jugador));

  // Sin excepción: solo su pupilo.
  await fijarOverride({});
  expect(await rutsVisibles()).toEqual([normRut(JUGADORES.pupilo.rut)]);
  expect((await request.get(`${API}/jugadores/${JUGADORES.hijoSocio.rut}`, { headers })).status()).toBe(403);

  // Con "Asistencia Staff" habilitado por el superadmin: todo el plantel.
  await fijarOverride({ asistencia_staff: true });
  const ruts = await rutsVisibles();
  expect(ruts).toEqual(expect.arrayContaining([normRut(JUGADORES.pupilo.rut), normRut(JUGADORES.hijoSocio.rut), normRut(JUGADORES.propio.rut)]));
  const lista = await (await request.get(`${API}/jugadores`, { headers })).json();
  expect(lista.some((j) => 'motivo_baja' in j)).toBe(false);
  expect((await request.get(`${API}/jugadores/${JUGADORES.hijoSocio.rut}`, { headers })).status()).toBe(200);

  // Ver el plantel no habilita a informar pagos de otra familia.
  const pagoAjeno = await request.post(`${API}/pagos-mensualidades`, {
    headers,
    data: { rut_pagos: CUENTAS.apoderado.rut, rut_jugador: JUGADORES.hijoSocio.rut, concepto_pago: 'Mensualidad', meses_correspondientes: 'enero-2026', monto_total_pagado: 30000, cantidad_meses_pagados: 1 },
  });
  expect(pagoAjeno.status()).toBe(403);
});

test('en Pasar lista aparecen las categorías de todo el plantel', async ({ page }) => {
  await fijarOverride({ asistencia_staff: true });
  await iniciarSesion(page, CUENTAS.apoderado.rut);
  await page.locator('.nav-item', { hasText: 'Asistencia' }).click();
  // SUB-15 es la categoría del hijo del socio+apoderado, no de su pupilo (SUB-13).
  await expect(page.getByRole('button', { name: 'SUB-15', exact: true })).toBeVisible({ timeout: 10000 });
  await expect(page.getByRole('button', { name: 'SUB-13', exact: true })).toBeVisible();
  await fijarOverride({});
});
