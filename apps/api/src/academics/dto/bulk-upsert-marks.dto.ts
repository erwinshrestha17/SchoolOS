import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

export class BulkUpsertMarksEntryDto {
  @IsString()
  @IsNotEmpty()
  studentId: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  marksObtained?: number | null;

  @IsOptional()
  @IsBoolean()
  isAbsent?: boolean;

  @IsOptional()
  @IsBoolean()
  isWithheld?: boolean;

  @IsOptional()
  @IsString()
  remarks?: string;
}

export class BulkUpsertMarksDto {
  @IsString()
  @IsNotEmpty()
  examTermId: string;

  @IsString()
  @IsNotEmpty()
  assessmentComponentId: string;

  @IsString()
  @IsNotEmpty()
  classId: string;

  @IsOptional()
  @IsString()
  sectionId?: string;

  @IsString()
  @IsNotEmpty()
  subjectId: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BulkUpsertMarksEntryDto)
  entries: BulkUpsertMarksEntryDto[];
}
