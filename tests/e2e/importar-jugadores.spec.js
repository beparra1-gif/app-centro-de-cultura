// Importar jugadores + apoderados desde filas pegadas: solo super admin,
// revisar no cambia nada, aplicar crea jugadores y UNA cuenta por apoderado
// repetido, y no pisa datos ya cargados.
import { test, expect } from '@playwright/test';
import { CUENTAS, PASSWORD_PRUEBA, crearPool, crearDatosPrueba, limpiarDatosPrueba, assertBdLocal } from './fixtures/cuentasPrueba.js';

const pool = crearPool();
const API = process.env.E2E_API_URL || 'http://localhost:3000/api';
const dv = (n) => {
  let s = 0; let m = 2;
  for (const d of String(n).split('').reverse()) { s += Number(d) * m; m = m === 7 ? 2 : m + 1; }
  const r = 11 - (s % 11);
  return r === 11 ? '0' : r === 10 ? 'K' : String(r);
};
const rut = (n) => `${n}-${dv(n)}`;
const [H1, H2, APO] = [99719001, 99719002, 99719101].map(rut);
const RUTS = [H1, H2, APO];
const texto = [
  'Nombre completo del jugador\tRut\tFecha de nacimiento\tFecha de ingreso al club\tNombre (APODERADO)\tRut (APODERADO)',
  `Hermano Uno Prueba Importar\t${H1}\t23 nov 2011\tFebrero 2026\tAndre Apoderada Prueba\t${APO}`,
  `Hermano Dos Prueba Importar\t${H2}\t29/07/2013\tMarzo, 2026\tAndrea Apoderada Prueba\t${APO.replace('-', '')}`,
].join('\n');

const borrar = async () => {
  await pool.query('DELETE FROM jugadores WHERE rut_jugador = ANY($1)', [RUTS]);
  await pool.query('DELETE FROM cuentas WHERE rut = ANY($1)', [RUTS]);
};
const token = async (request, r) => (await (await request.post(`${API}/auth/login`, { data: { rut: r, password: PASSWORD_PRUEBA } })).json()).token;

test.describe.configure({ mode: 'serial' });
test.beforeAll(async () => { assertBdLocal(); await crearDatosPrueba(pool); await borrar(); });
test.afterAll(async () => { await borrar(); await limpiarDatosPrueba(pool); await pool.end(); });

test('un admin común no puede importar', async ({ request }) => {
  const t = await token(request, CUENTAS.admin.rut);
  const r = await request.post(`${API}/jugadores/importar-planilla`, { headers: { Authorization: `Bearer ${t}` }, data: { texto } });
  expect(r.status()).toBe(403);
});

test('revisar no cambia nada; aplicar crea 2 hermanos con un solo apoderado', async ({ request }) => {
  const h = { Authorization: `Bearer ${await token(request, CUENTAS.super_admin.rut)}` };
  const plan = await (await request.post(`${API}/jugadores/importar-planilla`, { headers: h, data: { texto, rama: 'Masculina' } })).json();
  expect(plan.resumen).toMatchObject({ crear: 2, crearApoderados: 1, apoderados: 1 });
  expect((await pool.query('SELECT 1 FROM jugadores WHERE rut_jugador = ANY($1)', [RUTS])).rowCount).toBe(0);

  const res = await request.post(`${API}/jugadores/importar-planilla`, { headers: h, data: { texto, rama: 'Masculina', aplicar: true, resumen: plan.resumen } });
  expect(res.status()).toBe(200);
  expect(await res.json()).toMatchObject({ creados: 2, apoderadosCreados: 1 });

  const j = (await pool.query("SELECT rut_jugador, rut_apoderado, categoria, rama, to_char(fecha_ingreso, 'YYYY-MM-DD') AS ingreso FROM jugadores WHERE rut_jugador = ANY($1) ORDER BY rut_jugador", [RUTS])).rows;
  expect(j).toEqual([
    { rut_jugador: H1, rut_apoderado: APO, categoria: 'SUB-15', rama: 'Masculina', ingreso: '2026-02-01' },
    { rut_jugador: H2, rut_apoderado: APO, categoria: 'SUB-13', rama: 'Masculina', ingreso: '2026-03-01' },
  ]);
  const c = (await pool.query('SELECT rol, password, forzar_clave, correo FROM cuentas WHERE rut = $1', [APO])).rows;
  expect(c).toHaveLength(1);
  expect(c[0]).toMatchObject({ rol: 'apoderado', password: null, forzar_clave: true });

  // Segunda pasada: todo ya está, nada que aplicar.
  const otra = await (await request.post(`${API}/jugadores/importar-planilla`, { headers: h, data: { texto } })).json();
  expect(otra.resumen).toMatchObject({ crear: 0, completar: 0, crearApoderados: 0, yaEstaban: 2 });
});
