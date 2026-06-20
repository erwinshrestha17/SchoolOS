import { Gender } from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import {
  IsDateOfBirth,
  IsNepalPhone,
  IsPersonName,
  NormalizeNepalPhone,
  NormalizePersonName,
} from '../../common/validation/contact-profile.decorators';

export class UpdateStudentDto {
  @IsOptional()
  @IsString()
  @NormalizePersonName()
  @IsPersonName()
  firstNameEn?: string;

  @IsOptional()
  @IsString()
  @NormalizePersonName()
  @IsPersonName()
  lastNameEn?: string;

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

  @IsOptional()
  @IsDateOfBirth()
  dateOfBirth?: string;

  @IsOptional()
  @IsEnum(Gender)
  gender?: Gender;

  @IsOptional()
  @IsString()
  nationality?: string;

  @IsOptional()
  @IsString()
  motherTongue?: string;

  @IsOptional()
  @IsString()
  ethnicity?: string;

  @IsOptional()
  @IsString()
  disabilityFlag?: string;

  @IsOptional()
  @IsBoolean()
  confirmNoDisability?: boolean;

  @IsOptional()
  @IsString()
  nationalStudentId?: string;

  @IsOptional()
  @IsString()
  admissionNumber?: string;

  @IsOptional()
  @IsString()
  classId?: string;

  @IsOptional()
  @IsString()
  sectionId?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  rollNumber?: number;

  @IsOptional()
  @IsString()
  mediumOfInstruction?: string;

  @IsOptional()
  @IsString()
  medicalConditions?: string;

  @IsOptional()
  @IsString()
  severeAllergies?: string;

  @IsOptional()
  @IsString()
  medications?: string;

  @IsOptional()
  @IsString()
  specialNeeds?: string;

  @IsOptional()
  @IsString()
  emergencyName?: string;

  @IsOptional()
  @IsString()
  @NormalizeNepalPhone()
  @IsNepalPhone()
  emergencyPhone?: string;

  @IsOptional()
  @IsString()
  doctorName?: string;

  @IsOptional()
  @IsString()
  @NormalizeNepalPhone()
  @IsNepalPhone()
  doctorPhone?: string;

  @IsOptional()
  @IsString()
  photo?: string;

  @IsOptional()
  @IsString()
  photoFileName?: string;
}
