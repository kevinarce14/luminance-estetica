import { Type } from 'class-transformer';
import { IsInt, Min } from 'class-validator';
import { IsCalendarDate } from '../../../common/validators/date-time.validators';

/**
 * Body de POST /api/availability/available-slots (lo que envía el frontend)
 * y query de su alias GET.
 */
export class AvailableSlotsDto {
  @Type(() => Number)
  @IsInt({ message: 'service_id debe ser un número entero' })
  @Min(1, { message: 'service_id debe ser mayor a 0' })
  service_id!: number;

  /** "YYYY-MM-DD", fecha de calendario del studio. */
  @IsCalendarDate()
  date!: string;
}
