import { getAvailableSlots } from '../services/availabilityApi.ts'
import type { AppointmentWithDetails } from '../types/appointment.ts'
import type { TimeSlot } from '../types/availability.ts'
import type { LoadStatus } from '../types/booking.ts'
import { filterBookableSlots } from '../utils/availability.ts'
import { useAsyncResource } from './useAsyncResource.ts'

interface UseAvailableSlotsParams {
  serviceId: number | null
  date: string | null
  durationMinutes: number
  confirmedAppointments: AppointmentWithDetails[]
}

interface UseAvailableSlotsResult {
  status: LoadStatus
  slots: TimeSlot[]
  /** El backend no devolvió ningún bloque para la fecha (día sin atención o bloqueado). */
  isDayClosed: boolean
  retry: () => void
}

/** Consulta la disponibilidad de un servicio en una fecha y filtra los bloques reservables. */
export function useAvailableSlots({
  serviceId,
  date,
  durationMinutes,
  confirmedAppointments,
}: UseAvailableSlotsParams): UseAvailableSlotsResult {
  const key = serviceId !== null && date !== null ? `${serviceId}|${date}` : null
  const { status, data, retry } = useAsyncResource(key, () =>
    getAvailableSlots({ service_id: serviceId ?? 0, date: date ?? '' }),
  )

  const rawSlots = data?.available_slots ?? []
  const slots = filterBookableSlots(rawSlots, { confirmedAppointments, durationMinutes })

  return {
    status,
    slots,
    isDayClosed: status === 'ready' && rawSlots.length === 0,
    retry,
  }
}
