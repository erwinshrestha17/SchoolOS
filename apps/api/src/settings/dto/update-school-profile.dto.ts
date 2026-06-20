import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  IsNepalPhone,
  IsPersonName,
  IsProfileEmail,
  NormalizeEmailAddress,
  NormalizeNepalPhone,
  NormalizePersonName,
} from '../../common/validation/contact-profile.decorators';

export class UpdateSchoolProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  schoolName?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  schoolAddress?: string | null;

  @IsOptional()
  @IsString()
  @NormalizeNepalPhone()
  @IsNepalPhone()
  @MaxLength(50)
  schoolPhone?: string | null;

  @IsOptional()
  @NormalizeEmailAddress()
  @IsProfileEmail()
  @MaxLength(254)
  schoolEmail?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  schoolPanNumber?: string | null;

  @IsOptional()
  @IsString()
  @NormalizePersonName()
  @IsPersonName()
  @MaxLength(200)
  principalName?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  municipality?: string | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(99)
  wardNumber?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  district?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  province?: string | null;

  @IsOptional()
  @IsIn(['PRIVATE', 'COMMUNITY', 'TRUST'])
  schoolType?: 'PRIVATE' | 'COMMUNITY' | 'TRUST' | null;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  iemisSchoolCode?: string | null;
}
