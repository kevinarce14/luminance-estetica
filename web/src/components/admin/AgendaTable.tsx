import { AppointmentStatus, type AdminAppointment } from '../../types/appointment.ts'
import { formatStudioLongDate, formatStudioTime } from '../../utils/studioTime.ts'
import { AppointmentStatusBadge, PaymentBadge } from '../appointments/StatusBadge.tsx'

export type AgendaAction = 'confirm-cash' | 'complete' | 'cancel'

interface AgendaTableProps {
  appointments: AdminAppointment[]
  busyAppointmentId: number | null
  onAction: (action: AgendaAction, appointment: AdminAppointment) => void
}

export function AgendaTable({ appointments, busyAppointmentId, onAction }: AgendaTableProps) {
  return (
    <div className="admin-table-wrapper">
      <table className="admin-table">
        <thead>
          <tr>
            <th scope="col">ID</th>
            <th scope="col">Fecha y hora</th>
            <th scope="col">Cliente</th>
            <th scope="col">Servicio</th>
            <th scope="col">Estado</th>
            <th scope="col">Pago</th>
            <th scope="col">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {appointments.map((appointment) => {
            const isBusy = busyAppointmentId === appointment.id
            const disabled = busyAppointmentId !== null
            const { user } = appointment
            return (
              <tr key={appointment.id} aria-busy={isBusy || undefined}>
                <td data-label="ID">#{appointment.id}</td>
                <td data-label="Fecha y hora">
                  {formatStudioLongDate(appointment.appointment_date)}
                  <br />
                  <strong>{formatStudioTime(appointment.appointment_date)}</strong>
                </td>
                <td data-label="Cliente">
                  {user.full_name}
                  <small className="admin-table__contact">
                    {user.email}
                    {user.phone ? ` · ${user.phone}` : ''}
                  </small>
                </td>
                <td data-label="Servicio">
                  {appointment.service.name}
                  {appointment.notes ? (
                    <small className="admin-table__contact">📝 {appointment.notes}</small>
                  ) : null}
                </td>
                <td data-label="Estado">
                  <AppointmentStatusBadge status={appointment.status} />
                </td>
                <td data-label="Pago">
                  <PaymentBadge
                    status={appointment.payment?.status}
                    method={appointment.payment?.payment_method}
                  />
                </td>
                <td data-label="Acciones">
                  <div className="admin-table__actions">
                    {isBusy ? <i className="fas fa-spinner fa-spin" aria-label="Procesando" /> : null}
                    {appointment.status === AppointmentStatus.PENDING ? (
                      <button
                        type="button"
                        className="admin-btn admin-btn--success"
                        disabled={disabled}
                        onClick={() => onAction('confirm-cash', appointment)}
                      >
                        Confirmar (Efectivo)
                      </button>
                    ) : null}
                    {appointment.status === AppointmentStatus.CONFIRMED ? (
                      <button
                        type="button"
                        className="admin-btn admin-btn--info"
                        disabled={disabled}
                        onClick={() => onAction('complete', appointment)}
                      >
                        Completar
                      </button>
                    ) : null}
                    {appointment.status === AppointmentStatus.PENDING ||
                    appointment.status === AppointmentStatus.CONFIRMED ? (
                      <button
                        type="button"
                        className="admin-btn admin-btn--danger"
                        disabled={disabled}
                        onClick={() => onAction('cancel', appointment)}
                      >
                        Cancelar
                      </button>
                    ) : null}
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
