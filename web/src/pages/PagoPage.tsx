import { useState } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { ConfirmModal } from '../components/common/ConfirmModal.tsx'
import { LoadingOverlay, MessageBox, Spinner } from '../components/common/Feedback.tsx'
import { buildWhatsappUrl } from '../constants/contact.ts'
import { useAuth } from '../context/AuthContext.tsx'
import { useAppointment } from '../hooks/useAppointment.ts'
import { cancelAppointment } from '../services/appointmentsApi.ts'
import { createPaymentPreference } from '../services/paymentsApi.ts'
import { isApiError } from '../types/api.ts'
import { AppointmentStatus, type AppointmentWithDetails } from '../types/appointment.ts'
import { PaymentMethod, type CheckoutMethod } from '../types/payment.ts'
import type { User } from '../types/user.ts'
import { formatPrice } from '../utils/formatters.ts'
import {
  APPOINTMENT_STATUS_LABELS,
  isMercadoPagoApproved,
  isMercadoPagoFailed,
  isMercadoPagoPending,
  parseAppointmentId,
  readMercadoPagoReturn,
} from '../utils/payments.ts'
import { formatStudioLongDate, formatStudioTime } from '../utils/studioTime.ts'
import './PagoPage.css'

type ProcessingAction = 'mercadopago' | 'cancel' | null

function buildCashWhatsappMessage(appointment: AppointmentWithDetails, user: User | null): string {
  return [
    '¡Hola Cande! 👋',
    '',
    'Quiero reservar un turno con pago en efectivo:',
    '',
    `👤 *Cliente:* ${user?.full_name ?? 'Cliente'}`,
    `📧 *Email:* ${user?.email ?? ''}`,
    '',
    `📅 *Fecha:* ${formatStudioLongDate(appointment.appointment_date)}`,
    `🕐 *Hora:* ${formatStudioTime(appointment.appointment_date)}`,
    `💅 *Servicio:* ${appointment.service.name}`,
    `💰 *Precio:* ${formatPrice(appointment.service.price)}`,
    '',
    '💵 *Método de pago:* Efectivo en persona',
    `🆔 *Turno ID:* #${appointment.id}`,
    '',
    '¿Podés confirmarme este turno? ¡Gracias!',
  ].join('\n')
}

function getErrorMessage(error: unknown, fallback: string): string {
  return isApiError(error) ? error.message : fallback
}

