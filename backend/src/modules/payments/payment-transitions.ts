import { PaymentStatus, type Payment } from '../../generated/prisma/client';
import type { MercadoPagoPayment } from './mercadopago/mercadopago.interfaces';

/** Transiciones manuales del panel admin (PUT /payments/:id/status), iguales al legado. */
const ADMIN_TRANSITIONS: Partial<Record<PaymentStatus, PaymentStatus[]>> = {
  PENDING: [
    PaymentStatus.APPROVED,
    PaymentStatus.REJECTED,
    PaymentStatus.CANCELLED,
  ],
  APPROVED: [PaymentStatus.REFUNDED],
};

export function canAdminTransition(
  from: PaymentStatus,
  to: PaymentStatus,
): boolean {
  return ADMIN_TRANSITIONS[from]?.includes(to) ?? false;
}

/** Tolerancia de redondeo al comparar el monto acreditado con el esperado. */
const AMOUNT_TOLERANCE = 0.01;

export type WebhookDecision =
  /** Acreditar el pago y confirmar el turno. */
  | { action: 'approve' }
  /** Pasar el pago a un estado final no aprobado. */
  | { action: 'update'; status: PaymentStatus; errorMessage: string | null }
  /** El pago sigue en curso: solo se registra el ID de MercadoPago. */
  | { action: 'track' }
  /** Aprobado por un monto menor al esperado: queda pendiente para revisión manual. */
  | { action: 'flag'; errorMessage: string }
  /** La notificación no cambia nada (repetida, tardía o de otro intento). */
  | { action: 'ignore'; reason: string };

/**
 * Qué hacer con una notificación de MercadoPago según el estado actual del pago.
 * Las notificaciones pueden llegar repetidas o desordenadas, y un mismo turno puede
 * tener varios intentos (tarjeta rechazada y luego aprobada): un pago aprobado nunca
 * vuelve atrás, salvo un reembolso del mismo pago de MercadoPago.
 */
export function decideWebhookUpdate(
  current: Pick<Payment, 'status' | 'amount' | 'mercadopagoId'>,
  mp: MercadoPagoPayment,
): WebhookDecision {
  const isApproved = current.status === PaymentStatus.APPROVED;
  const sameMpPayment = current.mercadopagoId === String(mp.id);

  switch (mp.status) {
    case 'approved': {
      if (isApproved) {
        return { action: 'ignore', reason: 'el pago ya estaba aprobado' };
      }
      const paid = mp.transaction_amount ?? 0;
      if (paid + AMOUNT_TOLERANCE < current.amount) {
        return {
          action: 'flag',
          errorMessage: `MercadoPago acreditó $${paid}, menos que el precio del turno ($${current.amount}). Revisar antes de confirmar.`,
        };
      }
      return { action: 'approve' };
    }
    case 'rejected':
      return isApproved
        ? {
            action: 'ignore',
            reason: 'intento rechazado de un pago ya aprobado',
          }
        : {
            action: 'update',
            status: PaymentStatus.REJECTED,
            errorMessage: mp.status_detail ?? 'Pago rechazado por MercadoPago',
          };
    case 'cancelled':
      return isApproved
        ? {
            action: 'ignore',
            reason: 'intento cancelado de un pago ya aprobado',
          }
        : {
            action: 'update',
            status: PaymentStatus.CANCELLED,
            errorMessage: null,
          };
    case 'refunded':
    case 'charged_back':
      return isApproved && sameMpPayment
        ? {
            action: 'update',
            status: PaymentStatus.REFUNDED,
            errorMessage:
              mp.status === 'charged_back'
                ? 'Contracargo iniciado en MercadoPago'
                : null,
          }
        : { action: 'ignore', reason: 'reembolso de un pago no aprobado' };
    default:
      // pending, in_process, in_mediation, authorized: todavía no hay cobro.
      return isApproved
        ? { action: 'ignore', reason: 'el pago ya estaba aprobado' }
        : { action: 'track' };
  }
}
