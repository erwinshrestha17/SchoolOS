import { FeeFrequency } from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreateFeeHeadDto {
  @IsString()
  code!: string;

  @IsString()
  name!: string;

  @IsEnum(FeeFrequency)
  frequency!: FeeFrequency;

  @IsNumber()
  @Min(0)
  defaultAmount!: number;

  @IsOptional()
  @IsBoolean()
  vatApplicable?: boolean;
}
