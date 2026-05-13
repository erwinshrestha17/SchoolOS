import {
  IsDateString,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
} from 'class-validator';

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
  @IsObject()
  payload!: Record<string, unknown>;
}
