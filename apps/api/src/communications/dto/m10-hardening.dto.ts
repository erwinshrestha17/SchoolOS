import {
  IsDateString,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

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

export class ResolveEscalationDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  resolutionNote!: string;

  @IsOptional()
  @IsIn(['RESOLVED', 'CLOSED', 'WARNED'])
  action?: 'RESOLVED' | 'CLOSED' | 'WARNED';
}
