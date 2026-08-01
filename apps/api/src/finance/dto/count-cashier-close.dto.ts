import { IsDateString, IsDecimal, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

export class CountCashierCloseDto {
  @IsDateString()
  countedThroughAt!: string;

  @IsDecimal({ decimal_digits: '1,2', force_decimal: false })
  actualCashAmount!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  varianceReason?: string;

  @IsOptional()
  @IsObject()
  denominationBreakdown?: Record<string, unknown>;
}
