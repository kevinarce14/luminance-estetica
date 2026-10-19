import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.tsx'
import type { AuthRedirectState } from '../../types/navigation.ts'
import type { ReactNode } from 'react'

interface ProtectedRouteProps {
  children: ReactNode
}

/** Solo usuarios autenticados. Sin sesión va a /login recordando la ruta pedida. */
export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isAuthenticated } = useAuth()
  const location = useLocation()

  if (!isAuthenticated) {
    const state: AuthRedirectState = {
      from: `${location.pathname}${location.search}`,
    }
    return <Navigate to="/login" replace state={state} />
  }

  return children
}
