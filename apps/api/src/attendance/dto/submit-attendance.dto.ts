import {
  ArrayUnique,
  IsArray,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { AttendanceStatus } from '@prisma/client';
import { Transform, Type } from 'class-transformer';

const ATTENDANCE_STATUS_CODES: Record<string, AttendanceStatus> = {
  P: AttendanceStatus.PRESENT,
  A: AttendanceStatus.ABSENT,
  L: AttendanceStatus.LATE,
  LS: AttendanceStatus.SICK_LEAVE,
  LE: AttendanceStatus.EXCUSED_LEAVE,
  LU: AttendanceStatus.UNEXCUSED_LEAVE,
};

export class AttendanceExceptionDto {
  @IsString()
  studentId!: string;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string'
      ? (ATTENDANCE_STATUS_CODES[value.toUpperCase()] ?? value)
      : value,
  )
  @IsEnum(AttendanceStatus)
  status!: AttendanceStatus;

  @IsOptional()
  @IsString()
  remark?: string;

  @IsOptional()
  @IsDateString()
  lateAt?: string;
}

export class SubmitAttendanceDto {
  @IsString()
  academicYearId!: string;

  @IsString()
  classId!: string;

  @IsOptional()
  @IsString()
  sectionId?: string;

  @IsDateString()
  attendanceDate!: string;

  @IsOptional()
  @IsArray()
  @ArrayUnique((item: AttendanceExceptionDto) => item.studentId)
  @ValidateNested({ each: true })
  @Type(() => AttendanceExceptionDto)
  exceptions?: AttendanceExceptionDto[];
}
