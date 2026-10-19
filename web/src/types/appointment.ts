import type { UserPublic } from './user.ts'
import type { Service } from './service.ts'

export const AppointmentStatus = {
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
} as const

export type AppointmentStatus =
  (typeof AppointmentStatus)[keyof typeof AppointmentStatus]

/** Turno / cita (schema AppointmentResponse). */
export interface Appointment {
  id: number
  user_id: number
  service_id: number
  appointment_date: string
  notes: string | null
  status: AppointmentStatus
  cancellation_reason: string | null
  created_at: string
  user?: UserPublic
  service?: Service
}

export interface AppointmentCreatePayload {
  service_id: number
  appointment_date: string
  notes?: string
}
