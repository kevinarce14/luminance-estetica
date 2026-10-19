import type { Service } from '../../types/service.ts'
import { formatPrice } from '../../utils/formatters.ts'
import { formatStudioLongDate, formatStudioTime } from '../../utils/studioTime.ts'

interface BookingSummaryProps {
  service: Service
  date: string
  slotStart: string
}

export function BookingSummary({ service, date, slotStart }: BookingSummaryProps) {
  const items = [
    { icon: 'fas fa-calendar', label: 'Fecha', value: formatStudioLongDate(date) },
    { icon: 'fas fa-clock', label: 'Horario', value: formatStudioTime(slotStart) },
    { icon: 'fas fa-spa', label: 'Servicio', value: service.name },
    { icon: 'fas fa-hourglass', label: 'Duración', value: `${service.duration_minutes} minutos` },
    { icon: 'fas fa-dollar-sign', label: 'Precio', value: formatPrice(service.price) },
  ]

  return (
    <dl className="booking-summary">
      {items.map((item) => (
        <div key={item.label} className="booking-summary__item">
          <dt>
            <i className={item.icon} aria-hidden="true" /> {item.label}:
          </dt>
          <dd>{item.value}</dd>
        </div>
      ))}
    </dl>
  )
}
