// Utilidades de entorno y errores compartidas.
// Extraído de server.js sin cambios de comportamiento.
const fs = require('fs');
const path = require('path');

const normalizeEnvValue = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const unquoted = raw.replace(/^"(.*)"$/, '$1').replace(/^'(.*)'$/, '$1').trim();
  return unquoted;
};

const serializeError = (error) => {
  const e = error || {};
  const meta = e.$metadata || {};
  return {
    name: e.name || null,
    message: e.message || String(e),
    code: e.code || e.Code || null,
    statusCode: e.statusCode || meta.httpStatusCode || null,
    requestId: e.requestId || meta.requestId || null,
    extendedRequestId: meta.extendedRequestId || null,
  };
};

const resolveRuntimePath = (rawPath = '') => {
  const cleaned = String(rawPath || '').trim();
  if (!cleaned) return '';
  if (path.isAbsolute(cleaned)) return cleaned;

  const fromCwd = path.resolve(cleaned);
  if (fs.existsSync(fromCwd)) return fromCwd;

  return path.resolve(__dirname, cleaned);
};

module.exports = {
  resolveRuntimePath,
  normalizeEnvValue,
  serializeError,
};
