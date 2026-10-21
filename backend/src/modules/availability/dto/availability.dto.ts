import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';
import { toBoolean } from '../../../common/transformers/query.transformers';
import {
  IsCalendarDate,
  IsClockTime,
} from '../../../common/validators/date-time.validators';

/** Campos de horario: pueden venir null (día cerrado) o "HH:MM[:SS]". */
class ScheduleHoursDto {
  @IsOptional()
  @ValidateIf((_object, value) => value !== null)
  @IsClockTime({ message: 'start_time debe tener el formato HH:MM' })
  start_time?: string | null;

  @IsOptional()
  @ValidateIf((_object, value) => value !== null)
  @IsClockTime({ message: 'end_time debe tener el formato HH:MM' })
  end_time?: string | null;
}

/**
 * Body de POST /api/availability, /regular y /exceptions.
 * Reglas cruzadas (día XOR fecha, franja abierta con horario, fin > inicio): AvailabilityService.
 */
export class CreateAvailabilityDto extends ScheduleHoursDto {
  /** 0=Domingo … 6=Sábado. */
  @IsOptional()
  @ValidateIf((_object, value) => value !== null)
  @IsInt({ message: 'day_of_week debe ser un número entero' })
  @Min(0, { message: 'day_of_week va de 0 (Domingo) a 6 (Sábado)' })
  @Max(6, { message: 'day_of_week va de 0 (Domingo) a 6 (Sábado)' })
  day_of_week?: number | null;

  @IsOptional()
  @ValidateIf((_object, value) => value !== null)
  @IsCalendarDate({ message: 'specific_date debe tener el formato YYYY-MM-DD' })
  specific_date?: string | null;

  @IsOptional()
  @IsBoolean({ message: 'is_available debe ser true o false' })
  is_available = true;
}

/** Body de PUT /api/availability/:id y /regular/:id (actualización parcial). */
export class UpdateAvailabilityDto extends ScheduleHoursDto {
  @IsOptional()
  @IsBoolean({ message: 'is_available debe ser true o false' })
  is_available?: boolean;
}

/** Query de GET /api/availability/exceptions. */
export class ListExceptionsQueryDto {
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean({ message: 'future_only debe ser true o false' })
  future_only = true;
}
