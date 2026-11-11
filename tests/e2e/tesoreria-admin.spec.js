// Tesorería (super admin): pestañas, lista "Por cobrar" por persona que paga
// y pago manual por concepto. Caso real: socia que además es apoderada de
// 2 deportistas — su cuota de socio y la mensualidad de cada hijo se ven y
// se registran por separado (antes, el pago manual del hijo se guardaba
// como "Mensualidad Socio" y saldaba la cuota de la madre).
import { test, expect } from '@playwright/test';
import { CUENTAS, JUGADORES, crearPool, crearDatosPrueba, limpiarDatosPrueba, iniciarSesion } from './fixtures/cuentasPrueba.js';

const pool = crearPool();
const HIJO2 = { rut: '99700012-K', nombres: 'E2E HijoDos' };

test.describe.configure({ mode: 'serial' });
test.setTimeout(90000);
test.beforeAll(async () => {
  await crearDatosPrueba(pool);
  // Dígito verificador correcto para 99700012.
  const cuerpo = '99700012';
  let suma = 0; let mul = 2;
  for (const d of cuerpo.split('').reverse()) { suma += Number(d) * mul; mul = mul === 7 ? 2 : mul + 1; }
  const r = 11 - (suma % 11);
  HIJO2.rut = `${cuerpo}-${r === 11 ? '0' : r === 10 ? 'K' : r}`;
  await pool.query('DELETE FROM jugadores WHERE rut_jugador = $1', [HIJO2.rut]);
  await pool.query(
    `INSERT INTO jugadores (rut_jugador, nombres, apellido_paterno, rama, categoria, fecha_nacimiento, estado, rut_apoderado, correo_apoderado, fecha_ingreso)
     VALUES ($1, $2, 'Prueba', 'FEMENINA', 'SUB-13', '2013-05-05', 'ACTIVO', $3, 'e2e.socio_apoderado@test.local', '2025-12-15')`,
    [HIJO2.rut, HIJO2.nombres, CUENTAS.socio_apoderado.rut]
  );
});
test.afterAll(async () => {
  await pool.query('DELETE FROM pagos_mensualidades WHERE rut_jugador = $1', [HIJO2.rut]);
  await pool.query('DELETE FROM jugadores WHERE rut_jugador = $1', [HIJO2.rut]);
  await limpiarDatosPrueba(pool);
  await pool.end();
});

const irATesoreria = async (page) => {
  await iniciarSesion(page, CUENTAS.super_admin.rut);
  await page.getByRole('button', { name: 'Tesorería' }).first().click();
  await expect(page.getByRole('tab', { name: /Por cobrar/ })).toHaveAttribute('aria-selected', 'true');
};
const filaFamilia = (page) => page.locator('article.tc-fila', { hasText: 'E2E SocioApoderado' });

test('la socia-apoderada aparece una vez, con su cuota y la de cada hijo por separado', async ({ page }) => {
  await irATesoreria(page);
  await page.getByLabel('Buscar en Tesorería').fill('e2e socioapoderado');
  const fila = filaFamilia(page);
  await expect(fila).toHaveCount(1);
  await expect(fila.locator('.tc-perfil')).toHaveText(['Socio', 'Apoderado de 2']);
  await expect(fila.locator('.tc-linea')).toHaveCount(3);
  await expect(fila.locator('.tc-linea', { hasText: 'Cuota de socio' })).toBeVisible();
  await expect(fila.locator('.tc-linea', { hasText: 'E2E HijoSocio Prueba' })).toBeVisible();
  await expect(fila.locator('.tc-linea', { hasText: 'E2E HijoDos Prueba' })).toBeVisible();

  // Buscar por el nombre de un hijo encuentra a la familia.
  await page.getByLabel('Buscar en Tesorería').fill('hijodos');
  await expect(filaFamilia(page)).toHaveCount(1);
});

test('en el celular la lista se lee sin desplazamiento horizontal', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await irATesoreria(page);
  await page.getByLabel('Buscar en Tesorería').fill('e2e');
  await page.getByRole('button', { name: 'Todas', exact: true }).click();
  await expect(filaFamilia(page)).toBeVisible();
  const anchoExtra = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(anchoExtra).toBeLessThanOrEqual(1);
  await page.screenshot({ path: testInfo.outputPath('tesoreria-movil.png'), fullPage: false });
  await filaFamilia(page).scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath('tesoreria-movil-fila.png'), fullPage: false });
});

