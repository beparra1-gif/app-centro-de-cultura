// Acceso con código por correo: primer ingreso / olvidé mi contraseña, y
// bloqueo de la clave inicial "12345" para cuentas con correo real.
// El backend de pruebas no tiene SMTP: escribe cada correo como JSON en
// backend/.correos-dev/ (ver backend/lib/correo.js) y aquí se lee el código.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';
import { test, expect } from '@playwright/test';
import { CUENTAS, PASSWORD_PRUEBA, crearPool, crearDatosPrueba, limpiarDatosPrueba, iniciarSesion } from './fixtures/cuentasPrueba.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CARPETA_CORREOS = path.join(__dirname, '../../backend/.correos-dev');
const API = 'http://localhost:3000/api';
const pool = crearPool();

test.describe.configure({ mode: 'serial' });
test.setTimeout(90000);
test.beforeAll(async () => { await crearDatosPrueba(pool); });
test.afterAll(async () => { await limpiarDatosPrueba(pool); await pool.end(); });

const ultimoCodigoPara = async (correo, desde) => {
  for (let i = 0; i < 20; i++) {
    const archivos = fs.existsSync(CARPETA_CORREOS) ? fs.readdirSync(CARPETA_CORREOS) : [];
    const candidatos = archivos
      .map((f) => path.join(CARPETA_CORREOS, f))
      .filter((f) => fs.statSync(f).mtimeMs >= desde)
      .map((f) => JSON.parse(fs.readFileSync(f, 'utf8')))
      .filter((c) => c.para === correo)
      .sort((a, b) => b.creado.localeCompare(a.creado));
    const codigo = candidatos[0]?.texto?.match(/\b(\d{6})\b/)?.[1];
    if (codigo) return codigo;
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error(`No llegó correo para ${correo}`);
};

const abrirIngreso = async (page) => {
  await page.goto('/');
  await page.getByText('Ingreso Usuarios CCF').click();
};

test('olvidé mi contraseña: código al correo y nueva clave', async ({ page, request }) => {
  const desde = Date.now() - 1000;
  await abrirIngreso(page);
  await page.getByRole('button', { name: /Primera vez u olvidaste/ }).click();
  await page.getByPlaceholder('RUT').fill(CUENTAS.socio.rut);
  await page.getByRole('button', { name: 'Enviar código a mi correo' }).click();
  await expect(page.getByRole('heading', { name: 'Crea tu contraseña' })).toBeVisible();
  await expect(page.getByText(/e2\*+\w?@test\.local/).first()).toBeVisible();

  const codigo = await ultimoCodigoPara('e2e.socio@test.local', desde);
  await page.getByLabel('Código de 6 dígitos').fill(codigo);
  await page.getByPlaceholder('Nueva contraseña (mín. 5)').fill('SocioNueva2026!');
  await page.getByPlaceholder('Repite la nueva contraseña').fill('SocioNueva2026!');
  await page.getByRole('button', { name: 'Crear contraseña' }).click();
  await expect(page.getByText(/tu nueva contraseña quedó guardada/i)).toBeVisible();

  const login = await request.post(`${API}/auth/login`, { data: { rut: CUENTAS.socio.rut, password: 'SocioNueva2026!' } });
  expect(login.status()).toBe(200);
  // El código es de un solo uso.
  const reuso = await request.post(`${API}/auth/canjear-codigo`, { data: { rut: CUENTAS.socio.rut, codigo, nuevaClave: 'OtraMas2026!' } });
  expect(reuso.status()).toBe(400);
});

test('clave inicial 12345 con correo real: el login pide el código', async ({ page }) => {
  await pool.query('UPDATE cuentas SET password = $1, forzar_clave = true WHERE rut = $2', [await bcrypt.hash('12345', 10), CUENTAS.apoderado.rut]);
  const desde = Date.now() - 1000;
  await abrirIngreso(page);
  await page.getByPlaceholder('RUT').fill(CUENTAS.apoderado.rut);
  await page.getByPlaceholder('Contraseña').fill('12345');
  await page.getByRole('button', { name: /ingres|entrar|acceder/i }).click();
  // No entra con 12345: pasa directo a ingresar el código ya enviado.
  await expect(page.getByRole('heading', { name: 'Crea tu contraseña' })).toBeVisible({ timeout: 10000 });

  const codigo = await ultimoCodigoPara('e2e.apoderado@test.local', desde);
  await page.getByLabel('Código de 6 dígitos').fill(codigo);
  await page.getByPlaceholder('Nueva contraseña (mín. 5)').fill(PASSWORD_PRUEBA);
  await page.getByPlaceholder('Repite la nueva contraseña').fill(PASSWORD_PRUEBA);
  await page.getByRole('button', { name: 'Crear contraseña' }).click();
  await expect(page.getByText(/tu nueva contraseña quedó guardada/i)).toBeVisible();

  // Ya entra con la nueva, sin onboarding de cambio de clave.
  await iniciarSesion(page, CUENTAS.apoderado.rut);
});

test('código incorrecto descuenta intentos', async ({ request }) => {
  await request.post(`${API}/auth/solicitar-codigo`, { data: { rut: CUENTAS.staff.rut } });
  const r = await request.post(`${API}/auth/canjear-codigo`, { data: { rut: CUENTAS.staff.rut, codigo: '000000', nuevaClave: 'Algo2026!' } });
  // (si por azar el código fuera 000000 sería 200; probabilidad 1 en un millón)
  expect(r.status()).toBe(400);
  expect((await r.json()).error).toMatch(/Te quedan 4 intentos/);
});

test('cuenta sin correo real: ofrece WhatsApp del club', async ({ page }) => {
  await pool.query("UPDATE cuentas SET correo = 'pendiente-99700007@actualizar.local' WHERE rut = $1", [CUENTAS.mesa.rut]);
  await abrirIngreso(page);
  await page.getByRole('button', { name: /Primera vez u olvidaste/ }).click();
  await page.getByPlaceholder('RUT').fill(CUENTAS.mesa.rut);
  await page.getByRole('button', { name: 'Enviar código a mi correo' }).click();
  await expect(page.getByText(/No encontramos un correo registrado/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Escribir al club por WhatsApp' })).toBeVisible();
});
