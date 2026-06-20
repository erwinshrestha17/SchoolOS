import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
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
}