test('pago manual de un hijo: queda como mensualidad del hijo, no como cuota de socio', async ({ page }) => {
  await irATesoreria(page);
  await page.getByLabel('Buscar en Tesorería').fill('e2e socioapoderado');
  const lineaHijo = filaFamilia(page).locator('.tc-linea', { hasText: 'E2E HijoSocio Prueba' });
  await lineaHijo.getByRole('button', { name: /Pago/ }).click();

  await expect(page.getByText('Deportista seleccionado:')).toBeVisible();
  await expect(page.getByText(/Paga: E2E SocioApoderado Prueba/)).toBeVisible();
  await page.getByRole('button', { name: 'Ene', exact: true }).click();
  await page.getByRole('button', { name: 'Registrar y Confirmar' }).click();
  // Confirmación explícita del pago manual (queda aprobado sin bandeja).
  await page.getByRole('dialog').getByRole('button', { name: 'Registrar y confirmar' }).click();
  await expect(page.getByText(/Cargo de pago listo: pago registrado y confirmado/).first()).toBeVisible({ timeout: 15000 });
  await expect(page.getByText('Deportista seleccionado:')).toHaveCount(0, { timeout: 15000 });
  // Sigue en Tesorería (antes recargaba la página entera y volvía al menú).
  await expect(page.getByRole('tab', { name: /Por cobrar/ })).toBeVisible();
  await expect(page.getByLabel('Buscar en Tesorería')).toHaveValue('e2e socioapoderado');

  const pagos = (await pool.query(
    'SELECT concepto_pago, rut_jugador, rut_pagos, estado_pago, meses_correspondientes FROM pagos_mensualidades WHERE rut_pagos = $1 OR rut_jugador = $2',
    [CUENTAS.socio_apoderado.rut, JUGADORES.hijoSocio.rut]
  )).rows;
  expect(pagos).toHaveLength(1);
  expect(pagos[0].concepto_pago).not.toMatch(/socio/i);
  expect(pagos[0]).toMatchObject({ rut_jugador: JUGADORES.hijoSocio.rut, rut_pagos: CUENTAS.socio_apoderado.rut, estado_pago: 'aprobado' });

  // Enero de la cuota de socio sigue pendiente: el formulario de socio no lo bloquea.
  await page.reload();
  await page.getByRole('button', { name: 'Tesorería' }).first().click({ timeout: 20000 });
  await page.getByLabel('Buscar en Tesorería').fill('e2e socioapoderado');
  const lineaSocio = filaFamilia(page).locator('.tc-linea', { hasText: 'Cuota de socio' });
  await expect(lineaSocio.locator('.tc-meses')).toContainText('Ene');
  await expect(filaFamilia(page).locator('.tc-linea', { hasText: 'E2E HijoSocio Prueba' }).locator('.tc-meses')).not.toContainText('Ene');
  await lineaSocio.getByRole('button', { name: /Pago/ }).click();
  await expect(page.getByRole('button', { name: 'Ene', exact: true })).toBeEnabled();
});

test('"Ver cuenta" abre la cuenta de la familia con ambos hijos', async ({ page }) => {
  await irATesoreria(page);
  await page.getByLabel('Buscar en Tesorería').fill('e2e socioapoderado');
  await filaFamilia(page).getByRole('button', { name: /Ver cuenta/ }).click();
  await expect(page.getByText(/Revisando cuenta de:/)).toContainText('E2E SocioApoderado Prueba');
  await expect(page.getByText('Cuotas de Socio').first()).toBeVisible();
  await expect(page.getByText(/E2E HijoSocio/).last()).toBeVisible();
  await expect(page.getByText(/E2E HijoDos/).last()).toBeVisible();
});

