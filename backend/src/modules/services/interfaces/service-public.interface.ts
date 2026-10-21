import type { Service } from '../../../generated/prisma/client';

/**
 * Servicio tal como lo expone el catálogo público.
 * Mantiene el contrato JSON (snake_case) del backend FastAPI que ya consume `web/`.
 */
export interface ServicePublic {
  id: number;
  name: string;
  description: string | null;
  duration_minutes: number;
  price: number;
  category: string;
  image_url: string | null;
}

export function toServicePublic(service: Service): ServicePublic {
  return {
    id: service.id,
    name: service.name,
    description: service.description,
    duration_minutes: service.durationMinutes,
    price: service.price,
    category: service.category,
    image_url: service.imageUrl,
  };
}

/** Servicio completo para el panel admin (schema ServiceResponse). */
export interface ServiceAdmin extends ServicePublic {
  is_active: boolean;
  created_at: string;
  updated_at: string | null;
}

export function toServiceAdmin(service: Service): ServiceAdmin {
  return {
    ...toServicePublic(service),
    is_active: service.isActive,
    created_at: service.createdAt.toISOString(),
    updated_at: service.updatedAt?.toISOString() ?? null,
  };
}
