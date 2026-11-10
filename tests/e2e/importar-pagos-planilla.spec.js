// Importar pagos desde la planilla de Tesorería: solo super admin, revisar
// nunca cambia nada y un enlace inválido se explica. (La lectura de una
// planilla real de Google no se prueba aquí: depende de un servicio externo.)
import { test, expect } from '@playwright/test';
import { CUENTAS, PASSWORD_PRUEBA, crearPool, crearDatosPrueba, limpiarDatosPrueba, iniciarSesion } from './fixtures/cuentasPrueba.js';

const pool = crearPool();
const API = 'http://localhost:3000/api';

test.describe.configure({ mode: 'serial' });
test.beforeAll(async () => { await crearDatosPrueba(pool); });
test.afterAll(async () => { await limpiarDatosPrueba(pool); await pool.end(); });

const token = async (request, rut) => {
  const r = await request.post(`${API}/auth/login`, { data: { rut, password: PASSWORD_PRUEBA } });
  expect(r.status()).toBe(200);
  return (await r.json()).token;
};

test('solo el super admin puede revisar o aplicar', async ({ request }) => {
  const admin = await token(request, CUENTAS.admin.rut);
  const url = encodeURIComponent('https://docs.google.com/spreadsheets/d/abcdefghijklmnopqrstuvwxyz/edit');
  const get = await request.get(`${API}/pagos-mensualidades/importar-planilla?url=${url}`, { headers: { Authorization: `Bearer ${admin}` } });
  expect(get.status()).toBe(403);
  const post = await request.post(`${API}/pagos-mensualidades/importar-planilla`, { headers: { Authorization: `Bearer ${admin}` }, data: { url } });
  expect(post.status()).toBe(403);
});

test('un enlace que no es de Google Sheets se rechaza sin tocar la base', async ({ request }) => {
  const sa = await token(request, CUENTAS.super_admin.rut);
  const antes = Number((await pool.query('SELECT count(*) FROM pagos_mensualidades')).rows[0].count);
  const r = await request.get(`${API}/pagos-mensualidades/importar-planilla?url=${encodeURIComponent('https://ejemplo.cl/planilla')}`, { headers: { Authorization: `Bearer ${sa}` } });
  expect(r.status()).toBe(400);
  expect((await r.json()).error).toMatch(/enlace completo de la planilla/);
  const despues = Number((await pool.query('SELECT count(*) FROM pagos_mensualidades')).rows[0].count);
  expect(despues).toBe(antes);
});

test('la sección aparece en Validar pagos para el super admin', async ({ page }) => {
  await iniciarSesion(page, CUENTAS.super_admin.rut);
  await page.getByRole('button', { name: 'Tesorería' }).first().click();
  await page.getByRole('tab', { name: /Validar pagos/ }).click();
  await page.getByRole('button', { name: /Importar pagos desde la planilla/ }).click();
  await page.getByLabel(/Enlace de la planilla/).fill('https://ejemplo.cl/no-es-sheets');
  await page.getByRole('button', { name: 'Revisar' }).click();
  await expect(page.getByText(/enlace completo de la planilla/)).toBeVisible({ timeout: 10000 });
});
