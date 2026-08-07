import { defineConfig, devices } from '@playwright/test'

/**
 * spec/05_PRUEBAS.md §3 · Cuatro recorridos, los que importan.
 *
 * Corre contra el dev server local (nunca contra producción) con Supabase
 * local ya levantado (`supabase start`). `npm run test:e2e` no arranca
 * Supabase por sí solo — es infraestructura pesada que se comparte con
 * `npm run test`, no algo que valga la pena repetir por corrida.
 */
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false, // los flujos escriben en la misma base compartida
  retries: 0,
  workers: 1,
  reporter: 'list',
  timeout: 30_000,

  use: {
    baseURL: 'http://localhost:3000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },

  projects: [
    { name: 'chromium', use: { ...devices['iPhone 13'] } }, // se usa de pie, en un teléfono
  ],

  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: true,
    timeout: 30_000,
  },
})
