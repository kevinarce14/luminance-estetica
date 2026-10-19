import type { User } from './user.ts'

/** Respuesta de login/registro JWT (schema Token de FastAPI). */
export interface AuthToken {
  access_token: string
  token_type: string
}

export interface LoginCredentials {
  email: string
  password: string
}

export interface RegisterPayload {
  email: string
  full_name: string
  phone?: string
  password: string
}

/** Sesión activa: el token y el usuario siempre se guardan juntos. */
export interface AuthSession {
  token: string
  user: User
}

/** Valores del formulario de registro (todos string por ser inputs controlados). */
export interface RegisterFormValues {
  full_name: string
  email: string
  phone: string
  password: string
}

/** Errores de validación por campo de un formulario. */
export type FieldErrors<T> = Partial<Record<keyof T, string>>
