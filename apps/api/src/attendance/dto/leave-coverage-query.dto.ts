import { Type } from 'class-transformer';
import { IsDateString, IsInt, IsOptional, Max, Min } from 'class-validator';

export class LeaveCoverageQueryDto {
  /** First school day to report (defaults to today in Nepal). */
  @IsOptional()
  @IsDateString()
  from?: string;

  /** Number of days to report, 1–31 (default 14). */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(31)
  days?: number;
}
