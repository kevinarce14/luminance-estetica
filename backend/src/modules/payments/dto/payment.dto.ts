import { Transform, Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { toTrimmedLowercase } from '../../../common/transformers/query.transformers';
import {
  PAYMENT_STATUSES,
  type PaymentStatusValue,
} from '../interfaces/payment-response.interface';

/**
 * Body de POST /api/payments/create-preference (lo que envía el frontend).
 * `amount` se acepta por compatibilidad, pero se cobra el precio del servicio en la base.
 */
export class CreatePreferenceDto {
  @IsInt({ message: 'appointment_id debe ser un número entero' })
  @Min(1, { message: 'appointment_id debe ser mayor a 0' })
  appointment_id!: number;

  @IsNumber({}, { message: 'amount debe ser un número' })
  @IsPositive({ message: 'amount debe ser mayor a 0' })
  amount!: number;

  @IsOptional()
  @IsIn(['ARS'], { message: 'La única moneda aceptada es ARS' })
  currency?: string;

  @IsOptional()
  @IsIn(['mercadopago'], { message: 'payment_method debe ser mercadopago' })
  payment_method?: string;
}

export type ManualPaymentMethod = 'cash' | 'transfer';

/** Body de POST /api/payments/cash-payment (solo admin): pago manual ya cobrado. */
export class ManualPaymentDto {
  @IsInt({ message: 'appointment_id debe ser un número entero' })
  @Min(1, { message: 'appointment_id debe ser mayor a 0' })
  appointment_id!: number;

  @IsOptional()
  @IsIn(['cash', 'transfer'], {
    message: 'payment_method debe ser cash o transfer',
  })
  payment_method: ManualPaymentMethod = 'cash';

  /** Nro. de operación / comprobante de la transferencia. */
  @IsOptional()
  @IsString()
  @MaxLength(255)
  reference?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

/** Body de PUT /api/payments/:id/status (solo admin). */
export class UpdatePaymentStatusDto {
  @Transform(toTrimmedLowercase)
  @IsIn(PAYMENT_STATUSES, {
    message: `status debe ser uno de: ${PAYMENT_STATUSES.join(', ')}`,
  })
  status!: PaymentStatusValue;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

/** Query de GET /api/payments y /api/payments/all/payments. */
export class ListPaymentsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  skip = 0;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 100;

  @IsOptional()
  @Transform(toTrimmedLowercase)
  @IsIn(PAYMENT_STATUSES, {
    message: `status_filter debe ser uno de: ${PAYMENT_STATUSES.join(', ')}`,
  })
  status_filter?: PaymentStatusValue;
}
