import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEmail,
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Gender } from '@prisma/client';

export const ADMISSION_SOURCES = [
  'OFFICE_WALK_IN',
  'PARENT_ONLINE',
  'PHONE_INQUIRY',
  'TRANSFER_REQUEST',
  'IMPORT',
] as const;

export const ADMISSION_MODES = ['DIRECT_ALLOWED', 'REVIEW_REQUIRED'] as const;

export const ADMISSION_REVIEW_ACTIONS = [
  'REQUEST_INFORMATION',
  'ASSIGN_REVIEWER',
  'MARK_READY_FOR_REVIEW',
  'APPROVE',
  'REJECT',
  'ESCALATE_TO_PRINCIPAL',
  'CLOSE',
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

export class AdmissionPolicyRuleDto {
  @IsEnum(ADMISSION_MODES)
  admissionMode: AdmissionMode = 'DIRECT_ALLOWED';

  @IsOptional()
  @IsString()
  academicYearId?: string;

  @IsOptional()
  @IsString()
  gradeBand?: string;

  @IsOptional()
  @IsString()
  classId?: string;

  @IsOptional()
  @IsEnum(ADMISSION_SOURCES)
  source?: AdmissionSource;

  @IsOptional()
  @IsBoolean()
  transferStudent?: boolean;

  @IsOptional()
  @IsBoolean()
  requireDocumentReview?: boolean;

  @IsOptional()
  @IsBoolean()
  requireInterview?: boolean;

  @IsOptional()
  @IsBoolean()
  requirePrincipalApproval?: boolean;

  @IsOptional()
  @IsBoolean()
  requireTransferCertificate?: boolean;

  @IsOptional()
  @IsBoolean()
  requirePriorMarksheet?: boolean;

  @IsOptional()
  @IsBoolean()
  requireStreamOrMarksReview?: boolean;

  @IsOptional()
  @IsBoolean()
  allowAdmissionWithDocumentsPending?: boolean;

  @IsOptional()
  @IsBoolean()
  enforceCapacityWhenAvailable?: boolean;

  @IsOptional()
  @IsBoolean()
  requireSection?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  requiredDocuments?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  requiredFields?: string[];
}

export class UpdateAdmissionPolicyDto {
  @ValidateNested()
  @Type(() => AdmissionPolicyRuleDto)
  defaultPolicy!: AdmissionPolicyRuleDto;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AdmissionPolicyRuleDto)
  overrides?: AdmissionPolicyRuleDto[];
}

export class CreateAdmissionCaseDto {
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
  @IsBoolean()
  guardianReceivesAlerts?: boolean;

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
  @IsEnum(ADMISSION_SOURCES)
  source?: AdmissionSource;

  @IsOptional()
  @IsBoolean()
  transferStudent?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  previousSchool?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  @IsOptional()
  @IsDateString()
  admissionDate?: string;

  @IsOptional()
  @IsString()
  mediumOfInstruction?: string;

  @IsOptional()
  rollNumber?: number;

  @IsOptional()
  @IsString()
  nationalStudentId?: string;

  @IsOptional()
  @IsString()
  emergencyName?: string;

  @IsOptional()
  @IsString()
  emergencyPhone?: string;

  @IsOptional()
  @IsString()
  medicalConditions?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AdmissionDocumentReferenceDto)
  documents?: AdmissionDocumentReferenceDto[];
}

export class UpdateAdmissionCaseDto extends CreateAdmissionCaseDto {}

export class DirectAdmitAdmissionCaseDto extends CreateAdmissionCaseDto {
  @IsOptional()
  @IsBoolean()
  overrideDuplicate?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  overrideReason?: string;
}

export class FinalizeAdmissionCaseDto extends DirectAdmitAdmissionCaseDto {}

export class ReviewAdmissionCaseDto {
  @IsIn(ADMISSION_REVIEW_ACTIONS)
  action!: (typeof ADMISSION_REVIEW_ACTIONS)[number];

  @IsOptional()
  @IsString()
  reviewerUserId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reason?: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;
}
