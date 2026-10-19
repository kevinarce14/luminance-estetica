import type { DashboardMetrics } from '../../types/admin.ts'
import type { LoadStatus } from '../../types/booking.ts'
import { formatPrice } from '../../utils/formatters.ts'
import { MessageBox, Spinner } from '../common/Feedback.tsx'

interface MetricsCardsProps {
  status: LoadStatus
  metrics: DashboardMetrics | null
  onRetry: () => void
}

interface MetricCard {
  tone: 'green' | 'blue' | 'orange' | 'red'
  icon: string
  label: string
  value: string
  hint?: string
}

export function MetricsCards({ status, metrics, onRetry }: MetricsCardsProps) {
  if (!metrics) {
    if (status === 'error') {
      return (
        <MessageBox variant="warning">
          No se pudieron cargar las métricas.{' '}
          <button type="button" className="admin-link-button" onClick={onRetry}>
            Reintentar
          </button>
        </MessageBox>
      )
    }
    return <Spinner label="Cargando métricas..." />
  }

  const estimatedRevenue = metrics.revenue.this_month + metrics.revenue.pending
  const cards: MetricCard[] = [
    {
      tone: 'blue',
      icon: 'fas fa-calendar-day',
      label: 'Turnos de hoy',
      value: String(metrics.appointments.today),
      hint: `${metrics.appointments.this_week} esta semana`,
    },
    {
      tone: 'orange',
      icon: 'fas fa-hourglass-half',
      label: 'Pendientes de pago',
      value: String(metrics.appointments.pending_confirmation),
      hint: `${formatPrice(metrics.revenue.pending)} sin cobrar`,
    },
    {
      tone: 'green',
      icon: 'fas fa-dollar-sign',
      label: 'Ingresos del mes',
      value: formatPrice(metrics.revenue.this_month),
      hint: 'Pagos aprobados',
    },
    {
      tone: 'red',
      icon: 'fas fa-chart-line',
      label: 'Ingresos estimados',
      value: formatPrice(estimatedRevenue),
      hint: 'Cobrado + turnos sin pago',
    },
  ]

  return (
    <div className="admin-stats">
      {cards.map((card) => (
        <div key={card.label} className={`admin-stat admin-stat--${card.tone}`}>
          <div>
            <div className="admin-stat__value">{card.value}</div>
            <div className="admin-stat__label">{card.label}</div>
            {card.hint ? <div className="admin-stat__hint">{card.hint}</div> : null}
          </div>
          <div className="admin-stat__icon" aria-hidden="true">
            <i className={card.icon} />
          </div>
        </div>
      ))}
    </div>
  )
}
