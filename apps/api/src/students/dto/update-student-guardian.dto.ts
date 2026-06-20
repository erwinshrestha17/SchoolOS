import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';
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
}
