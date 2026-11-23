// Citaciones de punta a punta: creador por pasos (los citados al final),
// titulares y banca, publicación con aviso en la app y por WhatsApp (enlace
// que exige iniciar sesión), ventana emergente para el apoderado, % de aceptadas en
// el Muro, reemplazo desde la banca y reglas de quién puede responder.
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
const SEGUNDA = { rut: `${BASE + 31}-${dv(BASE + 31)}`, nombres: 'E2E Segunda' };
const BANCA = { rut: `${BASE + 30}-${dv(BASE + 30)}`, nombres: 'E2E Banca' };
const extras = [SEGUNDA, BANCA];
const COMPETENCIA = 'E2E Cita Liga';
const PUSH_FALSO = 'https://localhost:9/push/e2e';

const diaFuturo = () => {
  const f = new Date();
  f.setDate(f.getDate() + 4);
  return f.toISOString().slice(0, 10);
};

const limpiar = async () => {
  await pool.query(`DELETE FROM comunicaciones WHERE titulo LIKE '%E2E Cita%'`);
  await pool.query(`DELETE FROM citaciones WHERE competencia_nombre LIKE 'E2E Cita%'`);
  await pool.query('DELETE FROM jugadores WHERE rut_jugador = ANY($1)', [extras.map((e) => e.rut)]);
  await pool.query('DELETE FROM push_suscripciones WHERE endpoint = $1', [PUSH_FALSO]).catch(() => {});
};

test.describe.configure({ mode: 'serial' });
test.setTimeout(120000);
test.beforeAll(async () => {
  await limpiar();
  await crearDatosPrueba(pool);
  for (const e of extras) {
    await pool.query(
      `INSERT INTO jugadores (rut_jugador, nombres, apellido_paterno, rama, categoria, fecha_nacimiento, estado, rut_apoderado, correo_apoderado, fecha_ingreso)
       VALUES ($1, $2, 'Prueba', 'MASCULINA', 'SUB-13', '2014-02-02', 'ACTIVO', $3, 'e2e.apoderado@test.local', date_trunc('month', now()))`,
      [e.rut, e.nombres, CUENTAS.apoderado.rut]
    );
  }
  // Sin deuda: a un moroso la app exige autorización antes de citarlo.
  await pool.query("UPDATE jugadores SET fecha_ingreso = date_trunc('month', now()) WHERE rut_jugador = ANY($1)", [[JUGADORES.pupilo.rut, JUGADORES.propio.rut]]);
});
test.afterAll(async () => { await limpiar(); await limpiarDatosPrueba(pool); await pool.end(); });

const tokenDe = async (request, rut) => (await (await request.post(`${API}/auth/login`, { data: { rut, password: PASSWORD_PRUEBA } })).json()).token;
const cita = async () => (await pool.query('SELECT * FROM citaciones WHERE competencia_nombre = $1', [COMPETENCIA])).rows[0];
const conv = async (rut) => (await pool.query(
  'SELECT cc.* FROM citacion_convocados cc JOIN citaciones c ON c.id = cc.citacion_id WHERE c.competencia_nombre = $1 AND cc.rut_jugador = $2', [COMPETENCIA, rut]
)).rows[0];

