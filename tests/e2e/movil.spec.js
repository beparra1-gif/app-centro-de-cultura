// Recorrido en teléfono real (360×740, táctil, isMobile) por rol: captura de
// cada pantalla y métricas de lo que se rompe en celular — elementos que se
// salen del ancho, botones demasiado pequeños para el dedo, modales que no
// caben y contenido tapado por la barra inferior.
// Uso: MOVIL=1 npx playwright test tests/e2e/movil.spec.js
// Deja capturas en test-results/movil/ y el detalle en test-results/movil.json.
import fs from 'node:fs';
import { test, expect, devices } from '@playwright/test';
import { CUENTAS, JUGADORES, crearPool, crearDatosPrueba, limpiarDatosPrueba, iniciarSesion } from './fixtures/cuentasPrueba.js';

test.skip(!process.env.MOVIL, 'Recorrido móvil: ejecutar con MOVIL=1');
const pool = process.env.MOVIL ? crearPool() : null;
const CARPETA = 'test-results/movil';
const informe = [];
let n = 0;

test.describe.configure({ mode: 'serial' });
test.setTimeout(360000);
const { defaultBrowserType: _ignorar, ...galaxy } = devices['Galaxy S9+'];
test.use({ ...galaxy, viewport: { width: 360, height: 740 }, deviceScaleFactor: 1.5, actionTimeout: 8000 });
test.beforeAll(async () => {
  fs.rmSync(CARPETA, { recursive: true, force: true });
  fs.mkdirSync(CARPETA, { recursive: true });
  if (pool) await crearDatosPrueba(pool);
});
test.afterAll(async () => {
  if (pool) { await limpiarDatosPrueba(pool); await pool.end(); }
  fs.writeFileSync('test-results/movil.json', JSON.stringify(informe, null, 1));
});

const medir = () => {
  const W = window.innerWidth;
  const H = window.innerHeight;
  const visible = (el) => {
    const s = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    return s.visibility !== 'hidden' && s.display !== 'none' && r.width > 0 && r.height > 0;
  };
  const enScroll = (el) => {
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
      const ox = getComputedStyle(p).overflowX;
      if ((ox === 'auto' || ox === 'scroll') && p.scrollWidth > p.clientWidth) return true;
      if (ox === 'hidden' || ox === 'clip') return true;
    }
    return false;
  };
  const nombre = (el) => `${el.tagName.toLowerCase()}${el.className && typeof el.className === 'string' ? `.${el.className.trim().split(/\s+/).slice(0, 2).join('.')}` : ''} "${(el.innerText || el.getAttribute('aria-label') || el.value || '').trim().slice(0, 30)}"`;
  const salen = [];
  for (const el of document.querySelectorAll('body *')) {
    if (!visible(el)) continue;
    const r = el.getBoundingClientRect();
    if ((r.right > W + 1 || r.left < -1) && !enScroll(el) && getComputedStyle(el).position !== 'fixed') salen.push(`${nombre(el)} [${Math.round(r.left)}→${Math.round(r.right)}]`);
  }
  const chicos = [];
  for (const el of document.querySelectorAll('button, a[href], select, input:not([type=hidden]), [role=tab], [role=button]')) {
    if (!visible(el)) continue;
    const r = el.getBoundingClientRect();
    if (el.type === 'checkbox' || el.type === 'radio') continue;
    if (r.height < 32 || r.width < 32) chicos.push(`${nombre(el)} ${Math.round(r.width)}×${Math.round(r.height)}`);
  }
  const dialogo = [...document.querySelectorAll('[role=dialog]')].filter(visible).map((d) => {
    const r = d.getBoundingClientRect();
    return { alto: Math.round(r.height), top: Math.round(r.top), bottom: Math.round(r.bottom), ancho: Math.round(r.width), cabe: r.top >= -1 && r.bottom <= H + 1 && r.left >= -1 && r.right <= W + 1 };
  });
  const nav = document.querySelector('.ios-bottom-nav');
  let tapado = null;
  if (nav && visible(nav)) {
    // Al final del scroll, ¿el último elemento queda por encima de la barra?
    const navTop = nav.getBoundingClientRect().top;
    const scrollers = [document.scrollingElement, ...document.querySelectorAll('.ios-main, main')].filter(Boolean);
    const previos = scrollers.map((e) => e.scrollTop);
    scrollers.forEach((e) => { e.style.scrollBehavior = 'auto'; e.scrollTop = e.scrollHeight; });
    const main = document.querySelector('.ios-main, main');
    const ultimo = main ? [...main.querySelectorAll('button, input, select, p, h3, article, td, li, a')].filter(visible).reduce((a, el) => Math.max(a, el.getBoundingClientRect().bottom), 0) : 0;
    scrollers.forEach((e, i) => { e.scrollTop = previos[i]; e.style.scrollBehavior = ''; });
    tapado = { navTop: Math.round(navTop), ultimo: Math.round(ultimo), tapa: ultimo > navTop + 2 };
  }
  return {
    desbordeDoc: document.documentElement.scrollWidth - W,
    salen: [...new Set(salen)].slice(0, 12),
    chicos: [...new Set(chicos)].slice(0, 15),
    totalChicos: chicos.length,
    dialogo,
    tapado,
  };
};

