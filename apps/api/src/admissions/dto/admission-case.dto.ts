import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import {
  IsArray,
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { AdmissionDocumentTiming, Gender } from '@prisma/client';
import {
  ADMISSION_ASSESSMENT_MODES,
  ADMISSION_ASSESSMENT_RESULTS,
  ADMISSION_ASSESSMENT_TABS,
  ADMISSION_CASE_REVIEW_ACTIONS,
  type AdmissionAssessmentMode,
  type AdmissionAssessmentResult,
  type AdmissionAssessmentTab,
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
  'PRIMARY',
  'BASIC_SECONDARY',
  'GRADE_11_12',
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

export class ListDocumentRequestsDto {
  @IsOptional()
  @IsString()
  policyId?: string;

  @IsOptional()
  @IsString()
  classId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  documentKind?: string;

  @IsOptional()
  @IsEnum(AdmissionDocumentTiming)
  timing?: AdmissionDocumentTiming;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(3650)
  @Type(() => Number)
  minDaysPending?: number;

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
}

export class RequestAdmissionDocumentRemindersDto {
  @ApiProperty({
    type: [String],
    minItems: 1,
    maxItems: 25,
    uniqueItems: true,
    description:
      'Tenant-owned admission case IDs selected from the missing-document queue.',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(25)
  @ArrayUnique()
  @IsUUID('4', { each: true })
  admissionCaseIds!: string[];
}

export class ListAdmissionAssessmentSessionsDto {
  @IsOptional()
  @IsIn(ADMISSION_ASSESSMENT_TABS)
  tab?: AdmissionAssessmentTab = 'TODAY';

  @IsOptional()
  @IsString()
  policyId?: string;

  @IsOptional()
  @IsString()
  classId?: string;

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
}

export class ListAdmissionAssessmentCandidatesDto {
  @IsOptional()
  @IsUUID('4')
  admissionCaseId?: string;

  @IsOptional()
  @IsString()
  policyId?: string;

  @IsOptional()
  @IsString()
  classId?: string;

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
}

export class ScheduleAdmissionAssessmentDto {
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  bsDate!: string;

  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  startTime!: string;

  @IsOptional()
  @IsInt()
  @Min(15)
  @Max(240)
  @Type(() => Number)
  durationMinutes?: number;

  @IsOptional()
  @IsIn(ADMISSION_ASSESSMENT_MODES)
  mode?: AdmissionAssessmentMode;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  location?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}

export class RecordAdmissionAssessmentResultDto {
  @IsIn(ADMISSION_ASSESSMENT_RESULTS)
  result!: AdmissionAssessmentResult;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  @Type(() => Number)
  score?: number;

  @IsOptional()
  @IsString()
  @MinLength(5)
  @MaxLength(1000)
  notes?: string;
}

export class ReviewAdmissionCaseDto {
  @IsIn(ADMISSION_CASE_REVIEW_ACTIONS)
  action!: AdmissionCaseReviewAction;

  @IsOptional() @IsString() @MaxLength(100) reviewerUserId?: string;
  @IsOptional() @IsString() @MinLength(5) @MaxLength(1000) reason?: string;
  @IsOptional() @IsDateString() dueDate?: string;
}
