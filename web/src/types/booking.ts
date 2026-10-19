/** Pasos de la turnera (mismo orden que turnera.html). */
export type BookingStep = 1 | 2 | 3 | 4

export interface BookingStepInfo {
  step: BookingStep
  label: string
}

/** Estado de una carga asíncrona. */
export type LoadStatus = 'idle' | 'loading' | 'ready' | 'error'

/** Celda del calendario mensual. */
export interface CalendarDay {
  /** "YYYY-MM-DD" */
  date: string
  dayOfMonth: number
  isCurrentMonth: boolean
  isSelectable: boolean
  isToday: boolean
}

/** Cantidad de turnos confirmados por fecha ("YYYY-MM-DD" → cantidad). */
export type BusyDays = Record<string, number>

/** Resultado del alta de un turno por un admin (pago en efectivo automático). */
export interface AdminBookingResult {
  appointmentId: number
  serviceName: string
  date: string
  slotStart: string
  paymentConfirmed: boolean
}
