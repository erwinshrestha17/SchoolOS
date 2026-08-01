import { IsDecimal, IsOptional, IsString } from 'class-validator';

export class CreateFeeWaiverDto {
  @IsString()
  studentId!: string;

  @IsOptional()
  @IsString()
  feeHeadId?: string;

  @IsOptional()
  @IsString()
  invoiceId?: string;

  @IsDecimal({ decimal_digits: '1,2', force_decimal: false })
  amount!: string;

  @IsString()
  reason!: string;
}
