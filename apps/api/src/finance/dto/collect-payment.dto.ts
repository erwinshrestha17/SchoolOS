import { PaymentMethod } from '@prisma/client';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
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
  referenceNumber?: string;

  @IsOptional()
  @IsString()
  narration?: string;

  @IsOptional()
  @IsBoolean()
  isAdvance?: boolean;

  @IsOptional()
  @IsDateString()
  recognizedAt?: string;

  @IsOptional()
  @IsString()
  idempotencyKey?: string;
}
