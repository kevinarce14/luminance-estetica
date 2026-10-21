import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Length,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { toTrimmedLowercase } from '../../../common/transformers/query.transformers';

/** Categorías del catálogo (mismas que el legado y que el frontend). */
export const SERVICE_CATEGORIES = [
  'pestañas',
  'cejas',
  'laser',
  'facial',
  'corporal',
  'pies',
  'otros',
] as const;

const CATEGORY_MESSAGE = `Categoría no válida. Debe ser una de: ${SERVICE_CATEGORIES.join(', ')}`;

/** Body de POST /api/services (alias POST /api/admin/services). */
export class CreateServiceDto {
  @IsString()
  @Length(3, 255, { message: 'El nombre debe tener entre 3 y 255 caracteres' })
  name!: string;

  @IsOptional()
  @ValidateIf((_object, value) => value !== null)
  @IsString()
  description?: string | null;

  @IsInt({ message: 'La duración debe ser un número entero de minutos' })
  @Min(1, { message: 'La duración debe ser mayor a 0' })
  @Max(480, { message: 'La duración no puede superar las 8 horas' })
  duration_minutes!: number;

  @IsNumber({}, { message: 'El precio debe ser un número' })
  @IsPositive({ message: 'El precio debe ser mayor a 0' })
  price!: number;

  @Transform(toTrimmedLowercase)
  @IsIn(SERVICE_CATEGORIES, { message: CATEGORY_MESSAGE })
  category!: string;

  @IsOptional()
  @ValidateIf((_object, value) => value !== null)
  @IsString()
  @MaxLength(500)
  image_url?: string | null;

  @IsOptional()
  @IsBoolean()
  is_active = true;
}

/** Body de PUT /api/services/:id: actualización parcial. */
export class UpdateServiceDto {
  @IsOptional()
  @IsString()
  @Length(3, 255, { message: 'El nombre debe tener entre 3 y 255 caracteres' })
  name?: string;

  @IsOptional()
  @ValidateIf((_object, value) => value !== null)
  @IsString()
  description?: string | null;

  @IsOptional()
  @IsInt({ message: 'La duración debe ser un número entero de minutos' })
  @Min(1, { message: 'La duración debe ser mayor a 0' })
  @Max(480, { message: 'La duración no puede superar las 8 horas' })
  duration_minutes?: number;

  @IsOptional()
  @IsNumber({}, { message: 'El precio debe ser un número' })
  @IsPositive({ message: 'El precio debe ser mayor a 0' })
  price?: number;

  @IsOptional()
  @Transform(toTrimmedLowercase)
  @IsIn(SERVICE_CATEGORIES, { message: CATEGORY_MESSAGE })
  category?: string;

  @IsOptional()
  @ValidateIf((_object, value) => value !== null)
  @IsString()
  @MaxLength(500)
  image_url?: string | null;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}
