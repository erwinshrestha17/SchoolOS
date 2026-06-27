import {
  PayrollRunStatus,
  PayslipStatus,
  SalaryStructureStatus,
} from '@prisma/client';
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
} from 'class-validator';

export class PayrollPaginatedQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 25;
}

export class PayrollRunListQueryDto extends PayrollPaginatedQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  month?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  year?: number;

  @IsOptional()
  @IsEnum(PayrollRunStatus)
  status?: PayrollRunStatus;
}

export class PayrollDashboardSummaryQueryDto {
  @IsOptional()
  @IsUUID()
  payrollRunId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  month?: number;

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
  @Max(180)
  contractWindowDays?: number = 30;
}

export class PayslipListQueryDto extends PayrollPaginatedQueryDto {
  @IsOptional()
  @IsUUID()
  payrollRunId?: string;

  @IsOptional()
  @IsUUID()
  staffId?: string;

  @IsOptional()
  @IsEnum(PayslipStatus)
  status?: PayslipStatus;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  month?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  year?: number;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  search?: string;
}

export class SalaryStructureListQueryDto extends PayrollPaginatedQueryDto {
  @IsOptional()
  @IsUUID()
  staffId?: string;

  @IsOptional()
  @IsEnum(SalaryStructureStatus)
  status?: SalaryStructureStatus;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  search?: string;
}

export class StaffContractListQueryDto extends PayrollPaginatedQueryDto {
  @IsOptional()
  @IsUUID()
  staffId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  status?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  department?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(180)
  expiringWithinDays?: number;
}
