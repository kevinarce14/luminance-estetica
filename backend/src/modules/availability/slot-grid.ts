import {
  minutesOfDay,
  timeFromMinutes,
  zonedTimeToUtc,
} from '../../common/time/zoned-time';
import type { TimeSlot } from './interfaces/availability.interfaces';

/** Intervalo ocupado por un turno confirmado, en UTC. */
export interface BusyInterval {
  start: Date;
  end: Date;
}

export interface SlotGridInput {
  /** Fecha de calendario del studio, "YYYY-MM-DD". */
  date: string;
  /** Horario de atención del día en hora del studio, "HH:MM:SS". */
  opening: string;
  closing: string;
  durationMinutes: number;
  /** Separación entre inicios de bloque (MIN_APPOINTMENT_DURATION). */
  stepMinutes: number;
  timeZone: string;
  busy: BusyInterval[];
  /** Ningún bloque que empiece antes (ahora + anticipación mínima) es reservable. */
  earliestStart: Date;
  /** Ningún bloque que empiece después (ahora + máximo de días) es reservable. */
  latestStart: Date;
  /** false si el servicio no admite reservas (inactivo): todos los bloques quedan no disponibles. */
  bookable: boolean;
}

/** Dos intervalos [inicio, fin) se solapan si cada uno empieza antes de que termine el otro. */
export function overlaps(a: BusyInterval, b: BusyInterval): boolean {
  return a.start < b.end && a.end > b.start;
}

/**
 * Grilla de bloques del día: uno cada `stepMinutes` desde la apertura, mientras el
 * servicio termine antes del cierre. Los bloques no reservables se devuelven igual,
 * marcados `is_available: false` (el frontend interpreta una lista vacía como día cerrado).
 * Las horas se expresan en hora local del studio, sin offset (contrato del legado).
 */
export function buildSlotGrid(input: SlotGridInput): TimeSlot[] {
  const slots: TimeSlot[] = [];
  const closing = minutesOfDay(input.closing);
  const durationMs = input.durationMinutes * 60_000;

  for (
    let minute = minutesOfDay(input.opening);
    minute + input.durationMinutes <= closing;
    minute += input.stepMinutes
  ) {
    const startLocal = timeFromMinutes(minute);
    const start = zonedTimeToUtc(input.date, startLocal, input.timeZone);
    const interval = { start, end: new Date(start.getTime() + durationMs) };

    const isAvailable =
      input.bookable &&
      start >= input.earliestStart &&
      start <= input.latestStart &&
      !input.busy.some((busy) => overlaps(busy, interval));

    slots.push({
      start_time: `${input.date}T${startLocal}`,
      end_time: `${input.date}T${timeFromMinutes(minute + input.durationMinutes)}`,
      is_available: isAvailable,
    });
  }
  return slots;
}
