import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEmail,
  IsEnum,
  IsInt,
  IsIn,
  IsNotEmpty,
  IsNumberString,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

const SAAS_INVOICE_STATUSES = [
  'DRAFT',
  'ISSUED',
  'PAID',
  'PARTIAL',
  'OVERDUE',
  'CANCELLED',
] as const;
export type SaaSInvoiceStatusValue = (typeof SAAS_INVOICE_STATUSES)[number];

export class CreatePlatformPlanFeatureDto {
  @IsString()
  @IsNotEmpty()
  featureKey!: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}

export class CreateUsageLimitDto {
  @IsString()
  @IsNotEmpty()
  usageKey!: string;

  @IsInt()
  @Min(0)
  limit!: number;

  @IsOptional()
  @IsEnum(['DAILY', 'MONTHLY', 'ANNUAL', 'LIFETIME'])
  period?: 'DAILY' | 'MONTHLY' | 'ANNUAL' | 'LIFETIME';
}

export class CreatePlatformPlanDto {
  @IsString()
  @IsNotEmpty()
  key!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsNumberString()
  priceNpr?: string;

  @IsOptional()
  @IsString()
  billingCycle?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreatePlatformPlanFeatureDto)
  features?: CreatePlatformPlanFeatureDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateUsageLimitDto)
  limits?: CreateUsageLimitDto[];
}

export class UpdatePlatformPlanDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(['ACTIVE', 'ARCHIVED'])
  status?: 'ACTIVE' | 'ARCHIVED';

  @IsOptional()
  @IsNumberString()
  priceNpr?: string;

  @IsOptional()
  @IsString()
  billingCycle?: string;
}

export class AssignTenantSubscriptionDto {
  @IsString()
  @IsNotEmpty()
  planId!: string;

  @IsEnum([
    'TRIAL',
    'ACTIVE',
    'OVERDUE',
    'GRACE',
    'SUSPENDED',
    'EXPIRED',
    'CANCELLED',
  ])
  status!:
    | 'TRIAL'
    | 'ACTIVE'
    | 'OVERDUE'
    | 'GRACE'
    | 'SUSPENDED'
    | 'EXPIRED'
    | 'CANCELLED';

  @IsOptional()
  @IsDateString()
  startsAt?: string;

  @IsOptional()
  @IsDateString()
  endsAt?: string;

  @IsOptional()
  @IsDateString()
  renewsAt?: string;

  @IsOptional()
  @IsDateString()
  trialEndsAt?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  addOns?: string[];
}

export class TenantFeatureOverrideDto {
  @IsString()
  @IsNotEmpty()
  featureKey!: string;

  @IsBoolean()
  enabled!: boolean;

  @IsString()
  @MinLength(5)
  reason!: string;
}

export class UsageIncrementDto {
  @IsString()
  @IsNotEmpty()
  usageKey!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  amount?: number;

  @IsOptional()
  @IsEnum(['DAILY', 'MONTHLY', 'ANNUAL', 'LIFETIME'])
  period?: 'DAILY' | 'MONTHLY' | 'ANNUAL' | 'LIFETIME';
}

export class UpdateBillingProfileDto {
  @IsOptional()
  @IsString()
  billingContactName?: string;

  @IsOptional()
  @IsEmail()
  billingEmail?: string;

  @IsOptional()
  @IsString()
  billingPhone?: string;

  @IsOptional()
  @IsString()
  billingAddress?: string;

  @IsOptional()
  @IsString()
  panVatNumber?: string;

  @IsOptional()
  @IsString()
  preferredBillingCycle?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreateSaaSInvoiceLineDto {
  @IsEnum([
    'SUBSCRIPTION',
    'SETUP_FEE',
    'TRAINING_FEE',
    'SMS_BUNDLE',
    'STORAGE_ADDON',
    'CUSTOM_SUPPORT',
    'OTHER',
  ])
  lineType!:
    | 'SUBSCRIPTION'
    | 'SETUP_FEE'
    | 'TRAINING_FEE'
    | 'SMS_BUNDLE'
    | 'STORAGE_ADDON'
    | 'CUSTOM_SUPPORT'
    | 'OTHER';

  @IsString()
  @IsNotEmpty()
  description!: string;

  @IsInt()
  @Min(1)
  quantity!: number;

  @IsNumberString()
  unitAmount!: string;
}

export class CreateSaaSInvoiceDto {
  @IsOptional()
  @IsString()
  planId?: string;

