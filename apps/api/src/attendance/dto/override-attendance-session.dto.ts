import {
  ArrayMinSize,
  ArrayUnique,
  IsEnum,
  IsArray,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { AttendanceExceptionDto } from './submit-attendance.dto';

export enum AttendanceOverrideSource {
  MANUAL_OVERRIDE = 'manual_override',
  SYNC_CONFLICT_RESOLUTION = 'sync_conflict_resolution',
}

export class OverrideAttendanceSessionDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique((item: AttendanceExceptionDto) => item.studentId)
  @ValidateNested({ each: true })
  @Type(() => AttendanceExceptionDto)
  exceptions!: AttendanceExceptionDto[];

  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsEnum(AttendanceOverrideSource)
  source?: AttendanceOverrideSource;
}
