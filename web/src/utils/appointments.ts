import type {
  AgendaFilters,
  AgendaRow,
  AppointmentPatch,
  ClientContact,
} from '../types/admin.ts'
import {
  AppointmentStatus,
  type AppointmentHistoryItem,
  type AppointmentWithDetails,
} from '../types/appointment.ts'
import type { User } from '../types/user.ts'
import { getStudioDateKey } from './studioTime.ts'

const ACTIVE_STATUSES: readonly AppointmentStatus[] = [
  AppointmentStatus.PENDING,
  AppointmentStatus.CONFIRMED,
]

export function isActiveStatus(status: AppointmentStatus): boolean {
  return ACTIVE_STATUSES.includes(status)
}

/** Igual que `can_be_cancelled` del backend. */
export function canBeCancelled(status: AppointmentStatus): boolean {
  return isActiveStatus(status)
}

interface SplitAppointments {
  upcoming: AppointmentHistoryItem[]
  history: AppointmentHistoryItem[]
}

/**
 * Mis Turnos: "Próximos" = pendientes/confirmados con fecha futura (más cercano primero);
 * "Historial" = el resto (más reciente primero).
 */
export function splitUpcomingAndHistory(
  appointments: AppointmentHistoryItem[],
  now: number = Date.now(),
): SplitAppointments {
  const upcoming: AppointmentHistoryItem[] = []
  const history: AppointmentHistoryItem[] = []

  appointments.forEach((appointment) => {
    const isFuture = Date.parse(appointment.appointment_date) >= now
    if (isFuture && isActiveStatus(appointment.status)) {
      upcoming.push(appointment)
    } else {
      history.push(appointment)
    }
  })

  const byDate = (a: AppointmentHistoryItem, b: AppointmentHistoryItem) =>
    Date.parse(a.appointment_date) - Date.parse(b.appointment_date)

  return { upcoming: upcoming.sort(byDate), history: history.sort((a, b) => byDate(b, a)) }
}

/** Cruza los turnos con el contacto del cliente y aplica los cambios hechos en la sesión. */
export function buildAgendaRows(
  appointments: AppointmentWithDetails[],
  users: User[],
  sessionPatches: ReadonlyMap<number, AppointmentPatch>,
): AgendaRow[] {
  const contacts = new Map<number, ClientContact>(
    users.map((user) => [user.id, { email: user.email, phone: user.phone }]),
  )

  return appointments.map((appointment) => {
    const patch = sessionPatches.get(appointment.id)
    return {
      appointment: patch ? { ...appointment, ...patch } : appointment,
      contact: contacts.get(appointment.user_id) ?? null,
    }
  })
}

function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
}

/** Filtros de la agenda: fecha (en hora del studio), estado y búsqueda libre. */
export function filterAgendaRows(rows: AgendaRow[], filters: AgendaFilters): AgendaRow[] {
  const query = normalize(filters.search)
  const digitsQuery = filters.search.replace(/\D/g, '')

  return rows.filter(({ appointment, contact }) => {
    if (filters.date && getStudioDateKey(appointment.appointment_date) !== filters.date) {
      return false
    }

    if (filters.status !== 'all' && appointment.status !== filters.status) {
      return false
    }

    if (!query) {
      return true
    }

    const haystack = normalize(
      [
        `#${appointment.id}`,
        appointment.user.full_name,
        appointment.service.name,
        contact?.email ?? '',
        contact?.phone ?? '',
      ].join(' '),
    )
    const phoneDigits = (contact?.phone ?? '').replace(/\D/g, '')

    return (
      haystack.includes(query) ||
      (digitsQuery.length >= 3 && phoneDigits.includes(digitsQuery))
    )
  })
}
