import type { Availability } from '../../../generated/prisma/client';
import {
  dateColumnToString,
  timeColumnToString,
} from '../../../common/time/zoned-time';

/** Bloque de la grilla. Horas locales del studio, sin offset ("2026-10-22T09:00:00"). */
export interface TimeSlot {
  start_time: string;
  end_time: string;
  is_available: boolean;
}

/** Respuesta de POST /api/availability/available-slots. */
export interface AvailableSlotsResponse {
  date: string;
  service_id: number;
  service_name: string;
  duration_minutes: number;
  available_slots: TimeSlot[];
}

/** Franja de disponibilidad (schema AvailabilityResponse). day_of_week: 0=Domingo … 6=Sábado. */
export interface AvailabilityResponse {
  id: number;
  day_of_week: number | null;
  specific_date: string | null;
  start_time: string | null;
  end_time: string | null;
  is_available: boolean;
  created_at: string;
  updated_at: string | null;
}

/** Respuesta de GET /api/availability/check/:date. */
export interface DateAvailabilityCheck {
  date: string;
  day_of_week: number;
  is_available: boolean;
  start_time: string | null;
  end_time: string | null;
  is_exception: boolean;
}

/** Horario de atención efectivo de un día (excepción o franja semanal). */
export interface DaySchedule {
  opening: string;
  closing: string;
}

export function toAvailabilityResponse(
  availability: Availability,
): AvailabilityResponse {
  return {
    id: availability.id,
    day_of_week: availability.dayOfWeek,
    specific_date: availability.specificDate
      ? dateColumnToString(availability.specificDate)
      : null,
    start_time: availability.startTime
      ? timeColumnToString(availability.startTime)
      : null,
    end_time: availability.endTime
      ? timeColumnToString(availability.endTime)
      : null,
    is_available: availability.isAvailable,
    created_at: availability.createdAt.toISOString(),
    updated_at: availability.updatedAt?.toISOString() ?? null,
  };
}
