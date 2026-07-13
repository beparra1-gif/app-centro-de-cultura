const axios = require('axios');

const createSheetsWebhookSyncManager = ({
  webhookUrl = process.env.GOOGLE_SHEETS_WEBHOOK_URL,
  webhookToken = process.env.GOOGLE_SHEETS_WEBHOOK_TOKEN,
  enabled = String(process.env.GOOGLE_SHEETS_WEBHOOK_ENABLED || 'true').toLowerCase() === 'true',
  debounceMs = Number(process.env.GOOGLE_SHEETS_WEBHOOK_DEBOUNCE_MS || 2500),
  logger = console,
} = {}) => {
  const url = String(webhookUrl || '').trim();
  const token = String(webhookToken || '').trim();
  const safeDebounce = Number.isFinite(debounceMs) && debounceMs >= 0 ? debounceMs : 2500;

  let timer = null;
  let flushing = false;
  const queue = [];

  const isConfigured = () => Boolean(enabled && url);

  const flush = async () => {
    if (flushing) return;
    if (!isConfigured()) return;
    if (queue.length === 0) return;

    flushing = true;
    const events = queue.splice(0, queue.length);

    try {
      await axios.post(
        url,
        {
          source: 'ccf-backend',
          sentAt: new Date().toISOString(),
          events,
        },
        {
          timeout: 20000,
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { 'x-webhook-token': token } : {}),
          },
        }
      );
      logger.log(`[SHEETS-WEBHOOK] ${events.length} cambio(s) enviados.`);
    } catch (error) {
      // Reinsertar al inicio para reintento posterior.
      queue.unshift(...events);
      logger.error(`[SHEETS-WEBHOOK] Error enviando cambios: ${error.message}`);
    } finally {
      flushing = false;
      if (queue.length > 0 && !timer) {
        timer = setTimeout(() => {
          timer = null;
          void flush();
        }, safeDebounce);
      }
    }
  };

  const enqueueEvent = (event) => {
    if (!event || typeof event !== 'object') return;
    queue.push(event);

    if (!isConfigured()) return;

    if (!timer) {
      timer = setTimeout(() => {
        timer = null;
        void flush();
      }, safeDebounce);
    }
  };

  const sendPing = async () => {
    if (!isConfigured()) {
      return { ok: false, reason: 'Webhook Google Sheets no configurado.' };
    }

    try {
      await axios.post(
        url,
        {
          source: 'ccf-backend',
          type: 'ping',
          sentAt: new Date().toISOString(),
        },
        {
          timeout: 15000,
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { 'x-webhook-token': token } : {}),
          },
        }
      );

      return { ok: true };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  };

  return {
    isConfigured,
    enqueueEvent,
    flush,
    sendPing,
  };
};

module.exports = {
  createSheetsWebhookSyncManager,
};
