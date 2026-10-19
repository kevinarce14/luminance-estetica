import type {
  Appointment,
  AppointmentCreatePayload,
  AppointmentHistoryItem,
  AppointmentStatus,
  AppointmentStatusUpdatePayload,
  AppointmentWithDetails,
} from '../types/appointment.ts'
import { toUtcIsoDateTime } from '../utils/studioTime.ts'
import { apiRequest } from './apiClient.ts'

/** POST /appointments/ — crea el turno en estado "pending". */
export function createAppointment(
  payload: AppointmentCreatePayload,
): Promise<Appointment> {
  return apiRequest<Appointment>('/appointments/', {
    method: 'POST',
    body: { notes: '', ...payload },
  })
}

/** GET /appointments/ — turnos del usuario autenticado (incluye completados y cancelados). */
export async function getMyAppointments(): Promise<AppointmentHistoryItem[]> {
  const appointments = await apiRequest<AppointmentHistoryItem[]>('/appointments/')
  // AppointmentHistory serializa la fecha UTC sin offset.
  return appointments.map((appointment) => ({
    ...appointment,
    appointment_date: toUtcIsoDateTime(appointment.appointment_date),
  }))
}

/** GET /appointments/{id} — solo el dueño o un admin. */
export function getAppointment(appointmentId: number): Promise<AppointmentWithDetails> {
  return apiRequest<AppointmentWithDetails>(`/appointments/${appointmentId}`)
}

/** GET /appointments/public/confirmed — turnos confirmados (público, para el calendario). */
export function getConfirmedAppointments(): Promise<AppointmentWithDetails[]> {
  return apiRequest<AppointmentWithDetails[]>('/appointments/public/confirmed')
}

/** POST /appointments/{id}/cancel — el backend exige un motivo de 5 a 500 caracteres. */
export function cancelAppointment(
  appointmentId: number,
  cancellationReason: string,
): Promise<Appointment> {
  return apiRequest<Appointment>(`/appointments/${appointmentId}/cancel`, {
    method: 'POST',
    body: { cancellation_reason: cancellationReason },
  })
}

/** PUT /appointments/{id} — solo admin puede cambiar el estado. */
export function updateAppointmentStatus(
  appointmentId: number,
  status: AppointmentStatus,
): Promise<Appointment> {
  const payload: AppointmentStatusUpdatePayload = { status }
  return apiRequest<Appointment>(`/appointments/${appointmentId}`, {
    method: 'PUT',
    body: payload,
  })
}
