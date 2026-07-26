import { AttendanceStatus } from '@prisma/client';
import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class MobileParentAttendanceCorrectionDto {
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

export class MobileParentAttendanceCorrectionCancelDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  @MaxLength(500)
  reason!: string;
}
