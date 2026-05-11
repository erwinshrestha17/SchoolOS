import {
  IsDateString,
  IsOptional,
  IsString,
  IsEnum,
  IsNumber,
  Min
} from 'class-validator';
import { Type } from 'class-transformer';

export enum TaxSummaryType {
  VAT = 'VAT',
  TDS = 'TDS',
  PF = 'PF',
  ALL = 'ALL',
}

export class TaxSummaryQueryDto {
  @IsString()
  fiscalYearId!: string;

  @IsOptional()
  @IsString()
  fiscalPeriodId?: string;

  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @IsOptional()
  @IsDateString()
  toDate?: string;

  @IsOptional()
  @IsEnum(TaxSummaryType)
  summaryType?: TaxSummaryType;

  @IsOptional()
  @IsString()
  sourceModule?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  limit?: number;
}
