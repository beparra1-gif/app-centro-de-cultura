// Cuenta con rol "jugador" (o vacío) y perfil "apoderado": la app la trata como
// apoderado (Mi Cuenta + tarjeta de pago), y el servidor debe entregarle los
// pagos de su pupilo. Antes recibía [] y toda su deuda aparecía impaga.
import { test, expect } from '@playwright/test';
import { CUENTAS, JUGADORES, PASSWORD_PRUEBA, crearPool, crearDatosPrueba, limpiarDatosPrueba } from './fixtures/cuentasPrueba.js';

const pool = crearPool();
const API = process.env.E2E_API_URL || 'http://localhost:3000/api';
test.describe.configure({ mode: 'serial' });
test.beforeAll(async () => { await crearDatosPrueba(pool); });
test.afterAll(async () => { await limpiarDatosPrueba(pool); await pool.end(); });

for (const rol of ['jugador', '']) {
  test(`rol "${rol || 'vacío'}" + perfil apoderado recibe los pagos de su pupilo`, async ({ request }) => {
    await pool.query("UPDATE cuentas SET rol = $1, perfil_principal = 'apoderado' WHERE rut = $2", [rol || null, CUENTAS.apoderado.rut]);
    await pool.query('DELETE FROM pagos_mensualidades WHERE rut_jugador = $1', [JUGADORES.pupilo.rut]);
    await pool.query(
      `INSERT INTO pagos_mensualidades (rut_jugador, rut_pagos, concepto_pago, cantidad_meses_pagados, meses_correspondientes, monto_total_pagado, estado_pago)
       VALUES ($1, $2, 'Mensualidad', 1, 'julio-2026', 30000, 'aprobado')`,
      [JUGADORES.pupilo.rut, CUENTAS.admin.rut]
    );
    const login = await request.post(`${API}/auth/login`, { data: { rut: CUENTAS.apoderado.rut, password: PASSWORD_PRUEBA } });
    const { token } = await login.json();
    const pagos = await (await request.get(`${API}/pagos-mensualidades`, { headers: { Authorization: `Bearer ${token}` } })).json();
    expect(pagos.map((p) => p.meses_correspondientes)).toContain('julio-2026');
  });
}

test('un deportista (rol y perfil jugador) sin Mi Cuenta sigue sin ver pagos', async ({ request }) => {
  const login = await request.post(`${API}/auth/login`, { data: { rut: CUENTAS.jugador.rut, password: PASSWORD_PRUEBA } });
  const { token } = await login.json();
  const pagos = await (await request.get(`${API}/pagos-mensualidades`, { headers: { Authorization: `Bearer ${token}` } })).json();
  expect(pagos).toEqual([]);
});
