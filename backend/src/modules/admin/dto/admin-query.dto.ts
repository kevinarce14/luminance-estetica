import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  toBoolean,
  toTrimmedLowercase,
} from '../../../common/transformers/query.transformers';
import { IsCalendarDate } from '../../../common/validators/date-time.validators';
import { APPOINTMENT_STATUSES } from '../../appointments/dto/appointment.dto';
import type { AppointmentStatusValue } from '../../appointments/interfaces/appointment-response.interface';
import {
  PAYMENT_STATUSES,
  type PaymentStatusValue,
} from '../../payments/interfaces/payment-response.interface';

/** Paginación común de los listados del panel (hasta 1000 filas, como el legado). */
class AdminPageDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  skip = 0;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000, { message: 'limit no puede superar 1000' })
  limit = 200;

  /** Cliente (nombre, email, teléfono), servicio, notas o #ID. */
  @IsOptional()
  @IsString()
  @MaxLength(100, {
    message: 'La búsqueda no puede superar los 100 caracteres',
  })
  search?: string;
}

/** Query de GET /api/admin/appointments (agenda). Fechas en hora del studio. */
export class AdminAppointmentsQueryDto extends AdminPageDto {
  /** Un día exacto. */
  @IsOptional()
  @IsCalendarDate({ message: 'date debe tener el formato YYYY-MM-DD' })
  date?: string;

  /** Desde este día inclusive. */
  @IsOptional()
  @IsCalendarDate({ message: 'date_from debe tener el formato YYYY-MM-DD' })
  date_from?: string;

  /** Hasta este día inclusive. */
  @IsOptional()
  @IsCalendarDate({ message: 'date_to debe tener el formato YYYY-MM-DD' })
  date_to?: string;

  @IsOptional()
  @Transform(toTrimmedLowercase)
  @IsIn(APPOINTMENT_STATUSES, {
    message: `status debe ser uno de: ${APPOINTMENT_STATUSES.join(', ')}`,
  })
  status?: AppointmentStatusValue;

  /** Historial de un cliente. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  user_id?: number;

  @IsOptional()
  @IsIn(['asc', 'desc'], { message: 'order debe ser asc o desc' })
  order: 'asc' | 'desc' = 'asc';
}

/** Query de GET /api/admin/appointments/upcoming. */
export class UpcomingQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(365)
  days = 7;
}

/** Query de GET /api/admin/payments. */
export class AdminPaymentsQueryDto extends AdminPageDto {
  @IsOptional()
  @Transform(toTrimmedLowercase)
  @IsIn(PAYMENT_STATUSES, {
    message: `status debe ser uno de: ${PAYMENT_STATUSES.join(', ')}`,
  })
  status?: PaymentStatusValue;

  @IsOptional()
  @Transform(toTrimmedLowercase)
  @IsIn(['mercadopago', 'cash', 'transfer', 'card_pos'], {
    message: 'method debe ser mercadopago, cash, transfer o card_pos',
  })
  method?: 'mercadopago' | 'cash' | 'transfer' | 'card_pos';
}

/** Query de GET /api/admin/clients. */
export class AdminClientsQueryDto extends AdminPageDto {
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean({ message: 'is_active debe ser true o false' })
  is_active?: boolean;
}

/** Query de GET /api/admin/reports/yearly. */
export class YearlyReportQueryDto {
  @Type(() => Number)
  @IsInt({ message: 'year debe ser un año' })
  @Min(2020)
  @Max(2100)
  year!: number;
}

/** Query de GET /api/admin/reports/monthly. */
export class MonthlyReportQueryDto extends YearlyReportQueryDto {
  @Type(() => Number)
  @IsInt({ message: 'month debe ser un número de mes' })
  @Min(1)
  @Max(12)
  month!: number;
}
