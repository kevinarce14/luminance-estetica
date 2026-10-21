import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * Body de POST /api/auth/login. Formato OAuth2 "password grant"
 * (application/x-www-form-urlencoded), como OAuth2PasswordRequestForm de FastAPI:
 * el email viaja en `username`. También acepta JSON.
 */
export class LoginDto {
  @IsString()
  @IsNotEmpty({ message: 'El email es obligatorio' })
  @MaxLength(255)
  username!: string;

  @IsString()
  @IsNotEmpty({ message: 'La contraseña es obligatoria' })
  @MaxLength(100)
  password!: string;

  // Campos opcionales del estándar OAuth2: se aceptan (algunos clientes los envían) y se ignoran.
  @IsOptional() @IsString() grant_type?: string;
  @IsOptional() @IsString() scope?: string;
  @IsOptional() @IsString() client_id?: string;
  @IsOptional() @IsString() client_secret?: string;
}
