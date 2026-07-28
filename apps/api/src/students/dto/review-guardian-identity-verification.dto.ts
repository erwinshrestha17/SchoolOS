import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class ReviewGuardianIdentityVerificationDto {
  @IsIn(['VERIFIED', 'REJECTED', 'REVOKED'])
  status!: 'VERIFIED' | 'REJECTED' | 'REVOKED';

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reviewNote?: string;
}
