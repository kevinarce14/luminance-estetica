import type {
  AvailableSlotsRequest,
  AvailableSlotsResponse,
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
