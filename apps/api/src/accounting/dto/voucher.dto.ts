import {
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class ExpenseVoucherDto {
  @IsString()
  expenseAccountId!: string;

  @IsString()
  paymentAccountId!: string;

  @IsNumber()
  @Min(0.01)
  amount!: number;

  @IsDateString()
  entryDate!: string;

  @IsString()
  narration!: string;

  @IsOptional()
  @IsString()
  reference?: string;
}

export class PaymentVoucherDto {
  @IsString()
  payeeAccountId!: string;

  @IsString()
  paymentAccountId!: string;

  @IsNumber()
  @Min(0.01)
  amount!: number;

  @IsDateString()
  entryDate!: string;

  @IsString()
  narration!: string;

  @IsOptional()
  @IsString()
  reference?: string;
}

export class ReceiptVoucherDto {
  @IsString()
  receiptAccountId!: string;

  @IsString()
  depositAccountId!: string;

  @IsNumber()
  @Min(0.01)
  amount!: number;

  @IsDateString()
  entryDate!: string;

  @IsString()
  narration!: string;

  @IsOptional()
  @IsString()
  reference?: string;
}

export class ContraVoucherDto {
  @IsString()
  fromAccountId!: string;

  @IsString()
  toAccountId!: string;

  @IsNumber()
  @Min(0.01)
  amount!: number;

  @IsDateString()
  entryDate!: string;

  @IsString()
  narration!: string;
}
