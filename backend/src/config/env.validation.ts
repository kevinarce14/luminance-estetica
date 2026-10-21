import { plainToInstance, Type } from 'class-transformer';
import {
  IsEmail,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateBy,
  validateSync,
} from 'class-validator';

/** Zona horaria IANA válida para Intl (ej. America/Argentina/Buenos_Aires). */
function IsTimeZone(): PropertyDecorator {
  return ValidateBy({
    name: 'isTimeZone',
    validator: {
      validate: (value: unknown) => {
        if (typeof value !== 'string' || !value) return false;
        try {
          new Intl.DateTimeFormat('en-US', { timeZone: value });
          return true;
        } catch {
          return false;
        }
      },
      defaultMessage: () => 'TIMEZONE debe ser una zona horaria IANA válida',
    },
  });
}

export enum NodeEnv {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

/**
 * Variables de entorno de la API. Se validan al arrancar: si falta algo, no levanta.
 * Los nombres coinciden con los del backend FastAPI, así ambos comparten la misma
 * configuración (y los mismos JWT) durante la migración.
 */
export class EnvironmentVariables {
  @IsEnum(NodeEnv)
  NODE_ENV: NodeEnv = NodeEnv.Development;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(65535)
  PORT = 3000;

  @IsNotEmpty({ message: 'DATABASE_URL es obligatoria' })
  DATABASE_URL!: string;

  /** Orígenes del frontend separados por coma: CORS y links de los emails (el primero). */
  @IsString()
  FRONTEND_URL = 'http://localhost:5173';

  // ===== Autenticación (JWT HS256) =====
  @IsNotEmpty({ message: 'SECRET_KEY es obligatoria' })
  SECRET_KEY!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  ACCESS_TOKEN_EXPIRE_MINUTES = 1440;

  /** Client ID de Google Identity Services. Sin él, el login con Google queda deshabilitado. */
  @IsOptional()
  @IsString()
  GOOGLE_CLIENT_ID?: string;

  // ===== Email (Mailjet). Sin credenciales, los emails solo se registran en el log =====
  @IsOptional()
  @IsString()
  MAILJET_API_KEY_PUBLIC?: string;

  @IsOptional()
  @IsString()
  MAILJET_API_KEY_PRIVATE?: string;

  @IsEmail({}, { message: 'FROM_EMAIL debe ser un email válido' })
  FROM_EMAIL = 'noreply@luminancestudio.com';

  @IsString()
  FROM_NAME = 'Luminance Studio by Cande';

  // ===== Reglas de reserva (mismos valores por defecto que el legado) =====
  /** Zona horaria del studio: los horarios de atención están expresados en ella. */
  @IsTimeZone()
  TIMEZONE = 'America/Argentina/Buenos_Aires';

  /** Cada cuántos minutos arranca un bloque en la grilla de horarios. */
  @Type(() => Number)
  @IsInt()
  @Min(5)
  MIN_APPOINTMENT_DURATION = 30;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  MIN_BOOKING_ADVANCE_HOURS = 2;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  MAX_BOOKING_ADVANCE_DAYS = 30;

  // ===== MercadoPago (sin access token, el pago online queda deshabilitado) =====
  @IsOptional()
  @IsString()
  MERCADOPAGO_ACCESS_TOKEN?: string;

  /** Clave secreta de la sección Webhooks: si está, se valida la firma x-signature. */
  @IsOptional()
  @IsString()
  MERCADOPAGO_WEBHOOK_SECRET?: string;

  /** Base de la API REST (se cambia solo para apuntar a un MercadoPago simulado en tests). */
  @IsString()
  MERCADOPAGO_API_URL = 'https://api.mercadopago.com';

  /** URL pública de esta API: MercadoPago envía las notificaciones a BACKEND_URL/api/payments/webhook. */
  @IsOptional()
  @IsString()
  BACKEND_URL?: string;
}

export function validateEnv(
  config: Record<string, unknown>,
): EnvironmentVariables {
  const env = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(env);
  if (errors.length > 0) {
    const details = errors
      .flatMap((error) => Object.values(error.constraints ?? {}))
      .join('\n  - ');
    throw new Error(`Variables de entorno inválidas:\n  - ${details}`);
  }
  return env;
}

/** Lista de orígenes de FRONTEND_URL (sin espacios ni barras finales). */
export function parseFrontendOrigins(value: string): string[] {
  return value
    .split(',')
    .map((origin) => origin.trim().replace(/\/+$/, ''))
    .filter(Boolean);
}
