import { IsOptional, IsString } from 'class-validator';

export class CreateGuardianIdentityVerificationDto {
  @IsString()
  documentType!: string;

  @IsOptional()
  @IsString()
  documentNumber?: string;

  @IsOptional()
  @IsString()
  evidenceDocumentId?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
