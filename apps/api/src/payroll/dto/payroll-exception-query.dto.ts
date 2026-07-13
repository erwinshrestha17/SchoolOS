import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import {
  PayrollExceptionCode,
  PayrollExceptionSeverity,
  PayrollExceptionStatus,
} from '@prisma/client';

export class PayrollExceptionQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  year?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  month?: number;

  @IsOptional()
  @IsUUID()
  payrollRunId?: string;

  @IsOptional()
  @IsEnum(PayrollExceptionSeverity)
  severity?: PayrollExceptionSeverity;

  @IsOptional()
  @IsEnum(PayrollExceptionStatus)
  status?: PayrollExceptionStatus;

  @IsOptional()
  @IsEnum(PayrollExceptionCode)
  code?: PayrollExceptionCode;

  @IsOptional()
  @IsUUID()
  staffId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  department?: string;

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
}

export class AcknowledgePayrollExceptionDto {
  @IsString()
  @MinLength(10)
  @MaxLength(500)
  reason!: string;
}
