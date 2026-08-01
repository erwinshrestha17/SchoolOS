import { DiscountType } from '@prisma/client';
import {
  IsDecimal,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreateDiscountRuleDto {
  @IsString()
  name!: string;

  @IsString()
  reason!: string;

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
  @IsDecimal({ decimal_digits: '1,2', force_decimal: false })
  amountOff?: string;
}
