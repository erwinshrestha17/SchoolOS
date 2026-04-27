import { IsEnum, IsOptional, IsString } from 'class-validator';

export enum AttendanceConflictReviewDecision {
  REVIEWED_WITHOUT_CHANGE = 'REVIEWED_WITHOUT_CHANGE',
  REJECTED_RESUBMISSION = 'REJECTED_RESUBMISSION',
}

export class ReviewAttendanceConflictDto {
  @IsOptional()
  @IsEnum(AttendanceConflictReviewDecision)
  decision?: AttendanceConflictReviewDecision;

  @IsOptional()
  @IsString()
  resolutionNote?: string;
}
