import {
  AudienceType,
  CommunicationTemplateCategory,
  NoticePriority,
} from '@prisma/client';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  MaxLength,
} from 'class-validator';

export class CreateNoticeDraftDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  titleNe?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(10_000)
  body!: string;

  @IsOptional()
  @IsString()
  @MaxLength(10_000)
  bodyNe?: string;

  @IsOptional()
  @IsEnum(CommunicationTemplateCategory)
  category?: CommunicationTemplateCategory;

  @IsOptional()
  @IsBoolean()
  isPinned?: boolean;

  @IsOptional()
  @IsString()
  templateId?: string;

  @IsOptional()
  @IsEnum(NoticePriority)
  priority?: NoticePriority;

  @IsOptional()
  @IsEnum(AudienceType)
  audienceType?: AudienceType;

  @IsOptional()
  @IsString()
  classId?: string;

  @IsOptional()
  @IsString()
  sectionId?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  roleNames?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(500)
  @IsUUID('4', { each: true })
  staffIds?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(500)
  @IsUUID('4', { each: true })
  studentIds?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(500)
  @IsUUID('4', { each: true })
  guardianIds?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(500)
  @IsUUID('4', { each: true })
  recipientUserIds?: string[];

  @IsOptional()
  @IsString()
  attachmentFileId?: string;

  @IsOptional()
  @IsDateString()
  scheduledFor?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  idempotencyKey!: string;
}

export class UpdateNoticeDraftDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  titleNe?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(10_000)
  body?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10_000)
  bodyNe?: string;

  @IsOptional()
  @IsEnum(CommunicationTemplateCategory)
  category?: CommunicationTemplateCategory;

  @IsOptional()
  @IsBoolean()
  isPinned?: boolean;

  @IsOptional()
  @IsString()
  templateId?: string;

  @IsOptional()
  @IsEnum(NoticePriority)
  priority?: NoticePriority;

  @IsOptional()
  @IsEnum(AudienceType)
  audienceType?: AudienceType;

  @IsOptional()
  @IsString()
  classId?: string;

  @IsOptional()
  @IsString()
  sectionId?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  roleNames?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(500)
  @IsUUID('4', { each: true })
  staffIds?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(500)
  @IsUUID('4', { each: true })
  studentIds?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(500)
  @IsUUID('4', { each: true })
  guardianIds?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(500)
  @IsUUID('4', { each: true })
  recipientUserIds?: string[];

  @IsOptional()
  @IsString()
  attachmentFileId?: string;

  @IsOptional()
  @IsDateString()
  scheduledFor?: string;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}

export class NoticeScheduleDto {
  @IsDateString()
  scheduledFor!: string;
}

export class NoticeApprovalRequestDto {
  @IsString()
  @Length(3, 500)
  reason!: string;

  @IsOptional()
  @IsDateString()
  scheduledFor?: string;
}

export class NoticeLifecycleReasonDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason!: string;
}
