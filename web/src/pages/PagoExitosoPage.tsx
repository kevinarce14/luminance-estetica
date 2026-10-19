import { Link, useSearchParams } from 'react-router-dom'
import { Spinner } from '../components/common/Feedback.tsx'
import { useAuth } from '../context/AuthContext.tsx'
import { useAppointment } from '../hooks/useAppointment.ts'
import { readMercadoPagoReturn } from '../utils/payments.ts'
import { formatStudioLongDate, formatStudioTime } from '../utils/studioTime.ts'
import './PagoPage.css'

/** Retorno de MercadoPago con pago aprobado (pago-exitoso.html). */
export function PagoExitosoPage() {
  const { isAuthenticated } = useAuth()
  const [searchParams] = useSearchParams()
  const { appointmentId } = readMercadoPagoReturn(searchParams)
  // El detalle requiere sesión; si volvió de MP sin sesión se muestra el mensaje genérico.
  const { status, appointment } = useAppointment(isAuthenticated ? appointmentId : null)

  const renderDetails = () => {
    if (status === 'loading') {
      return <Spinner />
    }

    if (status === 'ready' && appointment) {
      return (
        <dl>
          <div className="pago-result__row">
            <dt>📅 Fecha</dt>
            <dd>{formatStudioLongDate(appointment.appointment_date)}</dd>
          </div>
          <div className="pago-result__row">
            <dt>🕐 Hora</dt>
            <dd>{formatStudioTime(appointment.appointment_date)}</dd>
          </div>
          <div className="pago-result__row">
            <dt>💅 Servicio</dt>
            <dd>{appointment.service.name}</dd>
          </div>
          <div className="pago-result__row">
            <dt>✅ Estado</dt>
            <dd>
              <span className="pago-result__badge">Confirmado</span>
            </dd>
          </div>
        </dl>
      )
    }

    return (
      <p className="pago-result__fallback">
        {appointmentId ? `Turno #${appointmentId} confirmado ✅` : 'Turno confirmado ✅'}
      </p>
    )
  }

  return (
    <div className="pago-page">
      <div className="pago-result">
        <div className="pago-result__icon pago-result__icon--success" aria-hidden="true">
          <i className="fas fa-check" />
        </div>
        <h1>¡Pago Exitoso! 🎉</h1>
        <p className="pago-result__subtitle">
          Tu turno está <strong>confirmado</strong>. Recibirás un email de confirmación en breve.
          💌
        </p>
        <div className="pago-result__details">{renderDetails()}</div>
        <Link to="/mis-turnos" className="btn btn-rosa">
          <i className="fas fa-calendar-check" aria-hidden="true" /> Ver mis turnos
        </Link>
      </div>
    </div>
  )
}
