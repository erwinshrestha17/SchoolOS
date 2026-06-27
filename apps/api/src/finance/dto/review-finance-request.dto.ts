import { IsIn, IsOptional, IsString } from 'class-validator';
import { FinanceRequestStatus } from '@prisma/client';

export class ReviewFinanceRequestDto {
  @IsIn([FinanceRequestStatus.APPROVED, FinanceRequestStatus.REJECTED])
  status!: FinanceRequestStatus;

  @IsOptional()
  @IsString()
  reviewNote?: string;
}
