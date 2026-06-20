import {
  IsBoolean,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from 'class-validator';

export class CreateStudentGuardianDto {
  @IsOptional()
  @IsUUID()
  guardianId?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  fullName?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  relation!: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @Matches(/^\+?[0-9][0-9\s-]{6,19}$/, {
    message: 'primaryPhone must be a valid phone number',
  })
  primaryPhone?: string;

  @IsOptional()
  @IsString()
  secondaryPhone?: string | null;

  @IsOptional()
  @IsEmail()
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
