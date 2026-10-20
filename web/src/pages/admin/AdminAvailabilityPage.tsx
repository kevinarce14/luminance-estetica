import { useState, type FormEvent } from 'react'
import { ConfirmModal } from '../../components/common/ConfirmModal.tsx'
import { MessageBox, Spinner, type MessageVariant } from '../../components/common/Feedback.tsx'
import { useAsyncResource } from '../../hooks/useAsyncResource.ts'
import {
  createAvailabilityException,
  createRegularSchedule,
  deleteAvailabilityException,
  getAvailabilityExceptions,
  getRegularSchedules,
  updateRegularSchedule,
} from '../../services/availabilityApi.ts'
import { isApiError } from '../../types/api.ts'
import type { Availability } from '../../types/availability.ts'
import { formatStudioLongDate, getStudioToday } from '../../utils/studioTime.ts'

/** Orden de visualización Lunes → Domingo con la convención del backend (0=Domingo). */
const WEEK_DAYS: { dayOfWeek: number; label: string }[] = [
  { dayOfWeek: 1, label: 'Lunes' },
  { dayOfWeek: 2, label: 'Martes' },
  { dayOfWeek: 3, label: 'Miércoles' },
  { dayOfWeek: 4, label: 'Jueves' },
  { dayOfWeek: 5, label: 'Viernes' },
  { dayOfWeek: 6, label: 'Sábado' },
  { dayOfWeek: 0, label: 'Domingo' },
]

const DEFAULT_START = '09:00'
const DEFAULT_END = '20:00'

interface Feedback {
  variant: MessageVariant
  message: string
}

/** "HH:MM:SS" del backend → "HH:MM" para <input type="time">. */
function toInputTime(value: string | null, fallback: string): string {
  return value ? value.slice(0, 5) : fallback
}

function hoursLabel(item: Availability): string {
  return item.is_available && item.start_time && item.end_time
    ? `${item.start_time.slice(0, 5)} a ${item.end_time.slice(0, 5)}`
    : 'Cerrado'
}

function errorMessage(error: unknown, fallback: string): string {
  return isApiError(error) ? error.message : fallback
}

interface WeekdayRowProps {
  dayOfWeek: number
  label: string
  schedule: Availability | undefined
  onSaved: (message: string) => void
  onError: (message: string) => void
}

/**
 * Fila editable de un día de la semana. Conserva su propio estado: tras guardar, la recarga
 * solo actualiza `schedule` (por ej. el id recién creado) sin pisar lo que se esté editando.
 */
