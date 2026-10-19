import type {
  Appointment,
  AppointmentCreatePayload,
  AppointmentStatus,
  AppointmentStatusUpdatePayload,
  AppointmentWithDetails,
  PublicBookedSlot,
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

/** GET /appointments/ — turnos del usuario autenticado (incluye completados y cancelados). */
export function getMyAppointments(): Promise<AppointmentWithDetails[]> {
  return apiRequest<AppointmentWithDetails[]>('/appointments/')
}

/** GET /appointments/{id} — solo el dueño o un admin. */
export function getAppointment(appointmentId: number): Promise<AppointmentWithDetails> {
  return apiRequest<AppointmentWithDetails>(`/appointments/${appointmentId}`)
}

/** GET /appointments/public/confirmed — horarios ocupados desde hoy (público, sin datos de clientes). */
export function getBookedSlots(): Promise<PublicBookedSlot[]> {
  return apiRequest<PublicBookedSlot[]>('/appointments/public/confirmed')
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

/** PUT /appointments/{id} — solo admin puede cambiar el estado (transiciones validadas en el backend). */
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
