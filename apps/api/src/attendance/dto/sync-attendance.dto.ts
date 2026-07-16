import {
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { SubmitAttendanceDto } from './submit-attendance.dto';

export class SyncAttendanceDto extends SubmitAttendanceDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  clientSubmissionId!: string;

  @IsDateString()
  deviceTimestamp!: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  deviceId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  deviceLabel?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  sessionFingerprint?: string;
}
