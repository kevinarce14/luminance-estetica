import { AppointmentStatus } from '../types/appointment.ts'
import {
  PaymentMethod,
  PaymentStatus,
  type MercadoPagoReturnParams,
} from '../types/payment.ts'

/** Estados con los que MercadoPago puede volver a las back_urls. */
const MP_APPROVED_STATUSES = ['approved']
const MP_FAILED_STATUSES = ['rejected', 'failure', 'cancelled', 'null']
const MP_PENDING_STATUSES = ['pending', 'in_process']

export const APPOINTMENT_STATUS_LABELS: Record<AppointmentStatus, string> = {
  [AppointmentStatus.PENDING]: 'Pendiente de Pago',
  [AppointmentStatus.CONFIRMED]: 'Confirmado',
  [AppointmentStatus.COMPLETED]: 'Completado',
  [AppointmentStatus.CANCELLED]: 'Cancelado',
}

/** Etiquetas cortas para badges (mis-turnos.html / admin-dashboard.html). */
export const APPOINTMENT_STATUS_BADGES: Record<AppointmentStatus, string> = {
  [AppointmentStatus.PENDING]: '⏳ Pendiente',
  [AppointmentStatus.CONFIRMED]: '✓ Confirmado',
  [AppointmentStatus.COMPLETED]: '★ Completado',
  [AppointmentStatus.CANCELLED]: '✗ Cancelado',
}

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  [PaymentStatus.PENDING]: 'Pago pendiente',
  [PaymentStatus.APPROVED]: 'Pagado',
  [PaymentStatus.REJECTED]: 'Pago rechazado',
  [PaymentStatus.CANCELLED]: 'Pago cancelado',
  [PaymentStatus.REFUNDED]: 'Reembolsado',
}

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  [PaymentMethod.MERCADOPAGO]: 'Mercado Pago',
  [PaymentMethod.CASH]: 'Efectivo',
  [PaymentMethod.TRANSFER]: 'Transferencia',
}

/** ID entero positivo a partir de un query param, o null. */
export function parseAppointmentId(value: string | null): number | null {
  if (value === null || !/^\d+$/.test(value)) {
    return null
  }
  const id = Number(value)
  return id > 0 ? id : null
}

/** MP vuelve con ?collection_status=…&external_reference=APPOINTMENT_ID&collection_id=PAYMENT_ID. */
export function readMercadoPagoReturn(params: URLSearchParams): MercadoPagoReturnParams {
  return {
    appointmentId: parseAppointmentId(params.get('external_reference')),
    status: params.get('collection_status') ?? params.get('status'),
    paymentId: params.get('collection_id') ?? params.get('payment_id'),
  }
}

export function isMercadoPagoApproved(status: string | null): boolean {
  return status !== null && MP_APPROVED_STATUSES.includes(status)
}

export function isMercadoPagoFailed(status: string | null): boolean {
  return status !== null && MP_FAILED_STATUSES.includes(status)
}

export function isMercadoPagoPending(status: string | null): boolean {
  return status !== null && MP_PENDING_STATUSES.includes(status)
}
