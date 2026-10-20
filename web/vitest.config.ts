import { defineConfig } from 'vitest/config'

/** Tests unitarios de la lógica pura (fechas, validaciones, filtros). Los flujos completos van con Playwright (e2e/). */
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
})
