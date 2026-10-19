import type { LoadStatus } from '../../types/booking.ts'
import type { Service } from '../../types/service.ts'
import { formatPrice } from '../../utils/formatters.ts'
import { MessageBox, Spinner } from '../common/Feedback.tsx'

interface ServiceSelectorProps {
  status: LoadStatus
  services: Service[]
  selectedServiceId: number | null
  onSelect: (serviceId: number) => void
  onRetry: () => void
}

export function ServiceSelector({
  status,
  services,
  selectedServiceId,
  onSelect,
  onRetry,
}: ServiceSelectorProps) {
  if (status === 'loading' || status === 'idle') {
    return <Spinner label="Cargando servicios..." />
  }

  if (status === 'error') {
    return (
      <MessageBox variant="warning">
        Error al cargar servicios.{' '}
        <button type="button" className="booking-link-button" onClick={onRetry}>
          Reintentar
        </button>
      </MessageBox>
    )
  }

  if (services.length === 0) {
    return <MessageBox variant="info">No hay servicios disponibles en este momento.</MessageBox>
  }

  return (
    <div className="booking-services" role="radiogroup" aria-label="Servicios">
      {services.map((service) => {
        const isSelected = service.id === selectedServiceId
        return (
          <button
            key={service.id}
            type="button"
            role="radio"
            aria-checked={isSelected}
            className={
              isSelected ? 'booking-service booking-service--selected' : 'booking-service'
            }
            onClick={() => onSelect(service.id)}
          >
            <span className="booking-service__info">
              <span className="booking-service__name">{service.name}</span>
              <span className="booking-service__details">
                <i className="fas fa-clock" aria-hidden="true" /> {service.duration_minutes} min
              </span>
            </span>
            <span className="booking-service__price">{formatPrice(service.price)}</span>
          </button>
        )
      })}
    </div>
  )
}
