// Avisos de pago: Tesorería recibe una notificación cuando una familia sube
// un comprobante, y desde "Por cobrar" se envía un recordatorio en la app a
// las familias con deuda (una vez al día como máximo).
import { test, expect } from '@playwright/test';
import { CUENTAS, JUGADORES, PASSWORD_PRUEBA, crearPool, crearDatosPrueba, limpiarDatosPrueba, iniciarSesion } from './fixtures/cuentasPrueba.js';

const pool = crearPool();
const API = 'http://localhost:3000/api';
test.describe.configure({ mode: 'serial' });
test.setTimeout(90000);
test.beforeAll(async () => { await crearDatosPrueba(pool); });
test.afterAll(async () => { await limpiarDatosPrueba(pool); await pool.end(); });

const notificaciones = async (rut, referencia) => (await pool.query(
  "SELECT titulo, cuerpo FROM notificaciones_app WHERE rut_destinatario = $1 AND tipo = 'pago' AND referencia_tipo = $2 ORDER BY id",
  [rut, referencia]
)).rows;

test('cuando una familia sube un comprobante, Tesorería recibe un solo aviso', async ({ request }) => {
  const login = await request.post(`${API}/auth/login`, { data: { rut: CUENTAS.apoderado.rut, password: PASSWORD_PRUEBA } });
  const { token } = await login.json();
  for (const mes of ['enero-2026', 'febrero-2026']) {
    const r = await request.post(`${API}/pagos-mensualidades`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { rut_jugador: JUGADORES.pupilo.rut, concepto_pago: 'Mensualidad', cantidad_meses_pagados: 1, meses_correspondientes: mes, monto_total_pagado: 30000, comprobante_url: '/c.png' },
    });
    expect(r.status()).toBe(200);
  }
  await expect.poll(async () => (await notificaciones(CUENTAS.super_admin.rut, 'comprobante')).length, { timeout: 5000 }).toBe(1);
  const [aviso] = await notificaciones(CUENTAS.super_admin.rut, 'comprobante');
  expect(aviso.titulo).toBe('Comprobante de E2E Apoderado Prueba');
});

test('recordatorio en la app desde Por cobrar, sin repetir el mismo día', async ({ page }) => {
  await iniciarSesion(page, CUENTAS.super_admin.rut);
  await page.getByRole('button', { name: 'Tesorería' }).first().click();
  await page.getByLabel('Buscar en Tesorería').fill('E2E SocioApoderado');
  await expect(page.locator('article.tc-fila', { hasText: 'E2E SocioApoderado' })).toBeVisible({ timeout: 20000 });
  await page.getByRole('button', { name: 'Recordar en la app' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Enviar recordatorios' }).click();
  await expect(page.getByText(/Recordatorio enviado a 1 familia/)).toBeVisible({ timeout: 10000 });
  const [aviso] = await notificaciones(CUENTAS.socio_apoderado.rut, 'recordatorio');
  expect(aviso.cuerpo).toMatch(/^Tienes \$[\d.]+ pendiente \(cuota de socio: .*E2E HijoSocio Prueba: .*\)\. Sube tu comprobante desde el Muro\.$/);
  // Segundo envío el mismo día: se omite.
  await page.getByRole('button', { name: 'Recordar en la app' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Enviar recordatorios' }).click();
  await expect(page.getByText(/Recordatorio enviado a 0 familias \(1 omitidas/)).toBeVisible({ timeout: 10000 });
  expect(await notificaciones(CUENTAS.socio_apoderado.rut, 'recordatorio')).toHaveLength(1);
});

test('Informes → Cierre de mes: resumen por categoría y descarga en imagen', async ({ page }) => {
  await iniciarSesion(page, CUENTAS.super_admin.rut);
  await page.getByRole('button', { name: 'Tesorería' }).first().click();
  await page.getByRole('tab', { name: /Informes/ }).click();
  await page.getByRole('tab', { name: 'Cierre de mes' }).click();
  await page.getByLabel('Mes del cierre').selectOption('10');
  await expect(page.getByRole('heading', { name: 'Cierre de octubre 2026' })).toBeVisible();
  await expect(page.locator('.cm-tabla tr', { hasText: 'SUB-15' })).toBeVisible();
  const [descarga] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Descargar imagen' }).click(),
  ]);
  expect(descarga.suggestedFilename()).toBe('cierre-octubre-2026.png');
});
