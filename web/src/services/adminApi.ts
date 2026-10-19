import type {
  AdminAppointmentsQuery,
  AdminPaymentsQuery,
  AgendaFilters,
  ClientSummary,
  DashboardMetrics,
  PaymentAdminView,
  YearlyReport,
} from '../types/admin.ts'
import type { AdminAppointment } from '../types/appointment.ts'
import type { User } from '../types/user.ts'
import { getStudioToday } from '../utils/studioTime.ts'
import { apiRequest } from './apiClient.ts'

/** Máximo de turnos que trae la agenda por consulta. */
export const AGENDA_LIMIT = 500

/** GET /admin/dashboard */
export function getDashboardMetrics(): Promise<DashboardMetrics> {
  return apiRequest<DashboardMetrics>('/admin/dashboard')
}

/** Traduce los filtros de la UI a los query params de GET /admin/appointments. */
export function buildAgendaQuery(filters: AgendaFilters): AdminAppointmentsQuery {
  const query: AdminAppointmentsQuery = {
    order: filters.scope === 'upcoming' ? 'asc' : 'desc',
    limit: AGENDA_LIMIT,
  }

  if (filters.date) {
    query.date = filters.date
  } else if (filters.scope === 'upcoming') {
    query.date_from = getStudioToday()
  }

  if (filters.status !== 'all') {
    query.status = filters.status
  }

  const search = filters.search.trim()
  if (search) {
    query.search = search
  }

  return query
}

/** GET /admin/appointments — agenda completa con filtros resueltos en el backend. */
export function getAdminAppointments(query: AdminAppointmentsQuery): Promise<AdminAppointment[]> {
  return apiRequest<AdminAppointment[]>(`/admin/appointments?${toQueryString(query)}`)
}

function toQueryString(query: object): string {
  const params = new URLSearchParams()
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== '') {
      params.set(key, String(value))
    }
  })
  return params.toString()
}

/** GET /admin/payments — pagos con cliente y turno. */
export function getAdminPayments(query: AdminPaymentsQuery): Promise<PaymentAdminView[]> {
  return apiRequest<PaymentAdminView[]>(`/admin/payments?${toQueryString(query)}`)
}

/** GET /admin/clients — clientes con métricas de su historial. */
export function getClients(search: string): Promise<ClientSummary[]> {
  return apiRequest<ClientSummary[]>(`/admin/clients?${toQueryString({ search: search.trim(), limit: 500 })}`)
}

/** Historial de turnos de un cliente (más reciente primero). */
export function getClientAppointments(userId: number): Promise<AdminAppointment[]> {
  return getAdminAppointments({ order: 'desc', limit: AGENDA_LIMIT, user_id: userId })
}

/** PUT /users/{id}/toggle-active — activar o desactivar la cuenta de un cliente. */
export function toggleUserActive(userId: number): Promise<User> {
  return apiRequest<User>(`/users/${userId}/toggle-active`, { method: 'PUT' })
}

/** GET /admin/reports/yearly */
export function getYearlyReport(year: number): Promise<YearlyReport> {
  return apiRequest<YearlyReport>(`/admin/reports/yearly?year=${year}`)
}
