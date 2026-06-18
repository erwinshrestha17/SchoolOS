import { IsDateString, IsOptional, IsString } from 'class-validator';

export class MobileTeacherAttendanceRosterQueryDto {
  @IsString()
  academicYearId!: string;

  @IsString()
  classId!: string;

  @IsOptional()
  @IsString()
  sectionId?: string;

  @IsOptional()
  @IsDateString()
  attendanceDate?: string;
}

export class MobileTeacherTodayQueryDto {
  @IsOptional()
  @IsDateString()
  date?: string;
}
