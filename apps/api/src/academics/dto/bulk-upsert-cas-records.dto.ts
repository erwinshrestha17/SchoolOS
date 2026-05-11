import {
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class BulkUpsertCasEntryDto {
  @IsUUID()
  studentId!: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  score?: number;

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
}

export class BulkUpsertCasRecordsDto {
  @IsUUID()
  academicYearId!: string;

  @IsUUID()
  classId!: string;

  @IsOptional()
  @IsUUID()
  sectionId?: string;

  @IsOptional()
  @IsUUID()
  subjectId?: string;

  @IsString()
  @MaxLength(100)
  category!: string;

  @IsNumber()
  @Min(1)
  maxScore!: number;

  @IsDateString()
  observedOn!: string;

  @ValidateNested({ each: true })
  @Type(() => BulkUpsertCasEntryDto)
  entries!: BulkUpsertCasEntryDto[];
}
