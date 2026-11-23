// Usuarios y Cuentas → "Código de acceso": la ventana con el código, el botón
// de WhatsApp y "Copiar mensaje" se ve completa en un teléfono (antes quedaba
// cortada bajo el encabezado, dentro del panel). Con CAPTURAS_DIR guarda pantallazo.
import { test, expect } from '@playwright/test';
import { CUENTAS, crearPool, crearDatosPrueba, limpiarDatosPrueba, iniciarSesion } from './fixtures/cuentasPrueba.js';

const pool = crearPool();
const OUT = process.env.CAPTURAS_DIR;
test.setTimeout(120000);
test.use({ viewport: { width: 390, height: 844 } });
test.beforeAll(async () => { await crearDatosPrueba(pool); });
test.afterAll(async () => { await limpiarDatosPrueba(pool); await pool.end(); });

test('la ventana del código de acceso se ve completa en el teléfono', async ({ page }) => {
  await pool.query("UPDATE cuentas SET telefono = '983931753', prefijo_tel = '+56' WHERE rut = $1", [CUENTAS.apoderado.rut]);
  await iniciarSesion(page, CUENTAS.super_admin.rut);
  await page.getByRole('button', { name: 'Usuarios y Cuentas' }).first().click();
  await page.getByRole('button', { name: /^Cuentas/ }).click();
  await page.getByPlaceholder('Nombre, correo, RUT o rol').fill('E2E Apoderado');
  await page.getByRole('button', { name: /Código de acceso/ }).first().click();

  const ventana = page.getByRole('dialog', { name: 'Código de acceso' });
  await expect(ventana).toBeVisible({ timeout: 10000 });
  await expect(ventana.getByText(/^\d{6}$/)).toBeInViewport();
  await expect(ventana.getByRole('link', { name: /Enviar por WhatsApp \(\+56983931753\)/ })).toBeInViewport();
  await expect(ventana.getByRole('button', { name: 'Copiar mensaje' })).toBeInViewport();
  if (OUT) await page.screenshot({ path: `${OUT}/6-codigo-acceso-movil.png` });

  await ventana.getByRole('button', { name: 'Cerrar' }).first().click();
  await expect(ventana).toBeHidden();
});
