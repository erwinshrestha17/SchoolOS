import {
  IsDateString,
  IsNotEmpty,
  IsDecimal,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreatePaymentRefundDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  idempotencyKey!: string;

  @IsOptional()
  @IsDecimal({ decimal_digits: '1,2', force_decimal: false })
  amount?: string;

  @IsString()
  @IsNotEmpty()
  reason!: string;

  @IsOptional()
  @IsDateString()
  refundDate?: string;

  @IsOptional()
  @IsString()
  referenceNumber?: string;

  @IsOptional()
  @IsString()
  narration?: string;
}
