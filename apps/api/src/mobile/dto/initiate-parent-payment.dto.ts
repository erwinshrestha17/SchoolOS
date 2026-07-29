import {
  IsNotEmpty,
  IsNumber,
  IsPositive,
  IsString,
  Length,
} from 'class-validator';
import { ConfirmStudentActionFields } from '../../common/security/confirm-student-action';

export class InitiateParentPaymentDto extends ConfirmStudentActionFields {
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
