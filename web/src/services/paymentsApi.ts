import {
  PaymentMethod,
  type MercadoPagoPreference,
  type Payment,
  type PaymentPreferencePayload,
} from '../types/payment.ts'
import type { ManualPaymentPayload, PaymentStatusUpdatePayload } from '../types/admin.ts'
import { apiRequest } from './apiClient.ts'

/** POST /payments/create-preference — devuelve la URL de checkout de MercadoPago. */
export function createPaymentPreference(
  appointmentId: number,
  amount: number,
): Promise<MercadoPagoPreference> {
  const payload: PaymentPreferencePayload = {
    appointment_id: appointmentId,
    amount,
    currency: 'ARS',
    payment_method: PaymentMethod.MERCADOPAGO,
  }
  return apiRequest<MercadoPagoPreference>('/payments/create-preference', {
    method: 'POST',
    body: payload,
  })
}

/** POST /payments/cash-payment — solo admin: pago manual aprobado (efectivo o transferencia) y turno confirmado. */
export function createManualPayment(payload: ManualPaymentPayload): Promise<Payment> {
  return apiRequest<Payment>('/payments/cash-payment', { method: 'POST', body: payload })
}

/** Atajo: pago en efectivo (turnos presenciales y "Confirmar (Efectivo)" de la agenda). */
export function createCashPayment(appointmentId: number): Promise<Payment> {
  return createManualPayment({ appointment_id: appointmentId, payment_method: PaymentMethod.CASH })
}

/** PUT /payments/{id}/status — aprobar, rechazar o reembolsar (transiciones validadas en el backend). */
export function updatePaymentStatus(
  paymentId: number,
  payload: PaymentStatusUpdatePayload,
): Promise<Payment> {
  return apiRequest<Payment>(`/payments/${paymentId}/status`, { method: 'PUT', body: payload })
}