const vigilar = (page) => {
  const errores = [];
  page.on('pageerror', (e) => errores.push(String(e.message).slice(0, 160)));
  return errores;
};

const capturar = async (page, rol, pantalla, errores) => {
  await page.waitForTimeout(700);
  const datos = await page.evaluate(medir);
  n += 1;
  const archivo = `${String(n).padStart(2, '0')}-${rol}-${pantalla}`.replace(/[^\w-]+/g, '_').slice(0, 80);
  await page.screenshot({ path: `${CARPETA}/${archivo}.png` });
  informe.push({ n, rol, pantalla, archivo, ...datos, js: [...errores] });
  errores.length = 0;
};

const paso = async (nombre, fn) => {
  try { await fn(); } catch (e) { informe.push({ pantalla: nombre, fallo: String(e.message).split('\n')[0].slice(0, 200) }); }
};

const tocarNav = (page, texto) => page.locator('.nav-item', { hasText: texto }).first().tap();
const irPanel = async (page, destino) => {
  await tocarNav(page, 'Panel');
  await page.locator('.pn-item', { hasText: destino }).first().tap();
};

test('super admin en teléfono', async ({ page }) => {
  const errores = vigilar(page);
  await iniciarSesion(page, CUENTAS.super_admin.rut);
  await capturar(page, 'sa', 'inicio', errores);
  const secciones = (await page.locator('.nav-item').allInnerTexts()).map((s) => s.trim()).filter(Boolean);
  for (const s of secciones) await paso(`nav ${s}`, async () => { await tocarNav(page, s); await capturar(page, 'sa', `nav-${s}`, errores); });

  await paso('tesoreria', async () => {
    await irPanel(page, 'Tesorería');
    await capturar(page, 'sa', 'tes-por-cobrar', errores);
    await page.getByLabel('Buscar en Tesorería').fill('e2e socioapoderado');
    await capturar(page, 'sa', 'tes-por-cobrar-busqueda', errores);
    await page.locator('article.tc-fila', { hasText: 'E2E SocioApoderado' }).locator('.tc-linea', { hasText: 'E2E HijoSocio' }).getByRole('button', { name: /Pago/ }).first().tap();
    await page.getByText('Deportista seleccionado:').waitFor();
    await capturar(page, 'sa', 'tes-pagoform', errores);
    await page.getByRole('button', { name: 'Ene', exact: true }).tap();
    await capturar(page, 'sa', 'tes-pagoform-mes', errores);
    await page.getByRole('radio', { name: 'Registrar monto pagado' }).tap();
    await capturar(page, 'sa', 'tes-pagoform-monto', errores);
    await page.getByRole('button', { name: 'Cancelar', exact: true }).last().tap();
  });
  for (const tab of ['Validar pagos', 'Resumen', 'Informes', 'Tarifas', 'Becas']) {
    await paso(`tes ${tab}`, async () => {
      await irPanel(page, 'Tesorería');
      await page.getByRole('tab', { name: new RegExp(tab) }).tap();
      await capturar(page, 'sa', `tes-${tab}`, errores);
      if (tab === 'Informes') {
        for (const sub of ['Socios', 'Cierre de mes']) {
          await page.getByRole('tab', { name: sub, exact: true }).tap();
          await capturar(page, 'sa', `tes-informe-${sub}`, errores);
        }
      }
    });
  }

  await paso('usuarios', async () => {
    await irPanel(page, 'Usuarios y Cuentas');
    await capturar(page, 'sa', 'usr-deportistas', errores);
    await page.getByPlaceholder('Nombre, RUT, rama o categoría').fill('E2E HijoSocio');
    await capturar(page, 'sa', 'usr-busqueda', errores);
    await page.getByRole('button', { name: /E2E HijoSocio/ }).first().tap();
    await capturar(page, 'sa', 'usr-ficha-datos', errores);
    for (const t of ['Pagos', 'Apoderado']) {
      await page.getByRole('dialog').getByRole('tab', { name: new RegExp(t) }).tap();
      await capturar(page, 'sa', `usr-ficha-${t}`, errores);
    }
    await page.getByRole('dialog').getByRole('button', { name: /Editar ficha/ }).tap();
    await capturar(page, 'sa', 'usr-editar-deportista', errores);
    await page.getByRole('dialog').getByRole('button', { name: /Cancelar|Cerrar/ }).first().tap();
  });
  for (const tab of ['Cuentas', 'Vincular apoderados', 'Registrar nuevo', 'Permisos']) {
    await paso(`usr ${tab}`, async () => {
      await irPanel(page, 'Usuarios y Cuentas');
      await page.getByRole('button', { name: new RegExp(`^${tab}`) }).first().tap();
      await capturar(page, 'sa', `usr-${tab}`, errores);
      if (tab === 'Cuentas') {
        await page.getByPlaceholder(/Nombre, RUT/).first().fill('E2E SocioApoderado');
        await capturar(page, 'sa', 'usr-cuentas-busqueda', errores);
        await page.getByRole('button', { name: /E2E SocioApoderado/ }).first().tap();
        await capturar(page, 'sa', 'usr-ficha-cuenta', errores);
        await page.getByRole('dialog').getByRole('button', { name: /Editar ficha/ }).tap();
        await capturar(page, 'sa', 'usr-editar-cuenta', errores);
        await page.getByRole('dialog').getByRole('button', { name: /Cancelar|Cerrar/ }).first().tap();
      }
    });
  }
  await paso('respaldos', async () => { await irPanel(page, 'Respaldos'); await capturar(page, 'sa', 'respaldos', errores); });
  const destinos = await (async () => { await tocarNav(page, 'Panel'); return page.locator('.pn-item strong').allInnerTexts(); })();
  for (const d of destinos.filter((x) => !['Tesorería', 'Usuarios y Cuentas', 'Respaldos'].includes(x))) {
    await paso(`panel ${d}`, async () => { await irPanel(page, d); await capturar(page, 'sa', `panel-${d}`, errores); });
  }
  expect(informe.length).toBeGreaterThan(10);
});

for (const rol of ['socio_apoderado', 'apoderado', 'socio', 'jugador', 'staff']) {
  test(`${rol} en teléfono`, async ({ page }) => {
    const errores = vigilar(page);
    await iniciarSesion(page, CUENTAS[rol].rut);
    await capturar(page, rol, 'inicio', errores);
    const secciones = (await page.locator('.nav-item').allInnerTexts()).map((s) => s.trim()).filter(Boolean);
    for (const s of secciones) {
      await paso(`${rol} ${s}`, async () => {
        await tocarNav(page, s);
        await capturar(page, rol, `nav-${s}`, errores);
        const boton = page.getByRole('button', { name: /Pagar|Registrar pago|Subir comprobante/ }).first();
        if (['socio_apoderado', 'apoderado', 'socio'].includes(rol) && await boton.isVisible().catch(() => false)) {
          await boton.tap();
          await capturar(page, rol, `${s}-pagar`, errores);
          await page.keyboard.press('Escape').catch(() => {});
          await page.getByRole('button', { name: /Cancelar|Cerrar|Volver/ }).first().tap({ timeout: 2000 }).catch(() => {});
        }
      });
    }
  });
}

void JUGADORES;
