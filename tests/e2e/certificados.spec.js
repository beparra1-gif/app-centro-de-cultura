// Certificados del club: el apoderado los solicita en Mi Cuenta, el admin
// carga firmas/timbre, emite (PDF con QR) o rechaza, la familia descarga, y
// cualquiera valida el QR en la página pública (anulado = deja de ser válido).
import fs from 'node:fs';
import { test, expect } from '@playwright/test';
import { CUENTAS, JUGADORES, PASSWORD_PRUEBA, crearPool, crearDatosPrueba, limpiarDatosPrueba, iniciarSesion } from './fixtures/cuentasPrueba.js';

const pool = crearPool();
const API = process.env.E2E_API_URL || 'http://localhost:3000/api';
const rutsFamilia = [JUGADORES.pupilo.rut, JUGADORES.hijoSocio.rut];
let recursosPrevios = [];

const limpiar = async () => {
  await pool.query('DELETE FROM certificados WHERE rut_jugador = ANY($1)', [rutsFamilia]);
};

test.describe.configure({ mode: 'serial' });
test.setTimeout(120000);
test.beforeAll(async () => {
  await limpiar();
  await crearDatosPrueba(pool);
  recursosPrevios = (await pool.query('SELECT clave FROM certificados_recursos')).rows.map((r) => r.clave);
});
test.afterAll(async () => {
  await limpiar();
  // Solo se borran las imágenes que la prueba cargó (no las reales del entorno local).
  await pool.query('DELETE FROM certificados_recursos WHERE NOT (clave = ANY($1))', [recursosPrevios]);
  await limpiarDatosPrueba(pool);
  await pool.end();
});

const tokenDe = async (request, rut) => (await (await request.post(`${API}/auth/login`, { data: { rut, password: PASSWORD_PRUEBA } })).json()).token;
// La barra inferior fija puede tapar un botón al final de la pantalla: se centra antes del clic.
const clicCentrado = async (boton) => {
  await boton.evaluate((el) => el.scrollIntoView({ block: 'center' }));
  await boton.click();
};
const certDe = async (tipo) => (await pool.query('SELECT * FROM certificados WHERE rut_jugador = $1 AND tipo = $2', [JUGADORES.pupilo.rut, tipo])).rows[0];

test('el apoderado solicita certificados desde Mi Cuenta', async ({ page }) => {
  await iniciarSesion(page, CUENTAS.apoderado.rut);
  await page.locator('.nav-item', { hasText: 'Mi Cuenta' }).click();
  const panel = page.getByTestId('certificados-familia');
  await expect(panel).toBeVisible({ timeout: 15000 });

  await panel.getByLabel('Tipo de certificado').selectOption('alumno_regular');
  await panel.getByRole('button', { name: 'Solicitar certificado' }).click();
  await expect(page.getByText(/Solicitud enviada/)).toBeVisible({ timeout: 10000 });

  await panel.getByLabel('Tipo de certificado').selectOption('participacion_permiso');
  await panel.getByLabel('Va dirigido a (tipo de establecimiento)').selectOption('Liceo');
  await panel.getByLabel('Nombre del establecimiento').fill('E2E Bicentenario');
  await panel.getByRole('button', { name: 'Solicitar certificado' }).click();
  await expect(panel.getByText('En revisión')).toHaveCount(2, { timeout: 10000 });

  // El pupilo de prueba no tiene pagos: se le avisa que solo se emite al día.
  await panel.getByLabel('Tipo de certificado').selectOption('vigencia_pago');
  await expect(panel.getByRole('alert')).toContainText(/Registra \d+ mensualidades? pendientes?.*solo se emite con todas las mensualidades al día/);
  await panel.getByRole('button', { name: 'Solicitar certificado' }).click();
  await expect(panel.getByText('En revisión')).toHaveCount(3, { timeout: 10000 });

  await panel.getByLabel('Tipo de certificado').selectOption('permanencia_participacion');
  await panel.getByRole('button', { name: 'Solicitar certificado' }).click();
  await expect(panel.getByText('En revisión')).toHaveCount(4, { timeout: 10000 });

  await panel.getByLabel('Tipo de certificado').selectOption('liberacion');
  await panel.getByRole('button', { name: 'Solicitar certificado' }).click();
  await expect(panel.getByText('En revisión')).toHaveCount(5, { timeout: 10000 });

  // Repetir uno pendiente no duplica.
  await panel.getByLabel('Tipo de certificado').selectOption('alumno_regular');
  await panel.getByRole('button', { name: 'Solicitar certificado' }).click();
  await expect(page.getByText('Ya hay una solicitud pendiente de ese certificado.')).toBeVisible({ timeout: 10000 });

  const { rows } = await pool.query("SELECT tipo, estado, presentado_ante FROM certificados WHERE rut_jugador = $1 ORDER BY id", [JUGADORES.pupilo.rut]);
  expect(rows).toEqual([
    { tipo: 'alumno_regular', estado: 'pendiente', presentado_ante: null },
    { tipo: 'participacion_permiso', estado: 'pendiente', presentado_ante: 'Liceo E2E Bicentenario' },
    { tipo: 'vigencia_pago', estado: 'pendiente', presentado_ante: null },
    { tipo: 'permanencia_participacion', estado: 'pendiente', presentado_ante: null },
    { tipo: 'liberacion', estado: 'pendiente', presentado_ante: null },
  ]);
});

