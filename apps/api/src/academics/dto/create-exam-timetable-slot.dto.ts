import { IsDateString, IsOptional, IsString } from 'class-validator';

export class CreateExamTimetableSlotDto {
  @IsString()
  academicYearId!: string;

  @IsString()
  examTermId!: string;

  @IsString()
  subjectId!: string;

  @IsString()
  classId!: string;

  @IsOptional()
  @IsString()
  sectionId?: string;

  @IsDateString()
  startsAt!: string;

  @IsDateString()
  endsAt!: string;

  @IsOptional()
  @IsString()
  room?: string;
}
