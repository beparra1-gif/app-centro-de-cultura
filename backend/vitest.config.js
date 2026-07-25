const { defineConfig } = require('vitest/config');

// Config propia y aislada: sin esto, vitest sube al vite.config.js de la
// raíz (frontend) y trata de aplicar su setupFiles (src/test/setup.js,
// pensado para jsdom) acá, donde no existe.
module.exports = defineConfig({
  test: {
    environment: 'node',
  },
});
