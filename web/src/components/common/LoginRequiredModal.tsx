import { Link } from 'react-router-dom'
import { Modal } from './Modal.tsx'

interface LoginRequiredModalProps {
  open: boolean
  onClose: () => void
}

export function LoginRequiredModal({ open, onClose }: LoginRequiredModalProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      labelledBy="login-required-title"
      size="wide"
    >
      <div className="lm-modal__icon lm-modal__icon--plain" aria-hidden="true">
        🔐
      </div>
      <h2 id="login-required-title">Inicio de Sesión Requerido</h2>
      <p>
        Para reservar un turno necesitas tener una cuenta. ¡Es gratis y toma
        solo un minuto!
      </p>
      <div className="lm-modal__actions">
        <Link
          to="/login"
          className="lm-modal__btn lm-modal__btn--pill lm-modal__btn--confirm"
          onClick={onClose}
        >
          Iniciar Sesión
        </Link>
        <button
          type="button"
          className="lm-modal__btn lm-modal__btn--pill lm-modal__btn--cancel"
          onClick={onClose}
        >
          Cancelar
        </button>
      </div>
    </Modal>
  )
}
