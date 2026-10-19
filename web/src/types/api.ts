/** Error normalizado de peticiones al backend. */
export interface ApiError {
  status: number
  message: string
  data: unknown
}

export function isApiError(error: unknown): error is ApiError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'status' in error &&
    'message' in error
  )
}
