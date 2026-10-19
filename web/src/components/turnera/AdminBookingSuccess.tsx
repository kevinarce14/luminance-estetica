import { Link } from 'react-router-dom'
import type { AdminBookingResult } from '../../types/booking.ts'
import { formatStudioLongDate, formatStudioTime } from '../../utils/studioTime.ts'
import { MessageBox } from '../common/Feedback.tsx'

interface AdminBookingSuccessProps {
  result: AdminBookingResult
  onCreateAnother: () => void
}

/** Confirmación del flujo admin: turno creado y pago en efectivo aprobado (turnera.html). */
export function AdminBookingSuccess({ result, onCreateAnother }: AdminBookingSuccessProps) {
  return (
    <div className="booking-success">
      <div className="booking-success__icon" aria-hidden="true">
        <i className="fas fa-check" />
      </div>
      <h2>{result.paymentConfirmed ? '¡Turno Confirmado!' : 'Turno creado'}</h2>
      <p className="booking-success__subtitle">La reserva se ha realizado exitosamente</p>

      {!result.paymentConfirmed ? (
        <MessageBox variant="warning">
          El turno se creó pero hubo un error al confirmar el pago. Podés confirmarlo
          manualmente desde el dashboard.
        </MessageBox>
      ) : null}

      <dl className="booking-success__details">
        <div>
          <dt>📋 ID Turno:</dt>
          <dd>#{result.appointmentId}</dd>
        </div>
        <div>
          <dt>💅 Servicio:</dt>
          <dd>{result.serviceName}</dd>
        </div>
        <div>
          <dt>📅 Fecha:</dt>
          <dd>{formatStudioLongDate(result.date)}</dd>
        </div>
        <div>
          <dt>🕐 Hora:</dt>
          <dd>{formatStudioTime(result.slotStart)}</dd>
        </div>
        <div>
          <dt>💰 Estado Pago:</dt>
          <dd className={result.paymentConfirmed ? 'booking-success__ok' : undefined}>
            {result.paymentConfirmed ? 'Confirmado (Efectivo)' : 'Pendiente'}
          </dd>
        </div>
        <div>
          <dt>✅ Estado Turno:</dt>
          <dd className={result.paymentConfirmed ? 'booking-success__ok' : undefined}>
            {result.paymentConfirmed ? 'Confirmado' : 'Pendiente'}
          </dd>
        </div>
      </dl>

      <div className="booking-success__actions">
        <button type="button" className="btn btn-rosa" onClick={onCreateAnother}>
          <i className="fas fa-plus" aria-hidden="true" /> Crear Otro Turno
        </button>
        <Link to="/admin" className="btn btn-lila">
          <i className="fas fa-chart-line" aria-hidden="true" /> Ir al Dashboard
        </Link>
      </div>
    </div>
  )
}
