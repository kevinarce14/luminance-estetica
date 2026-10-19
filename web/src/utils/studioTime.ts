import {
  MAX_BOOKING_ADVANCE_DAYS,
  NON_WORKING_WEEKDAYS,
  STUDIO_TIME_ZONE,
  STUDIO_UTC_OFFSET,
} from '../constants/booking.ts'

/**
 * Helpers de fechas en la zona horaria del studio (Buenos Aires),
 * independientes de la zona configurada en el navegador del cliente.
 * Las fechas de calendario se manejan como strings "YYYY-MM-DD".
 */

const HAS_OFFSET_PATTERN = /(Z|[+-]\d{2}:?\d{2})$/i

const dateKeyFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: STUDIO_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

const timeFormatter = new Intl.DateTimeFormat('es-AR', {
  timeZone: STUDIO_TIME_ZONE,
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

const longDateFormatter = new Intl.DateTimeFormat('es-AR', {
  timeZone: 'UTC',
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})

const monthTitleFormatter = new Intl.DateTimeFormat('es-AR', {
  timeZone: 'UTC',
  month: 'long',
  year: 'numeric',
})

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

/** "YYYY-MM-DD" → Date a medianoche UTC (solo para aritmética de calendario). */
function dateKeyToUtc(dateKey: string): Date {
  return new Date(`${dateKey}T00:00:00Z`)
}

function utcToDateKey(date: Date): string {
  return date.toISOString().slice(0, 10)
}

/** Fecha de hoy en el studio, "YYYY-MM-DD". */
export function getStudioToday(now: Date = new Date()): string {
  return dateKeyFormatter.format(now)
}

export function addDays(dateKey: string, days: number): string {
  const date = dateKeyToUtc(dateKey)
  date.setUTCDate(date.getUTCDate() + days)
  return utcToDateKey(date)
}

/** 0 = domingo … 6 = sábado. */
export function getWeekday(dateKey: string): number {
  return dateKeyToUtc(dateKey).getUTCDay()
}

/** Última fecha reservable según MAX_BOOKING_ADVANCE_DAYS. */
export function getMaxBookingDate(today: string = getStudioToday()): string {
  return addDays(today, MAX_BOOKING_ADVANCE_DAYS)
}

/** Regla de negocio del selector: ni pasado, ni días sin atención, ni más allá del máximo. */
export function isBookableDate(dateKey: string, today: string = getStudioToday()): boolean {
  return (
    dateKey >= today &&
    dateKey <= getMaxBookingDate(today) &&
    !NON_WORKING_WEEKDAYS.includes(getWeekday(dateKey))
  )
}

/**
 * Normaliza un datetime del backend a ISO con offset.
 * Los slots llegan sin offset (hora local del studio); los turnos llegan en UTC con offset.
 */
export function toStudioIsoDateTime(dateTime: string): string {
  return HAS_OFFSET_PATTERN.test(dateTime)
    ? dateTime
    : `${dateTime}${STUDIO_UTC_OFFSET}`
}

export function parseStudioDateTime(dateTime: string): Date {
  return new Date(toStudioIsoDateTime(dateTime))
}

/** "14:30 hs" en hora del studio. */
export function formatStudioTime(dateTime: string): string {
  return `${timeFormatter.format(parseStudioDateTime(dateTime))} hs`
}

/** Fecha "YYYY-MM-DD" (en hora del studio) de un datetime del backend. */
export function getStudioDateKey(dateTime: string): string {
  return dateKeyFormatter.format(parseStudioDateTime(dateTime))
}

/** "Sábado, 10 de febrero de 2024". Acepta "YYYY-MM-DD" o un datetime del backend. */
export function formatStudioLongDate(dateOrDateTime: string): string {
  const dateKey =
    dateOrDateTime.length === 10 ? dateOrDateTime : getStudioDateKey(dateOrDateTime)
  return capitalize(longDateFormatter.format(dateKeyToUtc(dateKey)))
}

/** "Octubre de 2026" para el título del calendario. */
export function formatMonthTitle(year: number, monthIndex: number): string {
  return capitalize(monthTitleFormatter.format(new Date(Date.UTC(year, monthIndex, 1))))
}

export function toDateKey(year: number, monthIndex: number, day: number): string {
  return utcToDateKey(new Date(Date.UTC(year, monthIndex, day)))
}
