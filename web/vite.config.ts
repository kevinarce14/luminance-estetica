import { fileURLToPath, URL } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

/** Backend local por defecto; API_PROXY_TARGET (en .env.local) permite apuntar el proxy a otro, ej. Render. */
const DEFAULT_API_PROXY_TARGET = 'http://localhost:3000'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiProxy = {
    '/api': {
      target: env.API_PROXY_TARGET?.trim() || DEFAULT_API_PROXY_TARGET,
      changeOrigin: true,
      secure: true,
    },
  }

  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    server: {
      port: 5173,
      proxy: apiProxy,
    },
  }
})
