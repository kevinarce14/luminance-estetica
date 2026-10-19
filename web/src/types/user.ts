/** Usuario autenticado (schema UserResponse del backend legado). */
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

export interface UserUpdatePayload {
  full_name?: string
  phone?: string
}
