import {
  IsArray,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { ApprovalDecisionType, ApprovalWorkflowType } from '@prisma/client';

export class CreateApprovalPolicyDto {
  @IsEnum(ApprovalWorkflowType)
  workflowType!: ApprovalWorkflowType;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  minApprovals?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  approverRoles?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  approverPermissions?: string[];

  @IsOptional()
  @IsString()
  finalActionKey?: string;
}

export class CreateApprovalRequestDto {
  @IsEnum(ApprovalWorkflowType)
  workflowType!: ApprovalWorkflowType;

  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsString()
  @IsNotEmpty()
  reason!: string;

  @IsString()
  @IsNotEmpty()
  targetModule!: string;

  @IsString()
  @IsNotEmpty()
  targetType!: string;

  @IsString()
  @IsNotEmpty()
  targetId!: string;

  @IsOptional()
  @IsString()
  policyId?: string;

  @IsOptional()
  @IsObject()
  beforeContext?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  afterContext?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  safeContext?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  finalActionKey?: string;

  @IsOptional()
  @IsObject()
  finalActionPayload?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  idempotencyKey?: string;
}

export class DecideApprovalRequestDto {
  @IsEnum(ApprovalDecisionType)
  decision!: ApprovalDecisionType;

  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsObject()
  context?: Record<string, unknown>;
}

export class CreateApprovalCommentDto {
  @IsString()
  @IsNotEmpty()
  body!: string;
}

export class AttachApprovalFileDto {
  @IsString()
  @IsNotEmpty()
  fileAssetId!: string;

  @IsOptional()
  @IsString()
  label?: string;
}
