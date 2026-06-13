import { IsDateString, IsOptional, IsString } from 'class-validator';

export class StaffTimeClockDto {
  @IsOptional()
  @IsDateString()
  attendanceDate?: string;

  @IsOptional()
  @IsDateString()
  timestamp?: string;

  @IsOptional()
  @IsString()
  note?: string;
}
