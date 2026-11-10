// Primer ingreso: aviso de datos personales obligatorio, registro y
// verificación de correo, código de activación del club (WhatsApp) y cierre
// de la clave inicial "12345" para cuentas sin correo.
import bcrypt from 'bcryptjs';
import { test, expect } from '@playwright/test';
import { CUENTAS, JUGADORES, PASSWORD_PRUEBA, crearPool, crearDatosPrueba, limpiarDatosPrueba, iniciarSesion, ultimoCodigoPara } from './fixtures/cuentasPrueba.js';
import { VERSION_AVISO } from '../../src/legal/avisoPrivacidad.js';

const API = process.env.E2E_API_URL || 'http://localhost:3000/api';
const pool = crearPool();

test.describe.configure({ mode: 'serial' });
test.setTimeout(90000);
test.beforeAll(async () => { await crearDatosPrueba(pool); });
test.afterAll(async () => { await limpiarDatosPrueba(pool); await pool.end(); });

const entrarConClave = async (page, rut, password) => {
  await page.goto('/');
  await page.getByText('Ingreso Usuarios CCF').click();
  await page.getByPlaceholder('RUT').fill(rut);
  await page.getByPlaceholder('Contraseña').fill(password);
  await page.getByRole('button', { name: /ingres|entrar|acceder/i }).click();
};

const avisoDialogo = (page) => page.getByRole('dialog', { name: 'Protección de tus datos personales' });

test('el aviso de datos es obligatorio y queda registrado', async ({ page }) => {
  await pool.query('UPDATE cuentas SET consentimiento_version = NULL WHERE rut = $1', [CUENTAS.apoderado.rut]);
  await entrarConClave(page, CUENTAS.apoderado.rut, PASSWORD_PRUEBA);
  const aviso = avisoDialogo(page);
  await expect(aviso).toBeVisible({ timeout: 15000 });
  const aceptar = aviso.getByRole('button', { name: 'Acepto y continúo' });
  await expect(aceptar).toBeDisabled();
  await aviso.getByLabel(/He leído el aviso/).check();
  await expect(aceptar).toBeDisabled(); // falta la casilla de datos de salud
  await aviso.getByLabel(/datos de salud/).check();
  await aviso.getByLabel(/\(Opcional\) Autorizo el uso de fotografías/).check();
  await aceptar.click();
  await expect(aviso).toHaveCount(0);

  const cuenta = (await pool.query('SELECT id, consentimiento_version, autorizacion_imagen FROM cuentas WHERE rut = $1', [CUENTAS.apoderado.rut])).rows[0];
  expect(cuenta.consentimiento_version).toBe(VERSION_AVISO);
  expect(cuenta.autorizacion_imagen).toBe(true);
  const registro = (await pool.query('SELECT * FROM consentimientos_datos WHERE cuenta_id = $1 ORDER BY id DESC LIMIT 1', [cuenta.id])).rows[0];
  expect(registro).toMatchObject({ version: VERSION_AVISO, acepta_tratamiento: true, acepta_datos_salud: true, autoriza_imagen: true });
});

test('"No acepto" cierra la sesión', async ({ page }) => {
  await pool.query('UPDATE cuentas SET consentimiento_version = NULL WHERE rut = $1', [CUENTAS.socio.rut]);
  await entrarConClave(page, CUENTAS.socio.rut, PASSWORD_PRUEBA);
  await avisoDialogo(page).getByRole('button', { name: /No acepto/ }).click();
  await expect(page.getByText('Ingreso Usuarios CCF')).toBeVisible();
});

test('cuenta sin correo: lo registra y verifica con un código', async ({ page }) => {
  await pool.query("UPDATE cuentas SET correo = 'pendiente-99700002@actualizar.local' WHERE rut = $1", [CUENTAS.admin.rut]);
  const desde = Date.now() - 1000;
  await entrarConClave(page, CUENTAS.admin.rut, PASSWORD_PRUEBA);
  const dialogo = page.getByRole('dialog', { name: 'Registra tu correo' });
  await expect(dialogo).toBeVisible({ timeout: 15000 });
  await dialogo.getByPlaceholder('tu@correo.cl').fill('admin.verificado@test.local');
  await dialogo.getByRole('button', { name: 'Enviar código' }).click();
  const codigo = await ultimoCodigoPara('admin.verificado@test.local', desde);
  await dialogo.getByLabel('Código de 6 dígitos').fill(codigo);
  await dialogo.getByRole('button', { name: 'Confirmar correo' }).click();
  await expect(dialogo).toHaveCount(0);
  const correo = (await pool.query('SELECT correo FROM cuentas WHERE rut = $1', [CUENTAS.admin.rut])).rows[0].correo;
  expect(correo).toBe('admin.verificado@test.local');
});

