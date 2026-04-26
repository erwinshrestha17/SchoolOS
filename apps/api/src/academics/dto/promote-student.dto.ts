import { IsOptional, IsString } from 'class-validator';

export class PromoteStudentDto {
  @IsString()
  academicYearId!: string;

  @IsString()
  targetAcademicYearId!: string;

  @IsString()
  studentId!: string;

  @IsString()
  toClassId!: string;

  @IsOptional()
  @IsString()
  toSectionId?: string;

  @IsOptional()
  @IsString()
  remarks?: string;
}
