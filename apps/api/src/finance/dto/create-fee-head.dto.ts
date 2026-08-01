import { FeeFrequency } from '@prisma/client';
import {
  IsBoolean,
  IsDecimal,
  IsEnum,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateFeeHeadDto {
  @IsString()
  code!: string;

  @IsString()
  name!: string;

  @IsEnum(FeeFrequency)
  frequency!: FeeFrequency;

  @IsDecimal({ decimal_digits: '1,2', force_decimal: false })
  defaultAmount!: string;

  @IsOptional()
  @IsBoolean()
  vatApplicable?: boolean;
}