test('nadie más puede pedir ni emitir por esa familia', async ({ request }) => {
  const otro = { Authorization: `Bearer ${await tokenDe(request, CUENTAS.socio_apoderado.rut)}` };
  const ajeno = await request.post(`${API}/certificados`, { headers: otro, data: { rut_jugador: JUGADORES.pupilo.rut, tipo: 'alumno_regular' } });
  expect(ajeno.status()).toBe(403);
  const visibles = await (await request.get(`${API}/certificados`, { headers: otro })).json();
  expect(visibles.some((c) => c.rut_jugador === JUGADORES.pupilo.rut)).toBe(false);
  const apoderado = { Authorization: `Bearer ${await tokenDe(request, CUENTAS.apoderado.rut)}` };
  const { id } = await certDe('alumno_regular');
  expect((await request.post(`${API}/certificados/${id}/emitir`, { headers: apoderado, data: {} })).status()).toBe(403);
  // El permiso escolar exige a quién va dirigido.
  const sinDestino = await request.post(`${API}/certificados`, { headers: apoderado, data: { rut_jugador: JUGADORES.pupilo.rut, tipo: 'participacion_permiso' } });
  expect(sinDestino.status()).toBe(400);
});

test('el admin carga firmas, emite (PDF con QR) y rechaza', async ({ page, request }) => {
  await iniciarSesion(page, CUENTAS.super_admin.rut);
  await expect(page.getByTitle('5 por emitir')).toBeVisible({ timeout: 15000 });
  await page.getByRole('button', { name: /^Certificados/ }).first().click();
  const panel = page.getByTestId('certificados-admin');
  await expect(panel.getByText(/Faltan imágenes de firma o timbre/)).toBeVisible();

  // Firmas y timbre: las reales si este equipo tiene recursos-certificados/
  // (no se versiona), si no un trazo azul dibujado como reemplazo.
  await panel.getByRole('button', { name: 'Firmas y timbre' }).click();
  const trazo = Buffer.from((await page.evaluate(() => {
    const c = document.createElement('canvas');
    c.width = 300; c.height = 120;
    const ctx = c.getContext('2d');
    ctx.strokeStyle = '#1a237e'; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(10, 90); ctx.bezierCurveTo(80, 0, 160, 120, 290, 30); ctx.stroke();
    return c.toDataURL('image/png');
  })).split(',')[1], 'base64');
  const archivo = (clave) => (fs.existsSync(`recursos-certificados/${clave}.png`)
    ? `recursos-certificados/${clave}.png`
    : { name: `${clave}.png`, mimeType: 'image/png', buffer: trazo });
  for (const [clave, etiqueta] of [['firma_secretario', /Firma de secretario/], ['firma_presidente', /Firma de presidencia/], ['timbre', /Timbre/]]) {
    await panel.getByLabel(etiqueta).setInputFiles(archivo(clave));
    await expect(page.getByText('Imagen guardada.').last()).toBeVisible({ timeout: 10000 });
  }
  await expect(panel.getByText(/Faltan imágenes/)).toHaveCount(0, { timeout: 10000 });

  await panel.getByRole('button', { name: /Por emitir/ }).click();
  const fila = (texto) => panel.locator('div', { has: page.getByText(texto) }).filter({ has: page.getByRole('button', { name: /Revisar y emitir/ }) }).last();

  // Alumno regular: emitir y descargar el PDF.
  await fila('Certificado de alumno regular').getByRole('button', { name: /Revisar y emitir/ }).click();
  const [pdf] = await Promise.all([
    page.waitForEvent('download', { timeout: 20000 }),
    clicCentrado(panel.getByRole('button', { name: /Emitir y descargar/ })),
  ]);
  expect(pdf.suggestedFilename()).toMatch(/^CCF-\d{4}-\d{5} - Certificado de alumno regular - E2E Pupilo/);
  await pdf.saveAs('test-results/certificados/alumno-regular.pdf'); // para revisarlo a ojo
  const ruta = await pdf.path();
  const bytes = fs.readFileSync(ruta);
  expect(bytes.subarray(0, 4).toString()).toBe('%PDF');
  expect(bytes.length).toBeGreaterThan(20000); // logo + firmas + QR
  expect(bytes.length).toBeLessThan(600000); // liviano para WhatsApp/correo (el logo original pesa 5 MB)

  const alumno = await certDe('alumno_regular');
  expect(alumno.estado).toBe('emitido');
  expect(alumno.folio).toMatch(/^CCF-\d{4}-\d{5}$/);
  expect(alumno.codigo_verificacion).toMatch(/^[A-Z2-9]{12}$/);
  expect(alumno.datos).toMatchObject({ nombre: 'E2E Pupilo Prueba', rut: JUGADORES.pupilo.rut, categoria: 'SUB-13', rama: 'MASCULINA', fecha_nacimiento: '2013-03-15' });
  // Vigencia de 90 días según la plantilla.
  const dias = Math.round((new Date(alumno.vigencia_hasta) - new Date(alumno.datos.fecha_emision)) / 86400000);
  expect(dias).toBe(90);

  // Participación y permiso: tabla de horario semanal (se registra tal cual) y destinatario.
  await fila('Certificado de participación y permiso').getByRole('button', { name: /Revisar y emitir/ }).click();
  await expect(panel.getByLabel(/Establecimiento educacional/)).toHaveValue('Liceo E2E Bicentenario');
  await panel.getByLabel(/Establecimiento educacional/).fill('Liceo E2E Bicentenario Corregido');
  const horario = { Lunes: ['17:30', '19:00'], Miércoles: ['19:00', '20:30'] };
  for (const dia of ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']) {
    const casilla = panel.getByRole('checkbox', { name: dia, exact: true });
    await casilla.setChecked(Boolean(horario[dia]));
    if (horario[dia]) {
      await panel.getByLabel(`${dia}: desde`).fill(horario[dia][0]);
      await panel.getByLabel(`${dia}: hasta`).fill(horario[dia][1]);
    }
  }
  const [pdfPermiso] = await Promise.all([page.waitForEvent('download', { timeout: 20000 }), clicCentrado(panel.getByRole('button', { name: /Emitir y descargar/ }))]);
  await pdfPermiso.saveAs('test-results/certificados/participacion-permiso.pdf');
  const permiso = await certDe('participacion_permiso');
  expect(permiso.datos.presentado_ante).toBe('Liceo E2E Bicentenario Corregido');
  expect(permiso.datos.extra.horario_semana).toEqual([
    { dia: 'Lunes', desde: '17:30', hasta: '19:00' },
    { dia: 'Miércoles', desde: '19:00', hasta: '20:30' },
  ]);
  expect(permiso.vigencia_hasta).toBeNull();

  // Permanencia y participación: ninguna competición viene marcada; el admin elige.
  await fila('Certificado de permanencia y participación').getByRole('button', { name: /Revisar y emitir/ }).click();
  await expect(panel.getByRole('checkbox', { name: 'Liga Lib Centro Damas.' })).not.toBeChecked();
  await clicCentrado(panel.getByRole('button', { name: /Emitir y descargar/ }));
  await expect(page.getByText('Marca o escribe al menos una competición.')).toBeVisible();
  await panel.getByRole('checkbox', { name: 'Liga Lib Centro Damas.' }).check();
  await panel.getByLabel('Otras competiciones (una por línea)').fill('Copa E2E 2026');
  const [pdfPermanencia] = await Promise.all([page.waitForEvent('download', { timeout: 20000 }), clicCentrado(panel.getByRole('button', { name: /Emitir y descargar/ }))]);
  await pdfPermanencia.saveAs('test-results/certificados/permanencia-participacion.pdf');
  expect((await certDe('permanencia_participacion')).datos.extra.torneos).toEqual(['Liga Lib Centro Damas.', 'Copa E2E 2026']);

  // Vigencia y pago: con mensualidades pendientes no se puede emitir.
  await fila('Certificado de vigencia y pago de cuota').getByRole('button', { name: /Revisar y emitir/ }).click();
  await expect(panel.getByRole('alert').first()).toContainText(/No se puede emitir hasta que todas estén pagadas/);
  await expect(panel.getByRole('button', { name: /Emitir y descargar/ })).toBeDisabled();
  // Tampoco llamando a la API sin la confirmación de que está al día.
  const admin = { Authorization: `Bearer ${await tokenDe(request, CUENTAS.super_admin.rut)}` };
  const vig = await certDe('vigencia_pago');
  const forzado = await request.post(`${API}/certificados/${vig.id}/emitir`, { headers: admin, data: { extra: { monto_cuota: 30000 } } });
  expect(forzado.status()).toBe(400);
  expect((await forzado.json()).error).toMatch(/al día/);

  // Queda al día (ingresó este mes: sin meses cobrables vencidos) → se habilita.
  await pool.query("UPDATE jugadores SET fecha_ingreso = date_trunc('month', now()) WHERE rut_jugador = $1", [JUGADORES.pupilo.rut]);
  await page.reload();
  await page.getByRole('button', { name: /^Certificados/ }).first().click();
  await fila('Certificado de vigencia y pago de cuota').getByRole('button', { name: /Revisar y emitir/ }).click();
  await expect(panel.getByText('Mensualidades al día.').last()).toBeVisible({ timeout: 15000 });
  await panel.getByLabel('Cuota mensual ($)').fill('30000');
  const [pdfCuota] = await Promise.all([page.waitForEvent('download', { timeout: 20000 }), clicCentrado(panel.getByRole('button', { name: /Emitir y descargar/ }))]);
  await pdfCuota.saveAs('test-results/certificados/vigencia-pago.pdf');
  const cuota = await certDe('vigencia_pago');
  expect(cuota.estado).toBe('emitido');
  expect(cuota.datos.extra.monto_cuota).toBe(30000);

  // Liberación: se rechaza con motivo.
  await fila('Certificado de liberación').getByRole('button', { name: /Rechazar/ }).click();
  await page.getByRole('dialog').getByRole('textbox').fill('Registra cuotas pendientes');
  await page.getByRole('dialog').getByRole('button', { name: 'Rechazar' }).click();
  await expect(page.getByText('Solicitud rechazada.')).toBeVisible({ timeout: 10000 });
  expect((await certDe('liberacion')).estado).toBe('rechazado');
});

