import { PaymentMethod } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class ListCashierClosesDto {
  @IsOptional()
  @IsDateString()
  openedFrom?: string;

  @IsOptional()
  @IsDateString()
  closedTo?: string;

  @IsOptional()
  @IsString()
  collectorUserId?: string;

  @IsOptional()
  @IsEnum(PaymentMethod)
  paymentMethod?: PaymentMethod;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @IsIn(['openedAt', 'closedAt', 'createdAt', 'closeNumber'])
  sortBy?: 'openedAt' | 'closedAt' | 'createdAt' | 'closeNumber';

  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortDirection?: 'asc' | 'desc';
}
