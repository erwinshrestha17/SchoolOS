import {
  IsNotEmpty,
  IsNumber,
  IsPositive,
  IsString,
  Length,
} from 'class-validator';

export class InitiateParentPaymentDto {
  @IsString()
  @IsNotEmpty()
  invoiceId!: string;

  @IsNumber()
  @IsPositive()
  amount!: number;

  @IsString()
  @IsNotEmpty()
  provider!: string;

  @IsString()
  @Length(16, 128)
  idempotencyKey!: string;
}
