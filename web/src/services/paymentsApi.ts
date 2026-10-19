import {
  PaymentMethod,
  type MercadoPagoPreference,
  type Payment,
  type PaymentPreferencePayload,
} from '../types/payment.ts'
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

/** POST /payments/cash-payment — solo admin: pago en efectivo aprobado y turno confirmado. */
export function createCashPayment(appointmentId: number): Promise<Payment> {
  return apiRequest<Payment>('/payments/cash-payment', {
    method: 'POST',
    body: { appointment_id: appointmentId },
  })
}
