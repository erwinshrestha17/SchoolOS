import { PaymentMethod } from '@prisma/client';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CollectPaymentDto {
  @IsString()
  invoiceId!: string;

  @IsNumber()
  @Min(0.01)
  amount!: number;

  @IsEnum(PaymentMethod)
  method!: PaymentMethod;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  referenceNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  narration?: string;

  @IsOptional()
  @IsBoolean()
  isAdvance?: boolean;

  @IsOptional()
  @IsDateString()
  recognizedAt?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  idempotencyKey!: string;
}
