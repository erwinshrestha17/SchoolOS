import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEmail,
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
  @IsEnum(Gender)
  gender?: Gender;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  guardianFullName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  guardianRelation?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  guardianPhone?: string;

  @IsOptional()
  @IsEmail()
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
