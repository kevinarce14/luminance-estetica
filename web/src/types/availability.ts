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

/** Franja de disponibilidad (schema AvailabilityResponse). day_of_week: 0=Domingo … 6=Sábado. */
export interface Availability {
  id: number
  day_of_week: number | null
  specific_date: string | null
  /** "HH:MM:SS" */
  start_time: string | null
  end_time: string | null
  is_available: boolean
  created_at: string
  updated_at: string | null
}

/** Body de POST /availability/regular. */
export interface RegularSchedulePayload {
  day_of_week: number
  start_time: string | null
  end_time: string | null
  is_available: boolean
}

/** Body de PUT /availability/regular/{id}. */
export interface RegularScheduleUpdate {
  start_time?: string | null
  end_time?: string | null
  is_available?: boolean
}

/** Body de POST /availability/exceptions (cerrado todo el día u horario especial). */
export interface AvailabilityExceptionPayload {
  specific_date: string
  start_time: string | null
  end_time: string | null
  is_available: boolean
}
