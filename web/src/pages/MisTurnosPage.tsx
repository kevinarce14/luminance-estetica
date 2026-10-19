import { useState } from 'react'
import { Link } from 'react-router-dom'
import { CancelAppointmentModal } from '../components/appointments/CancelAppointmentModal.tsx'
import {
  AppointmentStatusBadge,
  PaymentBadge,
} from '../components/appointments/StatusBadge.tsx'
import { MessageBox, Spinner } from '../components/common/Feedback.tsx'
import { buildWhatsappUrl } from '../constants/contact.ts'
import { useAuth } from '../hooks/useAuth.ts'
import { useAsyncResource } from '../hooks/useAsyncResource.ts'
import { cancelAppointment, getMyAppointments } from '../services/appointmentsApi.ts'
import { isApiError } from '../types/api.ts'
import { AppointmentStatus, type AppointmentWithDetails } from '../types/appointment.ts'
import { canBeCancelled, splitUpcomingAndHistory } from '../utils/appointments.ts'
import { formatPrice } from '../utils/formatters.ts'
import { formatStudioLongDate, formatStudioTime } from '../utils/studioTime.ts'
import './MisTurnosPage.css'

type MisTurnosTab = 'upcoming' | 'history'

interface Feedback {
  variant: 'success' | 'error'
  message: string
}

function describeAppointment(appointment: AppointmentWithDetails): string {
  return `${appointment.service.name} — ${formatStudioLongDate(appointment.appointment_date)}, ${formatStudioTime(appointment.appointment_date)}`
}

function buildRescheduleMessage(appointment: AppointmentWithDetails, clientName: string): string {
  return [
    'Hola Cande! 🌸',
    '',
    `Soy *${clientName}* y quisiera reprogramar mi turno:`,
    '',
    `📋 *ID Turno:* #${appointment.id}`,
    `💅 *Servicio:* ${appointment.service.name}`,
    `📅 *Fecha actual:* ${formatStudioLongDate(appointment.appointment_date)}`,
    `🕐 *Hora actual:* ${formatStudioTime(appointment.appointment_date)}`,
    '',
    '¿Podrías ayudarme a cambiar la fecha/hora?',
    '',
    '¡Gracias! 💖',
  ].join('\n')
}

interface AppointmentCardProps {
  appointment: AppointmentWithDetails
  clientName: string
  onCancel: (appointment: AppointmentWithDetails) => void
}

function AppointmentCard({ appointment, clientName, onCancel }: AppointmentCardProps) {
  const { service, payment, status } = appointment

  return (
    <article className="turno-card">
      <div className="turno-card__header">
        <div>
          <h3>{service.name}</h3>
          <div className="turno-card__category">{service.category}</div>
        </div>
        <AppointmentStatusBadge status={status} />
      </div>

      <dl className="turno-card__details">
        <div>
          <i className="fas fa-calendar-day" aria-hidden="true" />
          <dt>Fecha</dt>
          <dd>{formatStudioLongDate(appointment.appointment_date)}</dd>
        </div>
        <div>
          <i className="fas fa-clock" aria-hidden="true" />
          <dt>Hora</dt>
          <dd>{formatStudioTime(appointment.appointment_date)}</dd>
        </div>
        <div>
          <i className="fas fa-hourglass-half" aria-hidden="true" />
          <dt>Duración</dt>
          <dd>{service.duration_minutes} min</dd>
        </div>
        <div>
          <i className="fas fa-dollar-sign" aria-hidden="true" />
          <dt>Precio</dt>
          <dd>{formatPrice(service.price)}</dd>
        </div>
        <div className="turno-card__payment">
          <i className="fas fa-credit-card" aria-hidden="true" />
          <dt>Pago</dt>
          <dd>
            <PaymentBadge status={payment?.status} method={payment?.payment_method} />
          </dd>
        </div>
      </dl>

      {appointment.notes ? (
        <p className="turno-card__notes">
          <strong>Notas:</strong> {appointment.notes}
        </p>
      ) : null}
      {status === AppointmentStatus.CANCELLED && appointment.cancellation_reason ? (
        <p className="turno-card__notes">
          <strong>Motivo de cancelación:</strong> {appointment.cancellation_reason}
        </p>
      ) : null}

      <div className="turno-card__actions">
        {status === AppointmentStatus.PENDING ? (
          <Link to={`/pago?appointment_id=${appointment.id}`} className="turno-btn turno-btn--primary">
            <i className="fas fa-credit-card" aria-hidden="true" /> Pagar
          </Link>
        ) : null}
        {status === AppointmentStatus.CONFIRMED ? (
          <a
            href={buildWhatsappUrl(buildRescheduleMessage(appointment, clientName))}
            className="turno-btn turno-btn--warning"
            target="_blank"
            rel="noreferrer"
          >
            <i className="fas fa-calendar-alt" aria-hidden="true" /> Solicitar Reprogramar
          </a>
        ) : null}
        {canBeCancelled(status) ? (
          <button
            type="button"
            className="turno-btn turno-btn--danger"
            onClick={() => onCancel(appointment)}
          >
            <i className="fas fa-times" aria-hidden="true" /> Cancelar
          </button>
        ) : null}
      </div>
    </article>
  )
}