test('el admin crea la convocatoria por pasos y la publica', async ({ page }) => {
  await iniciarSesion(page, CUENTAS.super_admin.rut);
  await page.getByRole('button', { name: /^Citaciones/ }).first().click();

  // Paso 1: primero la categoría (sin ella no se avanza); aún no se ven jugadores.
  await expect(page.getByRole('navigation', { name: 'Pasos de la convocatoria' })).toBeVisible({ timeout: 15000 });
  await expect(page.getByRole('button', { name: 'Titular' })).toHaveCount(0);
  await page.getByRole('button', { name: /Siguiente: Partido/ }).click();
  await expect(page.getByText('Primero elige la categoría que vas a citar.')).toBeVisible();
  await page.locator('select', { has: page.locator('option[value="masculina"]') }).first().selectOption('masculina');
  await page.locator('select', { has: page.locator('option', { hasText: 'SUB-13' }) }).first().selectOption('SUB-13');
  await page.getByRole('button', { name: /Siguiente: Partido/ }).click();

  // Paso 2: no deja avanzar sin competencia y rival.
  await page.getByRole('button', { name: /Siguiente: Fecha y lugar/ }).click();
  await expect(page.getByText('Primero completa la competencia y el rival.')).toBeVisible();
  await page.getByPlaceholder('Ej: Liga ARBAM U15').fill(COMPETENCIA);
  await page.getByPlaceholder('Ej: Club Deportivo X').fill('E2E Rival');
  await page.getByRole('button', { name: /Siguiente: Fecha y lugar/ }).click();

  // Paso 2: fecha, horarios, lugar y mensaje.
  await page.locator('input[type=date]').first().fill(diaFuturo());
  await page.getByPlaceholder('Ej: Gimnasio Polideportivo').fill('Gimnasio E2E');
  await page.getByPlaceholder('Ej: Av. Libertad 123, Viña del Mar').fill('Av. Libertad 123, Viña del Mar');
  await page.getByPlaceholder(/Ej: llevar camiseta/).fill('Llevar camiseta blanca');
  await page.getByRole('button', { name: /Siguiente: Citados/ }).click();

  // Paso 4: recién aquí aparecen, y solo los de la categoría elegida.
  await expect(page.getByText(/Rama masculina · Categoría SUB-13/)).toBeVisible();
  await expect(page.getByRole('group', { name: 'Citar a E2E HijoSocio Prueba' })).toHaveCount(0);
  for (const [nombre, rol] of [['E2E Pupilo Prueba', 'Titular'], ['E2E Segunda Prueba', 'Titular'], ['E2E Banca Prueba', 'Banca']]) {
    await page.getByRole('group', { name: `Citar a ${nombre}` }).getByRole('button', { name: rol }).click();
  }
  await expect(page.getByText('2/12 titulares')).toBeVisible();
  await expect(page.getByText('1 en banca')).toBeVisible();
  await page.getByRole('button', { name: /Siguiente: Revisar y publicar/ }).click();

  // Paso 4: vista previa con escudos, horarios, lugar con Maps/Waze y mensaje.
  const tarjeta = page.getByTestId('tarjeta-partido');
  await expect(tarjeta.getByText('E2E Rival')).toBeVisible();
  await expect(tarjeta.getByRole('img', { name: 'Escudo genérico de E2E Rival' })).toBeVisible();
  await expect(tarjeta.getByRole('link', { name: /Waze/ })).toHaveAttribute('href', /waze\.com\/ul\?q=Gimnasio%20E2E/);
  await expect(tarjeta.getByText('Llevar camiseta blanca')).toBeVisible();
  await page.getByRole('button', { name: 'PUBLICAR Y NOTIFICAR' }).click();
  await expect(page.getByText(/Citación publicada: 2 titulares y 1 en banca/)).toBeVisible({ timeout: 10000 });

  // Se abre el envío por WhatsApp: mensaje del grupo en el formato del club,
  // con UN enlace para todos y sin enlace de mapa (eso queda en la app).
  const wsp = page.getByTestId('citacion-whatsapp');
  await expect(wsp).toBeVisible();
  const grupo = decodeURIComponent(await wsp.getByRole('link', { name: 'Mensaje al grupo' }).getAttribute('href'));
  expect(grupo).toContain('⚪️🔵 CITACIÓN OFICIAL U-13 ⚪️🔵');
  expect(grupo).toContain(`🏆 Competencia: ${COMPETENCIA}`);
  expect(grupo).toContain('📍 Lugar: Gimnasio E2E');
  expect(grupo).toContain('👥 JUGADORES CITADOS');
  expect(grupo).toContain('• E2E Pupilo Prueba');
  expect(grupo).toMatch(/Acá enlace para confirmar citación\n\S+\/\?partido=[a-f0-9]{32}$/);
  expect(grupo).not.toContain('maps');
  // El recordatorio individual va al teléfono del apoderado con el mismo enlace.
  const recordatorio = decodeURIComponent(await wsp.getByRole('link', { name: 'WhatsApp', exact: true }).first().getAttribute('href'));
  expect(recordatorio).toMatch(/^https:\/\/wa\.me\/56900000000\?text=/);
  expect(recordatorio).toMatch(/\/\?partido=[a-f0-9]{32}/);

  const c = await cita();
  expect(c).toMatchObject({ lugar_nombre: 'Gimnasio E2E', lugar_direccion: 'Av. Libertad 123, Viña del Mar', mensaje_adicional: 'Llevar camiseta blanca' });
  const { rows } = await pool.query('SELECT rut_jugador, rol_convocatoria, respuesta, token_respuesta FROM citacion_convocados WHERE citacion_id = $1 ORDER BY rut_jugador', [c.id]);
  expect(rows).toHaveLength(3);
  // Recién publicada: nadie queda como "no asiste".
  expect(rows.every((r) => r.respuesta === 'pendiente' && /^[a-f0-9]{32}$/.test(r.token_respuesta))).toBe(true);
  expect(rows.find((r) => r.rut_jugador === BANCA.rut).rol_convocatoria).toBe('banca');
  const { rows: avisos } = await pool.query(
    "SELECT titulo FROM notificaciones_app WHERE REPLACE(REPLACE(UPPER(rut_destinatario), '.', ''), '-', '') = $1",
    [CUENTAS.apoderado.rut.replace(/[.-]/g, '').toUpperCase()]
  );
  expect(avisos.some((a) => a.titulo.startsWith('En banca:'))).toBe(true);
  expect(avisos.some((a) => a.titulo.startsWith('Citación Liga'))).toBe(true);
});

