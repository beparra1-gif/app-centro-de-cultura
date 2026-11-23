// Staff con categorías asignadas: el super admin le asigna SUB-13 en
// "Editar cuenta"; el staff solo ve esa categoría al pasar lista y al citar,
// y propone deportistas nuevos que quedan pendientes hasta que un admin los
// aprueba (se crean en la nómina) o los rechaza (con motivo).
import { test, expect } from '@playwright/test';
import { CUENTAS, JUGADORES, PASSWORD_PRUEBA, crearPool, crearDatosPrueba, limpiarDatosPrueba, iniciarSesion } from './fixtures/cuentasPrueba.js';

const pool = crearPool();
const API = process.env.E2E_API_URL || 'http://localhost:3000/api';
const BASE = Number(process.env.E2E_RUT_BASE) || 99700000;
const dv = (cuerpo) => {
  let suma = 0;
  let mul = 2;
  for (const d of String(cuerpo).split('').reverse()) { suma += Number(d) * mul; mul = mul === 7 ? 2 : mul + 1; }
  const r = 11 - (suma % 11);
  return r === 11 ? '0' : r === 10 ? 'K' : String(r);
};
const NUEVO = { rut: `${BASE + 20}-${dv(BASE + 20)}`, nombres: 'E2E Nuevo', apellido: 'Propuesto' };
const RECHAZADO = { rut: `${BASE + 21}-${dv(BASE + 21)}`, nombres: 'E2E Rechazado', apellido: 'Propuesto' };
// Su apoderado no tiene cuenta: el admin corrige el nombre y al aprobar se le crea la cuenta.
const CORREGIDO = { rut: `${BASE + 23}-${dv(BASE + 23)}`, nombres: 'E2E Con Error', apellido: 'Propuesto' };
const APODERADO_NUEVO = { rut: `${BASE + 22}-${dv(BASE + 22)}`, nombre: 'E2E Madre Nueva Prueba', correo: 'e2e.madre.nueva@test.local' };
const rutsExtra = [NUEVO.rut, RECHAZADO.rut, CORREGIDO.rut];
const rutsPrueba = [JUGADORES.pupilo.rut, JUGADORES.hijoSocio.rut, ...rutsExtra];

const limpiarExtra = async () => {
  await pool.query('DELETE FROM solicitudes_jugador WHERE rut_jugador = ANY($1)', [rutsExtra]);
  await pool.query('DELETE FROM asistencia WHERE rut_jugador = ANY($1)', [rutsPrueba]);
  await pool.query('DELETE FROM gamificacion_puntos WHERE rut_jugador = ANY($1)', [rutsPrueba]);
  await pool.query("DELETE FROM citaciones WHERE competencia_nombre = 'E2E Liga Staff'");
  await pool.query('DELETE FROM jugadores WHERE rut_jugador = ANY($1)', [rutsExtra]);
  await pool.query('DELETE FROM notificaciones_app WHERE rut_destinatario = $1', [APODERADO_NUEVO.rut]);
  await pool.query('DELETE FROM cuentas WHERE rut = $1', [APODERADO_NUEVO.rut]);
};

test.describe.configure({ mode: 'serial' });
test.setTimeout(120000);
test.beforeAll(async () => {
  await limpiarExtra();
  await crearDatosPrueba(pool);
  // Sin deuda: ingresó este mes (a un moroso la app exige autorización del admin para citarlo).
  await pool.query("UPDATE jugadores SET fecha_ingreso = date_trunc('month', now()) WHERE rut_jugador = $1", [JUGADORES.pupilo.rut]);
});
test.afterAll(async () => { await limpiarExtra(); await limpiarDatosPrueba(pool); await pool.end(); });

const tokenDe = async (request, rut) => (await (await request.post(`${API}/auth/login`, { data: { rut, password: PASSWORD_PRUEBA } })).json()).token;
const nombre = (j) => `${j.nombres} ${j.apellido}`;

