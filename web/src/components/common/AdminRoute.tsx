import { Navigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.tsx'
import { ProtectedRoute } from './ProtectedRoute.tsx'
import type { ReactNode } from 'react'

interface AdminRouteProps {
  children: ReactNode
}

/** Solo administradores. Sin sesión → /login; usuario común → /studio. */
export function AdminRoute({ children }: AdminRouteProps) {
  const { isAdmin } = useAuth()

  return (
    <ProtectedRoute>
      {isAdmin ? children : <Navigate to="/studio" replace />}
    </ProtectedRoute>
  )
}
