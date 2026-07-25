import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, expect } from '@playwright/test';
import { Pool } from 'pg';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../../backend/.env') });

// Cuenta fija de e2e (no es una de las cuentas QA descartables usadas
// durante el desarrollo de features) — este spec la crea y la borra en
// cada corrida, así no depende de que alguien la haya dejado configurada
// a mano.
const RUT = '99777777-7';
const PASSWORD = 'E2eTest2026!';
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

test.beforeAll(async () => {
  const hash = await bcrypt.hash(PASSWORD, 10);
  await pool.query(
    `INSERT INTO cuentas (correo, rut, password, nombres, rol, estado)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (correo) DO UPDATE SET password = EXCLUDED.password, rol = EXCLUDED.rol, estado = EXCLUDED.estado`,
    ['e2e.login@test.local', RUT, hash, 'E2E Login Test', 'super_admin', 'activo']
  );
});

test.afterAll(async () => {
  await pool.query('DELETE FROM cuentas WHERE rut = $1', [RUT]);
  await pool.end();
});

test('login y navegación básica a Panel y Muro', async ({ page }) => {
  await page.goto('/');
  await page.getByText('Ingreso Usuarios CCF').click();

  await page.getByPlaceholder('RUT').fill(RUT);
  await page.getByPlaceholder('Contraseña').fill(PASSWORD);
  await page.getByRole('button', { name: /ingres|entrar|acceder/i }).click();

  const panelNav = page.locator('.nav-item', { hasText: 'Panel' });
  await expect(panelNav).toBeVisible({ timeout: 15000 });
  await panelNav.click();
  await expect(page.getByText('Resumen')).toBeVisible();

  await page.locator('.nav-item', { hasText: 'Muro' }).click();
  await expect(page.getByText('Muro Social')).toBeVisible();
});
