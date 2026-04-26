import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateCasRecordDto {
  @IsString()
  academicYearId!: string;

  @IsString()
  subjectId!: string;

  @IsString()
  studentId!: string;

  @IsString()
  classId!: string;

  @IsOptional()
  @IsString()
  sectionId?: string;

  @IsString()
  category!: string;

  @IsNumber()
  @Min(0)
  score!: number;

  @IsNumber()
  @Min(1)
  maxScore!: number;

  @IsString()
  observedOn!: string;

  @IsOptional()
  @IsString()
  note?: string;
}
