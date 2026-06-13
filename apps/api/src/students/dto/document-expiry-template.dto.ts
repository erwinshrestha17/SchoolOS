import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class UpsertDocumentExpiryTemplateDto {
  @IsIn(['email', 'sms'])
  channel!: 'email' | 'sms';

  @IsIn(['expired', 'expiring'])
  reminderStatus!: 'expired' | 'expiring';

  @IsOptional()
  @IsString()
  @MaxLength(200)
  subjectTemplate?: string;

  @IsString()
  @MaxLength(1000)
  messageTemplate!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  daysBeforeExpiry?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
