import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CashierCloseTransitionDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason!: string;
}

export class DepositCashierCloseDto extends CashierCloseTransitionDto {
  @IsString()
  @IsNotEmpty()
  depositId!: string;
}
