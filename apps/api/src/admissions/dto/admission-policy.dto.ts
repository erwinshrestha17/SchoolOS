import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  Max,
  ValidateNested,
  ArrayMinSize,
} from 'class-validator';
import {
  AdmissionPolicyApplicantType,
  AdmissionDocumentTiming,
} from '@prisma/client';
import { ADMISSION_GRADE_BANDS, ADMISSION_MODES, ADMISSION_SOURCES } from './admission-case.dto';

export class CreateAdmissionPolicyDto {
  @IsString() @MaxLength(160) name!: string;
  @IsOptional() @IsString() academicYearId?: string;
  @IsOptional() @IsString() classId?: string;
  @IsOptional() @IsIn(ADMISSION_GRADE_BANDS) gradeBand?: string;
  @IsOptional() @IsEnum(AdmissionPolicyApplicantType) applicantType?: AdmissionPolicyApplicantType;
  @IsOptional() @IsEnum(ADMISSION_SOURCES) source?: string;
}

export class UpdateAdmissionPolicyIdentityDto {
  @IsOptional() @IsString() @MaxLength(160) name?: string;
  @IsOptional() @IsString() academicYearId?: string;
  @IsOptional() @IsString() classId?: string;
  @IsOptional() @IsIn(ADMISSION_GRADE_BANDS) gradeBand?: string;
  @IsOptional() @IsEnum(AdmissionPolicyApplicantType) applicantType?: AdmissionPolicyApplicantType;
  @IsOptional() @IsEnum(ADMISSION_SOURCES) source?: string;
}

export class UpdateAdmissionPolicyVersionDto {
  @IsOptional() @IsIn(ADMISSION_MODES) admissionMode?: string;
  @IsOptional() @IsBoolean() transferStudent?: boolean;
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  requiredFields?: string[];
  @IsOptional() @IsBoolean() requireSection?: boolean;
  @IsOptional() @IsBoolean() requireDocumentReview?: boolean;
  @IsOptional() @IsBoolean() requireInterview?: boolean;
  @IsOptional() @IsBoolean() requirePrincipalApproval?: boolean;
  @IsOptional() @IsBoolean() requireTransferCertificate?: boolean;
  @IsOptional() @IsBoolean() requirePriorMarksheet?: boolean;
  @IsOptional() @IsBoolean() requireStreamOrMarksReview?: boolean;
  @IsOptional() @IsBoolean() allowAdmissionWithDocumentsPending?: boolean;
  @IsOptional() @IsBoolean() enforceCapacityWhenAvailable?: boolean;
  @IsOptional() @IsInt() @Min(0) @Type(() => Number) capacityOverride?: number;
  @IsOptional() @IsString() @MaxLength(2000) notesForOffice?: string;
}

export class UpsertDocumentRequirementDto {
  @IsString() @MaxLength(80) documentKind!: string;
  @IsString() @MaxLength(160) label!: string;
  @IsOptional() @IsBoolean() isRequired?: boolean;
  @IsOptional() @IsBoolean() requiresOriginalVerification?: boolean;
  @IsOptional() @IsEnum(AdmissionDocumentTiming) timing?: AdmissionDocumentTiming;
  @IsOptional() @IsInt() @Min(0) @Type(() => Number) expiresAfterDays?: number;
  @IsOptional() @IsBoolean() canBeWaived?: boolean;
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  waivableByRoleKeys?: string[];
  @IsOptional() @IsInt() @Type(() => Number) sortOrder?: number;
}

export class ActivateAdmissionPolicyVersionDto {
  @IsString() versionId!: string;
}

export class DuplicateAdmissionPolicyDto {
  @IsOptional() @IsString() @MaxLength(160) name?: string;
}

export class ApprovalChainStageDto {
  // ApprovalStep (created per-request by the shared approval engine) has no
  // custom-name field of its own — it always synthesizes "Approval step N"
  // from array position, so a stage's identity here is its role/permission,
  // not a free-text label that would have nowhere to persist.
  @IsOptional() @IsString() @MaxLength(160) approverRole?: string;
  @IsOptional() @IsString() @MaxLength(160) approverPermission?: string;
}

export class UpsertApprovalChainDto {
  @IsOptional() @IsInt() @Min(1) @Max(10) @Type(() => Number) minApprovals?: number;
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ApprovalChainStageDto)
  stages!: ApprovalChainStageDto[];
}
