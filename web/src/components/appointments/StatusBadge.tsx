import type { AppointmentStatus } from '../../types/appointment.ts'
import type { PaymentMethod, PaymentStatus } from '../../types/payment.ts'
import {
  APPOINTMENT_STATUS_BADGES,
  PAYMENT_METHOD_LABELS,
  PAYMENT_STATUS_LABELS,
} from '../../utils/payments.ts'
import './Appointments.css'

export function AppointmentStatusBadge({ status }: { status: AppointmentStatus }) {
  return (
    <span className={`lm-badge lm-badge--${status}`}>{APPOINTMENT_STATUS_BADGES[status]}</span>
  )
}

interface PaymentBadgeProps {
  status: PaymentStatus | null | undefined
  method?: PaymentMethod | null
}

/** Estado del pago; sin pago registrado muestra "Sin pago". */
export function PaymentBadge({ status, method }: PaymentBadgeProps) {
  if (!status) {
    return <span className="lm-badge lm-badge--no-payment">Sin pago</span>
  }

  const methodLabel = method ? ` · ${PAYMENT_METHOD_LABELS[method]}` : ''
  return (
    <span className={`lm-badge lm-badge--payment-${status}`}>
      {PAYMENT_STATUS_LABELS[status]}
      {methodLabel}
    </span>
  )
}
