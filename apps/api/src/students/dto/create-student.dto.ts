import { Gender } from '@prisma/client';
import {
  IsBoolean,
  IsDateString,
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class CreateStudentDto {
  @IsOptional()
  @IsString()
  studentSystemId?: string;

  @IsString()
  firstNameEn!: string;

  @IsString()
  lastNameEn!: string;

  @IsOptional()
  @IsString()
  firstNameNp?: string;

  @IsOptional()
  @IsString()
  lastNameNp?: string;

  @IsDateString()
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
  @IsEmail()
  email?: string;

  @ValidateIf((dto: CreateStudentDto) => dto.createLogin === true)
  @IsString()
  @MinLength(8)
  password?: string;

  @IsOptional()
  @IsString()
  phone?: string;
}
