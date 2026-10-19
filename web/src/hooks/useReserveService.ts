import { useCallback, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth.ts'
import type { TurneraLocationState } from '../types/navigation.ts'

interface UseReserveServiceResult {
  reserveService: (serviceId?: number) => void
  isLoginModalOpen: boolean
  closeLoginModal: () => void
}

/**
 * Flujo "Reservar Turno" del legado (`reserveService` en studio.html):
 * sin sesión abre el modal de login requerido; con sesión navega a /turnera.
 */
export function useReserveService(): UseReserveServiceResult {
  const navigate = useNavigate()
  const { isAuthenticated } = useAuth()
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false)

  const reserveService = useCallback(
    (serviceId?: number) => {
      if (!isAuthenticated) {
        setIsLoginModalOpen(true)
        return
      }

      const state: TurneraLocationState = { serviceId }
      navigate('/turnera', { state })
    },
    [isAuthenticated, navigate],
  )

  const closeLoginModal = useCallback(() => setIsLoginModalOpen(false), [])

  return { reserveService, isLoginModalOpen, closeLoginModal }
}
