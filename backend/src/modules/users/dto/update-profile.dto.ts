import { IsOptional, IsString, Length } from 'class-validator';
import { IsContactPhone } from '../../../common/validators/account.validators';

/** Body de PUT /api/users/me: solo nombre y teléfono son editables. */
export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @Length(2, 255, { message: 'El nombre debe tener entre 2 y 255 caracteres' })
  full_name?: string;

  @IsContactPhone()
  phone?: string;
}
