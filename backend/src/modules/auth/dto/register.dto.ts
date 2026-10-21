import { Transform } from 'class-transformer';
import { IsEmail, IsString, Length, MaxLength } from 'class-validator';
import { toTrimmedLowercase } from '../../../common/transformers/query.transformers';
import {
  IsAccountPassword,
  IsContactPhone,
} from '../../../common/validators/account.validators';

/** Body de POST /api/auth/register (mismas reglas que UserCreate de FastAPI). */
export class RegisterDto {
  @Transform(toTrimmedLowercase)
  @IsEmail({}, { message: 'El email no es válido' })
  @MaxLength(255)
  email!: string;

  @IsString({ message: 'El nombre es obligatorio' })
  @Length(2, 255, { message: 'El nombre debe tener entre 2 y 255 caracteres' })
  full_name!: string;

  @IsContactPhone()
  phone?: string;

  @IsAccountPassword()
  password!: string;
}
