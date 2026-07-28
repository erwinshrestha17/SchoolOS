import {
  IsOptional,
  IsString,
  IsUUID,
  Length,
  MaxLength,
} from 'class-validator';

export class CreateGuardianIdentityVerificationDto {
  @IsString()
  @Length(2, 80)
  documentType!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  documentNumber?: string;

  @IsOptional()
  @IsUUID()
  evidenceDocumentId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
