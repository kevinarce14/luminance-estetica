import type { Service } from '../types/service.ts'
import { apiRequest } from './apiClient.ts'

/** Catálogo público: solo servicios activos (equivale a `getServices()` del legado). */
export function getActiveServices(): Promise<Service[]> {
  return apiRequest<Service[]>('/services/?is_active=true')
}
