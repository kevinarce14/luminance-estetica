import { API_BASE_URL } from '../config/api.ts'
import type { ApiError, ValidationErrorItem } from '../types/api.ts'
import {
  AUTH_EXPIRED_EVENT,
  clearAuthStorage,
  readStoredToken,
} from './authStorage.ts'

const API_PREFIX = '/api'
const DEFAULT_ERROR_MESSAGE = 'Error en la petición'
const NETWORK_ERROR_MESSAGE =
  'No se pudo conectar con el servidor. Revisá tu conexión e intentá de nuevo.'

export function getApiUrl(endpoint: string): string {
  return `${API_BASE_URL}${API_PREFIX}${endpoint}`
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  /** Objeto (se envía como JSON) o URLSearchParams (se envía como form-urlencoded). */
  body?: unknown
  headers?: Record<string, string>
  /** Token explícito, por ej. justo después del login y antes de persistir la sesión. */
  token?: string
}

function isValidationErrorItem(item: unknown): item is ValidationErrorItem {
  return (
    typeof item === 'object' &&
    item !== null &&
    'msg' in item &&
    typeof item.msg === 'string'
  )
}

/** Extrae un mensaje legible de las respuestas de error de FastAPI (y de NestJS a futuro). */
function extractErrorMessage(data: unknown): string {
  if (typeof data !== 'object' || data === null) {
    return DEFAULT_ERROR_MESSAGE
  }

  const { detail, message } = data as { detail?: unknown; message?: unknown }

  if (typeof detail === 'string') {
    return detail
  }

  if (Array.isArray(detail)) {
    const messages = detail.filter(isValidationErrorItem).map((item) => item.msg)
    if (messages.length > 0) {
      return messages.join('. ')
    }
  }

  if (typeof message === 'string') {
    return message
  }

  if (Array.isArray(message)) {
    return message.join(', ')
  }

  return DEFAULT_ERROR_MESSAGE
}

function isAuthEndpoint(endpoint: string): boolean {
  return ['/auth/login', '/auth/register', '/auth/google', '/auth/password-reset'].some((path) =>
    endpoint.includes(path),
  )
}

/**
 * Cliente HTTP base. Los módulos por dominio (auth, turnos, pagos)
 * se construyen encima de esta función.
 */
export async function apiRequest<T>(
  endpoint: string,
  options: RequestOptions = {},
): Promise<T> {
  const token = options.token ?? readStoredToken()
  const isFormBody = options.body instanceof URLSearchParams
  const headers: Record<string, string> = {
    'Content-Type': isFormBody
      ? 'application/x-www-form-urlencoded'
      : 'application/json',
    ...options.headers,
  }

  if (token && !isAuthEndpoint(endpoint)) {
    headers.Authorization = `Bearer ${token}`
  }

  let body: string | undefined
  if (options.body instanceof URLSearchParams) {
    body = options.body.toString()
  } else if (options.body !== undefined) {
    body = JSON.stringify(options.body)
  }

  let response: Response
  try {
    response = await fetch(getApiUrl(endpoint), {
      method: options.method ?? 'GET',
      headers,
      body,
    })
  } catch (networkError) {
    const error: ApiError = {
      status: 0,
      message: NETWORK_ERROR_MESSAGE,
      data: networkError,
    }
    throw error
  }

  const text = await response.text()
  let data: unknown = null

  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = null
  }

  if (!response.ok) {
    // Sesión vencida o token inválido: igual que el legado, se borra la sesión.
    if (response.status === 401 && !isAuthEndpoint(endpoint) && !options.token) {
      clearAuthStorage()
      window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT))
    }

    const error: ApiError = {
      status: response.status,
      message: extractErrorMessage(data),
      data,
    }
    throw error
  }

  return data as T
}
