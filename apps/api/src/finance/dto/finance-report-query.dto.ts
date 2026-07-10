import { IsDateString, IsOptional } from 'class-validator';

export class FinanceReportQueryDto {
  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @IsOptional()
  @IsDateString()
  toDate?: string;
}
