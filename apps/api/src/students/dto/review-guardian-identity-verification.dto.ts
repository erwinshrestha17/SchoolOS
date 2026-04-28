import { IsIn, IsOptional, IsString } from 'class-validator';

export class ReviewGuardianIdentityVerificationDto {
  @IsIn(['VERIFIED', 'REJECTED', 'REVOKED'])
  status!: 'VERIFIED' | 'REJECTED' | 'REVOKED';

  @IsOptional()
  @IsString()
  reviewNote?: string;
}
