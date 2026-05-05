import { HomeworkSubmissionStatus } from '@prisma/client';
import {
  IsArray,
  IsEnum,
  IsISO8601,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateHomeworkSubmissionDto {
  @IsString()
  studentId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  submissionText?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  attachmentIds?: string[];

  @IsOptional()
  @IsObject()
  attachmentMetadata?: Record<string, unknown>;

  @IsOptional()
  @IsISO8601()
  submittedAt?: string;
}

export class UpdateHomeworkSubmissionDto {
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  submissionText?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  attachmentIds?: string[];

  @IsOptional()
  @IsObject()
  attachmentMetadata?: Record<string, unknown>;
}

export class UpdateHomeworkSubmissionStatusDto {
  @IsEnum(HomeworkSubmissionStatus)
  status!: HomeworkSubmissionStatus;
}

export class ReviewHomeworkSubmissionDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  score?: number;

  @IsOptional()
  @IsString()
  @MaxLength(3000)
  teacherRemarks?: string;

  @IsOptional()
  @IsString()
  @MaxLength(3000)
  correctionRemarks?: string;
}

export class RequestCorrectionDto {
  @IsString()
  @MaxLength(3000)
  correctionRemarks!: string;
}
