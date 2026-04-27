import {
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreateExpenseDto {
  @IsString()
  expenseAccountId!: string;

  @IsString()
  paymentAccountId!: string;

  @IsNumber()
  @Min(0.01)
  amount!: number;

  @IsDateString()
  expenseDate!: string;

  @IsString()
  narration!: string;

  @IsOptional()
  @IsString()
  referenceNumber?: string;
}
