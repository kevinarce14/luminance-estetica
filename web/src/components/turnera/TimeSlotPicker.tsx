import type { TimeSlot } from '../../types/availability.ts'
import type { LoadStatus } from '../../types/booking.ts'
import { formatStudioTime, getStudioToday } from '../../utils/studioTime.ts'
import { MessageBox, Spinner } from '../common/Feedback.tsx'

interface TimeSlotPickerProps {
  status: LoadStatus
  date: string | null
  slots: TimeSlot[]
  isDayClosed: boolean
  selectedSlot: string | null
  onSelect: (slotStart: string) => void
  onRetry: () => void
}

export function TimeSlotPicker({
  status,
  date,
  slots,
  isDayClosed,
  selectedSlot,
  onSelect,
  onRetry,
}: TimeSlotPickerProps) {
  if (status === 'idle') {
    return (
      <MessageBox variant="info">
        Seleccioná un servicio para ver horarios disponibles.
      </MessageBox>
    )
  }

  if (status === 'loading') {
    return <Spinner label="Cargando horarios..." />
  }

  if (status === 'error') {
    return (
      <MessageBox variant="warning">
        Error al cargar horarios.{' '}
        <button type="button" className="booking-link-button" onClick={onRetry}>
          Intentar nuevamente
        </button>
      </MessageBox>
    )
  }

  if (isDayClosed) {
    return (
      <MessageBox variant="info">
        No hay horarios disponibles para esta fecha. Por favor, seleccioná otro día.
      </MessageBox>
    )
  }

  if (slots.length === 0) {
    return (
      <MessageBox variant="warning">
        {date === getStudioToday()
          ? 'No hay más horarios disponibles para hoy. Por favor, seleccioná otro día.'
          : 'Todos los horarios están ocupados para esta fecha. Intentá con otro día.'}
      </MessageBox>
    )
  }

  return (
    <div className="booking-slots" role="radiogroup" aria-label="Horarios disponibles">
      {slots.map((slot) => {
        const isSelected = slot.start_time === selectedSlot
        return (
          <button
            key={slot.start_time}
            type="button"
            role="radio"
            aria-checked={isSelected}
            className={isSelected ? 'booking-slot booking-slot--selected' : 'booking-slot'}
            onClick={() => onSelect(slot.start_time)}
          >
            {formatStudioTime(slot.start_time)}
          </button>
        )
      })}
    </div>
  )
}
