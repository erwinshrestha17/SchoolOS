import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateHomeworkDto {
  @IsString()
  academicYearId!: string;

  @IsString()
  classId!: string;

  @IsOptional()
  @IsString()
  sectionId?: string;

  @IsString()
  subjectId!: string;

  @IsOptional()
  @IsString()
  assignedByStaffId?: string;

  @IsString()
  title!: string;

  @IsString()
  instructions!: string;

  @IsString()
  dueAt!: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  maxScore?: number;
}
