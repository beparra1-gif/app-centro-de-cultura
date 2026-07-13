const WEBHOOK_URL = process.env.WEBHOOK_URL;
const BACKEND_BASE = process.env.BACKEND_BASE;
const ADMIN_TOKEN = process.env.ADMIN_TOKEN;
const TIMEOUT_MS = Number(process.env.TIMEOUT_MS || 6000);

if (!WEBHOOK_URL || !BACKEND_BASE || !ADMIN_TOKEN) {
  console.error("Missing envs: WEBHOOK_URL, BACKEND_BASE, ADMIN_TOKEN");
  process.exit(1);
}

const TABLES = [
  "CUENTAS",
  "JUGADORES",
  "JUGADORES_VISITA",
  "COMUNICACIONES",
  "CONVOCATORIAS",
  "EVENTOS",
  "ASISTENCIA",
  "PAGOS",
  "PAGOS_MENSUALIDADES",
  "ALERTAS",
  "ESTADISTICAS",
  "EVALUACIONES",
  "GAMIFICACION_PUNTOS",
  "QUIZ_PREGUNTAS",
  "PIZARRA_TACTICA",
  "RESULTADOS",
  "PARTIDOS_LIVE",
  "STAFF",
  "TORNEOS",
  "CAJA_EVENTO_KIOSCO",
  "CATALOGO_INVENTARIO",
  "EGRESOS",
  "CLUBES",
  "ASISTENCIA_EVENTOS",
  "ENCUESTAS",
  "ENCUESTAS_RESPUESTAS",
  "LESIONES",
  "DISCIPLINA",
  "ENTRENAMIENTOS",
];

async function withTimeout(promiseFactory, ms) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), ms);
  try {
    return await promiseFactory(controller.signal);
  } finally {
    clearTimeout(t);
  }
}

async function postWebhook(table) {
  const ts = new Date().toISOString();
  const marker = `MOD_${table}_${new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14)}`;
  const payload = {
    source: "all-modules-validation-node",
    events: [
      {
        table,
        action: "POST",
        path: "/validation/all-modules",
        statusCode: 200,
        occurredAt: ts,
        body: { marker, module: table, created_at: ts },
        params: {},
        actor: { id: "copilot", rol: "diagnostic" },
      },
    ],
  };

  try {
    const res = await withTimeout(
      (signal) =>
        fetch(WEBHOOK_URL, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
          signal,
        }),
      TIMEOUT_MS,
    );

    const text = await res.text();
    let data = null;
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }

    return {
      table,
      ok: !!(res.ok && data && data.ok === true),
      status: res.status,
      processed: data && data.processed != null ? data.processed : "",
      script_version: data && data.script_version ? data.script_version : "",
      error: data && data.error ? String(data.error) : (!res.ok ? text.slice(0, 200) : ""),
      marker,
    };
  } catch (e) {
    return {
      table,
      ok: false,
      status: 0,
      processed: "",
      script_version: "",
      error: e && e.name === "AbortError" ? `timeout_${TIMEOUT_MS}ms` : String(e.message || e),
      marker,
    };
  }
}

async function pingAndFlush() {
  const headers = { "x-sync-token": ADMIN_TOKEN };

  const ping = await withTimeout(
    (signal) => fetch(`${BACKEND_BASE}/api/admin/sync-sheets/webhook-ping`, { method: "POST", headers, signal }),
    TIMEOUT_MS,
  ).then(async (r) => ({ status: r.status, body: await r.text() }))
   .catch((e) => ({ status: 0, body: String(e.message || e) }));

  const flush = await withTimeout(
    (signal) => fetch(`${BACKEND_BASE}/api/admin/sync-sheets/webhook-flush`, { method: "POST", headers, signal }),
    TIMEOUT_MS,
  ).then(async (r) => ({ status: r.status, body: await r.text() }))
   .catch((e) => ({ status: 0, body: String(e.message || e) }));

  return { ping, flush };
}

(async () => {
  const results = [];
  for (const table of TABLES) {
    process.stdout.write(`checking_table=${table}\n`);
    // Sequential on purpose to avoid overloading Apps Script quotas.
    const r = await postWebhook(table);
    results.push(r);
  }

  const ok = results.filter((r) => r.ok).length;
  const fail = results.length - ok;
  console.log(`modules_total=${results.length} ok=${ok} fail=${fail}`);
  for (const r of results) {
    console.log(`${r.table}\tok=${r.ok}\tstatus=${r.status}\tprocessed=${r.processed}\tscript_version=${r.script_version}\terror=${r.error}`);
  }

  const health = await pingAndFlush();
  console.log(`ping_status=${health.ping.status} ping_body=${health.ping.body}`);
  console.log(`flush_status=${health.flush.status} flush_body=${health.flush.body}`);
})();
