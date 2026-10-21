import { Module } from '@nestjs/common';
import { AvailabilityModule } from '../availability/availability.module';
import { MercadoPagoClient } from './mercadopago/mercadopago.client';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';

@Module({
  imports: [AvailabilityModule],
  controllers: [PaymentsController],
  providers: [PaymentsService, MercadoPagoClient],
  exports: [PaymentsService],
})
export class PaymentsModule {}
