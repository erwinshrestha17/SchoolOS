import { CashDepositStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class PrepareCashDepositDto {
  @IsUUID()
  cashierCloseId!: string;

  @IsUUID()
  accountId!: string;

  @IsOptional()
  @IsDateString()
  depositDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  referenceNumber?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  idempotencyKey!: string;
}

export class CashDepositTransitionDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason!: string;
}

export class ListCashDepositsDto {
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
  @IsEnum(CashDepositStatus)
  status?: CashDepositStatus;

  @IsOptional()
  @IsUUID()
  cashierCloseId?: string;
}
