import { IsNotEmpty, IsNumber, IsString, IsPositive } from 'class-validator';

export class InitiateOnlinePaymentDto {
  @IsString()
  @IsNotEmpty()
  invoiceId!: string;

  @IsNumber()
  @IsPositive()
  amount!: number;

  @IsString()
  @IsNotEmpty()
  provider!: string;
}
