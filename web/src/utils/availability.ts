import { MIN_BOOKING_ADVANCE_HOURS } from '../constants/booking.ts'
import type { PublicBookedSlot } from '../types/appointment.ts'
import type { TimeSlot } from '../types/availability.ts'
import type { BusyDays } from '../types/booking.ts'
import { getStudioDateKey, parseStudioDateTime } from './studioTime.ts'

const HOUR_MS = 60 * 60 * 1000

/**
 * Deja solo los horarios reservables:
 * 1. marcados como disponibles por el backend (ya descuenta los turnos confirmados),
 * 2. con la anticipación mínima que exige el backend al crear (MIN_BOOKING_ADVANCE_HOURS).
 */
export function filterBookableSlots(slots: TimeSlot[], now: number = Date.now()): TimeSlot[] {
  const earliestStart = now + MIN_BOOKING_ADVANCE_HOURS * HOUR_MS
  return slots.filter(
    (slot) => slot.is_available && parseStudioDateTime(slot.start_time).getTime() >= earliestStart,
  )
}

/** Cantidad de turnos confirmados por día (para marcarlos en el calendario). */
export function countBookedSlotsByDay(bookedSlots: PublicBookedSlot[]): BusyDays {
  return bookedSlots.reduce<BusyDays>((days, slot) => {
    const dateKey = getStudioDateKey(slot.appointment_date)
    days[dateKey] = (days[dateKey] ?? 0) + 1
    return days
  }, {})
}
