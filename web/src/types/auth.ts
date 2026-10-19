/** Respuesta de login/registro JWT (schema Token de FastAPI). */
export interface AuthToken {
  access_token: string
  token_type: string
}

export interface LoginCredentials {
  email: string
  password: string
}

export interface RegisterPayload {
  email: string
  full_name: string
  phone?: string
  password: string
}
