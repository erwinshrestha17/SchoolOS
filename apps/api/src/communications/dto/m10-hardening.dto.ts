import {
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateConsentTemplateDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  key!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  consentType!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  version!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  body!: string;

  @IsOptional()
  @IsDateString()
  effectiveFrom?: string;
}

export class UpdateConsentTemplateDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  body?: string;

  @IsOptional()
  @IsDateString()
  effectiveFrom?: string;
}

export class CommunicationPreferenceDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  source?: string;
}

export class RetryDeliveryDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class ProviderDeliveryStatusDto {
  @IsOptional()
  @IsEnum(['SMS', 'EMAIL', 'FCM'])
  providerType?: 'SMS' | 'EMAIL' | 'FCM';

  @IsOptional()
  @IsString()
  @MaxLength(100)
  providerName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  signature?: string;

  @IsOptional()
  @IsString()
  deliveryId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  providerMessageId?: string;

  @IsIn(['SENT', 'DELIVERED', 'FAILED'])
  status!: 'SENT' | 'DELIVERED' | 'FAILED';

  @IsOptional()
  @IsString()
  @MaxLength(100)
  failureCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  failureReason?: string;
}

export class ResendNoticeDto {
  @IsOptional()
  @IsString({ each: true })
  recipientUserIds?: string[];

  @IsOptional()
  @IsString({ each: true })
  guardianIds?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class CommunicationAuditQueryDto {
  @IsOptional()
  @IsString()
  resource?: string;

  @IsOptional()
  @IsString()
  action?: string;

  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsString()
  requestId?: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;
}

export class ResolveEscalationDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  resolutionNote!: string;

  @IsOptional()
  @IsIn(['RESOLVED', 'CLOSED', 'WARNED'])
  action?: 'RESOLVED' | 'CLOSED' | 'WARNED';
}
