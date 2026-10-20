import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  fetchCurrentUser,
  requestGoogleLogin,
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
import { AuthContext, type AuthContextValue } from './authContextValue.ts'

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

  /** Con el JWT ya emitido: obtiene /users/me y persiste la sesión. */
  const startSession = useCallback(async (token: string) => {
    const user = await fetchCurrentUser(token)
    const newSession: AuthSession = { token, user }

    saveStoredSession(newSession)
    setSession(newSession)
    return user
  }, [])

  const login = useCallback(
    async (credentials: LoginCredentials) => {
      const { access_token: token } = await requestLogin(credentials)
      return startSession(token)
    },
    [startSession],
  )

  const loginWithGoogle = useCallback(
    async (credential: string) => {
      const { access_token: token } = await requestGoogleLogin(credential)
      return startSession(token)
    },
    [startSession],
  )

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
      loginWithGoogle,
      register,
      logout,
    }),
    [session, login, loginWithGoogle, register, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