test('revisión: un pago del hijo guardado como cuota de socio se pasa a mensualidad', async ({ page }) => {
  // Así quedaban los pagos manuales antes de la corrección.
  const { rows: [malo] } = await pool.query(
    `INSERT INTO pagos_mensualidades (rut_jugador, rut_pagos, concepto_pago, cantidad_meses_pagados, meses_correspondientes, monto_total_pagado, estado_pago)
     VALUES ($1, $2, 'Mensualidad Socio', 1, 'Febrero 2026', 30000, 'aprobado') RETURNING id`,
    [HIJO2.rut, CUENTAS.socio_apoderado.rut]
  );
  await irATesoreria(page);
  await expect(page.getByRole('button', { name: /guardado como cuota de socio/ })).toBeVisible();
  await page.getByRole('button', { name: /guardado como cuota de socio/ }).click();
  await expect(page.getByRole('tab', { name: /Validar pagos/ })).toHaveAttribute('aria-selected', 'true');

  const item = page.locator('.rc-item', { hasText: 'E2E HijoDos Prueba' });
  await expect(item).toContainText('Febrero 2026');
  await expect(item).toContainText('Pagó: E2E SocioApoderado Prueba');
  await item.getByRole('button', { name: 'Es mensualidad del deportista' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Pasar a mensualidad' }).click();
  await expect(page.getByText('1 pago pasó a mensualidad del deportista.')).toBeVisible({ timeout: 15000 });
  await expect(page.locator('.rc-item', { hasText: 'E2E HijoDos Prueba' })).toHaveCount(0);

  const { rows: [corregido] } = await pool.query('SELECT concepto_pago, rut_jugador, estado_pago, notas_tesoreria FROM pagos_mensualidades WHERE id = $1', [malo.id]);
  expect(corregido).toMatchObject({ concepto_pago: 'Mensualidad', rut_jugador: HIJO2.rut, estado_pago: 'aprobado' });
  expect(corregido.notas_tesoreria).toMatch(/Reclasificado de "Mensualidad Socio" a "Mensualidad".*E2E SuperAdmin/);
});

test('condonar: el mes queda al día con $0 y nota "Deuda condonada"', async ({ page }) => {
  await irATesoreria(page);
  await page.getByLabel('Buscar en Tesorería').fill('hijodos');
  await filaFamilia(page).locator('.tc-linea', { hasText: 'E2E HijoDos Prueba' }).getByRole('button', { name: /Pago/ }).click();
  await page.getByRole('button', { name: 'Mar', exact: true }).click();
  await page.getByText(/Condonar la deuda de este mes/).click();
  await page.getByRole('button', { name: 'Registrar y Confirmar' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Condonar' }).click();
  await expect(page.getByText(/Deuda condonada \(1 mes\)/)).toBeVisible({ timeout: 15000 });
  const { rows } = await pool.query(
    "SELECT monto_total_pagado, notas_tesoreria, estado_pago FROM pagos_mensualidades WHERE rut_jugador = $1 AND meses_correspondientes ILIKE 'marzo%'",
    [HIJO2.rut]
  );
  expect(rows).toHaveLength(1);
  expect(Number(rows[0].monto_total_pagado)).toBe(0);
  expect(rows[0].notas_tesoreria).toMatch(/^Deuda condonada/);
});

test('informe por categoría: filtra y descarga la imagen', async ({ page }, testInfo) => {
  await irATesoreria(page);
  await page.getByRole('tab', { name: /Informes/ }).click();
  await page.getByLabel('Estado').selectOption('todos');
  await page.getByLabel('Buscar en el informe').fill('e2e');
  const tabla = page.locator('.id-tabla');
  await expect(tabla.locator('.id-grupo', { hasText: 'SUB-15' })).toBeVisible();
  // HijoDos: marzo condonado en la prueba anterior.
  const filaHijo2 = tabla.locator('tr', { hasText: 'E2E HijoDos' });
  await expect(filaHijo2.locator('td.id-condonado')).toHaveCount(1);
  await page.getByLabel('Categoría', { exact: true }).selectOption('SUB-15');
  await expect(tabla.locator('.id-grupo')).toHaveCount(1);
  const [descarga] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Descargar imagen' }).click(),
  ]);
  expect(descarga.suggestedFilename()).toMatch(/^informe-deuda-deportistas-.*sub-15.*\.png$/);
  await descarga.saveAs(testInfo.outputPath('informe-sub-15.png'));
  await page.getByRole('tab', { name: 'Socios' }).click();
  await expect(tabla.locator('tr', { hasText: 'E2E SocioApoderado' })).toBeVisible();
});

test('las pestañas separan Validar pagos y Resumen', async ({ page }) => {
  await irATesoreria(page);
  await page.getByRole('tab', { name: /Validar pagos/ }).click();
  await expect(page.getByText('Bandeja de Validación')).toBeVisible();
  await expect(page.locator('article.tc-fila')).toHaveCount(0);
  await page.getByRole('tab', { name: /Resumen/ }).click();
  await expect(page.getByText('Panorama General')).toBeVisible();
});
