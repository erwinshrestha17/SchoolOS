import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class PayrollPreviewQueryDto {
  @IsInt()
  @Min(2000)
  @Max(2100)
  @Type(() => Number)
  year: number;

  @IsInt()
  @Min(1)
  @Max(12)
  @Type(() => Number)
  month: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(32)
  @Type(() => Number)
  workingDays?: number;
}
