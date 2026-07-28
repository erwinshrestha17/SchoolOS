import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  GuardianCapability,
  GuardianRelationshipApprovalStatus,
  GuardianRelationshipStatus,
  GuardianRelationshipVerificationStatus,
} from '@prisma/client';
import {
  IsNepalPhone,
  IsPersonName,
  IsProfileEmail,
  NormalizeEmailAddress,
  NormalizeNepalPhone,
  NormalizePersonName,
} from '../../common/validation/contact-profile.decorators';

export class UpdateStudentGuardianDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @NormalizePersonName()
  @IsPersonName()
  fullName?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  relation?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @NormalizeNepalPhone()
  @IsNepalPhone()
  primaryPhone?: string;

  @IsOptional()
  @IsString()
  @NormalizeNepalPhone()
  @IsNepalPhone()
  secondaryPhone?: string;

  @IsOptional()
  @NormalizeEmailAddress()
  @IsProfileEmail()
  email?: string;

  @IsOptional()
  @IsString()
  occupation?: string;

  @IsOptional()
  @IsString()
  homeAddress?: string;

  @IsOptional()
  @IsString()
  wardNumber?: string;

  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsEnum(GuardianCapability, { each: true })
  capabilities?: GuardianCapability[];

  @IsOptional()
  @IsEnum(GuardianRelationshipVerificationStatus)
  verificationStatus?: GuardianRelationshipVerificationStatus;

  @IsOptional()
  @IsEnum(GuardianRelationshipStatus)
  status?: GuardianRelationshipStatus;

  @IsOptional()
  @IsDateString()
  effectiveFrom?: string;

  @IsOptional()
  @IsDateString()
  effectiveUntil?: string | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  emergencyContactPriority?: number | null;

  @IsOptional()
  @IsEnum(GuardianRelationshipApprovalStatus)
  approvalStatus?: GuardianRelationshipApprovalStatus;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  restrictionReasonRef?: string | null;
}
