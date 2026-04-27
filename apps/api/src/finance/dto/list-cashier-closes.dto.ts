import { PaymentMethod } from '@prisma/client';
import { IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';

export class ListCashierClosesDto {
  @IsOptional()
  @IsDateString()
  openedFrom?: string;

  @IsOptional()
  @IsDateString()
  closedTo?: string;

  @IsOptional()
  @IsString()
  collectorUserId?: string;

  @IsOptional()
  @IsEnum(PaymentMethod)
  paymentMethod?: PaymentMethod;
}
