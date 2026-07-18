import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  STUDENT_DUPLICATE_CONFIDENCE_FILTERS,
  STUDENT_DUPLICATE_QUEUE_STATUSES,
  type StudentDuplicateConfidenceFilter,
  type StudentDuplicateQueueStatus,
} from '@schoolos/core';

export class ListDuplicateStudentCandidatesDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  studentId?: string;

  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ minimum: 1, maximum: 50, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 20;

  @ApiPropertyOptional({ maxLength: 120 })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  @ApiPropertyOptional({
    enum: STUDENT_DUPLICATE_CONFIDENCE_FILTERS,
    default: 'ALL',
  })
  @IsOptional()
  @IsIn(STUDENT_DUPLICATE_CONFIDENCE_FILTERS)
  confidence?: StudentDuplicateConfidenceFilter = 'ALL';

  @ApiPropertyOptional({
    enum: STUDENT_DUPLICATE_QUEUE_STATUSES,
    default: 'PENDING',
  })
  @IsOptional()
  @IsIn(STUDENT_DUPLICATE_QUEUE_STATUSES)
  status?: StudentDuplicateQueueStatus = 'PENDING';
}
