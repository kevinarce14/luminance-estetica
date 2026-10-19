import type { AppointmentStatus, AppointmentWithDetails } from './appointment.ts'

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

/** Datos de contacto del cliente (cruzados desde GET /users/). */
export interface ClientContact {
  email: string
  phone: string | null
}

/** Fila de la agenda del panel: turno + contacto del cliente si se pudo obtener. */
export interface AgendaRow {
  appointment: AppointmentWithDetails
  contact: ClientContact | null
}

/** Cambio aplicado a un turno durante la sesión (sin volver a pedir la agenda). */
export type AppointmentPatch = Partial<Pick<AppointmentWithDetails, 'status' | 'payment'>>

export type AgendaStatusFilter = AppointmentStatus | 'all'

export interface AgendaFilters {
  /** "YYYY-MM-DD" o '' para todas las fechas. */
  date: string
  status: AgendaStatusFilter
  search: string
}

/** Resultado de cargar la agenda combinando "hoy" + "próximos". */
export interface AdminAgenda {
  appointments: AppointmentWithDetails[]
  /** Alguna de las fuentes falló (ej. bug de validación de fechas pasadas en /today). */
  isPartial: boolean
}
