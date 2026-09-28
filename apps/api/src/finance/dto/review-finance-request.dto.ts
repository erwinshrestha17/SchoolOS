import { IsIn, IsOptional, IsString } from 'class-validator';
import { FinanceRequestStatus } from '@prisma/client';

export class ReviewFinanceRequestDto {
  @IsIn([FinanceRequestStatus.REVIEWED])
  status!: FinanceRequestStatus;

  @IsOptional()
  @IsString()
  reviewNote?: string;
}
