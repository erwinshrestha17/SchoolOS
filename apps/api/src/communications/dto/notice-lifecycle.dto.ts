import { AudienceType, NoticePriority } from '@prisma/client';
import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  MaxLength,
} from 'class-validator';

export class CreateNoticeDraftDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(10_000)
  body!: string;

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
  @IsNotEmpty()
  @MaxLength(10_000)
  body?: string;

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
