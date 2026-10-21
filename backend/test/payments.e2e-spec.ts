import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { addDays, weekdayOf, zonedToday } from '../src/common/time/zoned-time';
import { MailService } from '../src/mail/mail.service';
import { PasswordService } from '../src/modules/users/password.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { FakeMercadoPago, signWebhook } from './support/fake-mercadopago';

/**
 * Pagos de punta a punta: turno → preferencia (MercadoPago simulado por HTTP) →
 * webhook firmado → turno confirmado; pagos manuales y acciones del admin.
 */

const TZ = 'America/Argentina/Buenos_Aires';
const EMAIL_DOMAIN = '@e2e-pay.example.com';
const SECRET = process.env.MERCADOPAGO_WEBHOOK_SECRET ?? '';

function openDay(fromOffset: number): string {
  let day = addDays(zonedToday(TZ), fromOffset);
  while (weekdayOf(day) === 0) day = addDays(day, 1);
  return day;
}
const DAY = openDay(18);
const local = (time: string) => `${DAY}T${time}:00-03:00`;

interface PaymentBody {
  id: number;
  appointment_id: number;
  user_id: number;
  amount: number;
  payment_method: string;
  status: string;
  mercadopago_id: string | null;
  mercadopago_preference_id: string | null;
  payment_details: string | null;
  error_message: string | null;
  approved_at: string | null;
}
interface AppointmentDetails {
  id: number;
  status: string;
  payment: PaymentBody | null;
}
type Who = 'ana' | 'bruno' | 'admin';

const mail = {
  sendWelcome: jest.fn(() => Promise.resolve(true)),
  sendPasswordReset: jest.fn(() => Promise.resolve(true)),
  sendPasswordChanged: jest.fn(() => Promise.resolve(true)),
  sendAppointmentCancelled: jest.fn(() => Promise.resolve(true)),
  sendAppointmentRescheduled: jest.fn(() => Promise.resolve(true)),
  sendPaymentConfirmed: jest.fn(() => Promise.resolve(true)),
};

