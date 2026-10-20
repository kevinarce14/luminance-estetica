import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

/** Convierte los valores de query string ("true", "1", "false", "0") a boolean. */
function toBoolean({ value }: { value: unknown }): unknown {
  if (value === 'true' || value === '1') return true;
  if (value === 'false' || value === '0') return false;
  return value;
}

/** Query params de GET /api/services (mismos nombres que el backend FastAPI). */
export class ListServicesQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'skip debe ser un número entero' })
  @Min(0, { message: 'skip no puede ser negativo' })
  skip = 0;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'limit debe ser un número entero' })
  @Min(1, { message: 'limit debe ser al menos 1' })
  @Max(100, { message: 'limit no puede superar 100' })
  limit = 100;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsString()
  @MaxLength(100)
  category?: string;

  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean({ message: 'is_active debe ser true o false' })
  is_active = true;
}
