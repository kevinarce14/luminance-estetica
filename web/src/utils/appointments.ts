import { AppointmentStatus, type AppointmentWithDetails } from '../types/appointment.ts'

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
  upcoming: AppointmentWithDetails[]
  history: AppointmentWithDetails[]
}

/**
 * Mis Turnos: "Próximos" = pendientes/confirmados con fecha futura (más cercano primero);
 * "Historial" = el resto (más reciente primero).
 */
export function splitUpcomingAndHistory(
  appointments: AppointmentWithDetails[],
  now: number = Date.now(),
): SplitAppointments {
  const upcoming: AppointmentWithDetails[] = []
  const history: AppointmentWithDetails[] = []

  appointments.forEach((appointment) => {
    const isFuture = Date.parse(appointment.appointment_date) >= now
    if (isFuture && isActiveStatus(appointment.status)) {
      upcoming.push(appointment)
    } else {
      history.push(appointment)
    }
  })

  const byDate = (a: AppointmentWithDetails, b: AppointmentWithDetails) =>
    Date.parse(a.appointment_date) - Date.parse(b.appointment_date)

  return { upcoming: upcoming.sort(byDate), history: history.sort((a, b) => byDate(b, a)) }
}
