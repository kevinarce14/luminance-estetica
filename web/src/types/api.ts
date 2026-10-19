/** Error normalizado de peticiones al backend. `status: 0` = sin conexión. */
export interface ApiError {
  status: number
  message: string
  data: unknown
}

/** Ítem de error de validación de FastAPI/Pydantic (respuestas 422). */
export interface ValidationErrorItem {
  msg: string
  loc?: (string | number)[]
}

export function isApiError(error: unknown): error is ApiError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'status' in error &&
    'message' in error
  )
}
