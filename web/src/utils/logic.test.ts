import { describe, expect, it } from 'vitest'
import { buildAgendaQuery, AGENDA_LIMIT } from '../services/adminApi.ts'
import type { AppointmentWithDetails } from '../types/appointment.ts'
import { splitUpcomingAndHistory } from './appointments.ts'
import { countBookedSlotsByDay, filterBookableSlots } from './availability.ts'
import {
  isMercadoPagoApproved,
  isMercadoPagoFailed,
  isMercadoPagoPending,
  parseAppointmentId,
  readMercadoPagoReturn,
} from './payments.ts'
import { getStudioToday } from './studioTime.ts'
import {
  getPasswordIssues,
  hasFieldErrors,
  normalizeResetToken,
  validateLogin,
  validateRegister,
  validateResetPassword,
} from './validators.ts'

describe('filterBookableSlots', () => {
  const now = Date.parse('2026-10-20T09:30:00-03:00')
  const slot = (time: string, isAvailable = true) => ({
    start_time: `2026-10-20T${time}:00`,
    end_time: '',
    is_available: isAvailable,
  })

  it('deja solo los disponibles con 2 h de anticipación', () => {
    const result = filterBookableSlots(
      [slot('10:00'), slot('11:30'), slot('12:00', false), slot('15:00')],
      now,
    )
    expect(result.map((item) => item.start_time.slice(11, 16))).toEqual(['11:30', '15:00'])
  })
})

describe('countBookedSlotsByDay', () => {
  it('agrupa por día del studio', () => {
    expect(
      countBookedSlotsByDay([
        { appointment_date: '2026-10-20T13:00:00Z', duration_minutes: 60 },
        { appointment_date: '2026-10-21T02:00:00Z', duration_minutes: 30 },
        { appointment_date: '2026-10-21T15:00:00Z', duration_minutes: 30 },
      ]),
    ).toEqual({ '2026-10-20': 2, '2026-10-21': 1 })
  })
})

describe('splitUpcomingAndHistory', () => {
  const now = Date.parse('2026-10-20T12:00:00Z')
  const appointment = (id: number, status: AppointmentWithDetails['status'], offsetHours: number) =>
    ({ id, status, appointment_date: new Date(now + offsetHours * 3_600_000).toISOString() }) as AppointmentWithDetails

  it('próximos = activos futuros (más cercano primero); historial = el resto (más reciente primero)', () => {
    const { upcoming, history } = splitUpcomingAndHistory(
      [
        appointment(1, 'pending', 24),
        appointment(2, 'confirmed', 1),
        appointment(3, 'completed', -24),
        appointment(4, 'cancelled', 24),
        appointment(5, 'confirmed', -1),
      ],
      now,
    )
    expect(upcoming.map((item) => item.id)).toEqual([2, 1])
    expect(history.map((item) => item.id)).toEqual([4, 5, 3])
  })
})

describe('validaciones', () => {
  it('política de contraseñas igual al backend', () => {
    expect(getPasswordIssues('Abcdefg1')).toEqual([])
    expect(getPasswordIssues('abc')).toEqual(
      expect.arrayContaining(['mínimo 8 caracteres', 'al menos una mayúscula', 'al menos un número']),
    )
  })

  it('login y registro', () => {
    expect(hasFieldErrors(validateLogin({ email: '', password: '' }))).toBe(true)
    expect(hasFieldErrors(validateLogin({ email: 'ana@example.com', password: 'x' }))).toBe(false)
    const base = { full_name: 'Ana', email: 'ana@example.com', phone: '', password: 'Abcdefg1' }
    expect(hasFieldErrors(validateRegister(base))).toBe(false)
    expect(validateRegister({ ...base, phone: '+54 11 1234-5678' }).phone).toBeUndefined()
    expect(validateRegister({ ...base, phone: '11-abc-1234' }).phone).toBeDefined()
    expect(validateRegister({ ...base, full_name: 'A' }).full_name).toBeDefined()
  })

  it('recuperar contraseña: código, fuerza y coincidencia', () => {
    expect(normalizeResetToken('  abc\n def  ')).toBe('abcdef')
    const errors = validateResetPassword({ token: 'corto', password: 'debil', confirmPassword: 'otra' })
    expect(Object.keys(errors).sort()).toEqual(['confirmPassword', 'password', 'token'])
    expect(
      hasFieldErrors(validateResetPassword({ token: 'x'.repeat(40), password: 'NuevaClave9', confirmPassword: 'NuevaClave9' })),
    ).toBe(false)
  })
})

describe('retorno de MercadoPago', () => {
  it('lee external_reference, estado e id de pago', () => {
    const params = new URLSearchParams('collection_status=approved&external_reference=77&collection_id=555')
    expect(readMercadoPagoReturn(params)).toEqual({ appointmentId: 77, status: 'approved', paymentId: '555' })
  })

  it('valida el id del turno', () => {
    expect(parseAppointmentId('12')).toBe(12)
    expect(parseAppointmentId('0')).toBeNull()
    expect(parseAppointmentId('12abc')).toBeNull()
    expect(parseAppointmentId(null)).toBeNull()
  })

  it('clasifica los estados', () => {
    expect(isMercadoPagoApproved('approved')).toBe(true)
    expect(isMercadoPagoFailed('rejected')).toBe(true)
    expect(isMercadoPagoPending('in_process')).toBe(true)
    expect(isMercadoPagoApproved(null)).toBe(false)
  })
})

describe('buildAgendaQuery', () => {
  it('"Próximos" filtra desde hoy en orden ascendente', () => {
    expect(buildAgendaQuery({ scope: 'upcoming', date: '', status: 'all', search: '  ' })).toEqual({
      order: 'asc',
      limit: AGENDA_LIMIT,
      date_from: getStudioToday(),
    })
  })

  it('"Historial completo" con filtros de día, estado y búsqueda', () => {
    expect(buildAgendaQuery({ scope: 'all', date: '2026-10-20', status: 'confirmed', search: ' ana ' })).toEqual({
      order: 'desc',
      limit: AGENDA_LIMIT,
      date: '2026-10-20',
      status: 'confirmed',
      search: 'ana',
    })
  })
})