test('"No tengo correo" deja continuar en esta sesión', async ({ page }) => {
  await pool.query("UPDATE cuentas SET correo = 'pendiente-99700003@actualizar.local' WHERE rut = $1", [CUENTAS.staff.rut]);
  await entrarConClave(page, CUENTAS.staff.rut, PASSWORD_PRUEBA);
  const dialogo = page.getByRole('dialog', { name: 'Registra tu correo' });
  await expect(dialogo).toBeVisible({ timeout: 15000 });
  await dialogo.getByRole('button', { name: /No tengo correo/ }).click();
  await expect(dialogo).toHaveCount(0);
  await expect(page.locator('.nav-item').first()).toBeVisible();
});

test('clave inicial 12345 cerrada para cuentas sin correo y jugadores sin cuenta', async ({ request }) => {
  await pool.query("UPDATE cuentas SET correo = 'pendiente-99700007@actualizar.local', password = $1, forzar_clave = true WHERE rut = $2",
    [await bcrypt.hash('12345', 10), CUENTAS.mesa.rut]);
  const cuenta = await request.post(`${API}/auth/login`, { data: { rut: CUENTAS.mesa.rut, password: '12345' } });
  expect(cuenta.status()).toBe(403);
  expect((await cuenta.json()).code).toBe('CLAVE_INICIAL_CERRADA');
  // Deportista sin cuenta: ya no se auto-crea una cuenta con 12345.
  const jugador = await request.post(`${API}/auth/login`, { data: { rut: JUGADORES.pupilo.rut, password: '12345' } });
  expect(jugador.status()).toBe(403);
  const sinCuentaCreada = await pool.query('SELECT 1 FROM cuentas WHERE rut = $1', [JUGADORES.pupilo.rut]);
  expect(sinCuentaCreada.rows).toHaveLength(0);
});

test('código de activación del club: admin lo genera y la cuenta sin correo lo canjea', async ({ page, browser }) => {
  // Admin genera el código desde Usuarios y Cuentas (vía su sesión real).
  const adminPage = await (await browser.newContext()).newPage();
  await iniciarSesion(adminPage, CUENTAS.super_admin.rut);
  const idMesa = (await pool.query('SELECT id FROM cuentas WHERE rut = $1', [CUENTAS.mesa.rut])).rows[0].id;
  const respuesta = await adminPage.evaluate(async ({ id, api }) => {
    const sesion = JSON.parse(Object.entries(localStorage).find(([k]) => k.includes('sesion') || k.includes('session'))?.[1] || '{}');
    const r = await fetch(`${api}/admin/cuentas/${id}/codigo-activacion`, { method: 'POST', headers: { Authorization: `Bearer ${sesion.token}` } });
    return { status: r.status, body: await r.json() };
  }, { id: idMesa, api: API });
  expect(respuesta.status).toBe(200);
  expect(respuesta.body.codigo).toMatch(/^\d{6}$/);
  expect(respuesta.body.vigencia_horas).toBe(48);
  await adminPage.context().close();

  // La persona usa "Tengo un código del club".
  await page.goto('/');
  await page.getByText('Ingreso Usuarios CCF').click();
  await page.getByRole('button', { name: /Primera vez u olvidaste/ }).click();
  await page.getByRole('button', { name: 'Tengo un código del club' }).click();
  await page.getByPlaceholder('RUT').fill(CUENTAS.mesa.rut);
  await page.getByLabel('Código de 6 dígitos').fill(respuesta.body.codigo);
  await page.getByPlaceholder('Nueva contraseña (mín. 5)').fill('MesaNueva2026!');
  await page.getByPlaceholder('Repite la nueva contraseña').fill('MesaNueva2026!');
  await page.getByRole('button', { name: 'Crear contraseña' }).click();
  await expect(page.getByText(/tu nueva contraseña quedó guardada/i)).toBeVisible();

  const login = await page.request.post(`${API}/auth/login`, { data: { rut: CUENTAS.mesa.rut, password: 'MesaNueva2026!' } });
  expect(login.status()).toBe(200);
});

