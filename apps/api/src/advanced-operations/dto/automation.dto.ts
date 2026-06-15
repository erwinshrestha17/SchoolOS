import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  AutomationActionType,
  AutomationConditionOperator,
  AutomationTriggerType,
} from '@prisma/client';

export class AutomationTriggerDto {
  @IsEnum(AutomationTriggerType)
  type!: AutomationTriggerType;

  @IsOptional()
  @IsString()
  sourceModule?: string;

  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;
}

export class AutomationConditionDto {
  @IsString()
  @IsNotEmpty()
  fieldPath!: string;

  @IsEnum(AutomationConditionOperator)
  operator!: AutomationConditionOperator;

  @IsOptional()
  value?: unknown;
}

export class AutomationActionDto {
  @IsEnum(AutomationActionType)
  type!: AutomationActionType;

  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

export class CreateAutomationRuleDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  priority?: number;

  @IsOptional()
  @IsString()
  featureKey?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AutomationTriggerDto)
  triggers!: AutomationTriggerDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AutomationConditionDto)
  conditions?: AutomationConditionDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AutomationActionDto)
  actions!: AutomationActionDto[];
}

export class ExecuteAutomationTriggerDto {
  @IsEnum(AutomationTriggerType)
  triggerType!: AutomationTriggerType;

  @IsOptional()
  @IsString()
  targetType?: string;

  @IsOptional()
  @IsString()
  targetId?: string;

  @IsOptional()
  @IsObject()
  payload?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  idempotencyKey?: string;
}
