import { describe, expect, it } from 'vitest'
import {
  addDays,
  formatStudioLongDate,
  formatStudioTime,
  getMaxBookingDate,
  getStudioDateKey,
  getStudioToday,
  getWeekday,
  isBookableDate,
  toStudioIsoDateTime,
} from './studioTime.ts'

describe('studioTime (zona America/Argentina/Buenos_Aires)', () => {
  it('interpreta los slots sin offset como hora del studio', () => {
    expect(toStudioIsoDateTime('2026-10-20T09:00:00')).toBe('2026-10-20T09:00:00-03:00')
    expect(formatStudioTime('2026-10-20T09:00:00')).toBe('09:00 hs')
  })

  it('respeta los datetimes que ya traen offset (turnos en UTC)', () => {
    expect(toStudioIsoDateTime('2026-10-20T12:00:00+00:00')).toBe('2026-10-20T12:00:00+00:00')
    expect(formatStudioTime('2026-10-20T12:00:00+00:00')).toBe('09:00 hs')
    expect(formatStudioTime('2026-10-20T12:00:00Z')).toBe('09:00 hs')
  })

  it('ubica en el día del studio un turno de madrugada UTC', () => {
    expect(getStudioDateKey('2026-10-21T02:00:00Z')).toBe('2026-10-20')
  })

  it('formatea fechas largas en español', () => {
    expect(formatStudioLongDate('2026-10-20')).toBe('Martes, 20 de octubre de 2026')
    expect(formatStudioLongDate('2026-10-21T02:00:00Z')).toBe('Martes, 20 de octubre de 2026')
  })

  it('calcula "hoy" en Buenos Aires aunque en UTC ya sea mañana', () => {
    expect(getStudioToday(new Date('2026-10-21T01:30:00Z'))).toBe('2026-10-20')
  })

  it('suma días y obtiene el día de la semana (0 = domingo)', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
    expect(getWeekday('2026-10-25')).toBe(0)
    expect(getWeekday('2026-10-24')).toBe(6)
  })

  describe('isBookableDate', () => {
    const today = '2026-10-20' // martes

    it('permite hoy y fechas futuras dentro de los 30 días', () => {
      expect(isBookableDate(today, today)).toBe(true)
      expect(isBookableDate('2026-10-24', today)).toBe(true)
      expect(isBookableDate(getMaxBookingDate(today), today)).toBe(true)
    })

    it('bloquea pasado, domingos y más allá del máximo', () => {
      expect(isBookableDate('2026-10-19', today)).toBe(false)
      expect(isBookableDate('2026-10-25', today)).toBe(false)
      expect(isBookableDate(addDays(getMaxBookingDate(today), 1), today)).toBe(false)
    })
  })
})