test('super admin asigna categorías a un staff desde Editar cuenta', async ({ page, request }) => {
  await iniciarSesion(page, CUENTAS.super_admin.rut);
  await page.getByRole('button', { name: 'Usuarios y Cuentas' }).first().click();
  await page.getByRole('button', { name: /^Cuentas/ }).click();
  await page.getByPlaceholder('Nombre, correo, RUT o rol').fill('E2E Staff');
  await page.getByRole('button', { name: 'Modificar' }).first().click();
  const editor = page.getByRole('dialog', { name: 'Editar cuenta' });
  await expect(editor.getByText('Categorías a cargo (staff)')).toBeVisible();
  await editor.getByLabel(/^Categorías:/).click();
  await editor.getByRole('group', { name: 'Categorías' }).getByLabel('SUB-13', { exact: true }).check();
  await editor.getByRole('button', { name: 'Guardar cambios' }).click();
  await expect(page.getByText('Cuenta actualizada correctamente.')).toBeVisible({ timeout: 10000 });

  const { rows: [c] } = await pool.query('SELECT categorias_asignadas, rol FROM cuentas WHERE rut = $1', [CUENTAS.staff.rut]);
  expect(c).toEqual({ categorias_asignadas: ['SUB-13'], rol: 'staff' });

  // El staff no puede asignarse categorías a sí mismo (campo solo admin).
  const token = await tokenDe(request, CUENTAS.staff.rut);
  const { rows: [{ id }] } = await pool.query('SELECT id FROM cuentas WHERE rut = $1', [CUENTAS.staff.rut]);
  await request.put(`${API}/cuentas/${id}`, { headers: { Authorization: `Bearer ${token}` }, data: { categorias_asignadas: [] } });
  const { rows: [c2] } = await pool.query('SELECT categorias_asignadas FROM cuentas WHERE rut = $1', [CUENTAS.staff.rut]);
  expect(c2.categorias_asignadas).toEqual(['SUB-13']);
});

