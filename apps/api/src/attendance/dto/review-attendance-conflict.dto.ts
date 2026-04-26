import { IsOptional, IsString } from 'class-validator';

export class ReviewAttendanceConflictDto {
  @IsOptional()
  @IsString()
  resolutionNote?: string;
}
