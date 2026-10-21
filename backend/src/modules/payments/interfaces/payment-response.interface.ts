import type { Payment } from '../../../generated/prisma/client';

/** Pago tal como lo expone la API (schema PaymentResponse). Estados y métodos en minúsculas. */
export interface PaymentResponse {
  id: number;
  appointment_id: number;
  user_id: number;
  amount: number;
  currency: string;
  payment_method: string;
  status: string;
  mercadopago_id: string | null;
  mercadopago_preference_id: string | null;
  transaction_id: string | null;
  payment_details: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string | null;
  approved_at: string | null;
}

export function toPaymentResponse(payment: Payment): PaymentResponse {
  return {
    id: payment.id,
    appointment_id: payment.appointmentId,
    user_id: payment.userId,
    amount: payment.amount,
    currency: payment.currency,
    payment_method: payment.paymentMethod.toLowerCase(),
    status: payment.status.toLowerCase(),
    mercadopago_id: payment.mercadopagoId,
    mercadopago_preference_id: payment.mercadopagoPreferenceId,
    transaction_id: payment.transactionId,
    payment_details: payment.paymentDetails,
    error_message: payment.errorMessage,
    created_at: payment.createdAt.toISOString(),
    updated_at: payment.updatedAt?.toISOString() ?? null,
    approved_at: payment.approvedAt?.toISOString() ?? null,
  };
}
