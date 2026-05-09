import { ApiProperty } from '@nestjs/swagger';
import { AttendanceStatus } from '@prisma/client';
import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export class CreateAttendanceCorrectionDto {
  @ApiProperty()
  @IsUUID()
  @IsOptional()
  attendanceRecordId?: string;

  @ApiProperty()
  @IsUUID()
  @IsOptional()
  attendanceSessionId?: string;

  @ApiProperty()
  @IsUUID()
  @IsNotEmpty()
  studentId!: string;

  @ApiProperty()
  @IsDateString()
  @IsNotEmpty()
  attendanceDate!: string;

  @ApiProperty({ enum: AttendanceStatus })
  @IsEnum(AttendanceStatus)
  @IsNotEmpty()
  requestedStatus!: AttendanceStatus;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  reason!: string;
}
