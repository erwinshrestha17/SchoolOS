import {
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreatePaymentRefundDto {
  @IsOptional()
  @IsNumber()
  @Min(0.01)
  amount?: number;

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
