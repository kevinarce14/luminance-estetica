import type { Payment } from './payment.ts'
import type { ServicePublic } from './service.ts'
import type { UserPublic } from './user.ts'

export const AppointmentStatus = {
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
} as const

export type AppointmentStatus =
  (typeof AppointmentStatus)[keyof typeof AppointmentStatus]

/** Turno / cita (schema AppointmentResponse). `appointment_date` llega en UTC con offset. */
export interface Appointment {
  id: number
  user_id: number
  service_id: number
  appointment_date: string
  notes: string | null
  status: AppointmentStatus
  reminder_sent: boolean
  cancelled_at: string | null
  cancellation_reason: string | null
  created_at: string
  updated_at: string | null
}

/** Turno con usuario, servicio y pago (schema AppointmentWithDetails). */
export interface AppointmentWithDetails extends Appointment {
  user: UserPublic
  service: ServicePublic
  payment: Payment | null
}

export interface AppointmentCreatePayload {
  service_id: number
  /** ISO 8601 con offset, ej. "2026-10-20T10:00:00-03:00". */
  appointment_date: string
  notes?: string
}
