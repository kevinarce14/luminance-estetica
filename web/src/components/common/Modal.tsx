import { useEffect, type MouseEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import './Modal.css'

interface ModalProps {
  open: boolean
  onClose: () => void
  labelledBy: string
  size?: 'default' | 'wide'
  children: ReactNode
}

/** Modal base con overlay: cierra con Escape o al hacer clic fuera del contenido. */
export function Modal({
  open,
  onClose,
  labelledBy,
  size = 'default',
  children,
}: ModalProps) {
  useEffect(() => {
    if (!open) {
      return
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, onClose])

  if (!open) {
    return null
  }

  const handleOverlayClick = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) {
      onClose()
    }
  }

  return createPortal(
    <div className="lm-modal" role="presentation" onClick={handleOverlayClick}>
      <div
        className={
          size === 'wide'
            ? 'lm-modal__content lm-modal__content--wide'
            : 'lm-modal__content'
        }
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
      >
        {children}
      </div>
    </div>,
    document.body,
  )
}
