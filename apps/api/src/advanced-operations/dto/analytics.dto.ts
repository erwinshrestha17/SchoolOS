import { IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';
import { AnalyticsSummaryDomain } from '@prisma/client';

export class AnalyticsSummaryQueryDto {
  @IsOptional()
  @IsEnum(AnalyticsSummaryDomain)
  domain?: AnalyticsSummaryDomain;

  @IsOptional()
  @IsDateString()
  summaryDate?: string;
}

export class RefreshAnalyticsSummaryDto {
  @IsEnum(AnalyticsSummaryDomain)
  domain!: AnalyticsSummaryDomain;

  @IsDateString()
  summaryDate!: string;

  @IsOptional()
  @IsString()
  idempotencyKey?: string;
}
