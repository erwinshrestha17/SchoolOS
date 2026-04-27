import { PaymentMethod } from '@prisma/client';
import { IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';

export class CashierCloseWindowDto {
  @IsDateString()
  openedAt!: string;

  @IsDateString()
  closedAt!: string;

  @IsOptional()
  @IsString()
  collectorUserId?: string;

  @IsOptional()
  @IsEnum(PaymentMethod)
  paymentMethod?: PaymentMethod;
}
