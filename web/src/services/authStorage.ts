import type { User } from '../types/user.ts'

const TOKEN_KEY = 'auth_token'
const USER_KEY = 'user_data'

export function readStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function saveStoredToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token)
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

export function saveStoredUser(user: User): void {
  localStorage.setItem(USER_KEY, JSON.stringify(user))
}

export function clearAuthStorage(): void {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
}
