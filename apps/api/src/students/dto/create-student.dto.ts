import { Gender } from '@prisma/client';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import {
  IsDateOfBirth,
  IsNepalPhone,
  IsPersonName,
  IsProfileEmail,
  NormalizeEmailAddress,
  NormalizeNepalPhone,
  NormalizePersonName,
} from '../../common/validation/contact-profile.decorators';

export class CreateStudentDto {
  @IsOptional()
  @IsString()
  studentSystemId?: string;

  @IsString()
  @NormalizePersonName()
  @IsPersonName()
  firstNameEn!: string;

  @IsString()
  @NormalizePersonName()
  @IsPersonName()
  lastNameEn!: string;

  @IsOptional()
  @IsString()
  @NormalizePersonName()
  @IsPersonName()
  firstNameNp?: string;

  @IsOptional()
  @IsString()
  @NormalizePersonName()
  @IsPersonName()
  lastNameNp?: string;

  @IsDateOfBirth()
  dateOfBirth!: string;

  @IsEnum(Gender)
  gender!: Gender;

  @IsDateString()
  admissionDate!: string;

  @IsString()
  classId!: string;

  @IsOptional()
  @IsString()
  section?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  rollNumber?: number;

  @IsOptional()
  @IsString()
  admissionNumber?: string;

  @IsOptional()
  @IsString()
  nationality?: string;

  @IsOptional()
  @IsString()
  mediumOfInstruct?: string;

  @IsOptional()
  @IsString()
  emergencyName?: string;

  @IsOptional()
  @IsString()
  emergencyPhone?: string;

  @IsOptional()
  @IsBoolean()
  createLogin?: boolean;

  @ValidateIf((dto: CreateStudentDto) => dto.createLogin === true)
  @NormalizeEmailAddress()
  @IsProfileEmail()
  email?: string;

  @ValidateIf((dto: CreateStudentDto) => dto.createLogin === true)
  @IsString()
  @MinLength(8)
  password?: string;

  @IsOptional()
  @IsString()
  @NormalizeNepalPhone()
  @IsNepalPhone()
  phone?: string;
}
