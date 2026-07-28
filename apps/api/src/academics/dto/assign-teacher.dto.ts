import { IsString } from 'class-validator';

export class AssignTeacherDto {
  @IsString()
  academicYearId!: string;

  @IsString()
  subjectId!: string;

  @IsString()
  staffId!: string;

  @IsString()
  classId!: string;

  @IsString()
  sectionId!: string;
}
