import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.tsx'
import type { AuthRedirectState } from '../../types/navigation.ts'
import type { ReactNode } from 'react'

const DEFAULT_REDIRECT = '/studio'

interface GuestRouteProps {
  children: ReactNode
}

/**
 * Solo visitantes sin sesión (/login, /register). Con sesión iniciada redirige
 * a la ruta protegida de origen o a /studio, igual que login.html del legado.
 * También resuelve la redirección inmediatamente después de un login exitoso.
 */
export function GuestRoute({ children }: GuestRouteProps) {
  const { isAuthenticated } = useAuth()
  const location = useLocation()

  if (isAuthenticated) {
    const state = location.state as AuthRedirectState | null
    return <Navigate to={state?.from ?? DEFAULT_REDIRECT} replace />
  }

  return children
}
