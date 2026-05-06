import { PaymentMethod, SalaryComponentType } from '@prisma/client';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class SalaryComponentDto {
  @IsString()
  name!: string;

  @IsEnum(SalaryComponentType)
  componentType!: SalaryComponentType;

  @IsNumber()
  amount!: number;

  @IsOptional()
  @IsBoolean()
  taxable?: boolean;
}

export class CreateSalaryStructureDto {
  @IsString()
  staffId!: string;

  @IsDateString()
  effectiveFrom!: string;

  @IsOptional()
  @IsDateString()
  effectiveTo?: string;

  @IsNumber()
  basicSalary!: number;

  @IsOptional()
  @IsNumber()
  allowances?: number;

  @IsOptional()
  @IsNumber()
  deductions?: number;

  @IsOptional()
  @IsBoolean()
  pfEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  tdsEnabled?: boolean;

  @IsOptional()
  @IsEnum(PaymentMethod)
  paymentMethod?: PaymentMethod;

  @IsOptional()
  @IsString()
  bankAccount?: string;

  @IsOptional()
  @IsString()
  bankName?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SalaryComponentDto)
  components?: SalaryComponentDto[];
}
