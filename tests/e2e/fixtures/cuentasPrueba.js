// Cuentas y deportistas de prueba para el recorrido E2E por rol.
// Solo para la BD LOCAL de desarrollo: assertBdLocal() aborta si
// DATABASE_URL no apunta a localhost. Todo usa RUTs 99.70x.xxx (fuera del
// rango real del club) y se borra al terminar con limpiarDatosPrueba().
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import { expect } from '@playwright/test';
import { VERSION_AVISO } from '../../../src/legal/avisoPrivacidad.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../../../backend/.env') });

export const PASSWORD_PRUEBA = 'E2eRoles2026!';

const dv = (cuerpo) => {
  let suma = 0;
  let mul = 2;
  for (const d of String(cuerpo).split('').reverse()) {
    suma += Number(d) * mul;
    mul = mul === 7 ? 2 : mul + 1;
  }
  const r = 11 - (suma % 11);
  return r === 11 ? '0' : r === 10 ? 'K' : String(r);
};
const rut = (cuerpo) => `${cuerpo}-${dv(cuerpo)}`;
// E2E_RUT_BASE permite correr un segundo entorno de pruebas en paralelo
// (otro rango de RUT y de correos) sin pisar las cuentas del primero.
const BASE = Number(process.env.E2E_RUT_BASE) || 99700000;
export const correoPrueba = (clave) => (BASE === 99700000 ? `e2e.${clave}@test.local` : `e2e${BASE}.${clave}@test.local`);

export const CUENTAS = {
  super_admin: { rut: rut(BASE + 1), nombres: 'E2E SuperAdmin', rol: 'super_admin' },
  admin: { rut: rut(BASE + 2), nombres: 'E2E Admin', rol: 'admin' },
  staff: { rut: rut(BASE + 3), nombres: 'E2E Staff', rol: 'staff' },
  apoderado: { rut: rut(BASE + 4), nombres: 'E2E Apoderado', rol: 'apoderado' },
  socio: { rut: rut(BASE + 5), nombres: 'E2E Socio', rol: 'socio' },
  jugador: { rut: rut(BASE + 6), nombres: 'E2E Jugador', rol: 'jugador' },
  mesa: { rut: rut(BASE + 7), nombres: 'E2E Mesa', rol: 'mesa' },
  socio_apoderado: { rut: rut(BASE + 8), nombres: 'E2E SocioApoderado', rol: 'socio_apoderado' },
};

// Cuentas que pagan cuota de socio (es_socio = true).
const ROLES_SOCIOS = ['socio', 'socio_apoderado'];

export const JUGADORES = {
  // Pupilo del apoderado de prueba.
  pupilo: { rut: rut(BASE + 10), nombres: 'E2E Pupilo', apellido: 'Prueba', rama: 'MASCULINA', categoria: 'SUB-13', fecha_nacimiento: '2013-03-15' },
  // Ficha propia de la cuenta "jugador" (mismo RUT), mayor de 13.
  propio: { rut: CUENTAS.jugador.rut, nombres: 'E2E Jugador', apellido: 'Prueba', rama: 'FEMENINA', categoria: 'SUB-17 / SUB-18', fecha_nacimiento: '2009-06-01' },
  // Hijo del socio+apoderado: la familia paga cuota de socio Y mensualidad.
  hijoSocio: { rut: rut(BASE + 11), nombres: 'E2E HijoSocio', apellido: 'Prueba', rama: 'MASCULINA', categoria: 'SUB-15', fecha_nacimiento: '2011-08-20', apoderado: 'socio_apoderado' },
};

const todosLosRuts = () => [...Object.values(CUENTAS).map((c) => c.rut), JUGADORES.pupilo.rut, JUGADORES.hijoSocio.rut];

export const assertBdLocal = () => {
  const url = String(process.env.DATABASE_URL || '');
  const host = (url.match(/@([^:/?]+)/) || [])[1];
  if (!['localhost', '127.0.0.1'].includes(host)) {
    throw new Error('Los datos de prueba E2E solo se crean en una BD local (DATABASE_URL debe ser localhost).');
  }
};

export const crearPool = () => {
  assertBdLocal();
  return new pg.Pool({ connectionString: process.env.DATABASE_URL });
};