test('staff pasa lista solo con su categoría y la asistencia se guarda', async ({ page }) => {
  await iniciarSesion(page, CUENTAS.staff.rut);
  await page.locator('.nav-item', { hasText: 'Asistencia' }).click();
  const pupilo = nombre(JUGADORES.pupilo);
  await expect(page.getByText(pupilo, { exact: true })).toBeVisible({ timeout: 15000 });
  await expect(page.getByText(nombre(JUGADORES.hijoSocio), { exact: true })).toHaveCount(0);
  // Los botones de categoría del entrenamiento solo ofrecen SUB-13.
  await expect(page.getByRole('button', { name: 'SUB-15', exact: true })).toHaveCount(0);

  const fila = page.locator('div', { has: page.getByText(pupilo, { exact: true }) }).filter({ has: page.getByRole('button', { name: 'PRESENTE' }) }).last();
  await fila.getByRole('button', { name: 'PRESENTE' }).click();
  await page.getByRole('button', { name: /Confirmar y Guardar Asistencia/ }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Confirmar y guardar' }).click();
  await expect.poll(async () => (await pool.query(
    "SELECT estado_asistencia FROM asistencia WHERE rut_jugador = $1 ORDER BY id_asistencia DESC LIMIT 1", [JUGADORES.pupilo.rut]
  )).rows[0]?.estado_asistencia, { timeout: 10000 }).toBe('presente');
  const { rows } = await pool.query('SELECT 1 FROM asistencia WHERE rut_jugador = $1', [JUGADORES.hijoSocio.rut]);
  expect(rows).toHaveLength(0);
});

test('staff cita a un partido solo a deportistas de su categoría', async ({ page }) => {
  await iniciarSesion(page, CUENTAS.staff.rut);
  await page.locator('.nav-item', { hasText: 'Gestión' }).click();
  await page.getByRole('button', { name: /Citaciones/ }).first().click();
  // Creador por pasos: categoría → partido → fecha y lugar → citados → publicar.
  // El staff solo tiene SUB-13 para elegir (su categoría asignada).
  const categoria = page.locator('select', { has: page.locator('option', { hasText: 'SUB-13' }) }).first();
  await expect(categoria.locator('option', { hasText: 'SUB-15' })).toHaveCount(0);
  await categoria.selectOption('SUB-13');
  await page.getByRole('button', { name: /Siguiente: Partido/ }).click();
  await page.getByPlaceholder('Ej: Liga ARBAM U15').fill('E2E Liga Staff');
  await page.getByPlaceholder('Ej: Club Deportivo X').fill('E2E Rival');
  await page.getByRole('button', { name: /Siguiente: Fecha y lugar/ }).click();
  const f = new Date(); f.setDate(f.getDate() + 3);
  await page.locator('input[type=date]').first().fill(f.toISOString().slice(0, 10));
  await page.getByRole('button', { name: /Siguiente: Citados/ }).click();
  const pupilo = nombre(JUGADORES.pupilo);
  const grupo = page.getByRole('group', { name: `Citar a ${pupilo}` });
  await expect(grupo).toBeVisible({ timeout: 15000 });
  await expect(page.getByText(new RegExp(nombre(JUGADORES.hijoSocio)))).toHaveCount(0);
  await grupo.getByRole('button', { name: 'Titular' }).click();
  await page.getByRole('button', { name: /Siguiente: Revisar y publicar/ }).click();
  await page.getByRole('button', { name: 'PUBLICAR Y NOTIFICAR' }).click();
  await expect.poll(async () => (await pool.query(
    `SELECT cc.rut_jugador FROM citaciones c JOIN citacion_convocados cc ON cc.citacion_id = c.id WHERE c.competencia_nombre = 'E2E Liga Staff'`
  )).rows.map((r) => r.rut_jugador), { timeout: 10000 }).toEqual([JUGADORES.pupilo.rut]);
});

test('el backend también bloquea al staff fuera de sus categorías', async ({ request }) => {
  const auth = { Authorization: `Bearer ${await tokenDe(request, CUENTAS.staff.rut)}` };
  const otro = JUGADORES.hijoSocio; // SUB-15, fuera de SUB-13
  const lista = await request.post(`${API}/asistencia/sesion`, { headers: auth, data: { fecha: '2026-11-20', registros: [{ rut_jugador: otro.rut, estado_asistencia: 'presente' }] } });
  expect(lista.status()).toBe(403);
  expect((await lista.json()).error).toContain('E2E HijoSocio');
  const cita = await request.post(`${API}/citaciones`, { headers: auth, data: { competencia_nombre: 'E2E Liga Staff', rival_nombre: 'X', convocados: [{ rut_jugador: otro.rut, nombre: 'x' }] } });
  expect(cita.status()).toBe(403);
  const evaluacion = await request.post(`${API}/evaluaciones`, { headers: auth, data: { rut_jugador: otro.rut, tipo_evaluacion: 'Técnica', puntaje_tecnica: 50 } });
  expect(evaluacion.status()).toBe(403);
  expect((await request.get(`${API}/evaluaciones/jugador/${otro.rut}`, { headers: auth })).status()).toBe(403);
  // Su propia categoría sigue permitida.
  expect((await request.get(`${API}/evaluaciones/jugador/${JUGADORES.pupilo.rut}`, { headers: auth })).status()).toBe(200);
  const { rows } = await pool.query('SELECT 1 FROM asistencia WHERE rut_jugador = $1', [otro.rut]);
  expect(rows).toHaveLength(0);

  // Lecturas: la nómina, la ficha, la asistencia y el ranking tampoco salen de SUB-13.
  const nomina = await (await request.get(`${API}/jugadores`, { headers: auth })).json();
  expect(nomina.map((j) => j.rut_jugador)).toContain(JUGADORES.pupilo.rut);
  expect(nomina.map((j) => j.rut_jugador)).not.toContain(otro.rut);
  expect(nomina.every((j) => String(j.categoria).toUpperCase() === 'SUB-13')).toBe(true);
  expect((await request.get(`${API}/jugadores/${otro.rut}`, { headers: auth })).status()).toBe(403);
  expect((await request.get(`${API}/asistencia/jugador/${otro.rut}`, { headers: auth })).status()).toBe(403);
  const ranking = await (await request.get(`${API}/academia/ranking?categoria=SUB-15`, { headers: auth })).json();
  expect(ranking).toEqual([]);
  const sesiones = await (await request.get(`${API}/asistencia/sesiones`, { headers: auth })).json();
  expect(sesiones.every((s) => (s.categorias || []).every((c) => String(c).toUpperCase() === 'SUB-13'))).toBe(true);
});

test('crear deportista directo exige un RUT válido en el servidor', async ({ request }) => {
  const auth = { Authorization: `Bearer ${await tokenDe(request, CUENTAS.super_admin.rut)}` };
  const malo = await request.post(`${API}/jugadores`, { headers: auth, data: { rut_jugador: '12.345.678-0', nombres: 'X', apellido_paterno: 'Y', rama: 'MASCULINA' } });
  expect(malo.status()).toBe(400);
  const apoderadoMalo = await request.post(`${API}/jugadores`, { headers: auth, data: { rut_jugador: RECHAZADO.rut, rut_apoderado: '1-1', nombres: 'X', apellido_paterno: 'Y' } });
  expect(apoderadoMalo.status()).toBe(400);
  const { rows } = await pool.query('SELECT 1 FROM jugadores WHERE rut_jugador = $1', [RECHAZADO.rut]);
  expect(rows).toHaveLength(0);
});

const proponer = async (page, j, apoderado = { rut: CUENTAS.apoderado.rut, nombre: 'E2E Apoderado Prueba', correo: 'E2E.Apoderado@test.local' }) => {
  await page.getByLabel('Nombres *').fill(j.nombres);
  await page.getByLabel('Apellido paterno *').fill(j.apellido);
  await page.getByLabel('RUT deportista *').fill(j.rut);
  await page.getByLabel('Fecha de nacimiento *').fill('2014-05-10');
  await page.getByLabel('Rama *').selectOption('MASCULINA');
  await page.getByLabel('Nombre completo *').fill(apoderado.nombre);
  await page.getByLabel('RUT apoderado *').fill(apoderado.rut);
  await page.getByLabel(/Teléfono \(9 dígitos/).fill('+56 9 1234 5678');
  await page.getByLabel('Correo').fill(apoderado.correo);
  await page.getByRole('button', { name: 'Enviar para aprobación' }).click();
};

test('staff propone deportistas; quedan pendientes y fuera de la nómina', async ({ page }) => {
  await iniciarSesion(page, CUENTAS.staff.rut);
  await page.locator('.nav-item', { hasText: 'Asistencia' }).click();
  await page.getByRole('button', { name: 'Nuevo deportista' }).click();
  const form = page.getByTestId('solicitud-jugador-staff');

  // RUT inválido: no se envía.
  await proponer(page, { ...NUEVO, rut: '12.345.678-0' });
  await expect(page.getByText('RUT del deportista inválido.')).toBeVisible();

  await proponer(page, NUEVO);
  await expect(page.getByText(/Solicitud enviada/)).toBeVisible({ timeout: 10000 });
  await expect(form.getByText('Pendiente de aprobación')).toBeVisible();
  await proponer(page, RECHAZADO);
  await expect(form.getByText('Pendiente de aprobación')).toHaveCount(2, { timeout: 10000 });
  await proponer(page, CORREGIDO, APODERADO_NUEVO);
  await expect(form.getByText('Pendiente de aprobación')).toHaveCount(3, { timeout: 10000 });

  // Duplicado del mismo RUT pendiente: el backend lo rechaza.
  await proponer(page, NUEVO);
  await expect(page.getByText('Ya hay una solicitud pendiente para ese RUT.')).toBeVisible({ timeout: 10000 });

  const { rows: [s] } = await pool.query('SELECT estado, datos FROM solicitudes_jugador WHERE rut_jugador = $1', [NUEVO.rut]);
  expect(s.estado).toBe('pendiente');
  expect(s.datos).toMatchObject({ categoria: 'SUB-13', rama: 'MASCULINA', telefono_apoderado: '912345678', correo_apoderado: 'e2e.apoderado@test.local' });
  const { rows: j } = await pool.query('SELECT 1 FROM jugadores WHERE rut_jugador = $1', [NUEVO.rut]);
  expect(j).toHaveLength(0);
  // Los admins reciben el aviso.
  const { rows: n } = await pool.query("SELECT 1 FROM notificaciones_app WHERE rut_destinatario = $1 AND titulo = 'Nuevo deportista por aprobar'", [CUENTAS.super_admin.rut]);
  expect(n.length).toBeGreaterThan(0);
});

test('admin aprueba uno (entra a la nómina) y rechaza otro con motivo', async ({ page, request }) => {
  // El staff no puede aprobar su propia solicitud.
  const tokenStaff = await tokenDe(request, CUENTAS.staff.rut);
  const { rows: [sol] } = await pool.query('SELECT id FROM solicitudes_jugador WHERE rut_jugador = $1', [NUEVO.rut]);
  const intento = await request.post(`${API}/solicitudes-jugador/${sol.id}/resolver`, { headers: { Authorization: `Bearer ${tokenStaff}` }, data: { aprobar: true } });
  expect(intento.status()).toBe(403);

  await iniciarSesion(page, CUENTAS.super_admin.rut);
  // La tarjeta del panel avisa cuántas hay por aprobar.
  await expect(page.getByTitle('3 por aprobar')).toBeVisible({ timeout: 15000 });
  await page.getByRole('button', { name: 'Usuarios y Cuentas' }).first().click();
  const bandeja = page.getByTestId('solicitudes-jugador-admin');
  await expect(bandeja.getByText('Deportistas por aprobar (3)')).toBeVisible({ timeout: 15000 });

  const filaDe = (j) => bandeja.locator('div', { has: page.getByText(nombre(j)) }).filter({ has: page.getByRole('button', { name: /Aprobar/ }) }).last();
  await expect(filaDe(NUEVO).getByText(/Apoderado con cuenta \(E2E Apoderado Prueba\): quedará vinculado/)).toBeVisible();
  await expect(filaDe(CORREGIDO).getByText(/Apoderado sin cuenta: al aprobar se crea/)).toBeVisible();

  // Corregir datos antes de aprobar (el nombre venía mal escrito).
  await filaDe(CORREGIDO).getByRole('button', { name: /Corregir/ }).click();
  await bandeja.getByLabel('Nombres *').fill('E2E Corregido');
  await bandeja.getByRole('button', { name: /Guardar y aprobar/ }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Aprobar' }).click();
  await expect(page.getByText(/E2E Corregido Propuesto incorporado a la nómina\. Se creó la cuenta del apoderado/)).toBeVisible({ timeout: 10000 });
  await expect(bandeja.getByText('Deportistas por aprobar (2)')).toBeVisible({ timeout: 10000 });

  // Entrega del código de activación al apoderado recién creado.
  const avisoCuentas = page.getByTestId('cuentas-apoderado-nuevas');
  await avisoCuentas.getByRole('button', { name: 'Generar código' }).click();
  const wsp = avisoCuentas.getByRole('link', { name: 'Abrir WhatsApp' });
  await expect(wsp).toHaveAttribute('href', /^https:\/\/wa\.me\/56912345678\?text=.*c%C3%B3digo/);
  await filaDe(NUEVO).getByRole('button', { name: /Aprobar/ }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Aprobar' }).click();
  await expect(page.getByText(`${nombre(NUEVO)} incorporado a la nómina.`)).toBeVisible({ timeout: 10000 });

  await filaDe(RECHAZADO).getByRole('button', { name: /Rechazar/ }).click();
  await page.getByRole('dialog').getByRole('textbox').fill('RUT no corresponde');
  await page.getByRole('dialog').getByRole('button', { name: 'Rechazar' }).click();
  await expect(page.getByText('Solicitud rechazada.')).toBeVisible({ timeout: 10000 });
  await expect(bandeja).toHaveCount(0);

  const { rows: [jug] } = await pool.query(
    'SELECT nombres, apellido_paterno, categoria, rama, fecha_nacimiento::text AS fn, rut_apoderado, correo_apoderado, nombre_emergencia, num_emergencia, fecha_ingreso FROM jugadores WHERE rut_jugador = $1',
    [NUEVO.rut]
  );
  expect(jug).toMatchObject({
    nombres: NUEVO.nombres, apellido_paterno: NUEVO.apellido, categoria: 'SUB-13', rama: 'MASCULINA', fn: '2014-05-10',
    rut_apoderado: CUENTAS.apoderado.rut, correo_apoderado: 'e2e.apoderado@test.local', nombre_emergencia: 'E2E Apoderado Prueba', num_emergencia: '912345678',
  });
  expect(jug.fecha_ingreso).not.toBeNull();
  const { rows: rech } = await pool.query('SELECT estado, motivo_rechazo FROM solicitudes_jugador WHERE rut_jugador = $1', [RECHAZADO.rut]);
  expect(rech).toEqual([{ estado: 'rechazada', motivo_rechazo: 'RUT no corresponde' }]);
  const { rows: noCreado } = await pool.query('SELECT 1 FROM jugadores WHERE rut_jugador = $1', [RECHAZADO.rut]);
  expect(noCreado).toHaveLength(0);

  const { rows: [corr] } = await pool.query('SELECT nombres, rut_apoderado, correo_apoderado FROM jugadores WHERE rut_jugador = $1', [CORREGIDO.rut]);
  expect(corr).toEqual({ nombres: 'E2E Corregido', rut_apoderado: APODERADO_NUEVO.rut, correo_apoderado: APODERADO_NUEVO.correo });
  const { rows: [cuentaAp] } = await pool.query('SELECT nombres, apellido_paterno, apellido_materno, correo, telefono, rol, forzar_clave, password FROM cuentas WHERE rut = $1', [APODERADO_NUEVO.rut]);
  expect(cuentaAp).toEqual({
    nombres: 'E2E Madre', apellido_paterno: 'Nueva', apellido_materno: 'Prueba',
    correo: APODERADO_NUEVO.correo, telefono: '912345678', rol: 'apoderado', forzar_clave: true, password: null,
  });

  // Resolver dos veces no duplica.
  const tokenAdmin = await tokenDe(request, CUENTAS.super_admin.rut);
  const otraVez = await request.post(`${API}/solicitudes-jugador/${sol.id}/resolver`, { headers: { Authorization: `Bearer ${tokenAdmin}` }, data: { aprobar: true } });
  expect(otraVez.status()).toBe(409);
});

test('staff ve el resultado y el aprobado ya aparece en su lista', async ({ page }) => {
  await iniciarSesion(page, CUENTAS.staff.rut);
  await page.locator('.nav-item', { hasText: 'Asistencia' }).click();
  await expect(page.getByText(nombre(NUEVO), { exact: true })).toBeVisible({ timeout: 15000 });
  await page.getByRole('button', { name: 'Nuevo deportista' }).click();
  const form = page.getByTestId('solicitud-jugador-staff');
  await expect(form.getByText('Aprobada', { exact: true })).toHaveCount(2);
  await expect(form.getByText('Rechazada', { exact: true })).toBeVisible();
  await expect(form.getByText('Motivo: RUT no corresponde')).toBeVisible();
});
