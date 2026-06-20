import { Type } from 'class-transformer';
import {
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Gender } from '@prisma/client';
import {
  IsDateOfBirth,
  IsNepalPhone,
  IsPersonName,
  IsProfileEmail,
  NormalizeEmailAddress,
  NormalizeNepalPhone,
  NormalizePersonName,
} from '../../common/validation/contact-profile.decorators';

export const ADMISSION_APPLICATION_STATUSES = [
  'INQUIRY',
  'APPLICATION',
  'DOCUMENT_PENDING',
  'ENTRANCE_INTERVIEW',
  'ACCEPTED',
  'ENROLLED',
  'REJECTED',
] as const;

export type AdmissionApplicationStatus =
  (typeof ADMISSION_APPLICATION_STATUSES)[number];

export class ListAdmissionApplicationsDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  page?: number = 1;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  limit?: number = 25;

  @IsOptional()
  @IsIn(ADMISSION_APPLICATION_STATUSES)
  status?: AdmissionApplicationStatus;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  classId?: string;
}

export class CreateAdmissionApplicationDto {
  @IsString()
  @NormalizePersonName()
  @IsPersonName()
  @MaxLength(100)
  firstNameEn!: string;

  @IsString()
  @NormalizePersonName()
  @IsPersonName()
  @MaxLength(100)
  lastNameEn!: string;

  @IsOptional()
  @IsString()
  @NormalizePersonName()
  @IsPersonName()
  @MaxLength(100)
  firstNameNp?: string;

  @IsOptional()
  @IsString()
  @NormalizePersonName()
  @IsPersonName()
  @MaxLength(100)
  lastNameNp?: string;

  @IsOptional()
  @IsDateOfBirth()
  dateOfBirth?: string;

  @IsOptional()
  @IsEnum(Gender)
  gender?: Gender;

  @IsOptional()
  @IsString()
  @NormalizePersonName()
  @IsPersonName()
  @MaxLength(160)
  guardianFullName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  guardianRelation?: string;

  @IsOptional()
  @IsString()
  @NormalizeNepalPhone()
  @IsNepalPhone()
  @MaxLength(32)
  guardianPhone?: string;

  @IsOptional()
  @NormalizeEmailAddress()
  @IsProfileEmail()
  guardianEmail?: string;

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
  @IsString()
  @MaxLength(80)
  source?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}

export class UpdateAdmissionApplicationStatusDto {
  @IsIn(ADMISSION_APPLICATION_STATUSES)
  status!: AdmissionApplicationStatus;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
