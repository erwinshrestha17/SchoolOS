import {
  IsDateString,
  IsOptional,
  IsString,
  IsBoolean,
  IsEnum
} from 'class-validator';
import { Transform } from 'class-transformer';

export enum IncomeStatementComparison {
  NONE = 'NONE',
  PREVIOUS_PERIOD = 'PREVIOUS_PERIOD',
  PREVIOUS_YEAR = 'PREVIOUS_YEAR',
}

export class IncomeStatementQueryDto {
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
  @IsEnum(IncomeStatementComparison)
  comparison?: IncomeStatementComparison;

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  includeZeroBalances?: boolean = false;
}