// Art. 16 quáter: 14–15 años consienten sus datos pero no los de salud;
// menores de 14 solo dejan constancia de lectura (consiente el apoderado).
const fichaPropiaConEdad = async (fechaNacimiento) => {
  await pool.query('UPDATE jugadores SET fecha_nacimiento = $1 WHERE rut_jugador = $2', [fechaNacimiento, CUENTAS.jugador.rut]);
  await pool.query('UPDATE cuentas SET consentimiento_version = NULL WHERE rut = $1', [CUENTAS.jugador.rut]);
};
const ultimoRegistro = async () => (await pool.query(
  `SELECT cd.* FROM consentimientos_datos cd JOIN cuentas c ON c.id = cd.cuenta_id
   WHERE c.rut = $1 ORDER BY cd.id DESC LIMIT 1`, [CUENTAS.jugador.rut])).rows[0];

test('deportista de 15 años: consiente sus datos, la salud la autoriza el apoderado', async ({ page }) => {
  const hace15 = new Date(); hace15.setFullYear(hace15.getFullYear() - 15); hace15.setMonth(hace15.getMonth() - 1);
  await fichaPropiaConEdad(hace15.toISOString().slice(0, 10));
  await entrarConClave(page, CUENTAS.jugador.rut, PASSWORD_PRUEBA);
  const aviso = avisoDialogo(page);
  await expect(aviso.getByLabel(/autorizo al Club a tratar mis datos personales/)).toBeVisible({ timeout: 15000 });
  await expect(aviso.getByText(/mis datos de salud los autoriza mi madre, padre o apoderado/)).toBeVisible();
  await expect(aviso.getByLabel(/Autorizo expresamente el tratamiento/)).toHaveCount(0);
  await aviso.getByLabel(/autorizo al Club a tratar mis datos personales/).check();
  await aviso.getByRole('button', { name: 'Acepto y continúo' }).click();
  await expect(aviso).toHaveCount(0);
  expect(await ultimoRegistro()).toMatchObject({ tipo_registro: 'consentimiento_14_15', acepta_tratamiento: true, acepta_datos_salud: false, edad_titular: 15 });
});

test('deportista de 12 años: solo deja constancia de lectura', async ({ page, request }) => {
  const hace12 = new Date(); hace12.setFullYear(hace12.getFullYear() - 12); hace12.setMonth(hace12.getMonth() - 1);
  await fichaPropiaConEdad(hace12.toISOString().slice(0, 10));
  // Sin la constancia de lectura, el backend no registra nada.
  const login = await request.post(`${API}/auth/login`, { data: { rut: CUENTAS.jugador.rut, password: PASSWORD_PRUEBA } });
  const { token } = await login.json();
  const sinLectura = await request.post(`${API}/consentimiento`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { version: VERSION_AVISO, acepta_tratamiento: true, acepta_datos_salud: true },
  });
  expect(sinLectura.status()).toBe(400);

  await entrarConClave(page, CUENTAS.jugador.rut, PASSWORD_PRUEBA);
  const aviso = avisoDialogo(page);
  const lectura = aviso.getByLabel(/Leí este aviso\. Entiendo que mi madre, padre o apoderado/);
  await expect(lectura).toBeVisible({ timeout: 15000 });
  await expect(aviso.getByRole('checkbox')).toHaveCount(1);
  await lectura.check();
  await aviso.getByRole('button', { name: 'Acepto y continúo' }).click();
  await expect(aviso).toHaveCount(0);
  expect(await ultimoRegistro()).toMatchObject({ tipo_registro: 'lectura_menor_14', acepta_tratamiento: false, acepta_datos_salud: false, edad_titular: 12 });
});
