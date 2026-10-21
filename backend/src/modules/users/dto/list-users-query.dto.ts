import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, Max, Min } from 'class-validator';
import { toBoolean } from '../../../common/transformers/query.transformers';

/** Query params de GET /api/users (solo admin). */
export class ListUsersQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  skip = 0;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 100;

  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean({ message: 'is_active debe ser true o false' })
  is_active?: boolean;

  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean({ message: 'is_admin debe ser true o false' })
  is_admin?: boolean;
}
