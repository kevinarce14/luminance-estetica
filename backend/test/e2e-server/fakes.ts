import { UnauthorizedException } from '@nestjs/common';
import type { MailService } from '../../src/mail/mail.service';
import type { GoogleAuthService } from '../../src/modules/auth/google-auth.service';
import type { GoogleIdentity } from '../../src/modules/auth/interfaces/auth.interfaces';
import type { MercadoPagoClient } from '../../src/modules/payments/mercadopago/mercadopago.client';
import type {
  MercadoPagoPayment,
  PreferenceRequest,
  PreferenceResponse,
} from '../../src/modules/payments/mercadopago/mercadopago.interfaces';

/**
 * Dobles de los servicios externos para el servidor E2E (mismo comportamiento que
 * tests/support.py del harness de FastAPI): nada sale a internet.
 */

export const MP_CHECKOUT_URL = 'https://mercadopago.test/checkout';

export interface SentMail {
  to: string;
  kind: string;
  /** Token de recuperación (solo en los emails de reseteo). */
  token?: string;
}

type MailMethods = Pick<
  MailService,
  | 'sendWelcome'
  | 'sendPasswordReset'
  | 'sendPasswordChanged'
  | 'sendAppointmentCancelled'
  | 'sendAppointmentRescheduled'
  | 'sendPaymentConfirmed'
>;

/** Reemplaza a MailService: guarda los emails "enviados" para leerlos desde los tests. */
export class E2eMailbox implements MailMethods {
  readonly messages: SentMail[] = [];

  private record(to: string, kind: string, token?: string): Promise<boolean> {
    this.messages.push({ to, kind, token });
    return Promise.resolve(true);
  }

  sendWelcome(to: string): Promise<boolean> {
    return this.record(to, 'welcome');
  }
  sendPasswordReset(
    to: string,
    _name: string,
    token: string,
  ): Promise<boolean> {
    return this.record(to, 'password-reset', token);
  }
  sendPasswordChanged(to: string): Promise<boolean> {
    return this.record(to, 'password-changed');
  }
  sendAppointmentCancelled(to: string): Promise<boolean> {
    return this.record(to, 'appointment-cancelled');
  }
  sendAppointmentRescheduled(to: string): Promise<boolean> {
    return this.record(to, 'appointment-rescheduled');
  }
  sendPaymentConfirmed(to: string): Promise<boolean> {
    return this.record(to, 'payment-confirmed');
  }

  /** Token del último email de recuperación enviado a `email`. */
  resetTokenFor(email: string): string | undefined {
    return [...this.messages]
      .reverse()
      .find((message) => message.to === email && message.token)?.token;
  }

  clear(): void {
    this.messages.length = 0;
  }
}

/** Google simulado: el credential "google:<email>:<nombre>" es válido y verificado. */
export class FakeGoogleAuthService implements Pick<
  GoogleAuthService,
  'getClientId' | 'verify'
> {
  constructor(private readonly clientId: string) {}

  getClientId(): string | null {
    return this.clientId;
  }

  verify(credential: string): Promise<GoogleIdentity> {
    const [prefix, email, ...name] = credential.split(':');
    if (prefix !== 'google' || !email) {
      return Promise.reject(
        new UnauthorizedException('Token de Google inválido'),
      );
    }
    return Promise.resolve({
      email,
      name: name.join(':'),
      emailVerified: true,
    });
  }
}

/**
 * MercadoPago simulado: la preferencia lleva al checkout ficticio y el pago
 * "mp-<id del turno>" está aprobado por el precio de su preferencia.
 */
export class FakeMercadoPagoClient implements Pick<
  MercadoPagoClient,
  'isConfigured' | 'createPreference' | 'getPayment'
> {
  private readonly preferences = new Map<string, PreferenceRequest>();

  isConfigured(): boolean {
    return true;
  }

  createPreference(body: PreferenceRequest): Promise<PreferenceResponse> {
    this.preferences.set(body.external_reference, body);
    const id = `pref-test-${body.external_reference}`;
    return Promise.resolve({
      id,
      init_point: `${MP_CHECKOUT_URL}?pref=${id}`,
      sandbox_init_point: null,
    });
  }

  getPayment(paymentId: string): Promise<MercadoPagoPayment> {
    const appointmentId = paymentId.split('-').pop() ?? '';
    const preference = this.preferences.get(appointmentId);
    return Promise.resolve({
      id: paymentId,
      status: 'approved',
      status_detail: 'accredited',
      external_reference: appointmentId,
      transaction_amount: preference?.items[0]?.unit_price ?? 0,
      payment_method_id: 'visa',
      payment_type_id: 'credit_card',
      date_approved: new Date().toISOString(),
    });
  }

  clear(): void {
    this.preferences.clear();
  }
}
