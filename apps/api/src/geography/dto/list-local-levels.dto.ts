import { IsIn, IsOptional, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class ListLocalLevelsDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  districtId?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  typeId?: number;

  @IsOptional()
  @IsIn(['en', 'ne'])
  locale?: string;
}
