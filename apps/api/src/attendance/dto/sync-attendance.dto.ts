import { IsDateString, IsOptional, IsString } from 'class-validator';
import { SubmitAttendanceDto } from './submit-attendance.dto';

export class SyncAttendanceDto extends SubmitAttendanceDto {
  @IsString()
  clientSubmissionId!: string;

  @IsDateString()
  deviceTimestamp!: string;

  @IsOptional()
  @IsString()
  deviceId?: string;

  @IsOptional()
  @IsString()
  deviceLabel?: string;

  @IsOptional()
  @IsString()
  sessionFingerprint?: string;
}
