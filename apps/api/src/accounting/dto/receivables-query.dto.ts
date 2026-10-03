import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  RECEIVABLES_AGING_BUCKETS,
  type ReceivablesAgingBucket,
} from '@schoolos/core';

/** Phase 7.11b: receivables as of a Nepal school day (default today). */
export class ReceivablesReconciliationQueryDto {
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'asOfDate must be YYYY-MM-DD' })
  asOfDate?: string;
}

export class ReceivablesAgingQueryDto extends ReceivablesReconciliationQueryDto {
  @IsOptional()
  @IsIn(RECEIVABLES_AGING_BUCKETS)
  bucket?: ReceivablesAgingBucket;

  @IsOptional()
  @IsString()
  classId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

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
}
