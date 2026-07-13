import { Type } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export const ACCOUNTING_SOURCE_MODULES = [
  'FEES',
  'PAYROLL',
  'CANTEEN',
  'LIBRARY',
  'TRANSPORT',
] as const;

export type AccountingSourceModule = (typeof ACCOUNTING_SOURCE_MODULES)[number];

export class ListAccountingSourceMappingsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 25;

  @IsOptional()
  @IsIn(ACCOUNTING_SOURCE_MODULES)
  sourceModule?: AccountingSourceModule;

  @IsOptional()
  @IsIn(['ACTIVE', 'ARCHIVED'])
  status?: 'ACTIVE' | 'ARCHIVED';

  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;
}

export class CreateAccountingSourceMappingDto {
  @IsIn(ACCOUNTING_SOURCE_MODULES)
  sourceModule!: AccountingSourceModule;

  @IsString()
  @MinLength(1)
  @MaxLength(80)
  sourceType!: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  postingType?: string;

  @IsUUID()
  debitAccountId!: string;

  @IsUUID()
  creditAccountId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsDateString()
  effectiveFrom!: string;

  @IsOptional()
  @IsDateString()
  effectiveTo?: string;
}

export class ArchiveAccountingSourceMappingDto {
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason!: string;
}
