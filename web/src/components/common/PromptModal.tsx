import { useState, type FormEvent } from 'react'
import { Modal } from './Modal.tsx'

interface PromptModalProps {
  icon: string
  title: string
  description: string
  label: string
  placeholder?: string
  confirmLabel: string
  required?: boolean
  maxLength?: number
  onConfirm: (value: string) => void
  onClose: () => void
}

/** Modal con un campo de texto (reemplaza los `prompt()` del legado). Montarlo con `key` para reiniciar. */
export function PromptModal({
  icon,
  title,
  description,
  label,
  placeholder,
  confirmLabel,
  required = false,
  maxLength = 500,
  onConfirm,
  onClose,
}: PromptModalProps) {
  const [value, setValue] = useState('')
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const trimmed = value.trim()
    if (required && !trimmed) {
      setError('Este campo es obligatorio.')
      return
    }
    onConfirm(trimmed)
  }

  return (
    <Modal open onClose={onClose} labelledBy="prompt-modal-title">
      <div className="lm-modal__icon" aria-hidden="true">
        {icon}
      </div>
      <h2 id="prompt-modal-title">{title}</h2>
      <p>{description}</p>
      <form onSubmit={handleSubmit} noValidate>
        <label className="lm-cancel__label" htmlFor="prompt-modal-value">
          {label}
        </label>
        <textarea
          id="prompt-modal-value"
          className="lm-cancel__textarea"
          value={value}
          maxLength={maxLength}
          placeholder={placeholder}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? 'prompt-modal-error' : undefined}
          onChange={(event) => {
            setValue(event.target.value)
            setError(null)
          }}
        />
        {error ? (
          <small id="prompt-modal-error" className="lm-cancel__error">
            {error}
          </small>
        ) : null}
        <div className="lm-modal__actions">
          <button type="button" className="lm-modal__btn lm-modal__btn--cancel" onClick={onClose}>
            Volver
          </button>
          <button type="submit" className="lm-modal__btn lm-modal__btn--confirm">
            {confirmLabel}
          </button>
        </div>
      </form>
    </Modal>
  )
}