test('la familia descarga su certificado y ve el rechazo', async ({ page }) => {
  await iniciarSesion(page, CUENTAS.apoderado.rut);
  await page.locator('.nav-item', { hasText: 'Mi Cuenta' }).click();
  const panel = page.getByTestId('certificados-familia');
  await expect(panel.getByRole('button', { name: /Descargar PDF/ })).toHaveCount(4, { timeout: 15000 });
  await expect(panel.getByText('Motivo: Registra cuotas pendientes')).toBeVisible();
  const [pdf] = await Promise.all([page.waitForEvent('download', { timeout: 20000 }), panel.getByRole('button', { name: /Descargar PDF/ }).last().click()]);
  expect(fs.readFileSync(await pdf.path()).subarray(0, 4).toString()).toBe('%PDF');
});

test('el QR valida en la página pública y deja de valer al anular', async ({ page, request }) => {
  const alumno = await certDe('alumno_regular');
  await page.goto(`/?verificar=${alumno.codigo_verificacion}`);
  const resultado = page.getByTestId('resultado-verificacion');
  await expect(resultado.getByText('✓ Certificado válido y vigente')).toBeVisible({ timeout: 15000 });
  await expect(resultado.getByText(alumno.folio)).toBeVisible();
  await expect(resultado.getByText(/E2E Pupilo Prueba · RUT \*\*\.\*\*\*\./)).toBeVisible();
  // El RUT completo nunca se publica.
  await expect(page.getByText(JUGADORES.pupilo.rut)).toHaveCount(0);

  const inventado = await request.get(`${API}/certificados/verificar/ABCDEFGHJKMN`);
  expect(inventado.status()).toBe(404);
  const rara = await request.get(`${API}/certificados/verificar/${encodeURIComponent("1' OR 1=1")}`);
  expect(rara.status()).toBe(404);

  const admin = { Authorization: `Bearer ${await tokenDe(request, CUENTAS.super_admin.rut)}` };
  expect((await request.post(`${API}/certificados/${alumno.id}/anular`, { headers: admin, data: { motivo: 'Emitido por error' } })).status()).toBe(200);
  await page.reload();
  await expect(resultado.getByText('✗ Certificado anulado')).toBeVisible({ timeout: 15000 });

  // Sin sesión no se pueden bajar firmas.
  expect((await request.get(`${API}/certificados/${alumno.id}/recursos`)).status()).toBe(401);
});
