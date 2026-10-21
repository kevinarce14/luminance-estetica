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
