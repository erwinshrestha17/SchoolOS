import { HomeworkSubmissionStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class HomeworkSubmissionQueryDto {
  @IsOptional()
  @IsString()
  studentId?: string;

  @IsOptional()
  @IsEnum(HomeworkSubmissionStatus)
  status?: HomeworkSubmissionStatus;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  @IsOptional()
  @IsIn(['LATE', 'ON_TIME'])
  timing?: 'LATE' | 'ON_TIME';

  @IsOptional()
  @IsIn(['REVIEWED', 'UNREVIEWED'])
  reviewState?: 'REVIEWED' | 'UNREVIEWED';

  @IsOptional()
  @IsString()
  classId?: string;

  @IsOptional()
  @IsString()
  sectionId?: string;

  @IsOptional()
  @IsString()
  subjectId?: string;

  @IsOptional()
  @IsISO8601()
  submittedFrom?: string;

  @IsOptional()
  @IsISO8601()
  submittedTo?: string;

  @IsOptional()
  @IsIn(['submittedAt', 'updatedAt', 'status', 'studentName'])
  sortBy?: 'submittedAt' | 'updatedAt' | 'status' | 'studentName';

  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc';

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
