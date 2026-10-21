/**
 * Conversión entre instantes UTC y "hora de pared" de una zona horaria IANA, sin
 * dependencias (Intl). Convención del sistema (igual que el legado):
 * - La base guarda los turnos en UTC sin zona.
 * - Los horarios de atención y la grilla de turnos están en la hora del studio.
 * - Fechas de calendario: "YYYY-MM-DD"; horas: "HH:MM:SS".
 */

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timeZone: string): Intl.DateTimeFormat {
  let formatter = formatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    formatters.set(timeZone, formatter);
  }
  return formatter;
}

export interface ZonedParts {
  /** "YYYY-MM-DD" */
  date: string;
  /** "HH:MM:SS" */
  time: string;
}

/** Fecha y hora de pared en `timeZone` para un instante. */
export function toZonedParts(instant: Date, timeZone: string): ZonedParts {
  const parts: Record<string, string> = {};
  for (const part of formatterFor(timeZone).formatToParts(instant)) {
    parts[part.type] = part.value;
  }
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${parts.hour}:${parts.minute}:${parts.second}`,
  };
}

/** Desfasaje de la zona respecto de UTC en ese instante, en ms (Buenos Aires: -3 h). */
function offsetMs(instant: Date, timeZone: string): number {
  const { date, time } = toZonedParts(instant, timeZone);
  const wallAsUtc = Date.parse(`${date}T${time}Z`);
  return wallAsUtc - Math.floor(instant.getTime() / 1000) * 1000;
}

/** Instante UTC de una hora de pared en `timeZone` ("2026-10-22" + "09:00" → 12:00Z en Buenos Aires). */
export function zonedTimeToUtc(
  date: string,
  time: string,
  timeZone: string,
): Date {
  const wallAsUtc = Date.parse(`${date}T${normalizeTime(time)}Z`);
  // Dos pasadas: corrige el desfasaje si la zona cambia de horario cerca de esa hora.
  let utc = wallAsUtc - offsetMs(new Date(wallAsUtc), timeZone);
  utc = wallAsUtc - offsetMs(new Date(utc), timeZone);
  return new Date(utc);
}

/** Fecha de hoy en `timeZone`. */
export function zonedToday(timeZone: string, now: Date = new Date()): string {
  return toZonedParts(now, timeZone).date;
}

/** [inicio, fin) de un día de calendario de `timeZone`, como instantes UTC. */
export function zonedDayRange(
  date: string,
  timeZone: string,
): { start: Date; end: Date } {
  return {
    start: zonedTimeToUtc(date, '00:00:00', timeZone),
    end: zonedTimeToUtc(addDays(date, 1), '00:00:00', timeZone),
  };
}

/** Día de la semana de una fecha de calendario: 0=Domingo … 6=Sábado (convención del sistema). */
export function weekdayOf(date: string): number {
  return new Date(`${date}T00:00:00Z`).getUTCDay();
}

export function addDays(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

/** "HH:MM" → "HH:MM:SS". */
export function normalizeTime(time: string): string {
  return time.length === 5 ? `${time}:00` : time;
}

/** Minutos desde medianoche de una hora "HH:MM[:SS]". */
export function minutesOfDay(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

/** Hora "HH:MM:SS" a partir de minutos desde medianoche. */
export function timeFromMinutes(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`;
}

// ===== Columnas de Prisma =====
// @db.Date y @db.Time llegan como Date en UTC (1970-01-01 para las horas).

/** Columna @db.Date → "YYYY-MM-DD". */
export function dateColumnToString(value: Date): string {
  return value.toISOString().slice(0, 10);
}

/** "YYYY-MM-DD" → valor para una columna @db.Date. */
export function dateStringToColumn(date: string): Date {
  return new Date(`${date}T00:00:00Z`);
}

/** Columna @db.Time → "HH:MM:SS". */
export function timeColumnToString(value: Date): string {
  return value.toISOString().slice(11, 19);
}

/** "HH:MM[:SS]" → valor para una columna @db.Time. */
export function timeStringToColumn(time: string): Date {
  return new Date(`1970-01-01T${normalizeTime(time)}Z`);
}

/**
 * Fecha y hora legibles para los emails, en la zona del studio
 * (ej. "miércoles 22 de octubre de 2026, 10:00 hs").
 */
export function formatForHumans(instant: Date, timeZone: string): string {
  const day = new Intl.DateTimeFormat('es-AR', {
    timeZone,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(instant);
  const time = toZonedParts(instant, timeZone).time.slice(0, 5);
  return `${day}, ${time} hs`;
}