export function MisTurnosPage() {
  const { user } = useAuth()
  const { status, data, retry } = useAsyncResource('my-appointments', getMyAppointments)
  const [activeTab, setActiveTab] = useState<MisTurnosTab>('upcoming')
  const [cancelTarget, setCancelTarget] = useState<AppointmentWithDetails | null>(null)
  const [isCancelling, setIsCancelling] = useState(false)
  const [feedback, setFeedback] = useState<Feedback | null>(null)

  const { upcoming, history } = splitUpcomingAndHistory(data ?? [])
  const visible = activeTab === 'upcoming' ? upcoming : history
  const clientName = user?.full_name ?? 'Cliente'

  const handleConfirmCancel = async (reason: string) => {
    if (!cancelTarget) {
      return
    }
    const target = cancelTarget
    setIsCancelling(true)
    setFeedback(null)

    try {
      await cancelAppointment(target.id, reason)
      setFeedback({ variant: 'success', message: '✅ Turno cancelado exitosamente.' })
      retry()
    } catch (error) {
      setFeedback({
        variant: 'error',
        message: `Error al cancelar el turno${isApiError(error) ? `: ${error.message}` : '.'}`,
      })
    } finally {
      setIsCancelling(false)
      setCancelTarget(null)
    }
  }

  const renderContent = () => {
    if (status === 'loading' && !data) {
      return <Spinner label="Cargando tus turnos..." size="large" />
    }

    if (status === 'error') {
      return (
        <MessageBox variant="error">
          Error al cargar tus turnos.{' '}
          <button type="button" className="turno-link-button" onClick={retry}>
            Reintentar
          </button>
        </MessageBox>
      )
    }

    if (visible.length === 0) {
      return (
        <div className="turnos-empty">
          <i className="fas fa-calendar-times" aria-hidden="true" />
          <h2>
            {activeTab === 'upcoming' ? 'No tenés turnos próximos' : 'Todavía no hay historial'}
          </h2>
          <p>¡Es hora de reservar tu próximo tratamiento de belleza!</p>
          <Link to="/turnera" className="btn btn-rosa">
            <i className="fas fa-plus-circle" aria-hidden="true" /> Reservar Turno
          </Link>
        </div>
      )
    }

    return (
      <div className="turnos-grid">
        {visible.map((appointment) => (
          <AppointmentCard
            key={appointment.id}
            appointment={appointment}
            clientName={clientName}
            onCancel={setCancelTarget}
          />
        ))}
      </div>
    )
  }

  const tabs: { id: MisTurnosTab; label: string; icon: string; count: number }[] = [
    { id: 'upcoming', label: 'Próximos', icon: 'fas fa-calendar-alt', count: upcoming.length },
    { id: 'history', label: 'Historial', icon: 'fas fa-history', count: history.length },
  ]

  return (
    <div className="mis-turnos-page">
      <div className="mis-turnos-container">
        <div className="mis-turnos-header">
          <h1>
            <i className="fas fa-calendar-alt" aria-hidden="true" /> Mis Turnos
          </h1>
          <p>Gestioná todas tus reservas en Luminance Studio</p>
        </div>

        <div className="mis-turnos-tabs" role="tablist" aria-label="Filtrar turnos">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              className={activeTab === tab.id ? 'mis-turnos-tab mis-turnos-tab--active' : 'mis-turnos-tab'}
              onClick={() => setActiveTab(tab.id)}
            >
              <i className={tab.icon} aria-hidden="true" /> {tab.label}
              {data ? <span className="mis-turnos-tab__count">{tab.count}</span> : null}
            </button>
          ))}
        </div>

        {feedback ? <MessageBox variant={feedback.variant}>{feedback.message}</MessageBox> : null}

        <div role="tabpanel">{renderContent()}</div>
      </div>

      <CancelAppointmentModal
        key={cancelTarget?.id ?? 'closed'}
        appointmentLabel={cancelTarget ? describeAppointment(cancelTarget) : null}
        isSubmitting={isCancelling}
        onConfirm={(reason) => void handleConfirmCancel(reason)}
        onClose={() => setCancelTarget(null)}
      />
    </div>
  )
}
