import { MIN_BOOKING_ADVANCE_HOURS } from '../constants/booking.ts'
import type { AppointmentWithDetails } from '../types/appointment.ts'
import type { TimeSlot } from '../types/availability.ts'
import type { BusyDays } from '../types/booking.ts'
import { getStudioDateKey, parseStudioDateTime } from './studioTime.ts'

const MINUTE_MS = 60 * 1000
const HOUR_MS = 60 * MINUTE_MS

interface FilterSlotsOptions {
  /** Turnos confirmados para el doble chequeo de solapamiento (igual que el legado). */
  confirmedAppointments: AppointmentWithDetails[]
  durationMinutes: number
  now?: number
}

/**
 * Deja solo los horarios reservables:
 * 1. marcados como disponibles por el backend,
 * 2. con la anticipación mínima que exige el backend (MIN_BOOKING_ADVANCE_HOURS),
 * 3. sin solapamiento con turnos confirmados (doble chequeo del legado).
 */
export function filterBookableSlots(
  slots: TimeSlot[],
  { confirmedAppointments, durationMinutes, now = Date.now() }: FilterSlotsOptions,
): TimeSlot[] {
  const durationMs = durationMinutes * MINUTE_MS
  const earliestStart = now + MIN_BOOKING_ADVANCE_HOURS * HOUR_MS
  const busyRanges = confirmedAppointments.map((appointment) => {
    const start = parseStudioDateTime(appointment.appointment_date).getTime()
    return { start, end: start + durationMs }
  })

  return slots.filter((slot) => {
    if (!slot.is_available) {
      return false
    }

    const slotStart = parseStudioDateTime(slot.start_time).getTime()
    if (slotStart < earliestStart) {
      return false
    }

    const slotEnd = slotStart + durationMs
    return !busyRanges.some((range) => range.start < slotEnd && range.end > slotStart)
  })
}

/** Agrupa turnos confirmados por día (para marcarlos en el calendario). */
export function countAppointmentsByDay(appointments: AppointmentWithDetails[]): BusyDays {
  return appointments.reduce<BusyDays>((days, appointment) => {
    const dateKey = getStudioDateKey(appointment.appointment_date)
    days[dateKey] = (days[dateKey] ?? 0) + 1
    return days
  }, {})
}
