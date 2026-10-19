import type { AuthSession } from '../types/auth.ts'
import type { User } from '../types/user.ts'

export const TOKEN_KEY = 'auth_token'
export const USER_KEY = 'user_data'

/** Evento global que emite el cliente HTTP cuando el backend responde 401 (sesión vencida). */
export const AUTH_EXPIRED_EVENT = 'luminance:auth-expired'

export function readStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function readStoredUser(): User | null {
  const raw = localStorage.getItem(USER_KEY)
  if (!raw) {
    return null
  }

  try {
    return JSON.parse(raw) as User
  } catch {
    return null
  }
}

/** Sesión guardada; si falta el token o el usuario se considera que no hay sesión. */
export function readStoredSession(): AuthSession | null {
  const token = readStoredToken()
  const user = readStoredUser()
  return token && user ? { token, user } : null
}

export function saveStoredSession({ token, user }: AuthSession): void {
  localStorage.setItem(TOKEN_KEY, token)
  localStorage.setItem(USER_KEY, JSON.stringify(user))
}

export function clearAuthStorage(): void {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
}
