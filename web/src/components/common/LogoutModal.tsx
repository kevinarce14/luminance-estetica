import { Modal } from './Modal.tsx'

interface LogoutModalProps {
  open: boolean
  onCancel: () => void
  onConfirm: () => void
}

export function LogoutModal({ open, onCancel, onConfirm }: LogoutModalProps) {
  return (
    <Modal open={open} onClose={onCancel} labelledBy="logout-modal-title">
      <div className="lm-modal__icon" aria-hidden="true">
        👋
      </div>
      <h2 id="logout-modal-title">¿Cerrar sesión?</h2>
      <p>
        ¿Estás segura de que querés salir? Siempre podés volver cuando quieras.
      </p>
      <div className="lm-modal__actions">
        <button
          type="button"
          className="lm-modal__btn lm-modal__btn--cancel"
          onClick={onCancel}
        >
          Quedarme
        </button>
        <button
          type="button"
          className="lm-modal__btn lm-modal__btn--confirm"
          onClick={onConfirm}
        >
          Sí, salir
        </button>
      </div>
    </Modal>
  )
}
