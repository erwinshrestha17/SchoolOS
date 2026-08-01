import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsDecimal,
  MaxLength,
} from 'class-validator';

export class CreateFinanceRequestDto {
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
}
