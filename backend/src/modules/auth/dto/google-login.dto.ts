import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

/** Body de POST /api/auth/google: el id_token que Google Identity Services entrega al frontend. */
export class GoogleLoginDto {
  @IsString()
  @IsNotEmpty({ message: 'Falta el credential de Google' })
  @MaxLength(4096)
  credential!: string;
}
