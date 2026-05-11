import {
  IsDateString,
  IsOptional,
  IsString,
  IsEnum,
  IsNumber,
  Min
} from 'class-validator';
import { Type } from 'class-transformer';

export enum CashBookAccountKind {
  CASH = 'CASH',
  BANK = 'BANK',
  CASH_AND_BANK = 'CASH_AND_BANK',
}

export class CashBookQueryDto {
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
  @IsString()
  accountId?: string;

  @IsOptional()
  @IsString()
  accountCode?: string;

  @IsOptional()
  @IsEnum(CashBookAccountKind)
  accountKind?: CashBookAccountKind;

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
