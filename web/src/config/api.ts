/**
 * Resolución automática de la URL del backend.
 *
 * - Desarrollo (`npm run dev`): rutas relativas `/api`, que el proxy de Vite envía al
 *   backend local (o al que indique API_PROXY_TARGET, ver vite.config.ts). Sin CORS.
 * - Producción (`npm run build`, ej. Vercel): backend desplegado en Render.
 * - VITE_API_BASE_URL, si tiene valor, tiene prioridad en ambos casos.
 */
export const PRODUCTION_API_BASE_URL = 'https://luminance-backend.onrender.com'

function resolveApiBaseUrl(): string {
  const override = import.meta.env.VITE_API_BASE_URL?.trim()
  if (override) {
    return override.replace(/\/+$/, '')
  }
  return import.meta.env.PROD ? PRODUCTION_API_BASE_URL : ''
}

export const API_BASE_URL = resolveApiBaseUrl()
