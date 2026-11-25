// Resultados: se publica el próximo partido (fecha, hora, lugar) dirigido a una
// categoría; solo esas familias lo ven, y después se carga el resultado.
import { test, expect } from '@playwright/test';
import { CUENTAS, JUGADORES, PASSWORD_PRUEBA, crearPool, crearDatosPrueba, limpiarDatosPrueba, iniciarSesion } from './fixtures/cuentasPrueba.js';

const pool = crearPool();
const API = process.env.E2E_API_URL || 'http://localhost:3000/api';
const RIVAL = 'E2E Rival Próximo';
test.describe.configure({ mode: 'serial' });
test.setTimeout(120000);
test.beforeAll(async () => { await crearDatosPrueba(pool); });
test.afterAll(async () => {
  await pool.query('DELETE FROM partidos_live WHERE equipo_visitante = $1', [RIVAL]);
  await limpiarDatosPrueba(pool);
  await pool.end();
});

const token = async (request, rut) => (await (await request.post(`${API}/auth/login`, { data: { rut, password: PASSWORD_PRUEBA } })).json()).token;
const rivales = async (request, tk) => {
  const r = await request.get(`${API}/partidos-live`, tk ? { headers: { Authorization: `Bearer ${tk}` } } : {});
  return (await r.json()).filter((p) => p.equipo_visitante === RIVAL);
};

test('admin publica el próximo partido para su categoría y ve a quién llega', async ({ page }) => {
  await iniciarSesion(page, CUENTAS.super_admin.rut);
  await page.getByRole('button', { name: 'Resultados' }).first().click();
  await expect(page.getByRole('radio', { name: 'Próximo partido' })).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByLabel('Puntos local *')).toHaveCount(0);
  await page.getByPlaceholder('Nombre equipo visitante').fill(RIVAL);
  await page.locator('select').filter({ has: page.locator('option', { hasText: 'Femenina' }) }).first().selectOption('Masculina');
  await page.locator('select').filter({ has: page.locator('option', { hasText: 'SUB-13' }) }).first().selectOption('SUB-13');
  await page.getByPlaceholder('Ej: Gimnasio CCF').fill('Gimnasio CCF');
  await page.locator('input[type="date"]').first().fill('2099-11-29');
  await page.locator('input[type="time"]').fill('15:00');
  const resumen = page.locator('.ap-resumen');
  await expect(resumen).toContainText('Para: Masculina SUB-13');
  await page.locator('.ap-audiencia').screenshot({ path: 'test-results/audiencia-partido.png' });
  await page.getByRole('button', { name: 'Publicar próximo partido' }).click();
  await expect(page.getByText(/Próximo partido publicado\. Para: Masculina SUB-13/)).toBeVisible({ timeout: 10000 });
});

test('solo lo ven las familias de esa categoría (ni otras ni la portada)', async ({ request }) => {
  expect(await rivales(request, await token(request, CUENTAS.apoderado.rut))).toHaveLength(1); // pupilo MASCULINA SUB-13
  expect(await rivales(request, await token(request, CUENTAS.socio_apoderado.rut))).toHaveLength(0); // hijo SUB-15
  expect(await rivales(request, null)).toHaveLength(0);
  expect(await rivales(request, await token(request, CUENTAS.staff.rut))).toHaveLength(1);
  const [p] = await rivales(request, await token(request, CUENTAS.admin.rut));
  expect(p).toMatchObject({ estado_juego: 'pendiente', hora_partido: '15:00', audiencia: { tipo: 'categoria' } });
});

test('la familia ve la tarjeta de próximo partido en el Muro', async ({ page }) => {
  await iniciarSesion(page, CUENTAS.apoderado.rut);
  await page.getByRole('button', { name: 'Resultados' }).first().click();
  const tarjeta = page.getByRole('article', { name: `Próximo partido contra ${RIVAL}` });
  await expect(tarjeta).toContainText('15:00 hrs');
  await expect(tarjeta).toContainText('Gimnasio CCF');
  await expect(tarjeta).toContainText('29 de noviembre');
  await page.addStyleTag({ content: '.bottom-nav, nav { display: none !important; }' });
  await tarjeta.screenshot({ path: 'test-results/proximo-partido.png' });
});

test('después se carga el resultado sobre el mismo partido', async ({ request }) => {
  const tk = await token(request, CUENTAS.admin.rut);
  const [p] = await rivales(request, tk);
  await request.put(`${API}/partidos-live/${p.id_partido}`, { headers: { Authorization: `Bearer ${tk}` }, data: { pts_local: 61, pts_visitante: 48, estado_juego: 'finalizado' } });
  const [fin] = await rivales(request, await token(request, CUENTAS.apoderado.rut));
  expect(fin).toMatchObject({ estado_juego: 'finalizado', pts_local: 61, audiencia: { tipo: 'categoria' } });
  expect(JUGADORES.pupilo.categoria).toBe('SUB-13');
});
