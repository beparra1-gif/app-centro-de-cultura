// Panel → Sistema → Respaldos: solo super admin; el interruptor de limpieza
// se guarda en la base (no hace falta tocar variables de DigitalOcean).
import { test, expect } from '@playwright/test';
import { CUENTAS, PASSWORD_PRUEBA, crearPool, crearDatosPrueba, limpiarDatosPrueba, iniciarSesion } from './fixtures/cuentasPrueba.js';

const pool = crearPool();
const API = 'http://localhost:3000/api';
test.describe.configure({ mode: 'serial' });
test.beforeAll(async () => { await crearDatosPrueba(pool); });
test.afterAll(async () => {
  await pool.query("DELETE FROM configuracion_sistema WHERE clave = 'respaldos'").catch(() => {});
  await limpiarDatosPrueba(pool);
  await pool.end();
});

const token = async (request, rut) => (await (await request.post(`${API}/auth/login`, { data: { rut, password: PASSWORD_PRUEBA } })).json()).token;

test('super admin ve el estado de los respaldos desde el Panel', async ({ page }) => {
  await iniciarSesion(page, CUENTAS.super_admin.rut);
  await page.locator('.pn-item', { hasText: 'Respaldos' }).click();
  await expect(page.getByRole('heading', { name: 'Respaldos' })).toBeVisible();
  await expect(page.getByText('Respaldo automático')).toBeVisible();
  await expect(page.getByText('Limpieza automática', { exact: true })).toBeVisible();
});

test('el interruptor de limpieza se guarda y solo el super admin puede usarlo', async ({ request }) => {
  const sa = await token(request, CUENTAS.super_admin.rut);
  const put = await request.put(`${API}/admin/respaldos`, { headers: { Authorization: `Bearer ${sa}` }, data: { retencionAplicar: true } });
  expect(put.status()).toBe(200);
  const estado = await (await request.get(`${API}/admin/respaldos`, { headers: { Authorization: `Bearer ${sa}` } })).json();
  expect(estado.retencion).toMatchObject({ activa: true, desdePanel: true });

  const admin = await token(request, CUENTAS.admin.rut);
  expect((await request.get(`${API}/admin/respaldos`, { headers: { Authorization: `Bearer ${admin}` } })).status()).toBe(403);
  expect((await request.post(`${API}/admin/respaldos/ejecutar`, { headers: { Authorization: `Bearer ${admin}` } })).status()).toBe(403);
});
