import type {
  Availability,
  AvailabilityExceptionPayload,
  AvailableSlotsRequest,
  AvailableSlotsResponse,
  RegularSchedulePayload,
  RegularScheduleUpdate,
} from '../types/availability.ts'
import { apiRequest } from './apiClient.ts'

/** POST /availability/available-slots (público). */
export function getAvailableSlots(
  request: AvailableSlotsRequest,
): Promise<AvailableSlotsResponse> {
  return apiRequest<AvailableSlotsResponse>('/availability/available-slots', {
    method: 'POST',
    body: request,
  })
}

// ========== ADMIN ==========

/** GET /availability/regular — horarios semanales (0=Domingo … 6=Sábado). */
export function getRegularSchedules(): Promise<Availability[]> {
  return apiRequest<Availability[]>('/availability/regular')
}

export function createRegularSchedule(payload: RegularSchedulePayload): Promise<Availability> {
  return apiRequest<Availability>('/availability/regular', { method: 'POST', body: payload })
}

export function updateRegularSchedule(
  scheduleId: number,
  payload: RegularScheduleUpdate,
): Promise<Availability> {
  return apiRequest<Availability>(`/availability/regular/${scheduleId}`, {
    method: 'PUT',
    body: payload,
  })
}

/** GET /availability/exceptions — fechas bloqueadas u horarios especiales desde hoy. */
export function getAvailabilityExceptions(): Promise<Availability[]> {
  return apiRequest<Availability[]>('/availability/exceptions?future_only=true')
}

export function createAvailabilityException(
  payload: AvailabilityExceptionPayload,
): Promise<Availability> {
  return apiRequest<Availability>('/availability/exceptions', { method: 'POST', body: payload })
}

export function deleteAvailabilityException(exceptionId: number): Promise<null> {
  return apiRequest<null>(`/availability/exceptions/${exceptionId}`, { method: 'DELETE' })
}
