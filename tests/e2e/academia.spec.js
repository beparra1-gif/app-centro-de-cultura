// Academia de punta a punta: el staff publica material (enlace y video
// subido), quiz y pizarra para SUB-13 Masculina; los gestiona (editar,
// despublicar, eliminar); revisa el dashboard y evalúa (técnica y
// psicomotriz). La familia del SUB-13 ve ese contenido, responde el quiz
// (+XP) y ve sus evaluaciones; la del SUB-15 no ve nada dirigido a SUB-13.
import { test, expect } from '@playwright/test';
import { CUENTAS, JUGADORES, PASSWORD_PRUEBA, crearPool, crearDatosPrueba, limpiarDatosPrueba, iniciarSesion } from './fixtures/cuentasPrueba.js';

const pool = crearPool();
const P = 'E2E Acad';
const T = {
  material: `${P} Material`, video: `${P} Video`, quiz: `${P} Quiz`, pizarra: `${P} Pizarra`,
  borrar: `${P} Para borrar`, editado: `${P} Material editado`,
};
const rutsFamilia = [JUGADORES.pupilo.rut, JUGADORES.hijoSocio.rut];

const limpiarAcademia = async () => {
  await pool.query(`DELETE FROM quiz_respuestas WHERE id_pregunta IN (SELECT id_pregunta FROM quiz_preguntas WHERE titulo LIKE '${P}%')`);
  await pool.query(`DELETE FROM quiz_preguntas WHERE titulo LIKE '${P}%'`);
  await pool.query(`DELETE FROM academia_material_interacciones WHERE comunicacion_id IN (SELECT id FROM comunicaciones WHERE titulo LIKE '${P}%')`).catch(() => {});
  await pool.query(`DELETE FROM comunicaciones WHERE titulo LIKE '${P}%'`);
  await pool.query(`DELETE FROM academia_videos WHERE titulo LIKE '${P}%'`);
  await pool.query(`DELETE FROM academia_pizarras WHERE nombre_tactica LIKE '${P}%'`);
  await pool.query('DELETE FROM evaluaciones WHERE rut_jugador = ANY($1)', [rutsFamilia]);
  await pool.query('DELETE FROM gamificacion_puntos WHERE rut_jugador = ANY($1)', [rutsFamilia]);
};

test.describe.configure({ mode: 'serial' });
test.setTimeout(120000);
test.beforeAll(async () => {
  await limpiarAcademia();
  await crearDatosPrueba(pool);
  await pool.query(`UPDATE cuentas SET categorias_asignadas = '["SUB-13"]'::jsonb WHERE rut = $1`, [CUENTAS.staff.rut]);
});
test.afterAll(async () => { await limpiarAcademia(); await limpiarDatosPrueba(pool); await pool.end(); });

const abrirDocente = async (page, vista) => {
  await iniciarSesion(page, CUENTAS.staff.rut);
  await page.locator('.nav-item', { hasText: 'Academia' }).click();
  await expect(page.getByText('Panel Docente')).toBeVisible({ timeout: 15000 });
  await page.getByRole('button', { name: vista, exact: true }).click();
};

// Rama Masculina + chip SUB-13 dentro de la sección abierta.
const destinarSub13 = async (seccion) => {
  await seccion.locator('select').filter({ has: seccion.page().locator('option', { hasText: 'Masculina' }) }).last().selectOption('Masculina');
  await seccion.getByRole('button', { name: 'SUB-13', exact: true }).last().click();
};

