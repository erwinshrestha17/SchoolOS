import { IsOptional, IsString } from 'class-validator';

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

/** Phase 5M: read-only eligibility preview before creating an assignment. */
export class TeacherEligibilityPreviewQueryDto {
  @IsString()
  staffId!: string;

  @IsString()
  classId!: string;

  @IsOptional()
  @IsString()
  subjectId?: string;
}
