import { defineConfig, devices } from '@playwright/test'

// Pruebas de interfaz (`npx playwright test` o `npm run test:e2e`).
// - Vite (5173): vistas con la API simulada en el navegador (tests/apoyo.js).
// - Servidor de pruebas (3101): versión compilada + server/index.js real contra una
//   TunjaAPI falsa (tests/servidor-prueba.mjs). Lo usan PWA, administradores y NFC.
export default defineConfig({
  testDir: './tests',
  outputDir: './tests/resultados',
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:5173',
    ...devices['Desktop Chrome'],
  },
  webServer: [
    {
      command: 'npm run dev -- --port 5173 --strictPort',
      url: 'http://localhost:5173',
      reuseExistingServer: true,
      timeout: 60_000,
    },
    {
      command: 'npm run build && node tests/servidor-prueba.mjs',
      url: 'http://127.0.0.1:3101/manifest.webmanifest',
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
})