  @IsOptional()
  @IsString()
  subscriptionId?: string;

  @IsDateString()
  issueDate!: string;

  @IsDateString()
  dueDate!: string;

  @IsOptional()
  @IsIn(SAAS_INVOICE_STATUSES)
  status?: SaaSInvoiceStatusValue;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateSaaSInvoiceLineDto)
  lines!: CreateSaaSInvoiceLineDto[];
}

export class RecordSaaSPaymentDto {
  @IsNumberString()
  amount!: string;

  @IsDateString()
  paymentDate!: string;

  @IsEnum(['CASH', 'BANK_TRANSFER', 'ESEWA', 'KHALTI', 'CHEQUE', 'OTHER'])
  method!: 'CASH' | 'BANK_TRANSFER' | 'ESEWA' | 'KHALTI' | 'CHEQUE' | 'OTHER';

  @IsOptional()
  @IsString()
  reference?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class CancelSaaSInvoiceDto {
  @IsString()
  @MinLength(5)
  reason!: string;
}

export class CreatePlatformWebhookEndpointDto {
  @IsEnum(['PLATFORM', 'TENANT'])
  ownerType!: 'PLATFORM' | 'TENANT';

  @IsOptional()
  @IsString()
  tenantId?: string;

  @IsUrl({ require_tld: false, require_protocol: true })
  url!: string;

  @IsString()
  @MinLength(16)
  signingSecret!: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  eventTypes!: string[];
}

export class UpdatePlatformWebhookEndpointDto {
  @IsOptional()
  @IsEnum(['ACTIVE', 'DISABLED'])
  status?: 'ACTIVE' | 'DISABLED';

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  eventTypes?: string[];
}

export class RecordPlatformWebhookDeliveryDto {
  @IsString()
  @IsNotEmpty()
  eventType!: string;

  @IsObject()
  payload!: Record<string, unknown>;

  @IsOptional()
  @IsEnum(['PENDING', 'DELIVERED', 'FAILED', 'RETRYING'])
  status?: 'PENDING' | 'DELIVERED' | 'FAILED' | 'RETRYING';

  @IsOptional()
  @IsInt()
  @Min(0)
  retryCount?: number;

  @IsOptional()
  @IsInt()
  responseCode?: number;

  @IsOptional()
  @IsString()
  responseMessageSummary?: string;
}

export class CreatePlatformApiKeyDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  name!: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Matches(/^[a-z][a-z0-9:._-]{1,80}$/i, { each: true })
  scopes?: string[];

  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}

export class RevokePlatformApiKeyDto {
  @IsString()
  @MinLength(5)
  reason!: string;
}

export class UpsertProviderConfigDto {
  @IsEnum([
    'SMS',
    'EMAIL',
    'FCM',
    'OBJECT_STORAGE',
    'PAYMENT_GATEWAY',
    'AI_PROVIDER',
  ])
  type!:
    | 'SMS'
    | 'EMAIL'
    | 'FCM'
    | 'OBJECT_STORAGE'
    | 'PAYMENT_GATEWAY'
    | 'AI_PROVIDER';

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsBoolean()
  enabled!: boolean;

  @IsEnum(['TEST', 'PRODUCTION'])
  environment!: 'TEST' | 'PRODUCTION';

  @IsObject()
  config!: Record<string, unknown>;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  secretKeys?: string[];
}

export class RetryFailedJobDto {
  @IsString()
  @IsNotEmpty()
  queueName!: string;

  @IsString()
  @IsNotEmpty()
  jobId!: string;

  @IsString()
  @MinLength(5)
  reason!: string;
}

export class OnboardingOverrideDto {
  @IsString()
  @IsNotEmpty()
  itemKey!: string;

  @IsBoolean()
  completed!: boolean;

  @IsString()
  @MinLength(5)
  reason!: string;
}
