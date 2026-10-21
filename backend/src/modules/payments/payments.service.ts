import {
  BadGatewayException,
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AppointmentStatus,
  PaymentMethod,
  PaymentStatus,
  type Appointment,
  type Payment,
  type Service,
  type User,
} from '../../generated/prisma/client';
import {
  parseFrontendOrigins,
  type EnvironmentVariables,
} from '../../config/env.validation';
import { MailService } from '../../mail/mail.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AvailabilityService } from '../availability/availability.service';
import { StudioClock } from '../availability/studio-clock';
import {
  CreatePreferenceDto,
  ListPaymentsQueryDto,
  ManualPaymentDto,
  UpdatePaymentStatusDto,
} from './dto/payment.dto';
import type {
  MercadoPagoPreferenceResponse,
  WebhookResult,
} from './interfaces/payment-response.interface';
import {
  MercadoPagoClient,
  MercadoPagoError,
} from './mercadopago/mercadopago.client';
import type {
  MercadoPagoPayment,
  PreferenceRequest,
} from './mercadopago/mercadopago.interfaces';
import { isValidWebhookSignature } from './mercadopago/webhook-signature';
import { canAdminTransition, decideWebhookUpdate } from './payment-transitions';

type AppointmentWithService = Appointment & {
  service: Service;
  user: Pick<User, 'email' | 'fullName'>;
};

/** Datos crudos de una notificación de MercadoPago (Webhooks o IPN). */
export interface WebhookNotification {
  query: Record<string, string | undefined>;
  body: unknown;
  signature: string | undefined;
  requestId: string | undefined;
}

