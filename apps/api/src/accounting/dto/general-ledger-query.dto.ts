import {
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  Min,
  Max,
  IsEnum,
} from 'class-validator';
import { Type } from 'class-transformer';
import { JournalSourceType } from '@prisma/client';

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
}
