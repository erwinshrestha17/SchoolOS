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
import { Type } from 'class-transformer';

class AttendanceExceptionDto {
  @IsString()
  studentId!: string;

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
