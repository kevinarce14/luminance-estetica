import { isApiError } from '../types/api.ts'

const INVALID_CREDENTIALS_MESSAGE = 'Email o contraseña incorrectos'
const REGISTER_FALLBACK_MESSAGE = 'Error al registrarse. Intentá de nuevo.'

export function getLoginErrorMessage(error: unknown): string {
  if (!isApiError(error)) {
    return INVALID_CREDENTIALS_MESSAGE
  }

  // 401 de una cuenta creada con Google: el backend explica cómo ingresar.
  if (error.status === 401 && error.message.includes('Google')) {
    return error.message
  }

  // 400/401: credenciales inválidas.
  if (error.status === 400 || error.status === 401) {
    return INVALID_CREDENTIALS_MESSAGE
  }

  return error.message
}

export function getGoogleLoginErrorMessage(error: unknown): string {
  return isApiError(error) && error.message
    ? error.message
    : 'Error al iniciar sesión con Google. Intentá de nuevo.'
}

export function getRegisterErrorMessage(error: unknown): string {
  if (!isApiError(error)) {
    return REGISTER_FALLBACK_MESSAGE
  }

  if (error.status === 422) {
    return `Datos inválidos: ${error.message}`
  }

  return error.message || REGISTER_FALLBACK_MESSAGE
}
