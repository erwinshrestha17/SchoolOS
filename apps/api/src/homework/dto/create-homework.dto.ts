import { HomeworkAssignmentStatus } from '@prisma/client';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsISO8601,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

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
  @IsISO8601()
  assignedDate?: string;

  @IsISO8601()
  dueDate!: string;

  @IsOptional()
  @IsEnum(HomeworkAssignmentStatus)
  status?: HomeworkAssignmentStatus;

  @IsOptional()
  @IsBoolean()
  submissionRequired?: boolean;

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
}
