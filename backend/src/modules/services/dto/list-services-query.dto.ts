import { Transform, Type } from 'class-transformer';
import {
  toBoolean,
  toTrimmedLowercase,
} from '../../../common/transformers/query.transformers';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

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
  @Transform(toTrimmedLowercase)
  @IsString()
  @MaxLength(100)
  category?: string;

  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean({ message: 'is_active debe ser true o false' })
  is_active = true;
}
