import { Navigate, useLocation } from 'react-router-dom'

interface LegacyRedirectProps {
  to: string
}

/**
 * Redirige una URL del frontend legado (ej. /pago-exitoso.html) a su ruta nueva,
 * conservando los query params. Necesario porque el backend configura las back_urls
 * de MercadoPago con las rutas .html.
 */
export function LegacyRedirect({ to }: LegacyRedirectProps) {
  const { search } = useLocation()
  return <Navigate to={`${to}${search}`} replace />
}
