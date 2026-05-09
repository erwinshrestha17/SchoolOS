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

  @IsUUID()
  subjectId!: string;

  @IsUUID()
  studentId!: string;

  @IsUUID()
  classId!: string;

  @IsOptional()
  @IsUUID()
  sectionId?: string;

  @IsString()
  @MaxLength(100)
  category!: string;

  @IsNumber()
  @Min(0)
  score!: number;

  @IsNumber()
  @Min(1)
  maxScore!: number;

  @IsDateString()
  observedOn!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
