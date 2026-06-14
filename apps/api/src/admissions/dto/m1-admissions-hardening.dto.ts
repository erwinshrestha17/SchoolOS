import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class AutosaveAdmissionDraftDto {
  @IsString()
  @MaxLength(120)
  draftKey!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  firstNameEn?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  lastNameEn?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  firstNameNp?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  lastNameNp?: string;

  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  guardianFullName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  guardianPhone?: string;

  @IsOptional()
  @IsString()
  academicYearId?: string;

  @IsOptional()
  @IsString()
  classId?: string;

  @IsOptional()
  @IsString()
  sectionId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  previousSchool?: string;

  @IsOptional()
  @IsObject()
  payload?: Record<string, unknown>;
}

export class RecoverAdmissionDraftsDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  draftKey?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  guardianPhone?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  @Type(() => Number)
  limit?: number = 10;
}

export class EnhancedDuplicateReviewDto {
  @IsString()
  @MaxLength(100)
  firstNameEn!: string;

  @IsString()
  @MaxLength(100)
  lastNameEn!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  firstNameNp?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  lastNameNp?: string;

  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  guardianPhones?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(160)
  previousSchool?: string;

  @IsOptional()
  @IsString()
  siblingStudentSystemId?: string;

  @IsOptional()
  @IsString()
  excludeStudentId?: string;
}

export class ResolveAdmissionRelationshipsDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  guardianPhones?: string[];

  @IsOptional()
  @IsString()
  siblingStudentSystemId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  lastNameEn?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  lastNameNp?: string;
}

export class RemoveStudentGuardianAccessDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;

  @IsOptional()
  @IsBoolean()
  confirmFileAccessReview?: boolean;
}

export class GenerateTransferCertificateDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  destinationSchool?: string;

  @IsOptional()
  @IsDateString()
  transferDate?: string;

  @IsOptional()
  @IsBoolean()
  waiveFeeCheck?: boolean;
}

export class GraduateStudentDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;

  @IsOptional()
  @IsDateString()
  graduatedAt?: string;
}

export class ImportReviewQueueDto {
  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  limit?: number = 50;
}

export class IemisReadinessSummaryDto {
  @IsOptional()
  @IsString()
  classId?: string;

  @IsOptional()
  @IsString()
  sectionId?: string;
}
