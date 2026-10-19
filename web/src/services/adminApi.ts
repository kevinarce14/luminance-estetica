import type { AdminAppointmentsQuery, AgendaFilters, DashboardMetrics } from '../types/admin.ts'
import type { AdminAppointment } from '../types/appointment.ts'
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
  const params = new URLSearchParams()
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined) {
      params.set(key, String(value))
    }
  })
  return apiRequest<AdminAppointment[]>(`/admin/appointments?${params.toString()}`)
}
