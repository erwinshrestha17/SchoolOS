import { AudienceType, NoticePriority } from '@prisma/client';
import {
  IsDateString,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

const MOBILE_EMERGENCY_PRIORITIES = [
  NoticePriority.URGENT,
  NoticePriority.EMERGENCY,
] as const;

const MOBILE_NOTICE_AUDIENCES = [
  AudienceType.ALL,
  AudienceType.CLASS,
  AudienceType.SECTION,
] as const;

export class MobilePrincipalEmergencyNoticePreviewDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  title!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  body!: string;

  @IsIn(MOBILE_EMERGENCY_PRIORITIES)
  priority!: (typeof MOBILE_EMERGENCY_PRIORITIES)[number];

  @IsIn(MOBILE_NOTICE_AUDIENCES)
  audienceType!: (typeof MOBILE_NOTICE_AUDIENCES)[number];

  @IsOptional()
  @IsUUID()
  classId?: string;

  @IsOptional()
  @IsUUID()
  sectionId?: string;
}

export class MobilePrincipalEmergencyNoticeSubmitDto extends MobilePrincipalEmergencyNoticePreviewDto {
  @IsIn(['SEND_NOW', 'SCHEDULE'])
  sendMode!: 'SEND_NOW' | 'SCHEDULE';

  @IsOptional()
  @IsDateString()
  scheduledFor?: string;

  @IsOptional()
  @IsUUID()
  attachmentFileId?: string;

  @IsUUID()
  idempotencyKey!: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason?: string;
}
