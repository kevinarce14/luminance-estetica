import { getAppointment } from '../services/appointmentsApi.ts'
import { isApiError } from '../types/api.ts'
import type { AppointmentWithDetails } from '../types/appointment.ts'
import type { LoadStatus } from '../types/booking.ts'
import { useAsyncResource } from './useAsyncResource.ts'

interface UseAppointmentResult {
  status: LoadStatus
  appointment: AppointmentWithDetails | null
  errorMessage: string | null
  retry: () => void
}

/** Carga un turno por ID. Con `appointmentId` null queda en 'idle'. */
export function useAppointment(appointmentId: number | null): UseAppointmentResult {
  const { status, data, error, retry } = useAsyncResource(
    appointmentId === null ? null : String(appointmentId),
    () => getAppointment(appointmentId ?? 0),
  )

  let errorMessage: string | null = null
  if (status === 'error') {
    errorMessage = isApiError(error) ? error.message : 'Error al cargar el turno'
  }

  return { status, appointment: data, errorMessage, retry }
}
