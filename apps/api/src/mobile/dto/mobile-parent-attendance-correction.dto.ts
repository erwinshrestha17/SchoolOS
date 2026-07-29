import { AttendanceStatus } from '@prisma/client';
import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ConfirmStudentActionFields } from '../../common/security/confirm-student-action';

export class MobileParentAttendanceCorrectionDto extends ConfirmStudentActionFields {
  @IsDateString()
  attendanceDate!: string;

  @IsEnum(AttendanceStatus)
  requestedStatus!: AttendanceStatus;

  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  @MaxLength(500)
  reason!: string;
}

export class MobileParentAttendanceCorrectionCancelDto extends ConfirmStudentActionFields {
  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  @MaxLength(500)
  reason!: string;
}
