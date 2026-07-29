import { IsIn, IsNumber, IsPositive, IsString, Length } from 'class-validator';
import { ConfirmStudentActionFields } from '../../common/security/confirm-student-action';
import {
  PARENT_SANDBOX_PAYMENT_PROVIDERS,
  type ParentSandboxPaymentProvider,
} from '../../finance/sandbox-payment-provider';

export class ParentSandboxFeePaymentDto extends ConfirmStudentActionFields {
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

export class ParentSandboxCanteenTopUpDto extends ConfirmStudentActionFields {
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