test('staff publica material por enlace, video subido, quiz y pizarra', async ({ page }) => {
  await abrirDocente(page, 'Publicar');
  const panel = page.locator('.card', { hasText: 'Panel Docente' });

  // Material por enlace.
  await panel.getByText('Publicar Contenido').click();
  await panel.getByPlaceholder('Ej: Lecturas defensivas desde lado débil').fill(T.material);
  await panel.getByPlaceholder('https://...').fill('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
  await destinarSub13(panel);
  await panel.getByRole('button', { name: /Publicar material/ }).click();
  await expect(page.getByText('Material publicado en Academia.')).toBeVisible({ timeout: 10000 });

  // Segundo material (se eliminará en la prueba de gestión).
  await panel.getByPlaceholder('Ej: Lecturas defensivas desde lado débil').fill(T.borrar);
  await panel.getByPlaceholder('https://...').fill('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
  await panel.getByRole('button', { name: /Publicar material/ }).click();
  await expect(page.getByText('Material publicado en Academia.').last()).toBeVisible({ timeout: 10000 });
  // El formulario se limpia al publicar: esperar antes de escribir lo siguiente.
  await expect(panel.getByPlaceholder('Ej: Lecturas defensivas desde lado débil')).toHaveValue('', { timeout: 15000 });

  // Video corto subido (el backend solo acepta MP4/WEBM/MOV).
  await panel.getByRole('button', { name: /Subir video corto/ }).click();
  await panel.locator('input[type=file]').setInputFiles({ name: 'clip.mp4', mimeType: 'video/mp4', buffer: Buffer.from('00000018667479706d703432', 'hex') });
  await panel.getByPlaceholder('Ej: Lecturas defensivas desde lado débil').fill(T.video);
  await destinarSub13(panel);
  await panel.getByRole('button', { name: /Subir y publicar video/ }).click();
  await expect(page.getByText('Video subido y publicado en Academia.')).toBeVisible({ timeout: 15000 });

  // Quiz.
  await panel.getByText('Crear Quiz Táctico').click();
  await panel.getByPlaceholder('Título del quiz').fill(T.quiz);
  await panel.getByPlaceholder('Pregunta').fill('¿Qué defensa cambia en cada bloqueo?');
  await panel.getByPlaceholder('Opción A').fill('Individual estricta');
  await panel.getByPlaceholder('Opción B').fill('Switch');
  await panel.getByPlaceholder('Opción C').fill('Zona 2-3');
  await panel.locator('select', { has: page.locator('option', { hasText: 'Respuesta correcta: B' }) }).selectOption('B');
  await destinarSub13(panel);
  await panel.getByRole('button', { name: 'Guardar quiz' }).click();
  await expect(page.getByText('Quiz táctico creado correctamente.')).toBeVisible({ timeout: 10000 });

  // Pizarra: dibuja, captura y guarda.
  await panel.getByText('Pizarra Interactiva').click();
  await panel.getByPlaceholder('Nombre de la táctica').fill(T.pizarra);
  await panel.getByPlaceholder('Descripción y objetivos').fill('Salida de presión 1-3-1');
  for (const ficha of ['Atacante', 'Defensor', 'Balón']) await panel.getByRole('button', { name: ficha, exact: true }).click();
  await panel.getByRole('button', { name: /Dibujar jugada/ }).click();
  const tablero = panel.getByRole('button', { name: /Limpiar todo/ }).locator('xpath=../following-sibling::div[1]');
  const caja = await tablero.boundingBox();
  await page.mouse.move(caja.x + 40, caja.y + 40);
  await page.mouse.down();
  await page.mouse.move(caja.x + 160, caja.y + 120, { steps: 8 });
  await page.mouse.up();
  await panel.getByRole('button', { name: /Capturar pizarra/ }).click();
  await expect(panel.getByText(/Pizarra capturada/)).toBeVisible();
  await destinarSub13(panel);
  await panel.getByRole('button', { name: 'Guardar pizarra' }).click();
  await expect(page.getByText('Pizarra táctica guardada correctamente.')).toBeVisible({ timeout: 10000 });

  const { rows: com } = await pool.query(`SELECT titulo, rama, categorias_objetivo FROM comunicaciones WHERE titulo LIKE '${P}%' ORDER BY titulo`);
  expect(com.map((c) => c.titulo)).toEqual([T.material, T.borrar, T.video].sort());
  expect(com.find((c) => c.titulo === T.material)).toMatchObject({ rama: 'Masculina' });
  expect(JSON.stringify(com.find((c) => c.titulo === T.material).categorias_objetivo)).toContain('SUB-13');
  const { rows: [vid] } = await pool.query(`SELECT tamano_bytes FROM academia_videos WHERE titulo = $1`, [T.video]);
  expect(Number(vid.tamano_bytes)).toBeGreaterThan(0);
  const { rows: [qz] } = await pool.query('SELECT respuesta_correcta, categorias_objetivo FROM quiz_preguntas WHERE titulo = $1', [T.quiz]);
  expect(qz.respuesta_correcta).toBe('B');
  const { rows: [pz] } = await pool.query('SELECT octet_length(imagen_data) AS bytes, rama FROM academia_pizarras WHERE nombre_tactica = $1', [T.pizarra]);
  expect(Number(pz.bytes)).toBeGreaterThan(1000);
});

test('staff gestiona lo publicado: editar, despublicar/publicar y eliminar', async ({ page }) => {
  await abrirDocente(page, 'Mis Publicaciones');
  const tarjeta = (titulo) => page.locator('div', { has: page.getByText(titulo, { exact: true }) }).filter({ has: page.getByRole('button', { name: /Editar/ }) }).last();

  await tarjeta(T.material).getByRole('button', { name: /Editar/ }).click();
  await page.getByPlaceholder('Título').first().fill(T.editado);
  await page.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(page.getByText('Cambios guardados.')).toBeVisible({ timeout: 10000 });
  await expect(tarjeta(T.editado)).toBeVisible();

  await tarjeta(T.quiz).getByRole('button', { name: 'Despublicar' }).click();
  await expect(tarjeta(T.quiz).getByText('Despublicado')).toBeVisible({ timeout: 10000 });
  await tarjeta(T.quiz).getByRole('button', { name: 'Publicar' }).click();
  await expect(tarjeta(T.quiz).getByText('Publicado', { exact: true })).toBeVisible({ timeout: 10000 });

  await tarjeta(T.borrar).getByRole('button', { name: /Eliminar/ }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Eliminar' }).click();
  await expect(page.getByText('Eliminado.')).toBeVisible({ timeout: 10000 });
  await expect(page.getByText(T.borrar, { exact: true })).toHaveCount(0);

  const { rows } = await pool.query(`SELECT titulo FROM comunicaciones WHERE titulo LIKE '${P}%' ORDER BY titulo`);
  expect(rows.map((r) => r.titulo)).toEqual([T.editado, T.video].sort());
  // Despublicar/publicar no borra las categorías destinatarias.
  const { rows: [qz] } = await pool.query('SELECT activo, categorias_objetivo FROM quiz_preguntas WHERE titulo = $1', [T.quiz]);
  expect(qz).toEqual({ activo: true, categorias_objetivo: ['SUB-13'] });
});

test('staff ve el dashboard y evalúa (técnica y psicomotriz) solo su categoría', async ({ page }) => {
  await abrirDocente(page, 'Dashboard');
  await expect(page.getByText(/Ranking|Participación|Quiz/).first()).toBeVisible({ timeout: 10000 });

  await page.getByRole('button', { name: 'Evaluar', exact: true }).click();
  const selector = page.locator('select', { has: page.locator('option', { hasText: 'Selecciona un deportista desde el roster activo' }) });
  await expect(selector.locator('option', { hasText: JUGADORES.pupilo.nombres })).toHaveCount(1);
  await expect(selector.locator('option', { hasText: JUGADORES.hijoSocio.nombres })).toHaveCount(0);
  await selector.selectOption(JUGADORES.pupilo.rut);

  await page.getByPlaceholder('Ej: Excelente visión de juego perimetral').fill('Buen tiro');
  await page.getByPlaceholder('Ej: Transición defensiva lenta').fill('Defensa');
  await page.getByRole('button', { name: /Emitir Evaluación Formal/ }).click();
  await expect(page.getByText(/Evaluación guardada para E2E Pupilo/)).toBeVisible({ timeout: 10000 });

  await page.getByRole('button', { name: 'Psicomotriz', exact: true }).click();
  await page.locator('select', { has: page.locator('option', { hasText: 'Derecha definida' }) }).selectOption('derecha');
  await page.getByPlaceholder(/Buena disociación/).fill('Buen equilibrio');
  await page.getByRole('button', { name: /Emitir Evaluación Formal/ }).click();
  await expect(page.getByText(/Evaluación guardada para E2E Pupilo/).last()).toBeVisible({ timeout: 10000 });

  const { rows } = await pool.query('SELECT tipo_evaluacion, lateralidad FROM evaluaciones WHERE rut_jugador = $1 ORDER BY id_evaluacion', [JUGADORES.pupilo.rut]);
  expect(rows).toHaveLength(2);
  expect(rows[1]).toMatchObject({ tipo_evaluacion: 'Evaluación Psicomotriz', lateralidad: 'derecha' });
});

test('familia SUB-13 ve el contenido, responde el quiz (+XP) y ve sus evaluaciones', async ({ page }) => {
  await iniciarSesion(page, CUENTAS.apoderado.rut);
  await page.locator('.nav-item', { hasText: 'Academia' }).click();
  await expect(page.getByText(T.editado, { exact: true })).toBeVisible({ timeout: 15000 });
  await expect(page.getByText(T.video, { exact: true })).toBeVisible();
  await expect(page.getByText(T.quiz)).toBeVisible();

  const quiz = page.locator('.academia-card', { hasText: T.quiz });
  await quiz.getByRole('button', { name: /B\) Switch/ }).click();
  await expect(quiz.getByText('Correcto. Sumas XP')).toBeVisible({ timeout: 10000 });
  await expect(quiz.getByRole('button', { name: /A\) / })).toBeDisabled();

  await expect(page.getByText('Lateralidad: Derecha definida')).toBeVisible();
  await expect(page.getByText(/Tiro: \d+/)).toBeVisible();

  const { rows: [r] } = await pool.query(
    'SELECT es_correcta, puntos_obtenidos FROM quiz_respuestas WHERE rut_jugador = $1 AND id_pregunta = (SELECT id_pregunta FROM quiz_preguntas WHERE titulo = $2)',
    [JUGADORES.pupilo.rut, T.quiz]
  );
  expect(r).toMatchObject({ es_correcta: true });
  expect(Number(r.puntos_obtenidos)).toBeGreaterThan(0);
});

test('familia SUB-15 no ve contenido dirigido a SUB-13', async ({ page }) => {
  await iniciarSesion(page, CUENTAS.socio_apoderado.rut);
  await page.locator('.nav-item', { hasText: 'Academia' }).click();
  await expect(page.getByText('Mis Evaluaciones')).toBeVisible({ timeout: 15000 });
  await expect(page.getByText(T.editado, { exact: true })).toHaveCount(0);
  await expect(page.getByText(T.video, { exact: true })).toHaveCount(0);
  await expect(page.getByText(T.quiz)).toHaveCount(0);
});

test('un admin ve también los quiz despublicados para gestionarlos; la familia no', async ({ request }) => {
  await pool.query('UPDATE quiz_preguntas SET activo = false WHERE titulo = $1', [T.quiz]);
  const API = process.env.E2E_API_URL || 'http://localhost:3000/api';
  const titulos = async (rut) => {
    const { token } = await (await request.post(`${API}/auth/login`, { data: { rut, password: PASSWORD_PRUEBA } })).json();
    return (await (await request.get(`${API}/quiz`, { headers: { Authorization: `Bearer ${token}` } })).json()).map((q) => q.titulo);
  };
  expect(await titulos(CUENTAS.admin.rut)).toContain(T.quiz);
  expect(await titulos(CUENTAS.apoderado.rut)).not.toContain(T.quiz);
});

test('un staff con categorías solo publica para ellas', async ({ request }) => {
  const API = process.env.E2E_API_URL || 'http://localhost:3000/api';
  const { token } = await (await request.post(`${API}/auth/login`, { data: { rut: CUENTAS.staff.rut, password: PASSWORD_PRUEBA } })).json();
  const auth = { Authorization: `Bearer ${token}` };
  const base = { tipo_quiz: 'tactico', rama: 'General', pregunta: '¿?', opciones_json: ['a', 'b', 'c'], respuesta_correcta: 'A', dificultad: 'media' };
  const otra = await request.post(`${API}/quiz`, { headers: auth, data: { ...base, titulo: `${P} Ajeno`, categorias_objetivo: ['SUB-15'] } });
  expect(otra.status()).toBe(403);
  const sinElegir = await request.post(`${API}/quiz`, { headers: auth, data: { ...base, titulo: `${P} Sin elegir`, categorias_objetivo: [] } });
  expect(sinElegir.status()).toBe(200);
  const { rows: [q] } = await pool.query('SELECT categorias_objetivo FROM quiz_preguntas WHERE titulo = $1', [`${P} Sin elegir`]);
  expect(q.categorias_objetivo).toEqual(['SUB-13']);
});
