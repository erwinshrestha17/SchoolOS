import { IsIn, IsNumber, IsPositive, IsString, Length } from 'class-validator';
import {
  PARENT_SANDBOX_PAYMENT_PROVIDERS,
  type ParentSandboxPaymentProvider,
} from '../../finance/sandbox-payment-provider';

export class ParentSandboxFeePaymentDto {
  @IsString()
  invoiceId!: string;

  @IsNumber()
  @IsPositive()
  amount!: number;

  @IsString()
  @IsIn(PARENT_SANDBOX_PAYMENT_PROVIDERS)
  provider!: ParentSandboxPaymentProvider;

  @IsString()
  @Length(16, 128)
  idempotencyKey!: string;
}

export class ParentSandboxCanteenTopUpDto {
  @IsNumber()
  @IsPositive()
  amount!: number;

  @IsString()
  @IsIn(PARENT_SANDBOX_PAYMENT_PROVIDERS)
  provider!: ParentSandboxPaymentProvider;

  @IsString()
  @Length(16, 128)
  idempotencyKey!: string;
}
