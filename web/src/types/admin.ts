import type { AppointmentStatus } from './appointment.ts'
import type { Payment, PaymentMethod, PaymentStatus } from './payment.ts'
import type { ServicePublic } from './service.ts'
import type { UserContact } from './user.ts'

/** Respuesta de GET /admin/dashboard. */
export interface DashboardMetrics {
  clients: {
    total: number
    new_this_month: number
  }
  appointments: {
    today: number
    this_week: number
    this_month: number
    pending_confirmation: number
  }
  revenue: {
    /** Pagos aprobados en el mes. */
    this_month: number
    /** Turnos pendientes/confirmados todavía sin pago. */
    pending: number
    currency: string
  }
  popular_services: {
    name: string
    count: number
  }[]
}

/** Alcance temporal de la agenda: desde hoy en adelante o el historial completo. */
export type AgendaScope = 'upcoming' | 'all'

export type AgendaStatusFilter = AppointmentStatus | 'all'

export interface AgendaFilters {
  scope: AgendaScope
  /** "YYYY-MM-DD" o '' para no filtrar por un día puntual. */
  date: string
  status: AgendaStatusFilter
  search: string
}

/** Query params de GET /admin/appointments. */
export interface AdminAppointmentsQuery {
  date?: string
  date_from?: string
  status?: AppointmentStatus
  search?: string
  user_id?: number
  order: 'asc' | 'desc'
  limit: number
}

/** Pago con cliente y turno (schema PaymentAdminView de GET /admin/payments). */
export interface PaymentAdminView extends Payment {
  user: UserContact
  appointment: {
    id: number
    appointment_date: string
    status: AppointmentStatus
    service: ServicePublic
  }
}

export type PaymentStatusFilter = PaymentStatus | 'all'
export type PaymentMethodFilter = PaymentMethod | 'all'

/** Query params de GET /admin/payments. */
export interface AdminPaymentsQuery {
  status?: PaymentStatus
  method?: PaymentMethod
  search?: string
  limit: number
}

/** Métodos que el admin puede registrar manualmente. */
export type ManualPaymentMethod = typeof PaymentMethod.CASH | typeof PaymentMethod.TRANSFER

/** Body de POST /payments/cash-payment (pago manual). */
export interface ManualPaymentPayload {
  appointment_id: number
  payment_method: ManualPaymentMethod
  reference?: string
  notes?: string
}

/** Body de PUT /payments/{id}/status. */
export interface PaymentStatusUpdatePayload {
  status: PaymentStatus
  notes?: string
}

/** Cliente con métricas (schema ClientSummary de GET /admin/clients). */
export interface ClientSummary extends UserContact {
  is_active: boolean
  created_at: string
  appointments_count: number
  completed_count: number
  cancelled_count: number
  last_appointment_date: string | null
  total_paid: number
}

export interface MonthSummary {
  month: number
  revenue: number
  payments_count: number
  appointments_count: number
  completed_count: number
  cancelled_count: number
}

export interface ServiceRanking {
  name: string
  appointments_count: number
  revenue: number
}

export interface PaymentMethodSummary {
  method: PaymentMethod
  count: number
  amount: number
}

/** Respuesta de GET /admin/reports/yearly. */
export interface YearlyReport {
  year: number
  currency: string
  total_revenue: number
  total_payments: number
  average_ticket: number
  total_appointments: number
  appointments_by_status: Partial<Record<AppointmentStatus, number>>
  new_clients: number
  months: MonthSummary[]
  top_services: ServiceRanking[]
  payment_methods: PaymentMethodSummary[]
}
