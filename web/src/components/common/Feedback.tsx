import type { ReactNode } from 'react'
import './Feedback.css'

interface SpinnerProps {
  label?: string
  size?: 'small' | 'large'
}

export function Spinner({ label, size = 'small' }: SpinnerProps) {
  return (
    <div className="lm-loading" role="status" aria-live="polite">
      <span
        className={size === 'large' ? 'lm-spinner lm-spinner--large' : 'lm-spinner'}
        aria-hidden="true"
      />
      {label ? <span>{label}</span> : <span className="lm-visually-hidden">Cargando</span>}
    </div>
  )
}

export type MessageVariant = 'info' | 'success' | 'warning' | 'error'

const MESSAGE_ICONS: Record<MessageVariant, string> = {
  info: 'fas fa-info-circle',
  success: 'fas fa-check-circle',
  warning: 'fas fa-exclamation-triangle',
  error: 'fas fa-times-circle',
}

interface MessageBoxProps {
  variant: MessageVariant
  children: ReactNode
}

/** Caja de mensaje (`.message-box` de turnera.html / `.alert` de pago.html). */
export function MessageBox({ variant, children }: MessageBoxProps) {
  return (
    <div
      className={`lm-message lm-message--${variant}`}
      role={variant === 'error' || variant === 'warning' ? 'alert' : 'status'}
    >
      <i className={MESSAGE_ICONS[variant]} aria-hidden="true" />
      <div>{children}</div>
    </div>
  )
}

interface LoadingOverlayProps {
  title: string
  subtitle?: string
}

/** Overlay a pantalla completa mientras se procesa un pago (pago.html). */
export function LoadingOverlay({ title, subtitle }: LoadingOverlayProps) {
  return (
    <div className="lm-loading-overlay" role="status" aria-live="assertive">
      <div className="lm-loading-overlay__content">
        <span className="lm-spinner lm-spinner--large" aria-hidden="true" />
        <h3>{title}</h3>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>
    </div>
  )
}
