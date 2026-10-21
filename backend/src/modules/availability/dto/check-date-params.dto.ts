import { IsCalendarDate } from '../../../common/validators/date-time.validators';

/** Parámetro de GET /api/availability/check/:date. */
export class CheckDateParamsDto {
  @IsCalendarDate({ message: 'Formato de fecha inválido. Use YYYY-MM-DD' })
  date!: string;
}
