import {
  IsDateString,
  IsOptional,
  IsString,
  IsBoolean,
  IsEnum,
  IsIn,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { ChartAccountType } from '@prisma/client';
import { LEDGER_STAGES, type LedgerStage } from '../ledger-scope';

export class TrialBalanceQueryDto {
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
  @IsEnum(ChartAccountType)
  accountType?: ChartAccountType;

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  includeZeroBalances?: boolean = false;

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  includeChildren?: boolean = true;

  @IsOptional()
  @IsDateString()
  asOfDate?: string;

  /** PRE_CLOSING (default) excludes fiscal-year closing entries. */
  @IsOptional()
  @IsIn(LEDGER_STAGES)
  stage?: LedgerStage = 'PRE_CLOSING';
}
