/** Bloque horario (schema TimeSlot). Las fechas llegan en hora local del studio, sin offset. */
export interface TimeSlot {
  start_time: string
  end_time: string
  is_available: boolean
}

/** Body de POST /availability/available-slots. */
export interface AvailableSlotsRequest {
  service_id: number
  /** Formato "YYYY-MM-DD". */
  date: string
}

/** Respuesta de POST /availability/available-slots. */
export interface AvailableSlotsResponse {
  date: string
  service_id: number
  service_name: string
  duration_minutes: number
  available_slots: TimeSlot[]
}
