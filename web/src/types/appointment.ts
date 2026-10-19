import type { Payment, PaymentMethod, PaymentStatus } from './payment.ts'
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

/** Servicio dentro del historial (schema ServiceInHistory). */
export interface ServiceInHistory {
  id: number
  name: string
  description: string | null
  duration_minutes: number
  price: number
  category: string
  is_active: boolean
}

/** Pago resumido dentro del historial (schema PaymentInHistory). */
export interface PaymentInHistory {
  id: number
  amount: number
  payment_method: PaymentMethod | null
  status: PaymentStatus | null
}

/**
 * Turno del historial del cliente (GET /appointments/, schema AppointmentHistory).
 * El backend lo envía en UTC *sin* offset; `appointmentsApi` lo normaliza a ISO con "Z".
 */
export interface AppointmentHistoryItem {
  id: number
  user_id: number
  service_id: number
  appointment_date: string
  status: AppointmentStatus
  notes: string | null
  reminder_sent: boolean
  cancelled_at: string | null
  cancellation_reason: string | null
  created_at: string | null
  service: ServiceInHistory | null
  payment: PaymentInHistory | null
}

/** Body de PUT /appointments/{id} para que un admin cambie el estado. */
export interface AppointmentStatusUpdatePayload {
  status: AppointmentStatus
}

/** Estados que un admin puede asignar desde el panel. */
export type AdminStatusAction =
  | typeof AppointmentStatus.CONFIRMED
  | typeof AppointmentStatus.COMPLETED
  | typeof AppointmentStatus.CANCELLED

export interface AppointmentCreatePayload {
  service_id: number
  /** ISO 8601 con offset, ej. "2026-10-20T10:00:00-03:00". */
  appointment_date: string
  notes?: string
}
