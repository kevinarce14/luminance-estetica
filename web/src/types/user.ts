/** Usuario autenticado (schema UserResponse del backend). */
export interface User {
  id: number
  email: string
  full_name: string
  phone: string | null
  is_active: boolean
  is_admin: boolean
  created_at: string
}

export interface UserPublic {
  id: number
  full_name: string
}

/** Usuario con datos de contacto (schema UserContact, solo respuestas de admin). */
export interface UserContact extends UserPublic {
  email: string
  phone: string | null
}

export interface UserUpdatePayload {
  full_name?: string
  phone?: string
}
