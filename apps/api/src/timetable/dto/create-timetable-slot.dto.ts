import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class CreateTimetableSlotDto {
  @IsString()
  academicYearId!: string;

  @IsString()
  classId!: string;

  @IsOptional()
  @IsString()
  sectionId?: string;

  @IsString()
  subjectId!: string;

  @IsString()
  staffId!: string;

  @IsInt()
  @Min(1)
  @Max(7)
  dayOfWeek!: number;

  @IsString()
  startsAt!: string;

  @IsString()
  endsAt!: string;

  @IsOptional()
  @IsString()
  room?: string;
}
