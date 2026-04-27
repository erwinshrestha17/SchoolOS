import {
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { AttendanceStatus } from '@prisma/client';

class StaffAttendanceRecordDto {
  @IsString()
  staffId!: string;

  @IsEnum(AttendanceStatus)
  status!: AttendanceStatus;

  @IsOptional()
  @IsString()
  leaveType?: string;

  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsDateString()
  checkInAt?: string;
}

export class SubmitStaffAttendanceDto {
  @IsDateString()
  attendanceDate!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique((item: StaffAttendanceRecordDto) => item.staffId)
  @ValidateNested({ each: true })
  @Type(() => StaffAttendanceRecordDto)
  records!: StaffAttendanceRecordDto[];
}
