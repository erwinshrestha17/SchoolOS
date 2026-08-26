import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class BulkUpsertMarksEntryDto {
  @IsString()
  @IsNotEmpty()
  studentId!: string;

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
  @IsBoolean()
  isRetest?: boolean;

  @IsOptional()
  @IsBoolean()
  isDraft?: boolean;

  @IsOptional()
  @IsString()
  remarks?: string;

  @IsOptional()
  @IsString()
  expectedVersion?: string;
}

export class BulkUpsertMarksDto {
  @IsString()
  @IsNotEmpty()
  examTermId!: string;

  @IsString()
  @IsNotEmpty()
  assessmentComponentId!: string;

  @IsString()
  @IsNotEmpty()
  classId!: string;

  @IsOptional()
  @IsString()
  sectionId?: string;

  @IsString()
  @IsNotEmpty()
  subjectId!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BulkUpsertMarksEntryDto)
  entries!: BulkUpsertMarksEntryDto[];

  @IsOptional()
  @IsString()
  @MaxLength(64)
  authorityNodeId?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  authorityEpoch?: number;
}
