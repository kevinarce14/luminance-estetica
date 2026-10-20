import { useState, type FormEvent } from 'react'
import type { ManualPaymentMethod, ManualPaymentPayload } from '../../types/admin.ts'
import { PaymentMethod } from '../../types/payment.ts'
import { formatPrice } from '../../utils/formatters.ts'
import { Modal } from '../common/Modal.tsx'

const MAX_REFERENCE = 255

interface ManualPaymentModalProps {
  appointmentId: number
  description: string
  amount: number
  isSubmitting: boolean
  onConfirm: (payload: ManualPaymentPayload) => void
  onClose: () => void
}

/** Registrar un pago manual aprobado: efectivo en el estudio o transferencia con comprobante. */
export function ManualPaymentModal({
  appointmentId,
  description,
  amount,
  isSubmitting,
  onConfirm,
  onClose,
}: ManualPaymentModalProps) {
  const [method, setMethod] = useState<ManualPaymentMethod>(PaymentMethod.CASH)
  const [reference, setReference] = useState('')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const trimmedReference = reference.trim()
    if (method === PaymentMethod.TRANSFER && !trimmedReference) {
      setError('Ingresá el número de operación o comprobante de la transferencia.')
      return
    }
    onConfirm({
      appointment_id: appointmentId,
      payment_method: method,
      ...(trimmedReference ? { reference: trimmedReference } : {}),
      ...(notes.trim() ? { notes: notes.trim() } : {}),
    })
  }

  return (
    <Modal open onClose={onClose} labelledBy="manual-payment-title">
      <div className="lm-modal__icon" aria-hidden="true">
        💵
      </div>
      <h2 id="manual-payment-title">Registrar pago</h2>
      <p>
        {description} · <strong>{formatPrice(amount)}</strong>
      </p>
      <form className="admin-form" onSubmit={handleSubmit} noValidate>
        <fieldset className="admin-form__options">
          <legend>Medio de pago</legend>
          {[
            { value: PaymentMethod.CASH, label: 'Efectivo en el estudio' },
            { value: PaymentMethod.TRANSFER, label: 'Transferencia bancaria' },
          ].map((option) => (
            <label key={option.value} className="admin-form__option">
              <input
                type="radio"
                name="manual-payment-method"
                value={option.value}
                checked={method === option.value}
                onChange={() => {
                  setMethod(option.value as ManualPaymentMethod)
                  setError(null)
                }}
              />
              {option.label}
            </label>
          ))}
        </fieldset>

        {method === PaymentMethod.TRANSFER ? (
          <>
            <label htmlFor="manual-payment-reference">Nro. de operación / comprobante</label>
            <input
              id="manual-payment-reference"
              value={reference}
              maxLength={MAX_REFERENCE}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? 'manual-payment-error' : undefined}
              onChange={(event) => {
                setReference(event.target.value)
                setError(null)
              }}
            />
          </>
        ) : null}
        {error ? (
          <small id="manual-payment-error" className="admin-form__error">
            {error}
          </small>
        ) : null}

        <label htmlFor="manual-payment-notes">Notas (opcional)</label>
        <textarea
          id="manual-payment-notes"
          value={notes}
          maxLength={500}
          onChange={(event) => setNotes(event.target.value)}
        />

        <div className="lm-modal__actions">
          <button type="button" className="lm-modal__btn lm-modal__btn--cancel" onClick={onClose} disabled={isSubmitting}>
            Volver
          </button>
          <button type="submit" className="lm-modal__btn lm-modal__btn--confirm" disabled={isSubmitting}>
            {isSubmitting ? 'Registrando...' : 'Registrar y confirmar turno'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
