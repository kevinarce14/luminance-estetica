import type { AdminAgenda, DashboardMetrics } from '../types/admin.ts'
import type { AppointmentWithDetails } from '../types/appointment.ts'
import type { User } from '../types/user.ts'
import { apiRequest } from './apiClient.ts'

/** Días hacia adelante que cubre la agenda del panel. */
export const AGENDA_DAYS_AHEAD = 60

/** GET /admin/dashboard */
export function getDashboardMetrics(): Promise<DashboardMetrics> {
  return apiRequest<DashboardMetrics>('/admin/dashboard')
}

/** GET /admin/appointments/today — pendientes y confirmados de hoy. */
export function getTodayAppointments(): Promise<AppointmentWithDetails[]> {
  return apiRequest<AppointmentWithDetails[]>('/admin/appointments/today')
}

/** GET /admin/appointments/upcoming — pendientes y confirmados futuros. */
export function getUpcomingAppointments(days: number): Promise<AppointmentWithDetails[]> {
  return apiRequest<AppointmentWithDetails[]>(`/admin/appointments/upcoming?days=${days}`)
}

/** GET /users/ — usuarios con email y teléfono (para el buscador por cliente). */
export function getUsers(limit = 500): Promise<User[]> {
  return apiRequest<User[]>(`/users/?limit=${limit}`)
}

/**
 * Agenda del panel. El backend legado no expone un listado completo de turnos,
 * así que se combinan "hoy" + "próximos" (solo pendientes/confirmados).
 * Cuando el backend nuevo (NestJS) tenga GET /admin/appointments, alcanza con cambiar esta función.
 */
export async function getAdminAgenda(): Promise<AdminAgenda> {
  const [today, upcoming] = await Promise.allSettled([
    getTodayAppointments(),
    getUpcomingAppointments(AGENDA_DAYS_AHEAD),
  ])

  if (today.status === 'rejected' && upcoming.status === 'rejected') {
    throw upcoming.reason
  }

  const byId = new Map<number, AppointmentWithDetails>()
  for (const result of [today, upcoming]) {
    if (result.status === 'fulfilled') {
      result.value.forEach((appointment) => byId.set(appointment.id, appointment))
    }
  }

  const appointments = [...byId.values()].sort(
    (a, b) => Date.parse(a.appointment_date) - Date.parse(b.appointment_date),
  )

  return {
    appointments,
    isPartial: today.status === 'rejected' || upcoming.status === 'rejected',
  }
}
