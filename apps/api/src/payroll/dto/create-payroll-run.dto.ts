import { PAYROLL_BS_MAX_YEAR, PAYROLL_BS_MIN_YEAR } from '@schoolos/core';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

/**
 * Phase 7.9: periodYear/periodMonth are the Bikram Sambat year and month.
 * `workingDays` is an optional operator-supplied divisor (1–32); omitted, the
 * divisor is the calendar-day count of the BS month.
 */
export class CreatePayrollRunDto {
  @IsInt()
  @Min(1)
  @Max(12)
  periodMonth!: number;

  @IsInt()
  @Min(PAYROLL_BS_MIN_YEAR)
  @Max(PAYROLL_BS_MAX_YEAR)
  periodYear!: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(32)
  workingDays?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}
