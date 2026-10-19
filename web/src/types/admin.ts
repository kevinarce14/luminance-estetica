import type { AppointmentStatus } from './appointment.ts'

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
  order: 'asc' | 'desc'
  limit: number
}
