import { PaymentStatus } from '../../generated/prisma/client';
import type { MercadoPagoPayment } from './mercadopago/mercadopago.interfaces';
import { canAdminTransition, decideWebhookUpdate } from './payment-transitions';

const pending = {
  status: PaymentStatus.PENDING,
  amount: 15000,
  mercadopagoId: null,
};
const approved = {
  status: PaymentStatus.APPROVED,
  amount: 15000,
  mercadopagoId: '900',
};
const mp = (overrides: Partial<MercadoPagoPayment>): MercadoPagoPayment => ({
  id: 900,
  status: 'approved',
  external_reference: '12',
  transaction_amount: 15000,
  ...overrides,
});

describe('canAdminTransition', () => {
  it('replica las transiciones manuales del legado', () => {
    const { PENDING, APPROVED, REJECTED, CANCELLED, REFUNDED } = PaymentStatus;
    expect(canAdminTransition(PENDING, APPROVED)).toBe(true);
    expect(canAdminTransition(PENDING, REJECTED)).toBe(true);
    expect(canAdminTransition(PENDING, CANCELLED)).toBe(true);
    expect(canAdminTransition(APPROVED, REFUNDED)).toBe(true);
    expect(canAdminTransition(REJECTED, APPROVED)).toBe(false);
    expect(canAdminTransition(APPROVED, REJECTED)).toBe(false);
    expect(canAdminTransition(REFUNDED, APPROVED)).toBe(false);
  });
});

describe('decideWebhookUpdate', () => {
  it('aprueba un pago pendiente acreditado por el monto completo', () => {
    expect(decideWebhookUpdate(pending, mp({}))).toEqual({ action: 'approve' });
  });

  it('es idempotente: una notificación repetida no vuelve a aprobar', () => {
    expect(decideWebhookUpdate(approved, mp({}))).toMatchObject({
      action: 'ignore',
    });
  });

  it('un monto menor al precio queda pendiente para revisión', () => {
    const decision = decideWebhookUpdate(
      pending,
      mp({ transaction_amount: 1 }),
    );
    expect(decision).toMatchObject({ action: 'flag' });
    expect(decision.action === 'flag' && decision.errorMessage).toMatch(
      /acreditó \$1, menos que el precio del turno \(\$15000\)/,
    );
  });

  it('rechazado o cancelado: actualiza un pago pendiente con el motivo', () => {
    expect(
      decideWebhookUpdate(
        pending,
        mp({
          status: 'rejected',
          status_detail: 'cc_rejected_insufficient_amount',
        }),
      ),
    ).toEqual({
      action: 'update',
      status: PaymentStatus.REJECTED,
      errorMessage: 'cc_rejected_insufficient_amount',
    });
    expect(decideWebhookUpdate(pending, mp({ status: 'cancelled' }))).toEqual({
      action: 'update',
      status: PaymentStatus.CANCELLED,
      errorMessage: null,
    });
  });

  it('un intento rechazado que llega tarde no pisa un pago aprobado', () => {
    expect(
      decideWebhookUpdate(approved, mp({ id: 901, status: 'rejected' })),
    ).toMatchObject({ action: 'ignore' });
  });

  it('reembolso o contracargo solo del mismo pago aprobado', () => {
    expect(decideWebhookUpdate(approved, mp({ status: 'refunded' }))).toEqual({
      action: 'update',
      status: PaymentStatus.REFUNDED,
      errorMessage: null,
    });
    expect(
      decideWebhookUpdate(approved, mp({ status: 'charged_back' })),
    ).toMatchObject({ action: 'update', status: PaymentStatus.REFUNDED });
    expect(
      decideWebhookUpdate(approved, mp({ id: 777, status: 'refunded' })),
    ).toMatchObject({ action: 'ignore' });
    expect(
      decideWebhookUpdate(pending, mp({ status: 'refunded' })),
    ).toMatchObject({
      action: 'ignore',
    });
  });

  it('en proceso: solo registra el ID de MercadoPago', () => {
    for (const status of ['pending', 'in_process', 'authorized'] as const) {
      expect(decideWebhookUpdate(pending, mp({ status }))).toEqual({
        action: 'track',
      });
    }
  });
});
