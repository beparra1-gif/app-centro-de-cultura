// Socio + apoderado: la cuota de socio y la mensualidad del pupilo son
// controles de meses INDEPENDIENTES. Se pueden pagar por separado o juntas
// (un solo comprobante), pero pagar uno nunca marca el otro.
// También: un socio sin pupilos ve su propia grilla de cuota de socio.
import { test, expect } from '@playwright/test';
import { CUENTAS, JUGADORES, crearPool, crearDatosPrueba, limpiarDatosPrueba, iniciarSesion } from './fixtures/cuentasPrueba.js';

const pool = crearPool();
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');

test.describe.configure({ mode: 'serial' });
test.beforeAll(async () => { await crearDatosPrueba(pool); });
test.afterAll(async () => { await limpiarDatosPrueba(pool); await pool.end(); });

const pagosFamilia = async () => (await pool.query(
  `SELECT concepto_pago, meses_correspondientes, rut_jugador, rut_pagos, estado_pago
   FROM pagos_mensualidades WHERE rut_pagos = $1 OR rut_jugador = $2 ORDER BY id`,
  [CUENTAS.socio_apoderado.rut, JUGADORES.hijoSocio.rut]
)).rows;

const grillaSocio = (page) => page.locator('div.mb-20', { has: page.getByText('Cuotas de Socio') }).locator('.grid-12-meses, .lista-12-meses');
const grillaHijo = (page) => page.locator('div.mb-15', { has: page.getByText(/Mensualidad Deportista/) }).locator('.grid-12-meses, .lista-12-meses');
const mes = (grilla, nombre) => grilla.locator('button.mes-box', { hasText: nombre });

const irAMiCuenta = async (page, rol) => {
  await iniciarSesion(page, CUENTAS[rol].rut);
  await page.locator('.nav-item', { hasText: 'Mi Cuenta' }).click();
  await expect(page.getByText('Panel de Pagos 2026')).toBeVisible({ timeout: 10000 });
};

const enviarComprobante = async (page) => {
  await page.locator('input[type="file"]').last().setInputFiles({ name: 'comprobante.png', mimeType: 'image/png', buffer: PNG });
  await expect(page.getByText(/ha recibido tu comprobante/i)).toBeVisible({ timeout: 15000 });
};

test('socio sin pupilos ve y paga su propia grilla de cuota de socio', async ({ page }) => {
  await irAMiCuenta(page, 'socio');
  const socio = grillaSocio(page);
  await expect(socio).toBeVisible();
  await expect(mes(socio, 'Mar')).toHaveClass(/mes-pendiente/);
  await expect(page.getByText(/Mensualidad Deportista/)).toHaveCount(0);
  // Sin hijos a cargo no hay pestaña "Pupilos" vacía.
  await expect(page.locator('.nav-item', { hasText: 'Pupilos' })).toHaveCount(0);
});

test('socio+apoderado paga SOLO la cuota de socio: el pupilo no cambia', async ({ page }, testInfo) => {
  await irAMiCuenta(page, 'socio_apoderado');
  await expect(grillaSocio(page)).toBeVisible();
  await expect(grillaHijo(page)).toBeVisible();

  await mes(grillaSocio(page), 'Ene').click();
  await enviarComprobante(page);

  const pagos = await pagosFamilia();
  expect(pagos).toHaveLength(1);
  expect(pagos[0]).toMatchObject({ concepto_pago: 'Mensualidad Socio', meses_correspondientes: 'ene-2026', rut_jugador: null, estado_pago: 'pendiente' });

  await page.reload();
  await page.locator('.nav-item', { hasText: 'Mi Cuenta' }).click();
  await expect(mes(grillaSocio(page), 'Ene')).toHaveClass(/mes-en-revision/, { timeout: 10000 });
  await expect(mes(grillaHijo(page), 'Ene')).toHaveClass(/mes-pendiente/);
  await page.screenshot({ path: testInfo.outputPath('socio-ene-en-revision.png'), fullPage: true });
});

test('socio+apoderado paga ambas juntas con un comprobante', async ({ page }) => {
  await irAMiCuenta(page, 'socio_apoderado');
  await mes(grillaSocio(page), 'Feb').click();
  await mes(grillaHijo(page), 'Feb').click();
  await enviarComprobante(page);

  const pagos = await pagosFamilia();
  const nuevos = pagos.filter((p) => p.meses_correspondientes === 'feb-2026');
  expect(nuevos.map((p) => p.concepto_pago).sort()).toEqual(['Mensualidad', 'Mensualidad Socio']);
  expect(nuevos.find((p) => p.concepto_pago === 'Mensualidad').rut_jugador).toBe(JUGADORES.hijoSocio.rut);
  expect(nuevos.find((p) => p.concepto_pago === 'Mensualidad Socio').rut_jugador).toBeNull();
});

test('tras aprobar, cada grilla y cada deuda se calculan por separado', async ({ page }, testInfo) => {
  await pool.query(
    "UPDATE pagos_mensualidades SET estado_pago = 'aprobado' WHERE rut_pagos = $1 OR rut_jugador = $2",
    [CUENTAS.socio_apoderado.rut, JUGADORES.hijoSocio.rut]
  );
  await irAMiCuenta(page, 'socio_apoderado');
  const socio = grillaSocio(page);
  const hijo = grillaHijo(page);
  // Socio pagó Ene+Feb; el hijo solo Feb.
  await expect(mes(socio, 'Ene')).toHaveClass(/mes-pagado/, { timeout: 10000 });
  await expect(mes(socio, 'Feb')).toHaveClass(/mes-pagado/);
  await expect(mes(hijo, 'Ene')).toHaveClass(/mes-pendiente/);
  await expect(mes(hijo, 'Feb')).toHaveClass(/mes-pagado/);
  // Deuda desglosada: socio Mar..Oct = 8, hijo Ene + Mar..Oct = 9.
  await expect(page.getByText(/Cuota de socio · 8 meses/)).toBeVisible();
  await expect(page.getByText(/Mensualidad deportista · 9 meses/)).toBeVisible();
  await expect(page.getByText('17 meses adeudados')).toBeVisible();
  // La deuda del hijo usa la MISMA cuota que muestra su tarjeta (tarifa
  // socio+apoderado), no la cuota general.
  const cuotaTexto = await page.getByText(/Cuota vigente: \$[\d.]+ \/ mes/).first().innerText();
  const cuotaHijo = Number(cuotaTexto.match(/\$([\d.]+)/)[1].replace(/\./g, ''));
  const filaHijo = page.locator('.desglose-deuda div', { hasText: 'Mensualidad deportista' });
  await expect(filaHijo).toContainText(`-$${(9 * cuotaHijo).toLocaleString('es-CL')}`);
  await page.screenshot({ path: testInfo.outputPath('socio-apoderado-deudas.png'), fullPage: true });
});
