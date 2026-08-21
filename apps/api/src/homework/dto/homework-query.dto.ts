import { HomeworkAssignmentStatus } from '@prisma/client';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Matches,
  Min,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export class HomeworkQueryDto {
  @IsOptional()
  @IsString()
  academicYearId?: string;

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
  @IsString()
  teacherId?: string;

  /**
   * "My homework only". Resolved server-side to the caller's own Staff row,
   * so it cannot be pointed at a colleague the way `teacherId` can -- and it
   * lets a teacher reach their own drafts without the UI needing to know its
   * own staff id (P1.6).
   */
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true' || value === '1')
  @IsBoolean()
  mine?: boolean;

  @IsOptional()
  @IsString()
  studentId?: string;

  @IsOptional()
  @IsEnum(HomeworkAssignmentStatus)
  status?: HomeworkAssignmentStatus;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  @IsOptional()
  @IsDateString({ strict: true })
  @Matches(DATE_ONLY_PATTERN, {
    message: 'assignedDate must use YYYY-MM-DD.',
  })
  assignedDate?: string;

  @IsOptional()
  @IsISO8601()
  dueFrom?: string;

  @IsOptional()
  @IsISO8601()
  dueTo?: string;

  @IsOptional()
  @IsIn(['dueDate', 'assignedDate', 'createdAt', 'title'])
  sortBy?: 'dueDate' | 'assignedDate' | 'createdAt' | 'title';

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
