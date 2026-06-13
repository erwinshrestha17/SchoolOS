import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';

export const FEE_AGING_BUCKETS = ['0-30', '31-60', '61-90', '90+'] as const;
export type FeeAgingBucket = (typeof FEE_AGING_BUCKETS)[number];

export class ListDefaultersDto {
  @IsOptional()
  @IsString()
  classId?: string;

  @IsOptional()
  @IsString()
  feeHeadId?: string;

  @IsOptional()
  @IsIn(FEE_AGING_BUCKETS)
  agingBucket?: FeeAgingBucket;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minDaysOverdue?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  maxDaysOverdue?: number;
}
