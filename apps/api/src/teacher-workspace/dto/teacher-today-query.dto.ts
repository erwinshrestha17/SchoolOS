import { IsDateString, IsOptional } from 'class-validator';

export class TeacherTodayQueryDto {
  @IsOptional()
  @IsDateString()
  date?: string;
}
