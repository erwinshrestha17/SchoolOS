import { IsOptional, IsString } from 'class-validator';

export class PayrollActionDto {
  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsString()
  paymentAccountCode?: string;
}
