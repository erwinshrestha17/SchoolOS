import { IsDateString, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class UpsertAttendanceDraftDto {
  @IsDateString()
  attendanceDate!: string;

  @IsString()
  @IsNotEmpty()
  academicYearId!: string;

  @IsString()
  @IsNotEmpty()
  classId!: string;

  @IsOptional()
  @IsString()
  sectionId?: string;

  @IsNotEmpty()
  payload!: any;
}
