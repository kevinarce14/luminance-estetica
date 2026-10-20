import type { Service, ServiceAdmin, ServicePayload } from '../types/service.ts'
import { apiRequest } from './apiClient.ts'

/** Catálogo público: solo servicios activos (equivale a `getServices()` del legado). */
export function getActiveServices(): Promise<Service[]> {
  return apiRequest<Service[]>('/services/?is_active=true')
}

// ========== ADMIN ==========

/** GET /services/admin/all — todos los servicios, activos e inactivos. */
export function getAllServicesAdmin(): Promise<ServiceAdmin[]> {
  return apiRequest<ServiceAdmin[]>('/services/admin/all')
}

export function createService(payload: ServicePayload): Promise<ServiceAdmin> {
  return apiRequest<ServiceAdmin>('/services/', { method: 'POST', body: payload })
}

export function updateService(serviceId: number, payload: ServicePayload): Promise<ServiceAdmin> {
  return apiRequest<ServiceAdmin>(`/services/${serviceId}`, { method: 'PUT', body: payload })
}

/** PUT /services/{id}/toggle-active */
export function toggleServiceActive(serviceId: number): Promise<ServiceAdmin> {
  return apiRequest<ServiceAdmin>(`/services/${serviceId}/toggle-active`, { method: 'PUT' })
}

/** DELETE /services/{id} — el backend lo impide si el servicio tiene turnos (conviene desactivarlo). */
export function deleteService(serviceId: number): Promise<null> {
  return apiRequest<null>(`/services/${serviceId}`, { method: 'DELETE' })
}
