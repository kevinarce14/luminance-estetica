import { createContext } from 'react'
import type { LoginCredentials, RegisterPayload } from '../types/auth.ts'
import type { User } from '../types/user.ts'

export interface AuthContextValue {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  isAdmin: boolean
  /** Autentica, obtiene `/users/me` y persiste la sesión. Lanza `ApiError` si falla. */
  login: (credentials: LoginCredentials) => Promise<User>
  /** Login/registro con el id_token de Google Identity Services. Lanza `ApiError` si falla. */
  loginWithGoogle: (credential: string) => Promise<User>
  /** Crea la cuenta (no inicia sesión: RegisterPage hace el auto-login). Lanza `ApiError` si falla. */
  register: (payload: RegisterPayload) => Promise<User>
  logout: () => void
}

/** Objeto de contexto (separado de AuthProvider para que Fast Refresh funcione). */
export const AuthContext = createContext<AuthContextValue | null>(null)
