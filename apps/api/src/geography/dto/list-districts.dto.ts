import { IsIn, IsOptional, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class ListDistrictsDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  provinceId?: number;

  @IsOptional()
  @IsIn(['en', 'ne'])
  locale?: string;
}
