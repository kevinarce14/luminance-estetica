import type {
  Appointment,
  AppointmentCreatePayload,
  AppointmentWithDetails,
} from '../types/appointment.ts'
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

/** GET /appointments/{id} — solo el dueño o un admin. */
export function getAppointment(appointmentId: number): Promise<AppointmentWithDetails> {
  return apiRequest<AppointmentWithDetails>(`/appointments/${appointmentId}`)
}

/** GET /appointments/public/confirmed — turnos confirmados (público, para el calendario). */
export function getConfirmedAppointments(): Promise<AppointmentWithDetails[]> {
  return apiRequest<AppointmentWithDetails[]>('/appointments/public/confirmed')
}

/** POST /appointments/{id}/cancel */
export function cancelAppointment(
  appointmentId: number,
  cancellationReason: string,
): Promise<Appointment> {
  return apiRequest<Appointment>(`/appointments/${appointmentId}/cancel`, {
    method: 'POST',
    body: { cancellation_reason: cancellationReason },
  })
}
