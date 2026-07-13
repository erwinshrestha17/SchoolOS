import {
  HomeworkAssignmentStatus,
  HomeworkSubmissionMethod,
} from '@prisma/client';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsISO8601,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class HomeworkRecurrenceDto {
  @IsIn(['DAILY', 'WEEKLY'])
  frequency!: 'DAILY' | 'WEEKLY';

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12)
  interval?: number;

  @IsOptional()
  @IsInt()
  @Min(2)
  @Max(60)
  occurrenceCount?: number;

  @IsOptional()
  @IsISO8601()
  repeatUntil?: string;
}

export class CreateHomeworkDto {
  @IsString()
  academicYearId!: string;

  @IsString()
  classId!: string;

  @IsOptional()
  @IsString()
  sectionId?: string;

  @IsString()
  subjectId!: string;

  @IsOptional()
  @IsString()
  teacherId?: string;

  @IsOptional()
  @IsString()
  assignedByStaffId?: string;

  @IsString()
  @MaxLength(160)
  title!: string;

  @IsString()
  @MaxLength(5000)
  instructions!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @IsOptional()
  @IsISO8601()
  assignedDate?: string;

  @IsISO8601()
  dueDate!: string;

  @IsOptional()
  @IsISO8601()
  dueAt?: string;

  @IsOptional()
  @IsEnum(HomeworkAssignmentStatus)
  status?: HomeworkAssignmentStatus;

  @IsOptional()
  @IsBoolean()
  submissionRequired?: boolean;

  @IsOptional()
  @IsEnum(HomeworkSubmissionMethod)
  submissionMethod?: HomeworkSubmissionMethod;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  parentInstructions?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  attachmentFileIds?: string[];

  @IsOptional()
  @IsObject()
  attachmentMetadata?: Record<string, unknown>;

  @IsOptional()
  @IsNumber()
  @Min(0)
  maxScore?: number;

  @IsOptional()
  @IsBoolean()
  saveAsTemplate?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  templateName?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => HomeworkRecurrenceDto)
  recurrence?: HomeworkRecurrenceDto;
}
