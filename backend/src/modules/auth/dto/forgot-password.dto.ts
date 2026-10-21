import { Transform } from 'class-transformer';
import { IsEmail } from 'class-validator';
import { toTrimmedLowercase } from '../../../common/transformers/query.transformers';

/** Body de POST /api/auth/password-reset (alias /forgot-password). */
export class ForgotPasswordDto {
  @Transform(toTrimmedLowercase)
  @IsEmail({}, { message: 'El email no es válido' })
  email!: string;
}
