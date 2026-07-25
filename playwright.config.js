import { defineConfig, devices } from '@playwright/test';

// Fundación E2E: un solo proyecto Chromium, sin webServer automático porque
// en este entorno el dev server (frontend :5173 + backend :3000) ya se
// levanta y se maneja a mano — correr `npx playwright test` asume que
// ambos ya están arriba.
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
});
