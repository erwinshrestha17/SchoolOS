import {
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateCasRecordDto {
  @IsUUID()
  academicYearId!: string;

  @IsOptional()
  @IsUUID()
  examTermId?: string;

  @IsUUID()
  classId!: string;

  @IsOptional()
  @IsUUID()
  sectionId?: string;

  @IsUUID()
  subjectId!: string;

  @IsUUID()
  studentId!: string;

  @IsString()
  @MaxLength(100)
  category!: string;

  @IsNumber()
  @Min(0)
  score!: number;

  @IsNumber()
  @Min(1)
  maxScore!: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  grade?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  observation?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  remarks?: string;

  @IsDateString()
  observedOn!: string;

  @IsOptional()
  @IsDateString()
  recordedAt?: string;

  /** Compatibility alias for legacy AcademicsService CAS helpers. */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
