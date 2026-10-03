import { AttendanceStatus } from '@prisma/client';
import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CorrectStaffAttendanceDto {
  @IsEnum(AttendanceStatus)
  status!: AttendanceStatus;

  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  reason!: string;

  @IsOptional()
  @IsString()
  leaveType?: string | null;

  @IsOptional()
  @IsString()
  note?: string | null;

  @IsOptional()
  @IsDateString()
  checkInAt?: string | null;

  @IsOptional()
  @IsDateString()
  checkOutAt?: string | null;
}
