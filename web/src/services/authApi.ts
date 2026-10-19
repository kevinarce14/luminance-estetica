import type {
  AuthToken,
  LoginCredentials,
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
