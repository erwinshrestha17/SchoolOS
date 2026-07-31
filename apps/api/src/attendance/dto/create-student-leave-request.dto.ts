import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { AttendanceStatus } from '@prisma/client';

export class CreateStudentLeaveRequestDto {
  @IsString()
  studentId!: string;

  @IsString()
  leaveType!: string;

  @IsDateString()
  startsOn!: string;

  @IsDateString()
  endsOn!: string;

  @IsString()
  @MinLength(8)
  reason!: string;
}

export class CreateParentStudentLeaveRequestDto {
  @IsString()
  leaveType!: string;

  @IsDateString()
  startsOn!: string;

  @IsDateString()
  endsOn!: string;

  @IsString()
  @MinLength(8)
  reason!: string;
}

export class ReviewStudentLeaveRequestDto {
  @IsEnum(['APPROVED', 'REJECTED'] as const)
  status!: 'APPROVED' | 'REJECTED';

  @IsOptional()
  @IsString()
  reviewNote?: string;
}

export function mapStudentLeaveTypeToAttendanceStatus(
  leaveType: string,
): AttendanceStatus {
  const normalized = leaveType.trim().toUpperCase().replace(/[\s-]+/g, '_');
  if (
    normalized === 'SICK' ||
    normalized === 'SICK_LEAVE' ||
    normalized === 'MEDICAL'
  ) {
    return AttendanceStatus.SICK_LEAVE;
  }
  if (
    normalized === 'UNEXCUSED' ||
    normalized === 'UNEXCUSED_LEAVE' ||
    normalized === 'UNAUTHORIZED'
  ) {
    return AttendanceStatus.UNEXCUSED_LEAVE;
  }
  return AttendanceStatus.EXCUSED_LEAVE;
}