function WeekdayRow({ dayOfWeek, label, schedule, onSaved, onError }: WeekdayRowProps) {
  const [isOpen, setIsOpen] = useState(schedule?.is_available ?? false)
  const [start, setStart] = useState(toInputTime(schedule?.start_time ?? null, DEFAULT_START))
  const [end, setEnd] = useState(toInputTime(schedule?.end_time ?? null, DEFAULT_END))
  const [isSaving, setIsSaving] = useState(false)
  const [rowError, setRowError] = useState<string | null>(null)

  const isDirty =
    isOpen !== (schedule?.is_available ?? false) ||
    (isOpen &&
      (start !== toInputTime(schedule?.start_time ?? null, DEFAULT_START) ||
        end !== toInputTime(schedule?.end_time ?? null, DEFAULT_END)))

  const handleSave = async () => {
    if (isOpen && (!start || !end || end <= start)) {
      setRowError('La hora de cierre debe ser posterior a la de apertura.')
      return
    }
    setRowError(null)
    setIsSaving(true)
    const hours = isOpen ? { start_time: start, end_time: end } : {}
    try {
      if (schedule) {
        await updateRegularSchedule(schedule.id, { ...hours, is_available: isOpen })
      } else {
        await createRegularSchedule({
          day_of_week: dayOfWeek,
          start_time: isOpen ? start : null,
          end_time: isOpen ? end : null,
          is_available: isOpen,
        })
      }
      onSaved(`✅ ${label}: ${isOpen ? `de ${start} a ${end}` : 'cerrado'}.`)
    } catch (error) {
      onError(errorMessage(error, `No se pudo guardar el horario del ${label.toLowerCase()}.`))
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <tr>
      <td data-label="Día">
        <strong>{label}</strong>
      </td>
      <td data-label="Atiende">
        <label className="admin-switch">
          <input type="checkbox" checked={isOpen} onChange={(event) => setIsOpen(event.target.checked)} />
          <span>{isOpen ? 'Abierto' : 'Cerrado'}</span>
        </label>
      </td>
      <td data-label="Horario">
        <div className="admin-time-range">
          <input
            type="time"
            aria-label={`Apertura del ${label.toLowerCase()}`}
            value={start}
            disabled={!isOpen}
            onChange={(event) => setStart(event.target.value)}
          />
          <span>a</span>
          <input
            type="time"
            aria-label={`Cierre del ${label.toLowerCase()}`}
            value={end}
            disabled={!isOpen}
            onChange={(event) => setEnd(event.target.value)}
          />
        </div>
        {rowError ? <small className="admin-form__error">{rowError}</small> : null}
      </td>
      <td data-label="Acción">
        <button
          type="button"
          className="admin-btn admin-btn--success"
          disabled={!isDirty || isSaving}
          onClick={() => void handleSave()}
        >
          {isSaving ? 'Guardando...' : 'Guardar'}
        </button>
      </td>
    </tr>
  )
}

type ExceptionKind = 'closed' | 'special'

export function AdminAvailabilityPage() {
  const regular = useAsyncResource('availability-regular', getRegularSchedules)
  const exceptions = useAsyncResource('availability-exceptions', getAvailabilityExceptions)
  const [feedback, setFeedback] = useState<Feedback | null>(null)

  const [exceptionDate, setExceptionDate] = useState('')
  const [exceptionKind, setExceptionKind] = useState<ExceptionKind>('closed')
  const [exceptionStart, setExceptionStart] = useState('10:00')
  const [exceptionEnd, setExceptionEnd] = useState('14:00')
  const [exceptionError, setExceptionError] = useState<string | null>(null)
  const [isSavingException, setIsSavingException] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Availability | null>(null)

  const today = getStudioToday()

  const handleCreateException = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!exceptionDate || exceptionDate < today) {
      setExceptionError('Elegí una fecha de hoy en adelante.')
      return
    }
    if (exceptionKind === 'special' && exceptionEnd <= exceptionStart) {
      setExceptionError('La hora de cierre debe ser posterior a la de apertura.')
      return
    }
    setExceptionError(null)
    setIsSavingException(true)
    try {
      await createAvailabilityException({
        specific_date: exceptionDate,
        is_available: exceptionKind === 'special',
        start_time: exceptionKind === 'special' ? exceptionStart : null,
        end_time: exceptionKind === 'special' ? exceptionEnd : null,
      })
      setFeedback({
        variant: 'success',
        message: `✅ ${formatStudioLongDate(exceptionDate)}: ${exceptionKind === 'closed' ? 'día bloqueado' : `horario especial de ${exceptionStart} a ${exceptionEnd}`}.`,
      })
      setExceptionDate('')
      exceptions.retry()
    } catch (error) {
      setExceptionError(errorMessage(error, 'No se pudo guardar la excepción.'))
    } finally {
      setIsSavingException(false)
    }
  }

  const handleDeleteException = async () => {
    if (!deleteTarget) {
      return
    }
    const target = deleteTarget
    setDeleteTarget(null)
    try {
      await deleteAvailabilityException(target.id)
      setFeedback({
        variant: 'success',
        message: `✅ Se quitó la excepción del ${formatStudioLongDate(target.specific_date ?? '')}: rige el horario semanal.`,
      })
      exceptions.retry()
    } catch (error) {
      setFeedback({ variant: 'error', message: errorMessage(error, 'No se pudo eliminar la excepción.') })
    }
  }

  const renderWeek = () => {
    if (regular.status === 'error') {
      return <MessageBox variant="error">No se pudo cargar el horario semanal.</MessageBox>
    }
    if (!regular.data) {
      return <Spinner label="Cargando horarios..." />
    }
    const byDay = new Map(regular.data.map((item) => [item.day_of_week, item]))
    return (
      <div className="admin-table-wrapper">
        <table className="admin-table">
          <thead>
            <tr>
              <th scope="col">Día</th>
              <th scope="col">Atiende</th>
              <th scope="col">Horario</th>
              <th scope="col">Acción</th>
            </tr>
          </thead>
          <tbody>
            {WEEK_DAYS.map(({ dayOfWeek, label }) => {
              const schedule = byDay.get(dayOfWeek)
              return (
                <WeekdayRow
                  key={dayOfWeek}
                  dayOfWeek={dayOfWeek}
                  label={label}
                  schedule={schedule}
                  onSaved={(message) => {
                    setFeedback({ variant: 'success', message })
                    regular.retry()
                  }}
                  onError={(message) => setFeedback({ variant: 'error', message })}
                />
              )
            })}
          </tbody>
        </table>
      </div>
    )
  }

  const renderExceptions = () => {
    if (exceptions.status === 'error') {
      return <MessageBox variant="error">No se pudieron cargar las excepciones.</MessageBox>
    }
    if (!exceptions.data) {
      return <Spinner label="Cargando excepciones..." />
    }
    if (exceptions.data.length === 0) {
      return <p className="admin-empty">No hay fechas bloqueadas ni horarios especiales próximos.</p>
    }
    return (
      <ul className="admin-exception-list">
        {exceptions.data.map((item) => (
          <li key={item.id}>
            <div>
              <strong>{formatStudioLongDate(item.specific_date ?? '')}</strong>
              <span className={item.is_available ? 'lm-badge lm-badge--completed' : 'lm-badge lm-badge--cancelled'}>
                {item.is_available ? `Horario especial: ${hoursLabel(item)}` : 'Cerrado todo el día'}
              </span>
            </div>
            <button type="button" className="admin-btn admin-btn--danger" onClick={() => setDeleteTarget(item)}>
              Quitar
            </button>
          </li>
        ))}
      </ul>
    )
  }

  return (
    <>
      {feedback ? <MessageBox variant={feedback.variant}>{feedback.message}</MessageBox> : null}

      <section className="admin-section" aria-labelledby="admin-week-title">
        <h2 id="admin-week-title" className="admin-section__title">
          <i className="fas fa-clock" aria-hidden="true" /> Horario semanal
        </h2>
        <p className="admin-section__hint">
          Franjas de atención por día. La turnera ofrece turnos dentro de estas franjas, cada 30
          minutos, según la duración de cada servicio.
        </p>
        {renderWeek()}
      </section>

      <section className="admin-section" aria-labelledby="admin-exceptions-title">
        <h2 id="admin-exceptions-title" className="admin-section__title">
          <i className="fas fa-calendar-times" aria-hidden="true" /> Fechas especiales
        </h2>
        <p className="admin-section__hint">
          Bloqueá feriados o vacaciones, o definí un horario distinto para un día puntual. La
          excepción reemplaza al horario semanal de esa fecha.
        </p>

        <form className="admin-form admin-exception-form" onSubmit={(event) => void handleCreateException(event)} noValidate>
          <div>
            <label htmlFor="exception-date">Fecha</label>
            <input
              id="exception-date"
              type="date"
              min={today}
              value={exceptionDate}
              onChange={(event) => {
                setExceptionDate(event.target.value)
                setExceptionError(null)
              }}
            />
          </div>
          <fieldset className="admin-form__options">
            <legend>Tipo</legend>
            <label className="admin-form__option">
              <input type="radio" name="exception-kind" checked={exceptionKind === 'closed'} onChange={() => setExceptionKind('closed')} />
              Cerrado todo el día
            </label>
            <label className="admin-form__option">
              <input type="radio" name="exception-kind" checked={exceptionKind === 'special'} onChange={() => setExceptionKind('special')} />
              Horario especial
            </label>
          </fieldset>
          {exceptionKind === 'special' ? (
            <div className="admin-time-range">
              <input type="time" aria-label="Apertura" value={exceptionStart} onChange={(event) => setExceptionStart(event.target.value)} />
              <span>a</span>
              <input type="time" aria-label="Cierre" value={exceptionEnd} onChange={(event) => setExceptionEnd(event.target.value)} />
            </div>
          ) : null}
          <button type="submit" className="btn btn-rosa" disabled={isSavingException}>
            {isSavingException ? 'Guardando...' : 'Agregar fecha'}
          </button>
          {exceptionError ? (
            <small className="admin-form__error" role="alert">
              {exceptionError}
            </small>
          ) : null}
        </form>

        {renderExceptions()}
      </section>

      <ConfirmModal
        open={deleteTarget !== null}
        icon="📅"
        title="¿Quitar fecha especial?"
        confirmLabel="Sí, quitar"
        onConfirm={() => void handleDeleteException()}
        onCancel={() => setDeleteTarget(null)}
      >
        {deleteTarget ? `${formatStudioLongDate(deleteTarget.specific_date ?? '')} volverá a usar el horario semanal.` : ''}
      </ConfirmModal>
    </>
  )
}
