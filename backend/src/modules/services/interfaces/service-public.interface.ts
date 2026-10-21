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
