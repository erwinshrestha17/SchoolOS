import { ApiProperty } from '@nestjs/swagger';
import { StudentLifecycleStatus } from '@prisma/client';
import {
  STUDENT_DUPLICATE_CONFIDENCE_FILTERS,
  STUDENT_DUPLICATE_CONFIDENCE_LEVELS,
  STUDENT_DUPLICATE_QUEUE_STATUSES,
  STUDENT_DUPLICATE_REVIEW_STATUSES,
  type StudentDuplicateConfidence,
  type StudentDuplicateConfidenceFilter,
  type StudentDuplicateQueueStatus,
  type StudentDuplicateReviewStatus,
} from '@schoolos/core';

export class DuplicateStudentCandidateStudentResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  studentSystemId!: string;

  @ApiProperty()
  fullNameEn!: string;

  @ApiProperty({ format: 'date' })
  dateOfBirth!: string;

  @ApiProperty({ nullable: true })
  admissionNumber!: string | null;

  @ApiProperty({ nullable: true })
  previousSchool!: string | null;

  @ApiProperty({ enum: StudentLifecycleStatus })
  lifecycleStatus!: StudentLifecycleStatus;

  @ApiProperty({ nullable: true })
  className!: string | null;

  @ApiProperty({ nullable: true })
  sectionName!: string | null;

  @ApiProperty({ type: [String] })
  guardianPhones!: string[];
}

export class DuplicateStudentReviewMetadataResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ enum: STUDENT_DUPLICATE_REVIEW_STATUSES })
  status!: StudentDuplicateReviewStatus;

  @ApiProperty()
  reason!: string;

  @ApiProperty()
  identityChanged!: boolean;

  @ApiProperty({ nullable: true, format: 'uuid' })
  reviewedById!: string | null;

  @ApiProperty({ format: 'date-time' })
  reviewedAt!: string;

  @ApiProperty({ nullable: true, format: 'uuid' })
  reopenedById!: string | null;

  @ApiProperty({ nullable: true, format: 'date-time' })
  reopenedAt!: string | null;

  @ApiProperty({ nullable: true })
  reopenReason!: string | null;
}

export class DuplicateStudentCandidateResponseDto {
  @ApiProperty({ type: DuplicateStudentCandidateStudentResponseDto })
  sourceStudent!: DuplicateStudentCandidateStudentResponseDto;

  @ApiProperty({ type: DuplicateStudentCandidateStudentResponseDto })
  candidateStudent!: DuplicateStudentCandidateStudentResponseDto;

  @ApiProperty({ minimum: 1, maximum: 100 })
  score!: number;

  @ApiProperty({ enum: STUDENT_DUPLICATE_CONFIDENCE_LEVELS })
  confidence!: StudentDuplicateConfidence;

  @ApiProperty({ type: [String] })
  reasons!: string[];

  @ApiProperty({ nullable: true })
  blockedReason!: string | null;

  @ApiProperty({ enum: STUDENT_DUPLICATE_QUEUE_STATUSES })
  reviewState!: StudentDuplicateQueueStatus;

  @ApiProperty({
    type: DuplicateStudentReviewMetadataResponseDto,
    nullable: true,
  })
  review!: DuplicateStudentReviewMetadataResponseDto | null;
}

export class DuplicateStudentCandidatesFiltersResponseDto {
  @ApiProperty({ nullable: true, format: 'uuid' })
  studentId!: string | null;

  @ApiProperty({ nullable: true })
  search!: string | null;

  @ApiProperty({ enum: STUDENT_DUPLICATE_CONFIDENCE_FILTERS })
  confidence!: StudentDuplicateConfidenceFilter;

  @ApiProperty({ enum: STUDENT_DUPLICATE_QUEUE_STATUSES })
  status!: StudentDuplicateQueueStatus;
}

export class DuplicateStudentCandidatesSummaryResponseDto {
  @ApiProperty({ minimum: 0 })
  pending!: number;

  @ApiProperty({ minimum: 0 })
  highConfidence!: number;

  @ApiProperty({ minimum: 0 })
  resolvedNotDuplicate!: number;

  @ApiProperty({ minimum: 0 })
  mergedToday!: number;

  @ApiProperty({ format: 'date-time' })
  asOf!: string;
}

export class ListDuplicateStudentCandidatesResponseDto {
  @ApiProperty({ type: [DuplicateStudentCandidateResponseDto] })
  candidates!: DuplicateStudentCandidateResponseDto[];

  @ApiProperty({ minimum: 1 })
  page!: number;

  @ApiProperty({ minimum: 1, maximum: 50 })
  limit!: number;

  @ApiProperty({ minimum: 0 })
  total!: number;

  @ApiProperty({ minimum: 0 })
  totalPages!: number;

  @ApiProperty({ enum: STUDENT_DUPLICATE_QUEUE_STATUSES })
  status!: StudentDuplicateQueueStatus;

  @ApiProperty({ nullable: true, format: 'uuid' })
  reviewedStudentId!: string | null;

  @ApiProperty({ type: DuplicateStudentCandidatesFiltersResponseDto })
  filters!: DuplicateStudentCandidatesFiltersResponseDto;

  @ApiProperty({ type: DuplicateStudentCandidatesSummaryResponseDto })
  summary!: DuplicateStudentCandidatesSummaryResponseDto;
}

export class DuplicateStudentReviewMutationResponseDto {
  @ApiProperty({ enum: STUDENT_DUPLICATE_QUEUE_STATUSES })
  reviewState!: StudentDuplicateQueueStatus;

  @ApiProperty({ type: DuplicateStudentReviewMetadataResponseDto })
  review!: DuplicateStudentReviewMetadataResponseDto;
}