test('el enlace del grupo pide iniciar sesión y abre la citación solo a quien está en la nómina', async ({ page, browser }) => {
  const { token_publico: enlace } = await cita();
  // Sin sesión no se ve ni responde nada: se guarda el enlace hasta ingresar.
  await page.goto(`/?partido=${enlace}`);
  await expect(page.getByText('Inicia sesión para ver y responder la citación.')).toBeVisible({ timeout: 15000 });
  await iniciarSesion(page, CUENTAS.apoderado.rut);
  const modal = page.getByTestId('citaciones-pendientes');
  await expect(modal.getByRole('heading', { name: 'Citación' })).toBeVisible({ timeout: 15000 });
  const pupilo = modal.locator('div', { has: page.getByText('E2E Pupilo Prueba fue citada/o') }).filter({ has: page.getByRole('button', { name: 'No podrá asistir' }) }).last();
  await expect(pupilo.getByTestId('tarjeta-partido').getByText('Gimnasio E2E', { exact: false })).toBeVisible();
  await pupilo.getByRole('button', { name: 'No podrá asistir' }).click();
  await pupilo.getByLabel('Motivo de la inasistencia').fill('Prueba en el colegio');
  await pupilo.getByRole('button', { name: 'Enviar' }).click();
  await expect(pupilo.getByText('Motivo: Prueba en el colegio')).toBeVisible({ timeout: 10000 });
  expect(await conv(JUGADORES.pupilo.rut)).toMatchObject({ respuesta: 'no', justificacion: 'Prueba en el colegio' });
  // El responsable sabe que hay banca para reemplazar.
  const { rows } = await pool.query(
    "SELECT cuerpo FROM notificaciones_app WHERE REPLACE(REPLACE(UPPER(rut_destinatario), '.', ''), '-', '') = $1 AND tipo = 'citacion_rsvp' ORDER BY id DESC LIMIT 1",
    [CUENTAS.super_admin.rut.replace(/[.-]/g, '').toUpperCase()]
  );
  expect(rows[0].cuerpo).toContain('Hay 1 en banca para reemplazar');

  // Otra familia (no está en la nómina) con el mismo enlace.
  const ajena = await browser.newPage();
  await ajena.goto(`/?partido=${enlace}`);
  await iniciarSesion(ajena, CUENTAS.socio_apoderado.rut);
  await expect(ajena.getByText('No tiene citación asignada para este juego.')).toBeVisible({ timeout: 15000 });
  await ajena.close();
});

