import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import type { User } from '../../generated/prisma/client';
import { ParseIdPipe } from '../../common/pipes/parse-id.pipe';
import { AdminOnly } from '../auth/decorators/auth.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  CreatePreferenceDto,
  ListPaymentsQueryDto,
  ManualPaymentDto,
  UpdatePaymentStatusDto,
} from './dto/payment.dto';
import {
  toPaymentResponse,
  type MercadoPagoPreferenceResponse,
  type PaymentResponse,
  type WebhookResult,
} from './interfaces/payment-response.interface';
import { PaymentsService } from './payments.service';

/** Pagos (mismo contrato que /api/payments de FastAPI). Rutas fijas antes que /:id. */
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  /** Checkout de MercadoPago. `create-preference` es la ruta que usa el frontend. */
  @Post(['create-preference', 'mercadopago/preference'])
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  createPreference(
    @CurrentUser() user: User,
    @Body() body: CreatePreferenceDto,
  ): Promise<MercadoPagoPreferenceResponse> {
    return this.paymentsService.createPreference(user, body);
  }

  /**
   * Notificaciones de MercadoPago (público). El body no se valida con DTO: MercadoPago
   * envía formatos distintos (Webhooks e IPN) y el estado se consulta a su API.
   */
  @Post(['webhook', 'mercadopago/webhook'])
  @HttpCode(HttpStatus.OK)
  handleWebhook(
    @Query() query: Record<string, string | undefined>,
    @Body() body: Record<string, unknown>,
    @Headers('x-signature') signature: string | undefined,
    @Headers('x-request-id') requestId: string | undefined,
  ): Promise<WebhookResult> {
    return this.paymentsService.handleWebhook({
      query,
      body,
      signature,
      requestId,
    });
  }

  /** Pago manual ya cobrado (solo admin). `cash-payment` es la ruta del frontend. */
  @Post(['cash-payment', 'cash'])
  @AdminOnly()
  async registerManualPayment(
    @Body() body: ManualPaymentDto,
  ): Promise<PaymentResponse> {
    return toPaymentResponse(
      await this.paymentsService.registerManualPayment(body),
    );
  }

  @Get('all/payments')
  @AdminOnly()
  async listAll(
    @Query() query: ListPaymentsQueryDto,
  ): Promise<PaymentResponse[]> {
    const payments = await this.paymentsService.listAll(query);
    return payments.map(toPaymentResponse);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  async listMine(
    @CurrentUser() user: User,
    @Query() query: ListPaymentsQueryDto,
  ): Promise<PaymentResponse[]> {
    const payments = await this.paymentsService.listMine(user, query);
    return payments.map(toPaymentResponse);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async findOne(
    @Param('id', ParseIdPipe) id: number,
    @CurrentUser() user: User,
  ): Promise<PaymentResponse> {
    return toPaymentResponse(
      await this.paymentsService.findOneForUser(id, user),
    );
  }

  /** Aprobar, rechazar, cancelar o reembolsar (solo admin). */
  @Put(':id/status')
  @AdminOnly()
  async updateStatus(
    @Param('id', ParseIdPipe) id: number,
    @Body() body: UpdatePaymentStatusDto,
  ): Promise<PaymentResponse> {
    return toPaymentResponse(await this.paymentsService.updateStatus(id, body));
  }
}