export const limpiarDatosPrueba = async (pool) => {
  const ruts = todosLosRuts();
  await pool.query('DELETE FROM pagos_mensualidades WHERE rut_jugador = ANY($1) OR rut_pagos = ANY($1)', [ruts]);
  await pool.query('DELETE FROM notificaciones_app WHERE rut_destinatario = ANY($1)', [ruts]);
  const prefijo = String(BASE).slice(0, 6);
  await pool.query('DELETE FROM logo_assets WHERE filename LIKE $1 OR filename LIKE $2', [`comprobante-${prefijo}%`, `perfil-${prefijo}%`]);
  await pool.query(`DELETE FROM codigos_acceso WHERE cuenta_id IN (SELECT id FROM cuentas WHERE rut = ANY($1))`, [ruts]).catch(() => {});
  await pool.query(`DELETE FROM consentimientos_datos WHERE cuenta_id IN (SELECT id FROM cuentas WHERE rut = ANY($1))`, [ruts]).catch(() => {});
  await pool.query('DELETE FROM jugadores WHERE rut_jugador = ANY($1)', [ruts]);
  await pool.query('DELETE FROM cuentas WHERE rut = ANY($1)', [ruts]);
};

export const crearDatosPrueba = async (pool) => {
  await limpiarDatosPrueba(pool);
  const hash = await bcrypt.hash(PASSWORD_PRUEBA, 10);
  for (const [clave, c] of Object.entries(CUENTAS)) {
    await pool.query(
      `INSERT INTO cuentas (correo, rut, password, nombres, apellido_paterno, telefono, direccion, comuna,
                            rol, perfil_principal, estado, forzar_clave, requiere_foto_perfil, es_socio, fecha_ingreso_socio, consentimiento_version)
       VALUES ($1, $2, $3, $4, 'Prueba', '+56900000000', 'Calle Falsa 123', 'Santiago', $5, $5, 'activo', false, false, $6, $7, $8)`,
      [correoPrueba(clave), c.rut, hash, c.nombres, c.rol,
        ROLES_SOCIOS.includes(clave), ROLES_SOCIOS.includes(clave) ? '2026-01-01' : null,
        // Aviso de datos ya aceptado: las pruebas que no son del primer ingreso
        // no deben quedar bloqueadas por PrimerIngresoModal.
        VERSION_AVISO]
    );
  }
  for (const j of Object.values(JUGADORES)) {
    await pool.query(
      `INSERT INTO jugadores (rut_jugador, nombres, apellido_paterno, rama, categoria, fecha_nacimiento, estado,
                              rut_apoderado, correo_apoderado, fecha_ingreso)
       VALUES ($1, $2, $3, $4, $5, $6, 'ACTIVO', $7, $8, $9)`,
      [j.rut, j.nombres, j.apellido, j.rama, j.categoria, j.fecha_nacimiento,
        j.apoderado ? CUENTAS[j.apoderado].rut : (j === JUGADORES.pupilo ? CUENTAS.apoderado.rut : null),
        j.apoderado ? correoPrueba(j.apoderado) : (j === JUGADORES.pupilo ? correoPrueba('apoderado') : null),
        j.fecha_ingreso || '2025-12-15']
    );
  }
};

// Login real por la UI; devuelve ms hasta ver el menú inferior.
export const iniciarSesion = async (page, rut) => {
  const cuenta = Object.values(CUENTAS).find((c) => c.rut === rut);
  await page.goto('/');
  await page.getByText('Ingreso Usuarios CCF').click();
  await page.getByPlaceholder('RUT').fill(rut);
  await page.getByPlaceholder('Contraseña').fill(PASSWORD_PRUEBA);
  const t0 = Date.now();
  await page.getByRole('button', { name: /ingres|entrar|acceder/i }).click();
  // La portada pública también tiene .nav-item: se confirma la sesión por el
  // nombre del usuario en el encabezado.
  await expect(page.getByText(`${cuenta?.nombres || ''} Prueba`).first()).toBeVisible({ timeout: 15000 });
  await expect(page.locator('.nav-item').first()).toBeVisible();
  return Date.now() - t0;
};

// Último código de 6 dígitos enviado a `correo` desde `desde` (ms). El
// backend de pruebas no tiene SMTP y guarda cada correo como JSON en
// backend/.correos-dev/ (ver backend/lib/correo.js).
export const ultimoCodigoPara = async (correo, desde) => {
  const fs = await import('node:fs');
  const carpeta = path.join(__dirname, '../../../backend/.correos-dev');
  for (let i = 0; i < 20; i++) {
    const archivos = fs.existsSync(carpeta) ? fs.readdirSync(carpeta) : [];
    const codigo = archivos
      .map((f) => path.join(carpeta, f))
      .filter((f) => fs.statSync(f).mtimeMs >= desde)
      .map((f) => JSON.parse(fs.readFileSync(f, 'utf8')))
      .filter((c) => c.para === correo)
      .sort((a, b) => b.creado.localeCompare(a.creado))[0]?.texto?.match(/\b(\d{6})\b/)?.[1];
    if (codigo) return codigo;
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error(`No llegó correo para ${correo}`);
};
