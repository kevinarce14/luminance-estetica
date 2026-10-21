import {
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import {
  AppointmentStatus,
  PaymentStatus,
  type User,
} from '../../generated/prisma/client';
import { MailService } from '../../mail/mail.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AvailabilityService } from '../availability/availability.service';
import { StudioClock } from '../availability/studio-clock';
import { MercadoPagoClient } from './mercadopago/mercadopago.client';
import type {
  PreferenceRequest,
  PreferenceResponse,
} from './mercadopago/mercadopago.interfaces';
import { parseNotification, PaymentsService } from './payments.service';

const NOW = new Date('2026-10-20T15:00:00Z');
const client = { id: 7, email: 'lucia@example.com', fullName: 'Lucía' } as User;

function appointment(overrides: object = {}) {
  return {
    id: 12,
    userId: 7,
    status: AppointmentStatus.PENDING,
    appointmentDate: new Date('2026-10-22T13:00:00Z'),
    service: {
      id: 1,
      name: 'Lifting de Pestañas',
      price: 15000,
      durationMinutes: 60,
    },
    payment: null,
    ...overrides,
  };
}

describe('parseNotification', () => {
  const parse = (query: Record<string, string>, body: unknown) =>
    parseNotification({
      query,
      body,
      signature: undefined,
      requestId: undefined,
    });

  it('Webhooks: body { type, data.id } o query ?type=payment&data.id=', () => {
    expect(parse({}, { type: 'payment', data: { id: 123 } })).toEqual({
      topic: 'payment',
      paymentId: '123',
    });
    expect(parse({ type: 'payment', 'data.id': '456' }, {})).toEqual({
      topic: 'payment',
      paymentId: '456',
    });
  });

  it('IPN: ?topic=payment&id= o body { resource, topic }', () => {
    expect(parse({ topic: 'payment', id: '789' }, {})).toEqual({
      topic: 'payment',
      paymentId: '789',
    });
    expect(
      parse(
        {},
        {
          topic: 'payment',
          resource: 'https://api.mercadopago.com/v1/payments/321',
        },
      ),
    ).toEqual({ topic: 'payment', paymentId: '321' });
  });

  it('otros tópicos (merchant_order) no son pagos', () => {
    expect(parse({ topic: 'merchant_order', id: '1' }, {}).topic).toBe(
      'merchant_order',
    );
  });
});

describe('PaymentsService.createPreference', () => {
  const prisma = {
    appointment: { findUnique: jest.fn() },
    payment: { upsert: jest.fn() },
  };
  const mercadoPago = {
    isConfigured: jest.fn<boolean, []>(),
    createPreference: jest.fn<
      Promise<PreferenceResponse>,
      [PreferenceRequest]
    >(),
  };
  const sentPreference = (): PreferenceRequest =>
    mercadoPago.createPreference.mock.calls[0][0];
  const availability = { getBusyIntervals: jest.fn() };

  async function build(env: Record<string, string | undefined>) {
    const config = { get: (key: string) => env[key] };
    const moduleRef = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: PrismaService, useValue: prisma },
        { provide: MercadoPagoClient, useValue: mercadoPago },
        { provide: AvailabilityService, useValue: availability },
        { provide: StudioClock, useValue: { now: () => NOW } },
        { provide: MailService, useValue: {} },
        { provide: ConfigService, useValue: config },
      ],
    }).compile();
    return moduleRef.get(PaymentsService);
  }

  beforeEach(() => {
    jest.resetAllMocks();
    mercadoPago.isConfigured.mockReturnValue(true);
    availability.getBusyIntervals.mockResolvedValue([]);
    mercadoPago.createPreference.mockResolvedValue({
      id: 'pref-1',
      init_point: 'https://mp/checkout?pref=pref-1',
    });
  });

  it('cobra el precio del servicio, no el monto que envía el cliente', async () => {
    const payments = await build({ FRONTEND_URL: 'http://localhost:5173' });
    prisma.appointment.findUnique.mockResolvedValue(appointment());

    const result = await payments.createPreference(client, {
      appointment_id: 12,
      amount: 1,
    });

    const body = sentPreference();
    expect(body).toMatchObject({
      items: [
        {
          unit_price: 15000,
          title: 'Turno - Lifting de Pestañas',
          currency_id: 'ARS',
        },
      ],
      external_reference: '12',
      back_urls: {
        success: 'http://localhost:5173/pago/exitoso',
        failure: 'http://localhost:5173/pago/fallido',
        pending: 'http://localhost:5173/pago',
      },
    });
    // En local (HTTP) MercadoPago no acepta auto_return ni puede notificar a localhost.
    expect(body).not.toHaveProperty('auto_return');
    expect(body).not.toHaveProperty('notification_url');
    expect(prisma.payment.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { appointmentId: 12 },
        update: expect.objectContaining({
          amount: 15000,
          status: PaymentStatus.PENDING,
          mercadopagoPreferenceId: 'pref-1',
        }) as object,
      }),
    );
    expect(result).toEqual({
      preference_id: 'pref-1',
      init_point: 'https://mp/checkout?pref=pref-1',
      sandbox_init_point: null,
    });
  });

  it('en producción (HTTPS) agrega auto_return y la URL del webhook', async () => {
    const payments = await build({
      FRONTEND_URL: 'https://luminance-estetica.vercel.app',
      BACKEND_URL: 'https://luminance-backend.onrender.com/',
    });
    prisma.appointment.findUnique.mockResolvedValue(appointment());
    await payments.createPreference(client, {
      appointment_id: 12,
      amount: 15000,
    });
    expect(sentPreference()).toMatchObject({
      auto_return: 'approved',
      notification_url:
        'https://luminance-backend.onrender.com/api/payments/webhook?source_news=webhooks',
    });
  });

  it('no inicia el pago si el horario ya lo confirmó otro turno', async () => {
    const payments = await build({ FRONTEND_URL: 'http://localhost:5173' });
    prisma.appointment.findUnique.mockResolvedValue(appointment());
    availability.getBusyIntervals.mockResolvedValue([{ start: NOW, end: NOW }]);
    await expect(
      payments.createPreference(client, { appointment_id: 12, amount: 15000 }),
    ).rejects.toThrow(BadRequestException);
    expect(mercadoPago.createPreference).not.toHaveBeenCalled();
  });

  it('sin access token responde 503', async () => {
    const payments = await build({ FRONTEND_URL: 'http://localhost:5173' });
    mercadoPago.isConfigured.mockReturnValue(false);
    await expect(
      payments.createPreference(client, { appointment_id: 12, amount: 15000 }),
    ).rejects.toThrow(ServiceUnavailableException);
  });
});
