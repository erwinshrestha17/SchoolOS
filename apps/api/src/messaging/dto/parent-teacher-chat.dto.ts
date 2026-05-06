import {
  ChatAbuseReportStatus,
  ChatAvailabilityAppliesToRole,
  ParentTeacherMessagePriority,
  ParentTeacherThreadStatus,
} from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export class ListParentTeacherThreadsDto {
  @IsOptional()
  @IsEnum(ParentTeacherThreadStatus)
  status?: ParentTeacherThreadStatus;

  @IsOptional()
  @IsString()
  studentId?: string;

  @IsOptional()
  @IsString()
  guardianId?: string;

  @IsOptional()
  @IsString()
  classTeacherId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

export class CreateParentTeacherThreadDto {
  @IsString()
  studentId!: string;

  @IsOptional()
  @IsString()
  guardianId?: string;

  @IsOptional()
  @IsString()
  classTeacherId?: string;

  @IsOptional()
  @IsString()
  academicYearId?: string;
}

export class CloseParentTeacherThreadDto {
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason!: string;
}

export class EscalateParentTeacherThreadDto {
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason!: string;

  @IsOptional()
  @IsString()
  escalatedToUserId?: string;
}

export class ListParentTeacherMessagesDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

export class CreateParentTeacherMessageDto {
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  message!: string;

  @IsOptional()
  @IsEnum(ParentTeacherMessagePriority)
  priority?: ParentTeacherMessagePriority;
}

export class ChatAvailabilityRuleDto {
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek!: number;

  @IsBoolean()
  enabled!: boolean;

  @IsString()
  @Matches(TIME_PATTERN)
  startTime!: string;

  @IsString()
  @Matches(TIME_PATTERN)
  endTime!: string;

  @IsEnum(ChatAvailabilityAppliesToRole)
  appliesToRole!: ChatAvailabilityAppliesToRole;
}

export class UpdateChatAvailabilityDto {
  @IsArray()
  @ArrayMaxSize(21)
  @ValidateNested({ each: true })
  @Type(() => ChatAvailabilityRuleDto)
  rules!: ChatAvailabilityRuleDto[];
}

export class CreateChatAbuseReportDto {
  @IsOptional()
  @IsString()
  messageId?: string;

  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason!: string;
}

export class ReviewChatAbuseReportDto {
  @IsEnum(ChatAbuseReportStatus)
  status!: ChatAbuseReportStatus;
}

export class ResolveChatEscalationDto {
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  resolutionNote!: string;
}
