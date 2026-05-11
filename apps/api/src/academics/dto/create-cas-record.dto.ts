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
  examTermId?: string; // Optional if CAS is term-linked, not in schema but for future

  @IsUUID()
  classId!: string;

  @IsOptional()
  @IsUUID()
  sectionId?: string;

  @IsOptional()
  @IsUUID()
  subjectId?: string;

  @IsUUID()
  studentId!: string;

  @IsString()
  @MaxLength(100)
  category!: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  score?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  maxScore?: number;

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

  @IsOptional()
  @IsDateString()
  observedOn?: string;

  @IsOptional()
  @IsDateString()
  recordedAt?: string; // Alias for observedOn if needed
}
