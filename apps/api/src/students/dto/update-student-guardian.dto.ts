import {
  IsBoolean,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
} from 'class-validator';

export class UpdateStudentGuardianDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  fullName?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  relation?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @Matches(/^\+?[0-9][0-9\s-]{6,19}$/, {
    message: 'primaryPhone must be a valid phone number',
  })
  primaryPhone?: string;

  @IsOptional()
  @IsString()
  secondaryPhone?: string;

  @IsOptional()
  @IsEmail()
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
