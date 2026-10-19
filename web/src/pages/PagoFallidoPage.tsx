import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { readMercadoPagoReturn } from '../utils/payments.ts'
import './PagoPage.css'

/** Retorno de MercadoPago con pago rechazado (pago-fallido.html). */
export function PagoFallidoPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { appointmentId } = readMercadoPagoReturn(searchParams)

  return (
    <div className="pago-page">
      <div className="pago-result">
        <div className="pago-result__icon pago-result__icon--error" aria-hidden="true">
          <i className="fas fa-times" />
        </div>
        <h1>Pago No Procesado</h1>
        <p className="pago-result__subtitle">
          No pudimos procesar tu pago. <strong>Tu turno sigue reservado</strong> y podés
          intentarlo nuevamente.
        </p>
        <div className="pago-result__alert">
          <i className="fas fa-info-circle" aria-hidden="true" /> El turno está pendiente de pago.
          Tenés tiempo para volver a intentarlo o elegir otro método de pago.
        </div>
        <div className="pago-result__buttons">
          {appointmentId ? (
            <Link to={`/pago?appointment_id=${appointmentId}`} className="btn btn-rosa">
              <i className="fas fa-redo" aria-hidden="true" /> Reintentar pago
            </Link>
          ) : (
            <button type="button" className="btn btn-rosa" onClick={() => navigate(-1)}>
              <i className="fas fa-redo" aria-hidden="true" /> Reintentar pago
            </button>
          )}
          <Link to="/turnera" className="btn pago-result__secondary">
            <i className="fas fa-calendar" aria-hidden="true" /> Nueva reserva
          </Link>
        </div>
      </div>
    </div>
  )
}