test('al entrar, el apoderado ve la ventana para responder y el Muro con % de aceptadas', async ({ page }) => {
  await iniciarSesion(page, CUENTAS.apoderado.rut);
  const modal = page.getByTestId('citaciones-pendientes');
  await expect(modal).toBeVisible({ timeout: 15000 });
  await expect(modal.getByText('E2E Segunda Prueba fue citada/o')).toBeVisible();
  await expect(modal.getByText('E2E Banca Prueba quedó en la banca (reserva)')).toBeVisible();
  const segunda = modal.locator('div', { has: page.getByText('E2E Segunda Prueba fue citada/o') }).filter({ has: page.getByRole('button', { name: 'Confirmo asistencia' }) }).last();
  await segunda.getByRole('button', { name: 'Confirmo asistencia' }).click();
  await expect(page.getByText('Asistencia de E2E Segunda Prueba confirmada.')).toBeVisible({ timeout: 10000 });
  expect((await conv(SEGUNDA.rut)).respuesta).toBe('si');
  await modal.getByRole('button', { name: 'Responder más tarde' }).click();
  await expect(modal).toHaveCount(0);

  await page.locator('.nav-item', { hasText: 'Muro' }).click();
  await expect(page.getByText('50% aceptadas').first()).toBeVisible({ timeout: 15000 });
  await expect(page.getByText('En banca (reserva)').first()).toBeVisible();
});

test('el admin reemplaza con la banca a quien se bajó', async ({ page }) => {
  await iniciarSesion(page, CUENTAS.super_admin.rut);
  await page.getByRole('button', { name: /^Citaciones/ }).first().click();
  await page.getByRole('button', { name: /Control de Citaciones/ }).click();
  const encabezado = page.locator('div', { has: page.getByText(new RegExp(`${COMPETENCIA} · vs E2E Rival`)) }).filter({ has: page.getByRole('button', { name: 'Ver detalle' }) }).last();
  await expect(page.getByText(/50% aceptadas/).first()).toBeVisible({ timeout: 15000 });
  await encabezado.getByRole('button', { name: 'Ver detalle' }).click();
  await expect(page.getByText(/Quedan 11 cupos de titular/)).toBeVisible();
  await page.getByRole('button', { name: 'Subir a titular' }).click();
  await expect(page.getByText('E2E Banca Prueba pasó a titular. Avísale por WhatsApp para que confirme.')).toBeVisible({ timeout: 10000 });
  expect(await conv(BANCA.rut)).toMatchObject({ rol_convocatoria: 'titular', respuesta: 'pendiente' });
});

