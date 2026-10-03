import { PAYROLL_BS_MAX_YEAR, PAYROLL_BS_MIN_YEAR } from '@schoolos/core';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class PayrollPreviewQueryDto {
  @IsInt()
  @Min(PAYROLL_BS_MIN_YEAR)
  @Max(PAYROLL_BS_MAX_YEAR)
  @Type(() => Number)
  year!: number;

  @IsInt()
  @Min(1)
  @Max(12)
  @Type(() => Number)
  month!: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(32)
  @Type(() => Number)
  workingDays?: number;
}
