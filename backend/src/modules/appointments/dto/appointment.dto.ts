import { Transform, Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { toTrimmedLowercase } from '../../../common/transformers/query.transformers';
import { IsIsoDateTime } from '../../../common/validators/date-time.validators';
import type { AppointmentStatusValue } from '../interfaces/appointment-response.interface';

export const APPOINTMENT_STATUSES: AppointmentStatusValue[] = [
  'pending',
  'confirmed',
  'completed',
  'cancelled',
];

/** Body de POST /api/appointments. El turno queda a nombre del usuario del token. */
export class CreateAppointmentDto {
  @IsInt({ message: 'service_id debe ser un número entero' })
  @Min(1, { message: 'service_id debe ser mayor a 0' })
  service_id!: number;

  /** ISO 8601 con offset (el frontend envía "2026-10-22T10:00:00-03:00"); sin offset = UTC. */
  @IsIsoDateTime()
  appointment_date!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000, {
    message: 'Las notas no pueden superar los 1000 caracteres',
  })
  notes?: string | null;
}

/** Body de PUT /api/appointments/:id: reprogramar, notas o (admin) cambiar el estado. */
export class UpdateAppointmentDto {
  @IsOptional()
  @IsIsoDateTime()
  appointment_date?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000, {
    message: 'Las notas no pueden superar los 1000 caracteres',
  })
  notes?: string;

  /** Se acepta en cualquier capitalización, como el legado. */
  @IsOptional()
  @Transform(toTrimmedLowercase)
  @IsIn(APPOINTMENT_STATUSES, {
    message: `status debe ser uno de: ${APPOINTMENT_STATUSES.join(', ')}`,
  })
  status?: AppointmentStatusValue;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  cancellation_reason?: string;
}

/** Body de POST (y PATCH) /api/appointments/:id/cancel. */
export class CancelAppointmentDto {
  @IsString({ message: 'El motivo de cancelación es obligatorio' })
  @Length(5, 500, {
    message: 'El motivo de cancelación debe tener entre 5 y 500 caracteres',
  })
  cancellation_reason!: string;
}

/** Query de GET /api/appointments (turnos del usuario autenticado). */
export class ListAppointmentsQueryDto {
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
  @IsIn(APPOINTMENT_STATUSES, {
    message: `status_filter debe ser uno de: ${APPOINTMENT_STATUSES.join(', ')}`,
  })
  status_filter?: AppointmentStatusValue;
}

export type AppointmentsWhen = 'upcoming' | 'past';

/** Query de GET /api/users/me/appointments. Sin `when` devuelve todos (contrato del legado). */
export class MyAppointmentsQueryDto {
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

  /** upcoming: futuros pendientes/confirmados · past: ya pasados, completados o cancelados. */
  @IsOptional()
  @IsIn(['upcoming', 'past'], { message: 'when debe ser upcoming o past' })
  when?: AppointmentsWhen;
}
