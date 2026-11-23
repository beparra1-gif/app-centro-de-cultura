// Reacciones del Muro: una por persona y publicación, aunque haga muchos clics.
import { test, expect } from '@playwright/test';
import { CUENTAS, PASSWORD_PRUEBA, crearPool, crearDatosPrueba, limpiarDatosPrueba, iniciarSesion } from './fixtures/cuentasPrueba.js';

const pool = crearPool();
const API = process.env.E2E_API_URL || 'http://localhost:3000/api';
const TITULO = 'E2E Reacciones Muro';

const limpiar = () => pool.query('DELETE FROM comunicaciones WHERE titulo = $1', [TITULO]);
test.describe.configure({ mode: 'serial' });
test.beforeAll(async () => { await limpiar(); await crearDatosPrueba(pool); });
test.afterAll(async () => { await limpiar(); await limpiarDatosPrueba(pool); await pool.end(); });

const tokenDe = async (request, rut) => (await (await request.post(`${API}/auth/login`, { data: { rut, password: PASSWORD_PRUEBA } })).json()).token;

test('una reacción por persona: repetir la quita y otra la reemplaza', async ({ request }) => {
  const admin = { Authorization: `Bearer ${await tokenDe(request, CUENTAS.super_admin.rut)}` };
  const com = await (await request.post(`${API}/comunicaciones`, { headers: admin, data: { titulo: TITULO, cuerpo_texto: 'x', tipo: 'Noticia', rama: 'General', categoria: 'General', urgencia: 'Baja' } })).json();
  const apoderado = { Authorization: `Bearer ${await tokenDe(request, CUENTAS.apoderado.rut)}` };
  const reaccionar = (headers, tipo) => request.post(`${API}/comunicaciones/${com.id}/reaccion`, { headers, data: { tipo } });

  // Muchos clics seguidos (incluso a la vez) nunca dejan más de una reacción suya.
  await Promise.all(Array.from({ length: 7 }, () => reaccionar(apoderado, 'love')));
  const { rows } = await pool.query('SELECT COUNT(*)::int AS n FROM comunicacion_reacciones WHERE comunicacion_id = $1', [com.id]);
  expect(rows[0].n).toBeLessThanOrEqual(1);
  await pool.query('DELETE FROM comunicacion_reacciones WHERE comunicacion_id = $1', [com.id]);

  expect(await (await reaccionar(apoderado, 'love')).json()).toEqual({ reacciones: { love: 1 }, mi_reaccion: 'love' });
  expect(await (await reaccionar(apoderado, 'great')).json()).toEqual({ reacciones: { great: 1 }, mi_reaccion: 'great' });
  expect(await (await reaccionar(admin, 'great')).json()).toEqual({ reacciones: { great: 2 }, mi_reaccion: 'great' });
  expect(await (await reaccionar(apoderado, 'great')).json()).toEqual({ reacciones: { great: 1 }, mi_reaccion: null });
  expect((await reaccionar(apoderado, 'hack')).status()).toBe(400);
  expect((await request.post(`${API}/comunicaciones/${com.id}/reaccion`, { data: { tipo: 'love' } })).status()).toBe(401);

  // Al recargar, cada uno ve su propia reacción y el total real.
  const lista = await (await request.get(`${API}/comunicaciones`, { headers: admin })).json();
  expect(lista.find((c) => c.id === com.id)).toMatchObject({ reacciones: { great: 1 }, mi_reaccion: 'great' });
});

test('en el Muro, varios clics en el corazón suman solo uno', async ({ page }) => {
  await iniciarSesion(page, CUENTAS.apoderado.rut);
  await page.locator('.nav-item', { hasText: 'Muro' }).click();
  const post = page.locator('.ios-rrss-card', { hasText: TITULO }).first();
  const corazon = post.getByRole('button', { name: /^Me encanta/ });
  for (let i = 0; i < 4; i += 1) await corazon.click();
  // 4 clics = puesto, quitado, puesto, quitado.
  await expect(corazon).toHaveAttribute('aria-pressed', 'false');
  await corazon.click();
  await expect(corazon).toHaveAttribute('aria-pressed', 'true');
  await expect(corazon).toHaveAccessibleName('Me encanta (1)');
  await page.reload();
  await page.locator('.nav-item', { hasText: 'Muro' }).click();
  await expect(page.locator('.ios-rrss-card', { hasText: TITULO }).first().getByRole('button', { name: 'Me encanta (1)' })).toHaveAttribute('aria-pressed', 'true');
});
