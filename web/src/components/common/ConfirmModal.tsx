import type { ReactNode } from 'react'
import { Modal } from './Modal.tsx'

interface ConfirmModalProps {
  open: boolean
  icon: string
  title: string
  children: ReactNode
  confirmLabel: string
  cancelLabel?: string
  onConfirm: () => void
  onCancel: () => void
}

/** Confirmación genérica con el estilo de LogoutModal (reemplaza los `confirm()` del legado). */
export function ConfirmModal({
  open,
  icon,
  title,
  children,
  confirmLabel,
  cancelLabel = 'Volver',
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  return (
    <Modal open={open} onClose={onCancel} labelledBy="confirm-modal-title">
      <div className="lm-modal__icon" aria-hidden="true">
        {icon}
      </div>
      <h2 id="confirm-modal-title">{title}</h2>
      <p>{children}</p>
      <div className="lm-modal__actions">
        <button
          type="button"
          className="lm-modal__btn lm-modal__btn--cancel"
          onClick={onCancel}
        >
          {cancelLabel}
        </button>
        <button
          type="button"
          className="lm-modal__btn lm-modal__btn--confirm"
          onClick={onConfirm}
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  )
}
