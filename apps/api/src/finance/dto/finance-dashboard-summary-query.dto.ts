import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export class FinanceDashboardSummaryQueryDto {
  @IsOptional()
  @Matches(DATE_ONLY_PATTERN)
  date?: string;

  @IsOptional()
  @Matches(DATE_ONLY_PATTERN)
  fromDate?: string;

  @IsOptional()
  @Matches(DATE_ONLY_PATTERN)
  toDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  timeZone?: string;
}
