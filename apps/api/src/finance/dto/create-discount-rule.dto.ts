import { DiscountType } from '@prisma/client';
import { IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateDiscountRuleDto {
  @IsString()
  name!: string;

  @IsEnum(DiscountType)
  type!: DiscountType;

  @IsOptional()
  @IsString()
  feeHeadId?: string;

  @IsOptional()
  @IsString()
  classId?: string;

  @IsOptional()
  @IsString()
  feePlanId?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  percentOff?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  amountOff?: number;
}
