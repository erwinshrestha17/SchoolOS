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
  IsUUID,
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

export class CreateStudentGuardianDto {
  @IsOptional()
  @IsUUID()
  guardianId?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @NormalizePersonName()
  @IsPersonName()
  @MaxLength(160)
  fullName?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  relation!: string;

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
  secondaryPhone?: string | null;

  @IsOptional()
  @NormalizeEmailAddress()
  @IsProfileEmail()
  email?: string | null;

  @IsOptional()
  @IsString()
  occupation?: string | null;

  @IsOptional()
  @IsString()
  homeAddress?: string | null;

  @IsOptional()
  @IsString()
  wardNumber?: string | null;

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
