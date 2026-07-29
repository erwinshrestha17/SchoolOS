import { IsOptional, IsString } from 'class-validator';

export class AssignClassTeacherDto {
  @IsString()
  staffId!: string;

  @IsOptional()
  @IsString()
  academicYearId?: string;
}
