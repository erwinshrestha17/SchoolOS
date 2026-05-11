import {
  IsDateString,
  IsOptional,
  IsString,
  IsBoolean,
  IsEnum,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { ChartAccountType } from '@prisma/client';

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
}
