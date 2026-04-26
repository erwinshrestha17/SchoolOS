import { IsDateString, IsString } from 'class-validator';
import { SubmitAttendanceDto } from './submit-attendance.dto';

export class SyncAttendanceDto extends SubmitAttendanceDto {
  @IsString()
  clientSubmissionId!: string;

  @IsDateString()
  deviceTimestamp!: string;
}
