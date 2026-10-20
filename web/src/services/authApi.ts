import type {
  AuthToken,
  GoogleAuthConfig,
  LoginCredentials,
  MessageResponse,
  PasswordResetConfirmPayload,
  RegisterPayload,
} from '../types/auth.ts'
import type { User } from '../types/user.ts'
import { apiRequest } from './apiClient.ts'

/** POST /auth/login — OAuth2PasswordRequestForm de FastAPI: form-urlencoded con `username`. */
export function requestLogin({
  email,
  password,
}: LoginCredentials): Promise<AuthToken> {
  const body = new URLSearchParams({ username: email, password })
  return apiRequest<AuthToken>('/auth/login', { method: 'POST', body })
}

/** POST /auth/register */
export function requestRegister(payload: RegisterPayload): Promise<User> {
  return apiRequest<User>('/auth/register', { method: 'POST', body: payload })
}

/** GET /users/me — con `token` explícito se usa antes de persistir la sesión. */
export function fetchCurrentUser(token?: string): Promise<User> {
  return apiRequest<User>('/users/me', { token })
}

/** GET /auth/google/config — si el login con Google está habilitado y su Client ID público. */
export function getGoogleAuthConfig(): Promise<GoogleAuthConfig> {
  return apiRequest<GoogleAuthConfig>('/auth/google/config')
}

/** POST /auth/google — intercambia el id_token de Google por un JWT propio (crea la cuenta si no existe). */
export function requestGoogleLogin(credential: string): Promise<AuthToken> {
  return apiRequest<AuthToken>('/auth/google', { method: 'POST', body: { credential } })
}

/** POST /auth/password-reset — envía el email con el código; responde igual exista o no la cuenta. */
export function requestPasswordReset(email: string): Promise<MessageResponse> {
  return apiRequest<MessageResponse>('/auth/password-reset', { method: 'POST', body: { email } })
}

/** POST /auth/password-reset/confirm — código de un solo uso (1 hora) + nueva contraseña. */
export function confirmPasswordReset(payload: PasswordResetConfirmPayload): Promise<MessageResponse> {
  return apiRequest<MessageResponse>('/auth/password-reset/confirm', { method: 'POST', body: payload })
}