const SLOT_TAKEN_MESSAGE =
  'Ya hay un turno confirmado que se superpone con este horario';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private readonly frontendUrl: string;
  private readonly backendUrl: string | undefined;
  private readonly webhookSecret: string | undefined;

  constructor(
    private readonly prisma: PrismaService,
    private readonly mercadoPago: MercadoPagoClient,
    private readonly availability: AvailabilityService,
    private readonly clock: StudioClock,
    private readonly mail: MailService,
    config: ConfigService<EnvironmentVariables, true>,
  ) {
    this.frontendUrl = parseFrontendOrigins(
      config.get('FRONTEND_URL', { infer: true }),
    )[0];
    this.backendUrl =
      config.get('BACKEND_URL', { infer: true })?.trim().replace(/\/+$/, '') ||
      undefined;
    this.webhookSecret =
      config.get('MERCADOPAGO_WEBHOOK_SECRET', { infer: true })?.trim() ||
      undefined;
  }

  // =====================================================================
  // MercadoPago: preferencia de pago
  // =====================================================================

  /**
   * Crea la preferencia de checkout para un turno propio pendiente. Se cobra el precio
   * del servicio guardado en la base (el monto que envía el cliente no se usa).
   * Si el turno ya tenía un intento sin aprobar, se reutiliza ese pago (uno por turno).
   */
  async createPreference(
    user: User,
    dto: CreatePreferenceDto,
  ): Promise<MercadoPagoPreferenceResponse> {
    if (!this.mercadoPago.isConfigured()) {
      throw new ServiceUnavailableException(
        'El pago con Mercado Pago no está disponible en este momento',
      );
    }

    const appointment = await this.prisma.appointment.findUnique({
      where: { id: dto.appointment_id },
      include: { service: true, payment: true },
    });
    if (!appointment) {
      throw new NotFoundException('Turno no encontrado');
    }
    if (appointment.userId !== user.id) {
      throw new ForbiddenException('Este turno no te pertenece');
    }
    if (appointment.payment?.status === PaymentStatus.APPROVED) {
      throw new BadRequestException('Este turno ya tiene un pago asociado');
    }
    if (appointment.status !== AppointmentStatus.PENDING) {
      throw new BadRequestException(
        appointment.status === AppointmentStatus.CANCELLED
          ? 'No se puede pagar un turno cancelado'
          : 'Este turno ya no está pendiente de pago',
      );
    }
    if (appointment.appointmentDate < this.clock.now()) {
      throw new BadRequestException('El horario de este turno ya pasó');
    }
    // No dejar pagar un horario que mientras tanto confirmó otro cliente.
    if (await this.overlapsConfirmed(appointment)) {
      throw new BadRequestException(
        'Este horario ya no está disponible. Elegí otro turno.',
      );
    }

    const price = appointment.service.price;
    if (Math.abs(dto.amount - price) > 0.01) {
      this.logger.warn(
        `Turno #${appointment.id}: el cliente envió $${dto.amount}, se cobra el precio del servicio ($${price})`,
      );
    }

    let preference;
    try {
      preference = await this.mercadoPago.createPreference(
        this.buildPreference(appointment, user, price),
      );
    } catch (error) {
      if (error instanceof MercadoPagoError) {
        throw new BadGatewayException(
          'No se pudo iniciar el pago con Mercado Pago. Intentá de nuevo.',
        );
      }
      throw error;
    }

    const data = {
      userId: appointment.userId,
      amount: price,
      currency: 'ARS',
      paymentMethod: PaymentMethod.MERCADOPAGO,
      status: PaymentStatus.PENDING,
      mercadopagoPreferenceId: preference.id,
      errorMessage: null,
    };
    await this.prisma.payment.upsert({
      where: { appointmentId: appointment.id },
      create: { appointmentId: appointment.id, ...data },
      update: data,
    });

    return {
      preference_id: preference.id,
      init_point: preference.init_point,
      sandbox_init_point: preference.sandbox_init_point ?? null,
    };
  }

  private buildPreference(
    appointment: Appointment & { service: Service },
    user: User,
    price: number,
  ): PreferenceRequest {
    const backUrls = {
      success: `${this.frontendUrl}/pago/exitoso`,
      failure: `${this.frontendUrl}/pago/fallido`,
      pending: `${this.frontendUrl}/pago`,
    };
    return {
      items: [
        {
          id: String(appointment.service.id),
          title: `Turno - ${appointment.service.name}`,
          description: `Pago de turno #${appointment.id}`,
          quantity: 1,
          unit_price: price,
          currency_id: 'ARS',
        },
      ],
      payer: { email: user.email, name: user.fullName },
      back_urls: backUrls,
      // MercadoPago rechaza auto_return si las back_urls no son HTTPS (ej. localhost).
      ...(backUrls.success.startsWith('https://')
        ? { auto_return: 'approved' as const }
        : {}),
      external_reference: String(appointment.id),
      statement_descriptor: 'LUMINANCE STUDIO',
      // MercadoPago no puede notificar a localhost: solo con una URL pública HTTPS.
      ...(this.backendUrl?.startsWith('https://')
        ? {
            notification_url: `${this.backendUrl}/api/payments/webhook?source_news=webhooks`,
          }
        : {}),
      metadata: { appointment_id: appointment.id },
    };
  }

  // =====================================================================
  // MercadoPago: notificaciones (webhook)
  // =====================================================================

  /**
   * Procesa una notificación de pago. El estado real se consulta siempre a la API de
   * MercadoPago (la notificación solo trae el ID). Responde 2xx salvo firma inválida
   * (401) o falla al consultar MercadoPago (502, para que reintente).
   */
  async handleWebhook(
    notification: WebhookNotification,
  ): Promise<WebhookResult> {
    const { topic, paymentId } = parseNotification(notification);
    if (topic !== 'payment') {
      return { status: 'ignored', reason: 'not a payment notification' };
    }
    if (!paymentId) {
      return { status: 'error', reason: 'no payment id' };
    }
    if (
      this.webhookSecret &&
      !isValidWebhookSignature({
        secret: this.webhookSecret,
        signature: notification.signature,
        requestId: notification.requestId,
        dataId: notification.query['data.id'] ?? paymentId,
      })
    ) {
      throw new UnauthorizedException('Firma de MercadoPago inválida');
    }

    let mpPayment: MercadoPagoPayment;
    try {
      mpPayment = await this.mercadoPago.getPayment(paymentId);
    } catch (error) {
      this.logger.error(
        `No se pudo consultar el pago ${paymentId}: ${String(error)}`,
      );
      throw new BadGatewayException(
        'No se pudo consultar el pago en MercadoPago',
      );
    }

    const appointmentId = Number(mpPayment.external_reference);
    if (!Number.isInteger(appointmentId) || appointmentId <= 0) {
      return { status: 'error', reason: 'invalid external reference' };
    }
    const payment = await this.prisma.payment.findUnique({
      where: { appointmentId },
      include: { appointment: { include: { service: true, user: true } } },
    });
    if (!payment) {
      this.logger.warn(
        `Notificación de MercadoPago sin pago local: turno #${appointmentId}`,
      );
      return { status: 'error', reason: 'payment not found' };
    }

    const decision = decideWebhookUpdate(payment, mpPayment);
    const mpId = String(mpPayment.id);
    const mpDetails = JSON.stringify({
      payment_method_id: mpPayment.payment_method_id ?? null,
      payment_type_id: mpPayment.payment_type_id ?? null,
      status_detail: mpPayment.status_detail ?? null,
    });

    switch (decision.action) {
      case 'approve':
        await this.approve(payment, payment.appointment, {
          mercadopagoId: mpId,
          transactionId: mpId,
          paymentDetails: mpDetails,
          approvedAt: mpPayment.date_approved
            ? new Date(mpPayment.date_approved)
            : this.clock.now(),
          // El dinero ya ingresó: si el horario se ocupó, se deja registrado para el admin.
          onConflict: 'flag',
        });
        break;
      case 'update':
        await this.prisma.payment.update({
          where: { id: payment.id },
          data: {
            status: decision.status,
            errorMessage: decision.errorMessage,
            mercadopagoId: mpId,
            transactionId: mpId,
          },
        });
        break;
      case 'track':
      case 'flag':
        await this.prisma.payment.update({
          where: { id: payment.id },
          data: {
            mercadopagoId: mpId,
            transactionId: mpId,
            ...(decision.action === 'flag'
              ? { errorMessage: decision.errorMessage }
              : {}),
          },
        });
        break;
      case 'ignore':
        this.logger.log(
          `Notificación del pago ${mpId} ignorada: ${decision.reason}`,
        );
        return { status: 'ignored', reason: decision.reason };
    }
    this.logger.log(
      `Pago #${payment.id} (turno #${appointmentId}): MercadoPago ${mpPayment.status} → ${decision.action}`,
    );
    return { status: 'ok' };
  }

  // =====================================================================
  // Pagos manuales y administración
  // =====================================================================

  /**
   * Registra un pago manual ya cobrado (efectivo en el studio o transferencia) y confirma
   * el turno. Reutiliza el pago existente del turno (por ej. una preferencia sin pagar).
   */
  async registerManualPayment(dto: ManualPaymentDto): Promise<Payment> {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id: dto.appointment_id },
      include: { service: true, user: true, payment: true },
    });
    if (!appointment) {
      throw new NotFoundException('Turno no encontrado');
    }
    if (appointment.status === AppointmentStatus.CANCELLED) {
      throw new BadRequestException(
        'No se puede registrar un pago para un turno cancelado',
      );
    }

    const existing = appointment.payment;
    if (existing?.status === PaymentStatus.APPROVED) {
      // Ya estaba pago: solo se asegura que el turno quede confirmado.
      if (appointment.status === AppointmentStatus.PENDING) {
        await this.confirmAppointment(appointment);
      }
      return existing;
    }
    if (
      appointment.status === AppointmentStatus.PENDING &&
      (await this.overlapsConfirmed(appointment))
    ) {
      throw new BadRequestException(SLOT_TAKEN_MESSAGE);
    }

    const details =
      [dto.reference && `Comprobante: ${dto.reference}`, dto.notes]
        .filter(Boolean)
        .join(' · ') || null;
    const payment =
      existing ??
      (await this.prisma.payment.create({
        data: {
          appointmentId: appointment.id,
          userId: appointment.userId,
          amount: appointment.service.price,
          currency: 'ARS',
          paymentMethod:
            dto.payment_method === 'transfer'
              ? PaymentMethod.TRANSFER
              : PaymentMethod.CASH,
          status: PaymentStatus.PENDING,
        },
      }));

    return this.approve(payment, appointment, {
      paymentMethod:
        dto.payment_method === 'transfer'
          ? PaymentMethod.TRANSFER
          : PaymentMethod.CASH,
      paymentDetails: details,
      approvedAt: this.clock.now(),
      onConflict: 'reject',
    });
  }

  /**
   * PUT /payments/:id/status (admin). Transiciones: PENDING → APPROVED | REJECTED |
   * CANCELLED y APPROVED → REFUNDED. Aprobar confirma el turno; rechazar lo deja
   * pendiente de pago (como indica el panel admin).
   */
  async updateStatus(
    id: number,
    dto: UpdatePaymentStatusDto,
  ): Promise<Payment> {
    const payment = await this.prisma.payment.findUnique({
      where: { id },
      include: { appointment: { include: { service: true, user: true } } },
    });
    if (!payment) {
      throw new NotFoundException('Pago no encontrado');
    }
    const target = dto.status.toUpperCase() as PaymentStatus;
    if (target === payment.status) {
      return payment;
    }
    if (!canAdminTransition(payment.status, target)) {
      throw new BadRequestException(
        `No se puede pasar un pago de '${payment.status.toLowerCase()}' a '${dto.status}'`,
      );
    }

    if (target === PaymentStatus.APPROVED) {
      if (payment.appointment.status === AppointmentStatus.CANCELLED) {
        throw new BadRequestException(
          'No se puede aprobar el pago de un turno cancelado',
        );
      }
      return this.approve(payment, payment.appointment, {
        approvedAt: this.clock.now(),
        ...(dto.notes ? { paymentDetails: dto.notes } : {}),
        onConflict: 'reject',
      });
    }

    return this.prisma.payment.update({
      where: { id },
      data:
        target === PaymentStatus.REFUNDED
          ? {
              status: target,
              ...(dto.notes ? { paymentDetails: dto.notes } : {}),
            }
          : {
              status: target,
              errorMessage: dto.notes || 'Rechazado por el administrador',
            },
    });
  }

  async findOneForUser(id: number, user: User): Promise<Payment> {
    const payment = await this.prisma.payment.findUnique({ where: { id } });
    if (!payment) {
      throw new NotFoundException('Pago no encontrado');
    }
    if (payment.userId !== user.id && !user.isAdmin) {
      throw new ForbiddenException('No tienes permiso para ver este pago');
    }
    return payment;
  }

  listMine(user: User, query: ListPaymentsQueryDto): Promise<Payment[]> {
    return this.prisma.payment.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      skip: query.skip,
      take: query.limit,
    });
  }

  listAll(query: ListPaymentsQueryDto): Promise<Payment[]> {
    return this.prisma.payment.findMany({
      where: query.status_filter
        ? { status: query.status_filter.toUpperCase() as PaymentStatus }
        : {},
      orderBy: { createdAt: 'desc' },
      skip: query.skip,
      take: query.limit,
    });
  }

  // =====================================================================
  // Helpers
  // =====================================================================

  /**
   * Aprueba el pago y confirma el turno pendiente en una transacción, y avisa al cliente.
   * Si el horario ya lo ocupa otro turno confirmado: `reject` lanza 400 sin tocar nada
   * (acciones del admin); `flag` aprueba el cobro pero deja el turno pendiente con una
   * nota para el admin (el dinero ya ingresó por MercadoPago).
   */
  private async approve(
    payment: Payment,
    appointment: AppointmentWithService,
    options: {
      approvedAt: Date;
      onConflict: 'reject' | 'flag';
      mercadopagoId?: string;
      transactionId?: string;
      paymentMethod?: PaymentMethod;
      paymentDetails?: string | null;
    },
  ): Promise<Payment> {
    let errorMessage: string | null = null;
    let confirm = appointment.status === AppointmentStatus.PENDING;

    if (appointment.status === AppointmentStatus.CANCELLED) {
      errorMessage =
        'Pago aprobado para un turno cancelado: corresponde reembolsarlo.';
    } else if (confirm && (await this.overlapsConfirmed(appointment))) {
      if (options.onConflict === 'reject') {
        throw new BadRequestException(SLOT_TAKEN_MESSAGE);
      }
      confirm = false;
      errorMessage =
        'Pago aprobado, pero el horario ya está confirmado para otro turno: reprogramar o reembolsar.';
    }

    const [approved] = await this.prisma.$transaction([
      this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: PaymentStatus.APPROVED,
          approvedAt: options.approvedAt,
          errorMessage,
          ...(options.mercadopagoId
            ? { mercadopagoId: options.mercadopagoId }
            : {}),
          ...(options.transactionId
            ? { transactionId: options.transactionId }
            : {}),
          ...(options.paymentMethod
            ? { paymentMethod: options.paymentMethod }
            : {}),
          ...(options.paymentDetails !== undefined
            ? { paymentDetails: options.paymentDetails }
            : {}),
        },
      }),
      ...(confirm
        ? [
            this.prisma.appointment.update({
              where: { id: appointment.id },
              data: { status: AppointmentStatus.CONFIRMED },
            }),
          ]
        : []),
    ]);

    // El email dice "tu turno está confirmado": solo si realmente lo está.
    if (confirm || appointment.status === AppointmentStatus.CONFIRMED) {
      void this.mail.sendPaymentConfirmed(
        appointment.user.email,
        appointment.user.fullName,
        appointment.service.name,
        approved.amount,
        appointment.appointmentDate,
      );
    }
    return approved;
  }

  private async confirmAppointment(
    appointment: AppointmentWithService,
  ): Promise<void> {
    if (await this.overlapsConfirmed(appointment)) {
      throw new BadRequestException(SLOT_TAKEN_MESSAGE);
    }
    await this.prisma.appointment.update({
      where: { id: appointment.id },
      data: { status: AppointmentStatus.CONFIRMED },
    });
  }

  private async overlapsConfirmed(
    appointment: Appointment & { service: Pick<Service, 'durationMinutes'> },
  ): Promise<boolean> {
    const end = new Date(
      appointment.appointmentDate.getTime() +
        appointment.service.durationMinutes * 60_000,
    );
    const busy = await this.availability.getBusyIntervals(
      appointment.appointmentDate,
      end,
      appointment.id,
    );
    return busy.length > 0;
  }
}

/**
 * MercadoPago notifica de dos formas:
 * - Webhooks: body `{ type: "payment", data: { id } }` y query `?type=payment&data.id=…`.
 * - IPN (legado): query `?topic=payment&id=…` y body `{ resource, topic }`.
 */
export function parseNotification(notification: WebhookNotification): {
  topic: string | undefined;
  paymentId: string | undefined;
} {
  const body = isRecord(notification.body) ? notification.body : {};
  const data = isRecord(body.data) ? body.data : {};
  const { query } = notification;

  const topic =
    asString(body.type) ?? asString(body.topic) ?? query.type ?? query.topic;
  const resourceId = asString(body.resource)?.split('/').pop();
  const paymentId =
    asString(data.id) ?? query['data.id'] ?? query.id ?? resourceId;
  return { topic, paymentId: paymentId?.trim() || undefined };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | undefined {
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  return undefined;
}