export function PagoPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const mpReturn = readMercadoPagoReturn(searchParams)
  const appointmentId =
    parseAppointmentId(searchParams.get('appointment_id')) ?? mpReturn.appointmentId

  // Retorno de MercadoPago a esta URL: se deriva a la pantalla de resultado (igual que pago.html).
  let mpRedirect: string | null = null
  if (mpReturn.appointmentId !== null && isMercadoPagoApproved(mpReturn.status)) {
    mpRedirect = `/pago/exitoso?${searchParams.toString()}`
  } else if (mpReturn.appointmentId !== null && isMercadoPagoFailed(mpReturn.status)) {
    mpRedirect = `/pago/fallido?${searchParams.toString()}`
  }

  const { status, appointment, errorMessage, retry } = useAppointment(
    mpRedirect ? null : appointmentId,
  )

  const [selectedMethod, setSelectedMethod] = useState<CheckoutMethod | null>(null)
  const [processing, setProcessing] = useState<ProcessingAction>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [isCashModalOpen, setIsCashModalOpen] = useState(false)
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false)
  const [cashRequestSent, setCashRequestSent] = useState(false)

  if (mpRedirect) {
    return <Navigate to={mpRedirect} replace />
  }

  const isPayable = appointment?.status === AppointmentStatus.PENDING
  const canConfirm = isPayable && selectedMethod !== null && processing === null

  const handleMercadoPago = async (target: AppointmentWithDetails) => {
    setProcessing('mercadopago')
    try {
      const preference = await createPaymentPreference(target.id, target.service.price)
      // Checkout externo: se sale de la SPA hacia MercadoPago.
      window.location.assign(preference.init_point)
    } catch (error) {
      setActionError(getErrorMessage(error, 'No se pudo iniciar el pago con Mercado Pago.'))
      setProcessing(null)
    }
  }

  const handleConfirmPayment = () => {
    if (!appointment || !selectedMethod) {
      return
    }
    setActionError(null)

    if (selectedMethod === PaymentMethod.MERCADOPAGO) {
      void handleMercadoPago(appointment)
    } else {
      setIsCashModalOpen(true)
    }
  }

  const handleConfirmCash = () => {
    if (!appointment) {
      return
    }
    setIsCashModalOpen(false)
    window.open(
      buildWhatsappUrl(buildCashWhatsappMessage(appointment, user)),
      '_blank',
      'noopener,noreferrer',
    )
    setCashRequestSent(true)
  }

  const handleConfirmCancel = async () => {
    if (!appointment) {
      return
    }
    setIsCancelModalOpen(false)
    setActionError(null)
    setProcessing('cancel')
    try {
      await cancelAppointment(appointment.id, 'Cancelado desde página de pago')
      navigate('/turnera', { replace: true })
    } catch (error) {
      setActionError(getErrorMessage(error, 'Error al cancelar la reserva.'))
      setProcessing(null)
    }
  }

  const renderSummary = () => {
    if (appointmentId === null) {
      return (
        <MessageBox variant="warning">
          No se encontró información del turno. <Link to="/turnera">Reservá un turno →</Link>
        </MessageBox>
      )
    }

    if (status === 'loading' || status === 'idle') {
      return <Spinner label="Cargando información..." />
    }

    if (status === 'error' || !appointment) {
      return (
        <MessageBox variant="warning">
          <strong>Error al cargar turno #{appointmentId}</strong>
          <br />
          {errorMessage}
          <div className="pago-inline-actions">
            <button type="button" className="pago-retry" onClick={retry}>
              🔄 Reintentar
            </button>
            <Link to="/turnera">← Volver</Link>
          </div>
        </MessageBox>
      )
    }

    if (!isPayable) {
      return (
        <MessageBox variant="warning">
          Este turno ya fue procesado (estado:{' '}
          <strong>{APPOINTMENT_STATUS_LABELS[appointment.status]}</strong>).
          <br />
          <Link to="/mis-turnos">Ver mis turnos →</Link>
        </MessageBox>
      )
    }

    const items = [
      { icon: 'fas fa-spa', label: 'Servicio', value: appointment.service.name },
      { icon: 'fas fa-calendar', label: 'Fecha', value: formatStudioLongDate(appointment.appointment_date) },
      { icon: 'fas fa-clock', label: 'Horario', value: formatStudioTime(appointment.appointment_date) },
      { icon: 'fas fa-hourglass', label: 'Duración', value: `${appointment.service.duration_minutes} minutos` },
    ]

    return (
      <dl className="pago-summary">
        <div className="pago-summary__item">
          <dt>
            <i className="fas fa-tag" aria-hidden="true" /> Estado
          </dt>
          <dd>
            <span className="pago-status-badge">⏳ Pendiente de Pago</span>
          </dd>
        </div>
        {items.map((item) => (
          <div key={item.label} className="pago-summary__item">
            <dt>
              <i className={item.icon} aria-hidden="true" /> {item.label}
            </dt>
            <dd>{item.value}</dd>
          </div>
        ))}
        <div className="pago-summary__item pago-summary__item--total">
          <dt>
            <i className="fas fa-dollar-sign" aria-hidden="true" /> Total a Pagar
          </dt>
          <dd className="pago-summary__total">{formatPrice(appointment.service.price)}</dd>
        </div>
      </dl>
    )
  }

  const paymentOptions: {
    method: CheckoutMethod
    icon: string
    title: string
    subtitle: string
    badge?: string
    details: string
  }[] = [
    {
      method: PaymentMethod.MERCADOPAGO,
      icon: 'fas fa-credit-card',
      title: 'Mercado Pago',
      subtitle: 'Tarjeta, transferencia bancaria o saldo MP',
      badge: 'Recomendado',
      details:
        'Serás redirigido a Mercado Pago para completar el pago. Podés pagar con tarjeta de crédito/débito, saldo de Mercado Pago o transferencia bancaria (CBU/CVU). El turno se confirma automáticamente.',
    },
    {
      method: PaymentMethod.CASH,
      icon: 'fas fa-money-bill-wave',
      title: 'Efectivo en Persona',
      subtitle: 'Pagá directamente en el estudio',
      details:
        '💬 Serás redirigido a WhatsApp. Enviarás un mensaje a Cande con los detalles de tu turno; ella confirmará tu reserva y coordinarás el pago en efectivo cuando llegues al estudio.',
    },
  ]

  return (
    <div className="pago-page">
      <div className="pago-card">
        <div className="pago-card__header">
          <h1>💳 Confirmar tu Turno</h1>
          <p>Completá el pago para confirmar tu reserva</p>
        </div>

        <div className="pago-card__content">
          {isMercadoPagoPending(mpReturn.status) ? (
            <MessageBox variant="info">
              Tu pago con Mercado Pago está <strong>en proceso</strong>. Te avisaremos por email
              cuando se acredite.
            </MessageBox>
          ) : (
            <MessageBox variant="warning">
              <strong>Importante:</strong> Tu turno está <strong>reservado temporalmente</strong>{' '}
              con estado &quot;Pendiente&quot;. Una vez acreditado el pago, recibirás un email de
              confirmación.
            </MessageBox>
          )}

          {cashRequestSent ? (
            <MessageBox variant="success">
              ✅ ¡Abriendo WhatsApp! Cande te responderá para confirmar tu turno. Una vez
              confirmado por ella, aparecerá en <Link to="/mis-turnos">Mis Turnos</Link>.
            </MessageBox>
          ) : null}

          {actionError ? <MessageBox variant="error">{actionError}</MessageBox> : null}

          <div className="pago-grid">
            <section className="pago-appointment" aria-labelledby="pago-resumen-title">
              <h2 id="pago-resumen-title">
                <i className="fas fa-calendar-check" aria-hidden="true" /> Resumen del Turno
              </h2>
              {renderSummary()}
            </section>

            <section
              className="pago-methods"
              aria-labelledby="pago-metodos-title"
              inert={!isPayable}
            >
              <h2 id="pago-metodos-title">Método de Pago</h2>
              <div role="radiogroup" aria-labelledby="pago-metodos-title" className="pago-methods__list">
                {paymentOptions.map((option) => {
                  const isSelected = selectedMethod === option.method
                  return (
                    <button
                      key={option.method}
                      type="button"
                      role="radio"
                      aria-checked={isSelected}
                      disabled={!isPayable}
                      className={isSelected ? 'pago-option pago-option--selected' : 'pago-option'}
                      onClick={() => setSelectedMethod(option.method)}
                    >
                      <span className="pago-option__header">
                        <span className="pago-option__icon" aria-hidden="true">
                          <i className={option.icon} />
                        </span>
                        <span className="pago-option__title">
                          <span className="pago-option__name">{option.title}</span>
                          <span className="pago-option__subtitle">{option.subtitle}</span>
                        </span>
                        {option.badge ? (
                          <span className="pago-option__badge">{option.badge}</span>
                        ) : null}
                      </span>
                      {isSelected ? (
                        <span className="pago-option__details">{option.details}</span>
                      ) : null}
                    </button>
                  )
                })}
              </div>
            </section>
          </div>

          <div className="pago-actions">
            <button
              type="button"
              className="pago-btn pago-btn--secondary"
              disabled={!isPayable || processing !== null}
              onClick={() => setIsCancelModalOpen(true)}
            >
              <i className="fas fa-times" aria-hidden="true" /> Cancelar Reserva
            </button>
            <button
              type="button"
              className="pago-btn pago-btn--primary"
              disabled={!canConfirm}
              onClick={handleConfirmPayment}
            >
              <i className="fas fa-check-circle" aria-hidden="true" /> Confirmar Pago
            </button>
          </div>
        </div>
      </div>

      {processing === 'mercadopago' ? (
        <LoadingOverlay title="Procesando pago..." subtitle="Te estamos redirigiendo a Mercado Pago" />
      ) : null}
      {processing === 'cancel' ? (
        <LoadingOverlay title="Cancelando reserva..." subtitle="Por favor esperá un momento" />
      ) : null}

      <ConfirmModal
        open={isCashModalOpen}
        icon="💬"
        title="Pago en efectivo"
        confirmLabel="Ir a WhatsApp"
        onConfirm={handleConfirmCash}
        onCancel={() => setIsCashModalOpen(false)}
      >
        Serás redirigido a WhatsApp para confirmar tu reserva con Cande. Desde allí podrás
        coordinar los detalles de tu turno y el pago en efectivo.
      </ConfirmModal>

      <ConfirmModal
        open={isCancelModalOpen}
        icon="🗓️"
        title="¿Cancelar reserva?"
        confirmLabel="Sí, cancelar"
        onConfirm={() => void handleConfirmCancel()}
        onCancel={() => setIsCancelModalOpen(false)}
      >
        ¿Estás segura de que querés cancelar esta reserva? El horario quedará libre para otra
        persona.
      </ConfirmModal>
    </div>
  )
}
