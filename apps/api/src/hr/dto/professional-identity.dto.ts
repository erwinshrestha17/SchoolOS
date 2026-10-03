import { StaffEmploymentType, StaffResponsibilityKind } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

const NON_BLANK = /\S/;

export class CreateStaffEmploymentDto {
  @IsIn(Object.values(StaffEmploymentType))
  employmentType!: StaffEmploymentType;

  @IsString()
  @MinLength(1)
  @MaxLength(80)
  @Matches(NON_BLANK)
  postCategoryCode!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(80)
  @Matches(NON_BLANK)
  schoolTypeCode!: string;

  @IsOptional()
  @IsInt()
  localLevelId?: number;

  @IsDateString()
  effectiveFrom!: string;

  @IsOptional()
  @IsDateString()
  effectiveTo?: string;

  @IsOptional()
  @IsUUID()
  contractId?: string;

  @IsOptional()
  @IsUUID()
  policyVersionId?: string;
}

export class ReviewProfessionalRecordDto {
  @IsIn(['VERIFY', 'REJECT'])
  decision!: 'VERIFY' | 'REJECT';

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}

export class EndStaffEmploymentDto {
  @IsDateString()
  effectiveTo!: string;

  @IsString()
  @MinLength(3)
  @MaxLength(1000)
  @Matches(NON_BLANK)
  reason!: string;
}

export class CreateStaffResponsibilityDto {
  @IsUUID()
  employmentId!: string;

  @IsIn(Object.values(StaffResponsibilityKind))
  kind!: StaffResponsibilityKind;

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  @Matches(NON_BLANK)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  department?: string;

  @IsDateString()
  effectiveFrom!: string;

  @IsOptional()
  @IsDateString()
  effectiveTo?: string;
}

export class EndStaffResponsibilityDto {
  @IsDateString()
  effectiveTo!: string;

  @IsString()
  @MinLength(3)
  @MaxLength(1000)
  @Matches(NON_BLANK)
  reason!: string;
}

export class CreateTeacherProfileDto {
  @IsDateString()
  effectiveFrom!: string;
}

export class DeactivateTeacherProfileDto {
  @IsDateString()
  effectiveTo!: string;
}

class EvidenceBaseDto {
  @IsOptional()
  @IsString()
  @MaxLength(40)
  subjectCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  levelCode?: string;

  @IsOptional()
  @IsDateString()
  issuedOn?: string;

  @IsDateString()
  validFrom!: string;

  @IsOptional()
  @IsDateString()
  validUntil?: string;

  /** A tenant FileAsset holding the protected evidence document. */
  @IsOptional()
  @IsUUID()
  documentId?: string;

  @IsOptional()
  @IsUrl({ protocols: ['https'], require_protocol: true })
  @MaxLength(2000)
  sourceUri?: string;
}

export class CreateQualificationEvidenceDto extends EvidenceBaseDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  @Matches(NON_BLANK)
  qualification!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  institution?: string;
}

export class CreateLicenceEvidenceDto extends EvidenceBaseDto {
  /** Issuing authority, e.g. TSC. */
  @IsString()
  @MinLength(1)
  @MaxLength(40)
  @Matches(NON_BLANK)
  authorityCode!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  @Matches(NON_BLANK)
  externalReference!: string;
}

export class RevokeProfessionalEvidenceDto {
  @IsString()
  @MinLength(3)
  @MaxLength(1000)
  @Matches(NON_BLANK)
  reason!: string;
}

export class EligibilityProjectionQueryDto {
  @IsUUID()
  classId!: string;

  @IsOptional()
  @IsUUID()
  subjectId?: string;
}

const WORKSPACE_STATES = ['ELIGIBLE', 'NEEDS_REVIEW', 'INELIGIBLE'] as const;

/** Phase 7.10: HR teacher-eligibility workspace filters (read-only). */
export class EligibilityWorkspaceQueryDto {
  @IsOptional()
  @IsIn(WORKSPACE_STATES)
  status?: (typeof WORKSPACE_STATES)[number];

  @IsOptional()
  @IsString()
  @MaxLength(80)
  search?: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    value === 'true' || value === true
      ? true
      : value === 'false' || value === false
        ? false
        : value,
  )
  @IsBoolean()
  atRiskOnly?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(180)
  horizonDays?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 25;
}

export class EligibilitySummaryQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(180)
  horizonDays?: number;
}
