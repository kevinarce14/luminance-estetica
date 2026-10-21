import { defineConfig, devices } from '@playwright/test'

/**
 * Pruebas E2E: navegador real + frontend (Vite) + backend real + PostgreSQL descartable.
 *
 *   TEST_DATABASE_URL=postgresql://... npm run test:e2e                      → backend NestJS (backend/)
 *   E2E_BACKEND=fastapi TEST_DATABASE_URL=postgresql://... npm run test:e2e  → backend FastAPI (app/)
 *
 * Los mismos tests validan ambos backends: los dos exponen el mismo contrato y las rutas
 * auxiliares /__e2e__/* (backend/test/e2e-server y tests/e2e_server.py).
 * Usa puertos propios (backend 8800, frontend 5180) y nunca reutiliza servidores ya
 * levantados: así no puede conectarse por error a un backend de desarrollo con datos reales.
 */
const BACKEND_PORT = 8800
const FRONTEND_PORT = 5180
const FRONTEND_URL = `http://localhost:${FRONTEND_PORT}`
const PYTHON = process.env.PYTHON ?? 'python'
const BACKEND = process.env.E2E_BACKEND ?? 'nest'

if (BACKEND !== 'nest' && BACKEND !== 'fastapi') {
  throw new Error(`E2E_BACKEND debe ser "nest" o "fastapi" (recibido: "${BACKEND}").`)
}

const backendCommand =
  BACKEND === 'nest'
    ? `npm --prefix ../backend run e2e:server -- --port ${BACKEND_PORT} --frontend-url ${FRONTEND_URL}`
    : `${PYTHON} ../tests/e2e_server.py --port ${BACKEND_PORT} --frontend-url ${FRONTEND_URL}`

if (!process.env.TEST_DATABASE_URL) {
  throw new Error(
    'Definí TEST_DATABASE_URL con una base PostgreSQL descartable: el backend de E2E borra y recrea el schema.',
  )
}

export const E2E_API_URL = `http://127.0.0.1:${BACKEND_PORT}`

export default defineConfig({
  testDir: './e2e',
  // Comparten una base: se ejecutan en orden, de a uno.
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: FRONTEND_URL,
    locale: 'es-AR',
    timezoneId: 'America/Argentina/Buenos_Aires',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: backendCommand,
      url: `${E2E_API_URL}/api/health`,
      reuseExistingServer: false,
      timeout: 120_000,
      stdout: 'pipe',
      stderr: 'pipe',
      env: { PYTHONIOENCODING: 'utf-8' },
    },
    {
      command: `npx vite --port ${FRONTEND_PORT} --strictPort`,
      url: FRONTEND_URL,
      reuseExistingServer: false,
      timeout: 120_000,
      env: { API_PROXY_TARGET: E2E_API_URL, VITE_API_BASE_URL: '' },
    },
  ],
})
