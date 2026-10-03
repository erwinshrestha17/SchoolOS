import {
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  Min,
  Max,
  IsEnum,
  IsIn,
} from 'class-validator';
import { Type } from 'class-transformer';
import { JournalSourceType } from '@prisma/client';
import { LEDGER_STAGES, type LedgerStage } from '../ledger-scope';

export class GeneralLedgerQueryDto {
  @IsString()
  fiscalYearId!: string;

  @IsOptional()
  @IsString()
  accountId?: string;

  @IsOptional()
  @IsString()
  accountCode?: string;

  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @IsOptional()
  @IsDateString()
  toDate?: string;

  @IsOptional()
  @IsString()
  fiscalPeriodId?: string;

  @IsOptional()
  @IsString()
  sourceModule?: string;

  @IsOptional()
  @IsEnum(JournalSourceType)
  sourceType?: JournalSourceType;

  @IsOptional()
  @IsString()
  sourceId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number = 50;

  @IsOptional()
  @IsString()
  sort?: string = 'entryDate:asc,entryNumber:asc';

  /** POST_CLOSING (default) shows closing entries; PRE_CLOSING matches the income statement. */
  @IsOptional()
  @IsIn(LEDGER_STAGES)
  stage?: LedgerStage = 'POST_CLOSING';
}
