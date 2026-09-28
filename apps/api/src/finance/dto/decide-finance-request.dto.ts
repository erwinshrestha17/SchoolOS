import { IsIn, IsOptional, IsString } from 'class-validator';
import { FinanceRequestStatus } from '@prisma/client';

export class DecideFinanceRequestDto {
  @IsIn([FinanceRequestStatus.APPROVED, FinanceRequestStatus.REJECTED])
  status!: 'APPROVED' | 'REJECTED';

  @IsOptional()
  @IsString()
  reviewNote?: string;
}
