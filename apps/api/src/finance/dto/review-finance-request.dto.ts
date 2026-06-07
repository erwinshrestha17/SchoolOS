import { IsEnum, IsOptional, IsString } from 'class-validator';
import { FinanceRequestStatus } from '@prisma/client';

export class ReviewFinanceRequestDto {
  @IsEnum(FinanceRequestStatus)
  status!: FinanceRequestStatus;

  @IsOptional()
  @IsString()
  reviewNote?: string;
}
