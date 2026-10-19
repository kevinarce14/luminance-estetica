import type { ApiError } from '../types/api.ts'
import { readStoredToken } from './authStorage.ts'

const API_PREFIX = '/api'

function getBaseUrl(): string {
  return import.meta.env.VITE_API_BASE_URL ?? ''
}

export function getApiUrl(endpoint: string): string {
  return `${getBaseUrl()}${API_PREFIX}${endpoint}`
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: unknown
  headers?: Record<string, string>
}

/**
 * Cliente HTTP base. Los módulos por dominio (auth, turnos, pagos)
 * se irán agregando en features siguientes.
 */
export async function apiRequest<T>(
  endpoint: string,
  options: RequestOptions = {},
): Promise<T> {
  const token = readStoredToken()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...options.headers,
  }

  const isAuthEndpoint =
    endpoint.includes('/auth/login') || endpoint.includes('/auth/register')

  if (token && !isAuthEndpoint) {
    headers.Authorization = `Bearer ${token}`
  }

  const response = await fetch(getApiUrl(endpoint), {
    method: options.method ?? 'GET',
    headers,
    body:
      options.body !== undefined ? JSON.stringify(options.body) : undefined,
  })

  const text = await response.text()
  let data: unknown = null

  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = null
  }

  if (!response.ok) {
    const payload = data as { detail?: string; message?: string } | null
    const error: ApiError = {
      status: response.status,
      message: payload?.detail ?? payload?.message ?? 'Error en la petición',
      data,
    }
    throw error
  }

  return data as T
}
