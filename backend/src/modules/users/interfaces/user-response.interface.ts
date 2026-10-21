import type { User } from '../../../generated/prisma/client';

/** Usuario tal como lo devuelve la API (schema UserResponse de FastAPI). Nunca incluye el hash. */
export interface UserResponse {
  id: number;
  email: string;
  full_name: string;
  phone: string | null;
  is_active: boolean;
  is_admin: boolean;
  created_at: string;
}

export function toUserResponse(user: User): UserResponse {
  return {
    id: user.id,
    email: user.email,
    full_name: user.fullName,
    phone: user.phone,
    is_active: user.isActive,
    is_admin: user.isAdmin,
    created_at: user.createdAt.toISOString(),
  };
}