describe('Pagos (e2e)', () => {
  const mercadoPago = new FakeMercadoPago(
    4799,
    process.env.MERCADOPAGO_ACCESS_TOKEN ?? '',
  );
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const tokens: Record<Who, string> = { ana: '', bruno: '', admin: '' };
  const emails: Record<Who, string> = { ana: '', bruno: '', admin: '' };
  let lifting: number; // $15.000, 60 min
  let henna: number; // $8.000, 30 min
  let mpSequence = 5000;

  const http = () => request(app.getHttpServer());
  const as = (who: Who) => ({ Authorization: `Bearer ${tokens[who]}` });

  async function book(
    who: Who,
    serviceId: number,
    time: string,
  ): Promise<number> {
    const response = await http()
      .post('/api/appointments/')
      .set(as(who))
      .send({ service_id: serviceId, appointment_date: local(time), notes: '' })
      .expect(201);
    return (response.body as { id: number }).id;
  }

  /** Lo que hace el frontend al elegir "Mercado Pago" en /pago. */
  function startCheckout(who: Who, appointmentId: number, amount = 15000) {
    return http().post('/api/payments/create-preference').set(as(who)).send({
      appointment_id: appointmentId,
      amount,
      currency: 'ARS',
      payment_method: 'mercadopago',
    });
  }

  /** MercadoPago registra un pago y notifica al webhook (formato Webhooks, firmado). */
  function notifyPayment(
    appointmentId: number,
    status: string,
    extra: Record<string, unknown> = {},
  ) {
    mpSequence += 1;
    const id = String(mpSequence);
    mercadoPago.payments.set(id, {
      id: mpSequence,
      status: status as 'approved',
      status_detail:
        status === 'approved' ? 'accredited' : 'cc_rejected_other_reason',
      external_reference: String(appointmentId),
      transaction_amount: 15000,
      payment_method_id: 'visa',
      payment_type_id: 'credit_card',
      date_approved: status === 'approved' ? new Date().toISOString() : null,
      ...extra,
    });
    return { id, send: () => sendWebhook(id) };
  }

  function sendWebhook(id: string, headers = signWebhook(SECRET, id)) {
    return http()
      .post('/api/payments/webhook')
      .query({ 'data.id': id, type: 'payment' })
      .set(headers)
      .send({ action: 'payment.updated', type: 'payment', data: { id } });
  }

  async function appointment(
    id: number,
    who: Who = 'admin',
  ): Promise<AppointmentDetails> {
    const response = await http()
      .get(`/api/appointments/${id}`)
      .set(as(who))
      .expect(200);
    return response.body as AppointmentDetails;
  }

  async function cleanUp(): Promise<void> {
    const user = { email: { endsWith: EMAIL_DOMAIN } };
    await prisma.payment.deleteMany({ where: { user } });
    await prisma.appointment.deleteMany({ where: { user } });
    await prisma.user.deleteMany({ where: user });
  }

  beforeAll(async () => {
    await mercadoPago.start();
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(MailService)
      .useValue(mail)
      .compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    await cleanUp();

    const hashed = await app.get(PasswordService).hash('Clave1234');
    for (const [who, isAdmin] of [
      ['ana', false],
      ['bruno', false],
      ['admin', true],
    ] as const) {
      emails[who] = `${who}.${Date.now()}${EMAIL_DOMAIN}`;
      await prisma.user.create({
        data: {
          email: emails[who],
          fullName: `${who} E2E`,
          hashedPassword: hashed,
          isAdmin,
        },
      });
      const login = await http()
        .post('/api/auth/login')
        .type('form')
        .send({ username: emails[who], password: 'Clave1234' })
        .expect(200);
      tokens[who] = (login.body as { access_token: string }).access_token;
    }
    const byName = async (name: string) =>
      (await prisma.service.findFirstOrThrow({ where: { name } })).id;
    lifting = await byName('Lifting de Pestañas');
    henna = await byName('Henna de Cejas');
  });

  beforeEach(() => jest.clearAllMocks());

  afterAll(async () => {
    await cleanUp();
    await app.close();
    await mercadoPago.stop();
  });

  describe('Preferencia de MercadoPago', () => {
    it('crea el checkout cobrando el precio de la base, no el monto enviado', async () => {
      const id = await book('ana', lifting, '10:00');
      await http()
        .post('/api/payments/create-preference')
        .send({ appointment_id: id, amount: 1 })
        .expect(401);

      const response = await startCheckout('ana', id, 1).expect(200);
      expect(response.body).toEqual({
        preference_id: expect.stringMatching(/^pref-\d+$/) as string,
        init_point: expect.stringContaining(
          'https://mercadopago.test/checkout?pref_id=',
        ) as string,
        sandbox_init_point: expect.any(String) as string,
      });
      expect(mercadoPago.lastPreference()).toMatchObject({
        items: [
          {
            unit_price: 15000,
            quantity: 1,
            title: 'Turno - Lifting de Pestañas',
            currency_id: 'ARS',
          },
        ],
        payer: { email: emails.ana },
        external_reference: String(id),
        back_urls: {
          success: 'http://localhost:5173/pago/exitoso',
          failure: 'http://localhost:5173/pago/fallido',
          pending: 'http://localhost:5173/pago',
        },
      });

      expect((await appointment(id, 'ana')).payment).toMatchObject({
        status: 'pending',
        amount: 15000,
        payment_method: 'mercadopago',
        mercadopago_preference_id: (response.body as { preference_id: string })
          .preference_id,
      });
    });

    it('reintentar el pago reutiliza el registro (uno por turno); alias /mercadopago/preference', async () => {
      const id = await book('ana', henna, '11:30');
      await startCheckout('ana', id).expect(200);
      await http()
        .post('/api/payments/mercadopago/preference')
        .set(as('ana'))
        .send({ appointment_id: id, amount: 8000 })
        .expect(200);
      expect(await prisma.payment.count({ where: { appointmentId: id } })).toBe(
        1,
      );
      expect(mercadoPago.lastPreference().items[0].unit_price).toBe(8000);
    });

    it('valida dueño, existencia y datos del pedido', async () => {
      const id = await book('ana', henna, '12:30');
      const foreign = await startCheckout('bruno', id).expect(403);
      expect((foreign.body as { message: string }).message).toBe(
        'Este turno no te pertenece',
      );
      await startCheckout('ana', 999999999).expect(404);
      await http()
        .post('/api/payments/create-preference')
        .set(as('ana'))
        .send({ appointment_id: id, amount: -5, payment_method: 'cash' })
        .expect(422);
    });
  });

  describe('Webhook de MercadoPago', () => {
    it('pago aprobado: acredita, confirma el turno, avisa por email y es idempotente', async () => {
      const id = await book('ana', lifting, '14:00');
      await startCheckout('ana', id).expect(200);
      const notification = notifyPayment(id, 'approved');

      const first = await notification.send().expect(200);
      expect(first.body).toEqual({ status: 'ok' });
      const confirmed = await appointment(id);
      expect(confirmed.status).toBe('confirmed');
      expect(confirmed.payment).toMatchObject({
        status: 'approved',
        mercadopago_id: notification.id,
        approved_at: expect.any(String) as string,
        error_message: null,
      });
      expect(mail.sendPaymentConfirmed).toHaveBeenCalledWith(
        emails.ana,
        'ana E2E',
        'Lifting de Pestañas',
        15000,
        expect.any(Date),
      );

      // MercadoPago reintenta: no se duplica nada.
      expect((await notification.send().expect(200)).body).toMatchObject({
        status: 'ignored',
      });
      expect(mail.sendPaymentConfirmed).toHaveBeenCalledTimes(1);

      // El horario queda ocupado y no se puede volver a pagar.
      const slots = await http()
        .post('/api/availability/available-slots')
        .send({ service_id: lifting, date: DAY })
        .expect(200);
      const at14 = (
        slots.body as {
          available_slots: Array<{ start_time: string; is_available: boolean }>;
        }
      ).available_slots.find((slot) => slot.start_time.endsWith('14:00:00'));
      expect(at14?.is_available).toBe(false);
      const again = await startCheckout('ana', id).expect(400);
      expect((again.body as { message: string }).message).toBe(
        'Este turno ya tiene un pago asociado',
      );
    });

    it('rechaza notificaciones sin firma o con firma inválida (401)', async () => {
      const id = await book('bruno', henna, '15:30');
      await startCheckout('bruno', id).expect(200);
      const notification = notifyPayment(id, 'approved');
      await sendWebhook(notification.id, {}).expect(401);
      await sendWebhook(
        notification.id,
        signWebhook('otra-clave', notification.id),
      ).expect(401);
      expect((await appointment(id)).status).toBe('pending');
    });

    it('ignora otros tópicos, informa pagos desconocidos y pide reintento si MercadoPago falla', async () => {
      const merchantOrder = await http()
        .post('/api/payments/webhook')
        .query({ topic: 'merchant_order', id: '1' })
        .send({})
        .expect(200);
      expect(merchantOrder.body).toMatchObject({ status: 'ignored' });

      // MercadoPago no conoce el pago → 502 para que reintente más tarde.
      await sendWebhook('no-existe').expect(502);

      const orphan = notifyPayment(999999999, 'approved');
      expect((await orphan.send().expect(200)).body).toEqual({
        status: 'error',
        reason: 'payment not found',
      });
    });

    it('rechazado y luego aprobado: el intento tardío rechazado no pisa la aprobación', async () => {
      const id = await book('ana', henna, '16:30');
      await startCheckout('ana', id, 8000).expect(200);
      const rejected = notifyPayment(id, 'rejected', {
        transaction_amount: 8000,
      });
      await rejected.send().expect(200);
      let current = await appointment(id);
      expect(current.status).toBe('pending');
      expect(current.payment).toMatchObject({
        status: 'rejected',
        error_message: 'cc_rejected_other_reason',
      });

      await startCheckout('ana', id, 8000).expect(200); // el cliente reintenta
      await notifyPayment(id, 'approved', { transaction_amount: 8000 })
        .send()
        .expect(200);
      await rejected.send().expect(200); // llega tarde la notificación del primer intento
      current = await appointment(id);
      expect(current.status).toBe('confirmed');
      expect(current.payment?.status).toBe('approved');
    });

    it('un monto menor al precio queda pendiente para revisión', async () => {
      const id = await book('bruno', lifting, '18:00');
      await startCheckout('bruno', id).expect(200);
      await notifyPayment(id, 'approved', { transaction_amount: 100 })
        .send()
        .expect(200);
      const current = await appointment(id);
      expect(current.status).toBe('pending');
      expect(current.payment?.status).toBe('pending');
      expect(current.payment?.error_message).toMatch(/acreditó \$100/);
      expect(mail.sendPaymentConfirmed).not.toHaveBeenCalled();
    });

    it('pago aprobado de un turno ya cancelado: se registra para reembolsar', async () => {
      const id = await book('bruno', henna, '19:30');
      await startCheckout('bruno', id, 8000).expect(200);
      await http()
        .post(`/api/appointments/${id}/cancel`)
        .set(as('bruno'))
        .send({ cancellation_reason: 'Cambio de planes' })
        .expect(200);
      await notifyPayment(id, 'approved', { transaction_amount: 8000 })
        .send()
        .expect(200);
      const current = await appointment(id);
      expect(current.status).toBe('cancelled');
      expect(current.payment?.status).toBe('approved');
      expect(current.payment?.error_message).toMatch(
        /corresponde reembolsarlo/,
      );
      expect(mail.sendPaymentConfirmed).not.toHaveBeenCalled();
    });
  });

  describe('Pagos manuales (admin)', () => {
    it('efectivo: solo admin, aprueba el pago y confirma el turno', async () => {
      const id = await book('ana', henna, '09:00');
      await http()
        .post('/api/payments/cash-payment')
        .set(as('ana'))
        .send({ appointment_id: id })
        .expect(403);

      const response = await http()
        .post('/api/payments/cash-payment')
        .set(as('admin'))
        .send({ appointment_id: id, payment_method: 'cash' })
        .expect(201);
      expect(response.body).toMatchObject({
        appointment_id: id,
        amount: 8000,
        payment_method: 'cash',
        status: 'approved',
      });
      expect((await appointment(id)).status).toBe('confirmed');
      expect(mail.sendPaymentConfirmed).toHaveBeenCalledTimes(1);
    });

    it('transferencia con comprobante (alias /payments/cash) y reutiliza una preferencia sin pagar', async () => {
      const id = await book('bruno', henna, '10:30');
      await startCheckout('bruno', id, 8000).expect(200);
      const pendingId = (await appointment(id)).payment?.id;

      const response = await http()
        .post('/api/payments/cash')
        .set(as('admin'))
        .send({
          appointment_id: id,
          payment_method: 'transfer',
          reference: 'OP-445566',
          notes: 'Seña',
        })
        .expect(201);
      expect(response.body).toMatchObject({
        id: pendingId,
        payment_method: 'transfer',
        status: 'approved',
        payment_details: 'Comprobante: OP-445566 · Seña',
      });
    });

    it('no registra pagos de turnos cancelados ni de horarios ya ocupados', async () => {
      const cancelled = await book('ana', henna, '12:00');
      await http()
        .post(`/api/appointments/${cancelled}/cancel`)
        .set(as('ana'))
        .send({ cancellation_reason: 'Ya no puedo' })
        .expect(200);
      await http()
        .post('/api/payments/cash-payment')
        .set(as('admin'))
        .send({ appointment_id: cancelled })
        .expect(400);

      // Dos turnos pendientes en el mismo horario (se permite): al cobrar uno, el otro ya no entra.
      const first = await book('ana', henna, '11:00');
      const second = await book('bruno', henna, '11:00');
      await http()
        .post('/api/payments/cash-payment')
        .set(as('admin'))
        .send({ appointment_id: first })
        .expect(201);
      const response = await http()
        .post('/api/payments/cash-payment')
        .set(as('admin'))
        .send({ appointment_id: second })
        .expect(400);
      expect((response.body as { message: string }).message).toBe(
        'Ya hay un turno confirmado que se superpone con este horario',
      );
      expect((await appointment(second)).status).toBe('pending');
    });
  });

  describe('Aprobar y rechazar desde el panel (PUT /payments/:id/status)', () => {
    it('rechazar deja el turno pendiente de pago y no admite volver a aprobar', async () => {
      const id = await book('ana', henna, '13:00');
      await startCheckout('ana', id, 8000).expect(200);
      const paymentId = (await appointment(id)).payment!.id;

      const rejected = await http()
        .put(`/api/payments/${paymentId}/status`)
        .set(as('admin'))
        .send({ status: 'rejected', notes: 'Pago no acreditado' })
        .expect(200);
      expect(rejected.body).toMatchObject({
        status: 'rejected',
        error_message: 'Pago no acreditado',
      });
      expect((await appointment(id)).status).toBe('pending');

      const invalid = await http()
        .put(`/api/payments/${paymentId}/status`)
        .set(as('admin'))
        .send({ status: 'approved' })
        .expect(400);
      expect((invalid.body as { message: string }).message).toBe(
        "No se puede pasar un pago de 'rejected' a 'approved'",
      );
    });

    it('aprobar confirma el turno; luego se puede reembolsar', async () => {
      const id = await book('ana', henna, '15:00');
      await startCheckout('ana', id, 8000).expect(200);
      const paymentId = (await appointment(id)).payment!.id;
      await http()
        .put(`/api/payments/${paymentId}/status`)
        .set(as('ana'))
        .send({ status: 'approved' })
        .expect(403);

      const approved = await http()
        .put(`/api/payments/${paymentId}/status`)
        .set(as('admin'))
        .send({ status: 'APPROVED', notes: 'Transferencia verificada' })
        .expect(200);
      expect(approved.body).toMatchObject({
        status: 'approved',
        payment_details: 'Transferencia verificada',
      });
      expect((await appointment(id)).status).toBe('confirmed');

      await http()
        .put(`/api/payments/${paymentId}/status`)
        .set(as('admin'))
        .send({ status: 'approved' })
        .expect(200);
      const refunded = await http()
        .put(`/api/payments/${paymentId}/status`)
        .set(as('admin'))
        .send({ status: 'refunded', notes: 'Reembolso por cancelación' })
        .expect(200);
      expect((refunded.body as PaymentBody).status).toBe('refunded');
    });
  });

  describe('Consultas', () => {
    it('cada cliente ve solo sus pagos; el admin ve todos', async () => {
      const mine = await http()
        .get('/api/payments/')
        .set(as('ana'))
        .expect(200);
      const list = mine.body as PaymentBody[];
      expect(list.length).toBeGreaterThan(0);
      const anaId = list[0].user_id;
      expect(list.every((payment) => payment.user_id === anaId)).toBe(true);

      await http()
        .get(`/api/payments/${list[0].id}`)
        .set(as('ana'))
        .expect(200);
      const forbidden = await http()
        .get(`/api/payments/${list[0].id}`)
        .set(as('bruno'))
        .expect(403);
      expect((forbidden.body as { message: string }).message).toBe(
        'No tienes permiso para ver este pago',
      );
      await http().get('/api/payments/999999999').set(as('ana')).expect(404);

      const approved = await http()
        .get('/api/payments/all/payments')
        .query({ status_filter: 'approved' })
        .set(as('admin'))
        .expect(200);
      expect(
        (approved.body as PaymentBody[]).every(
          (payment) => payment.status === 'approved',
        ),
      ).toBe(true);
      await http().get('/api/payments/all/payments').set(as('ana')).expect(403);
    });
  });
});
