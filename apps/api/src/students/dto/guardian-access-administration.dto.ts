import {
  GUARDIAN_RECOVERY_ACTIONS,
  GUARDIAN_RECOVERY_VERIFICATION_METHODS,
  type GuardianRecoveryAction,
  type GuardianRecoveryVerificationMethod,
} from '@schoolos/core';
import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  MinLength,
  ValidateIf,
} from 'class-validator';
import {
  IsProfileEmail,
  IsNepalPhone,
  NormalizeEmailAddress,
  NormalizeNepalPhone,
} from '../../common/validation/contact-profile.decorators';

export class GuardianRecoveryActionDto {
  @IsIn(GUARDIAN_RECOVERY_ACTIONS)
  action!: GuardianRecoveryAction;

  @IsIn(GUARDIAN_RECOVERY_VERIFICATION_METHODS)
  verificationMethod!: GuardianRecoveryVerificationMethod;

  @IsString()
  @IsNotEmpty()
  @Length(5, 500)
  reason!: string;

  @IsString()
  @IsNotEmpty()
  @Length(3, 200)
  evidenceReference!: string;

  @ValidateIf(
    (dto: GuardianRecoveryActionDto) => dto.action === 'APPROVE_PHONE_CHANGE',
  )
  @IsString()
  @IsNotEmpty()
  @NormalizeNepalPhone()
  @IsNepalPhone()
  newPrimaryPhone?: string;

  @IsOptional()
  @IsUUID()
  coGuardianId?: string;
}

export class RevokeGuardianSessionDto {
  @IsString()
  @IsNotEmpty()
  @Length(5, 500)
  reason!: string;

  @IsString()
  @IsNotEmpty()
  @Length(3, 200)
  evidenceReference!: string;
}

export class ProvisionGuardianAccountDto {
  @NormalizeEmailAddress()
  @IsProfileEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  temporaryPassword!: string;

  @IsIn(GUARDIAN_RECOVERY_VERIFICATION_METHODS)
  verificationMethod!: GuardianRecoveryVerificationMethod;

  @IsString()
  @IsNotEmpty()
  @Length(5, 500)
  reason!: string;

  @IsString()
  @IsNotEmpty()
  @Length(3, 200)
  evidenceReference!: string;

  @IsOptional()
  @IsUUID()
  coGuardianId?: string;
}
