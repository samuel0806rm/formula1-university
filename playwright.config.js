import { defineConfig, devices } from '@playwright/test'

// Pruebas de interfaz. `npm run test:e2e` levanta Vite si no está corriendo.
export default defineConfig({
  testDir: './tests',
  outputDir: './tests/resultados',
  fullyParallel: false,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:5173',
    ...devices['Desktop Chrome'],
  },
  webServer: {
    command: 'npm run dev -- --port 5173 --strictPort',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
    timeout: 60_000,
  },
})
