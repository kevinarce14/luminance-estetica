import type { BookingStepInfo } from '../types/booking.ts'

/** Reglas de negocio de reservas, alineadas con app/core/config.py del backend. */

export const STUDIO_TIME_ZONE = 'America/Argentina/Buenos_Aires'
/** Argentina no usa horario de verano: el offset es fijo. */
export const STUDIO_UTC_OFFSET = '-03:00'

/** Días sin atención (0 = domingo), igual que `hiddenDays: [0]` del calendario legado. */
export const NON_WORKING_WEEKDAYS: readonly number[] = [0]

/** MIN_BOOKING_ADVANCE_HOURS del backend. */
export const MIN_BOOKING_ADVANCE_HOURS = 2
/** MAX_BOOKING_ADVANCE_DAYS del backend. */
export const MAX_BOOKING_ADVANCE_DAYS = 30

/** Duración usada para el doble chequeo de solapamiento cuando falta el dato del servicio. */
export const DEFAULT_APPOINTMENT_DURATION_MINUTES = 60

export const BOOKING_STEPS: BookingStepInfo[] = [
  { step: 1, label: 'Fecha' },
  { step: 2, label: 'Servicio' },
  { step: 3, label: 'Horario' },
  { step: 4, label: 'Confirmar' },
]

export const WEEKDAY_LABELS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'] as const
