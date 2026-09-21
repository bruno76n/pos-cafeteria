import { defineConfig, devices } from '@playwright/test';
import { PUERTO_API, PUERTO_APP, PUERTO_PWA } from './e2e/puertos';

const entorno = { API_PUERTO: String(PUERTO_API) };

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: {
    ...devices['Desktop Chrome'],
    baseURL: `http://localhost:${PUERTO_APP}`,
    viewport: { width: 1280, height: 800 },
    hasTouch: true,
    locale: 'es-MX',
    timezoneId: 'America/Mexico_City',
    trace: 'retain-on-failure',
  },
  webServer: [
    {
      command: 'tsx e2e/servidor.ts',
      url: `http://localhost:${PUERTO_API}/api/salud`,
      env: entorno,
      reuseExistingServer: false,
      stdout: 'pipe',
    },
    {
      command: `vite --port ${PUERTO_APP} --strictPort`,
      url: `http://localhost:${PUERTO_APP}`,
      env: entorno,
      reuseExistingServer: false,
    },
    {
      // Build de producción con service worker, para la prueba de la PWA sin red.
      command: `vite build && vite preview --port ${PUERTO_PWA} --strictPort`,
      url: `http://localhost:${PUERTO_PWA}`,
      env: entorno,
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
});
