export const ServiceCategory = {
  PESTANAS: 'pestañas',
  CEJAS: 'cejas',
  LASER: 'laser',
  FACIAL: 'facial',
  CORPORAL: 'corporal',
  PIES: 'pies',
  OTROS: 'otros',
} as const

export type ServiceCategory = (typeof ServiceCategory)[keyof typeof ServiceCategory]

/** Servicio del catálogo (schema ServiceResponse). */
export interface Service {
  id: number
  name: string
  description: string | null
  duration_minutes: number
  price: number
  category: ServiceCategory
  image_url: string | null
  is_active: boolean
  created_at: string
}

/** Servicio embebido en un turno (schema ServicePublic). */
export type ServicePublic = Pick<
  Service,
  'id' | 'name' | 'description' | 'duration_minutes' | 'price' | 'category' | 'image_url'
>

/** Servicio completo para el panel admin (schema ServiceResponse). */
export interface ServiceAdmin extends Service {
  updated_at: string | null
}

/** Body de POST /services/ y PUT /services/{id}. */
export interface ServicePayload {
  name: string
  description: string | null
  duration_minutes: number
  price: number
  category: ServiceCategory
  image_url: string | null
}

/** Valores del formulario de servicio (inputs controlados). */
export interface ServiceFormValues {
  name: string
  description: string
  duration_minutes: string
  price: string
  category: ServiceCategory
  image_url: string
}
