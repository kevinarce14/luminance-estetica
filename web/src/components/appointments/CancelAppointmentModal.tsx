import { useState, type FormEvent } from 'react'
import { Modal } from '../common/Modal.tsx'
import './Appointments.css'

const MIN_REASON_LENGTH = 5
const MAX_REASON_LENGTH = 500

interface CancelAppointmentModalProps {
  /** Turno a cancelar; null = modal cerrado. */
  appointmentLabel: string | null
  isSubmitting: boolean
  onConfirm: (reason: string) => void
  onClose: () => void
}

/** Reemplaza el `prompt()` del legado: pide el motivo (5–500 caracteres, regla del backend). */
export function CancelAppointmentModal({
  appointmentLabel,
  isSubmitting,
  onConfirm,
  onClose,
}: CancelAppointmentModalProps) {
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)

  const handleClose = () => {
    if (isSubmitting) {
      return
    }
    setReason('')
    setError(null)
    onClose()
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const trimmed = reason.trim()
    if (trimmed.length < MIN_REASON_LENGTH) {
      setError(`El motivo debe tener al menos ${MIN_REASON_LENGTH} caracteres.`)
      return
    }
    setError(null)
    onConfirm(trimmed)
  }

  return (
    <Modal open={appointmentLabel !== null} onClose={handleClose} labelledBy="cancel-modal-title">
      <div className="lm-modal__icon" aria-hidden="true">
        🗓️
      </div>
      <h2 id="cancel-modal-title">¿Cancelar turno?</h2>
      <p>{appointmentLabel}</p>
      <form onSubmit={handleSubmit} noValidate>
        <label className="lm-cancel__label" htmlFor="cancel-reason">
          Motivo de la cancelación
        </label>
        <textarea
          id="cancel-reason"
          className="lm-cancel__textarea"
          value={reason}
          maxLength={MAX_REASON_LENGTH}
          placeholder="Ej: Surgió un imprevisto y no podré asistir"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? 'cancel-reason-error' : undefined}
          disabled={isSubmitting}
          onChange={(event) => setReason(event.target.value)}
        />
        {error ? (
          <small id="cancel-reason-error" className="lm-cancel__error">
            {error}
          </small>
        ) : null}
        <div className="lm-modal__actions">
          <button
            type="button"
            className="lm-modal__btn lm-modal__btn--cancel"
            onClick={handleClose}
            disabled={isSubmitting}
          >
            Volver
          </button>
          <button
            type="submit"
            className="lm-modal__btn lm-modal__btn--confirm"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Cancelando...' : 'Sí, cancelar'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
