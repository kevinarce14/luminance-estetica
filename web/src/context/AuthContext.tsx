import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  fetchCurrentUser,
  requestLogin,
  requestRegister,
} from '../services/authApi.ts'
import {
  AUTH_EXPIRED_EVENT,
  clearAuthStorage,
  readStoredSession,
  saveStoredSession,
  TOKEN_KEY,
  USER_KEY,
} from '../services/authStorage.ts'
import type {
  AuthSession,
  LoginCredentials,
  RegisterPayload,
} from '../types/auth.ts'
import type { User } from '../types/user.ts'

interface AuthContextValue {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  isAdmin: boolean
  /** Autentica, obtiene `/users/me` y persiste la sesión. Lanza `ApiError` si falla. */
  login: (credentials: LoginCredentials) => Promise<User>
  /** Crea la cuenta (no inicia sesión: RegisterPage hace el auto-login). Lanza `ApiError` si falla. */
  register: (payload: RegisterPayload) => Promise<User>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(() =>
    readStoredSession(),
  )

  useEffect(() => {
    // 401 desde cualquier petición: el cliente HTTP ya borró el storage.
    const handleExpired = () => setSession(null)

    // Login/logout hecho en otra pestaña.
    const handleStorage = (event: StorageEvent) => {
      if (event.key === null || event.key === TOKEN_KEY || event.key === USER_KEY) {
        setSession(readStoredSession())
      }
    }

    window.addEventListener(AUTH_EXPIRED_EVENT, handleExpired)
    window.addEventListener('storage', handleStorage)
    return () => {
      window.removeEventListener(AUTH_EXPIRED_EVENT, handleExpired)
      window.removeEventListener('storage', handleStorage)
    }
  }, [])

  const login = useCallback(async (credentials: LoginCredentials) => {
    const { access_token: token } = await requestLogin(credentials)
    const user = await fetchCurrentUser(token)
    const newSession: AuthSession = { token, user }

    saveStoredSession(newSession)
    setSession(newSession)
    return user
  }, [])

  const register = useCallback(
    (payload: RegisterPayload) => requestRegister(payload),
    [],
  )

  const logout = useCallback(() => {
    clearAuthStorage()
    setSession(null)
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      user: session?.user ?? null,
      token: session?.token ?? null,
      isAuthenticated: session !== null,
      isAdmin: session?.user.is_admin === true,
      login,
      register,
      logout,
    }),
    [session, login, register, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth debe usarse dentro de AuthProvider')
  }
  return context
}
