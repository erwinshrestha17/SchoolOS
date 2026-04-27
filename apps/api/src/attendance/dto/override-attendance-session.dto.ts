import {
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { AttendanceExceptionDto } from './submit-attendance.dto';

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
}