test('reglas: responde el apoderado, staff o admin, y la jugadora solo si es autogestionada; familias sin enlaces', async ({ request }) => {
  const admin = { Authorization: `Bearer ${await tokenDe(request, CUENTAS.super_admin.rut)}` };
  const pasado = '2020-01-01T10:00';
  const vencida = await request.post(`${API}/citaciones`, { headers: admin, data: { competencia_nombre: 'E2E Cita Vencida', rival_nombre: 'X', hora_maxima_confirmacion: pasado, convocados: [{ rut_jugador: JUGADORES.propio.rut, nombre: 'E2E Jugador' }] } });
  expect(vencida.status()).toBe(400);
  expect((await vencida.json()).error).toMatch(/ya pasó/);

  const creada = await (await request.post(`${API}/citaciones`, { headers: admin, data: { competencia_nombre: 'E2E Cita Propia', rival_nombre: 'X', dia_citacion: diaFuturo(), convocados: [{ rut_jugador: JUGADORES.propio.rut, nombre: 'E2E Jugador' }] } })).json();
  const jugador = { Authorization: `Bearer ${await tokenDe(request, CUENTAS.jugador.rut)}` };
  const responder = (headers) => request.patch(`${API}/citaciones/${creada.id}/convocados/${JUGADORES.propio.rut}/rsvp`, { headers, data: { respuesta: 'si' } });
  // La jugadora citada no responde... salvo que el club la marque autogestionada.
  expect((await responder(jugador)).status()).toBe(403);
  await request.post(`${API}/jugadores/${JUGADORES.propio.rut}/autogestionable`, { headers: admin, data: { activo: true } });
  expect((await responder(jugador)).status()).toBe(200);
  await request.post(`${API}/jugadores/${JUGADORES.propio.rut}/autogestionable`, { headers: admin, data: { activo: false } });
  expect((await responder(jugador)).status()).toBe(403);
  // Con el enlace la ve; quien gestiona la abre en Citaciones.
  const { rows: [propia] } = await pool.query('SELECT token_publico FROM citaciones WHERE id = $1', [creada.id]);
  expect((await (await request.get(`${API}/citaciones/por-enlace/${propia.token_publico}`, { headers: jugador })).json()).acceso).toBe('jugador');
  expect((await (await request.get(`${API}/citaciones/por-enlace/${propia.token_publico}`, { headers: admin })).json()).acceso).toBe('gestion');
  expect((await request.get(`${API}/citaciones/por-enlace/${propia.token_publico}`)).status()).toBe(401);
  // El admin responde por la familia.
  expect((await responder(admin)).status()).toBe(200);

  // Las familias no reciben enlaces ni teléfonos de otros apoderados.
  const apoderado = { Authorization: `Bearer ${await tokenDe(request, CUENTAS.apoderado.rut)}` };
  expect((await responder(apoderado)).status()).toBe(403);
  const visibles = await (await request.get(`${API}/citaciones`, { headers: apoderado })).json();
  const nuestra = visibles.find((c) => c.competencia_nombre === COMPETENCIA);
  expect(nuestra.convocados.length).toBeGreaterThan(0);
  expect(nuestra.convocados.every((c) => c.token_respuesta === undefined && c.apoderado_telefono === undefined)).toBe(true);
  expect(nuestra.token_publico).toBeUndefined();
});

test('avisos nativos: clave pública y registro del teléfono', async ({ request }) => {
  const { publicKey } = await (await request.get(`${API}/push/clave-publica`)).json();
  expect(publicKey).toMatch(/^[A-Za-z0-9_-]{80,}$/);
  // La clave se genera una vez y queda guardada.
  expect((await (await request.get(`${API}/push/clave-publica`)).json()).publicKey).toBe(publicKey);
  const apoderado = { Authorization: `Bearer ${await tokenDe(request, CUENTAS.apoderado.rut)}` };
  const sub = { endpoint: PUSH_FALSO, keys: { p256dh: 'BExample', auth: 'abc' } };
  expect((await request.post(`${API}/push/suscribir`, { headers: apoderado, data: { suscripcion: sub } })).status()).toBe(200);
  expect((await request.post(`${API}/push/suscribir`, { data: { suscripcion: sub } })).status()).toBe(401);
  expect((await request.post(`${API}/push/suscribir`, { headers: apoderado, data: { suscripcion: { endpoint: 'http://inseguro' } } })).status()).toBe(400);
  const { rows } = await pool.query('SELECT rut_norm FROM push_suscripciones WHERE endpoint = $1', [PUSH_FALSO]);
  expect(rows).toEqual([{ rut_norm: CUENTAS.apoderado.rut.replace(/[.-]/g, '').toUpperCase() }]);
});
