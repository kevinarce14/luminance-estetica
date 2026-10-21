import { Transform, type TransformFnParams } from 'class-transformer';
import { IsString, Length } from 'class-validator';
import { IsAccountPassword } from '../../../common/validators/account.validators';

/** El código se suele pegar desde el email: se toleran espacios y saltos de línea. */
function removeWhitespace({ value }: TransformFnParams): unknown {
  return typeof value === 'string' ? value.replace(/\s+/g, '') : value;
}

/** Body de POST /api/auth/password-reset/confirm (alias /reset-password). */
export class ResetPasswordDto {
  @Transform(removeWhitespace)
  @IsString({ message: 'El código es obligatorio' })
  @Length(10, 2048, { message: 'El código es inválido' })
  token!: string;

  @IsAccountPassword()
  new_password!: string;
}
