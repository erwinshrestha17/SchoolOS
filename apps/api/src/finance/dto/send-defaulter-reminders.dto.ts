import { NotificationChannel } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { FEE_AGING_BUCKETS, FeeAgingBucket } from './list-defaulters.dto';

export class SendDefaulterRemindersDto {
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  invoiceIds?: string[];

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

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsEnum(NotificationChannel, { each: true })
  channels?: NotificationChannel[];

  @IsOptional()
  @IsString()
  message?: string;
}
