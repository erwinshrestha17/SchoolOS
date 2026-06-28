import { ApprovalDecisionType } from '@prisma/client';
import {
  IsIn,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class MobilePrincipalApprovalQueryDto {
  @IsOptional()
  @IsIn(['pending', 'approved', 'rejected'])
  status?: 'pending' | 'approved' | 'rejected';
}

export class MobilePrincipalApprovalDecisionDto {
  @IsEnum(ApprovalDecisionType)
  decision!: ApprovalDecisionType;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason?: string;

  @IsUUID()
  idempotencyKey!: string;
}
