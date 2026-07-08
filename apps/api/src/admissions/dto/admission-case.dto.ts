import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Gender } from '@prisma/client';
import {
  ADMISSION_CASE_REVIEW_ACTIONS,
  type AdmissionCaseReviewAction,
} from '@schoolos/core';
import {
  IsDateOfBirth,
  IsNepalPhone,
  IsPersonName,
  IsProfileEmail,
  NormalizeEmailAddress,
  NormalizeNepalPhone,
  NormalizePersonName,
} from '../../common/validation/contact-profile.decorators';

export const ADMISSION_SOURCES = [
  'OFFICE_WALK_IN',
  'PARENT_ONLINE',
  'PHONE_INQUIRY',
  'TRANSFER_REQUEST',
  'IMPORT',
] as const;

export const ADMISSION_MODES = ['DIRECT_ALLOWED', 'REVIEW_REQUIRED'] as const;

export const ADMISSION_GRADE_BANDS = [
  'MONTESSORI',
  'PRIMARY',
  'BASIC_SECONDARY',
  'GRADE_11_12',
] as const;

export const ADMISSION_REQUIRED_FIELDS = [
  'firstNameEn',
  'lastNameEn',
  'firstNameNp',
  'lastNameNp',
  'dateOfBirth',
  'gender',
  'guardianFullName',
  'guardianRelation',
  'guardianPhone',
  'guardianEmail',
  'academicYearId',
  'classId',
  'sectionId',
  'previousSchool',
  'admissionDate',
  'nationalStudentId',
  'emergencyName',
  'emergencyPhone',
] as const;

export type AdmissionSource = (typeof ADMISSION_SOURCES)[number];
export type AdmissionMode = (typeof ADMISSION_MODES)[number];

export class AdmissionDocumentReferenceDto {
  @IsString()
  fileId!: string;

  @IsString()
  @MaxLength(80)
  kind!: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  title?: string;
}

export class CreateAdmissionCaseDto {
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
  @IsOptional() @IsDateOfBirth() dateOfBirth?: string;
  @IsOptional() @IsEnum(Gender) gender?: Gender;
  @IsOptional()
  @IsString()
  @NormalizePersonName()
  @IsPersonName()
  @MaxLength(160)
  guardianFullName?: string;
  @IsOptional() @IsString() @MaxLength(80) guardianRelation?: string;
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
  @IsOptional() @IsBoolean() guardianReceivesAlerts?: boolean;
  @IsOptional() @IsString() academicYearId?: string;
  @IsOptional() @IsString() classId?: string;
  @IsOptional() @IsString() sectionId?: string;
  @IsOptional() @IsEnum(ADMISSION_SOURCES) source?: AdmissionSource;
  @IsOptional() @IsBoolean() transferStudent?: boolean;
  @IsOptional() @IsString() @MaxLength(160) previousSchool?: string;
  @IsOptional() @IsString() @MaxLength(1000) notes?: string;
  @IsOptional() @IsDateString() admissionDate?: string;
  @IsOptional() @IsString() @MaxLength(80) mediumOfInstruction?: string;
  @IsOptional() @IsInt() @Min(1) @Type(() => Number) rollNumber?: number;
  @IsOptional() @IsString() @MaxLength(100) nationalStudentId?: string;
  @IsOptional()
  @IsString()
  @NormalizePersonName()
  @IsPersonName()
  @MaxLength(160)
  emergencyName?: string;
  @IsOptional()
  @IsString()
  @NormalizeNepalPhone()
  @IsNepalPhone()
  @MaxLength(32)
  emergencyPhone?: string;
  @IsOptional() @IsString() @MaxLength(2000) medicalConditions?: string;
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AdmissionDocumentReferenceDto)
  documents?: AdmissionDocumentReferenceDto[];
  @IsOptional() @IsString() policyId?: string;
}

export class UpdateAdmissionCaseDto {
  @IsOptional()
  @IsString()
  @NormalizePersonName()
  @IsPersonName()
  @MaxLength(100)
  firstNameEn?: string;
  @IsOptional()
  @IsString()
  @NormalizePersonName()
  @IsPersonName()
  @MaxLength(100)
  lastNameEn?: string;
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
  @IsOptional() @IsDateOfBirth() dateOfBirth?: string;
  @IsOptional() @IsEnum(Gender) gender?: Gender;
  @IsOptional()
  @IsString()
  @NormalizePersonName()
  @IsPersonName()
  @MaxLength(160)
  guardianFullName?: string;
  @IsOptional() @IsString() @MaxLength(80) guardianRelation?: string;
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
  @IsOptional() @IsBoolean() guardianReceivesAlerts?: boolean;
  @IsOptional() @IsString() academicYearId?: string;
  @IsOptional() @IsString() classId?: string;
  @IsOptional() @IsString() sectionId?: string;
  @IsOptional() @IsEnum(ADMISSION_SOURCES) source?: AdmissionSource;
  @IsOptional() @IsBoolean() transferStudent?: boolean;
  @IsOptional() @IsString() @MaxLength(160) previousSchool?: string;
  @IsOptional() @IsString() @MaxLength(1000) notes?: string;
  @IsOptional() @IsDateString() admissionDate?: string;
  @IsOptional() @IsString() @MaxLength(80) mediumOfInstruction?: string;
  @IsOptional() @IsInt() @Min(1) @Type(() => Number) rollNumber?: number;
  @IsOptional() @IsString() @MaxLength(100) nationalStudentId?: string;
  @IsOptional()
  @IsString()
  @NormalizePersonName()
  @IsPersonName()
  @MaxLength(160)
  emergencyName?: string;
  @IsOptional()
  @IsString()
  @NormalizeNepalPhone()
  @IsNepalPhone()
  @MaxLength(32)
  emergencyPhone?: string;
  @IsOptional() @IsString() @MaxLength(2000) medicalConditions?: string;
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AdmissionDocumentReferenceDto)
  documents?: AdmissionDocumentReferenceDto[];
  @IsOptional() @IsString() policyId?: string;
}

export class DirectAdmitAdmissionCaseDto extends UpdateAdmissionCaseDto {
  @IsOptional() @IsBoolean() overrideDuplicate?: boolean;
  @IsOptional() @IsString() @MaxLength(500) overrideReason?: string;
}

export class FinalizeAdmissionCaseDto extends DirectAdmitAdmissionCaseDto {}

export class WaiveCaseDocumentDto {
  @IsString() @MaxLength(80) documentKind!: string;
  @IsOptional() @IsString() @MinLength(5) @MaxLength(1000) reason?: string;
}

export class ReviewAdmissionCaseDto {
  @IsIn(ADMISSION_CASE_REVIEW_ACTIONS)
  action!: AdmissionCaseReviewAction;

  @IsOptional() @IsString() @MaxLength(100) reviewerUserId?: string;
  @IsOptional() @IsString() @MinLength(5) @MaxLength(1000) reason?: string;
  @IsOptional() @IsDateString() dueDate?: string;
}
