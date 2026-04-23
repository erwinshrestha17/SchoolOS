import { ContractType, Gender } from '@prisma/client';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class CreateStaffDto {
  @IsOptional()
  @IsString()
  employeeId?: string;

  @IsString()
  firstName!: string;

  @IsString()
  lastName!: string;

  @IsDateString()
  dateOfBirth!: string;

  @IsEnum(Gender)
  gender!: Gender;

  @IsString()
  address!: string;

  @IsDateString()
  joiningDate!: string;

  @IsEnum(ContractType)
  contractType!: ContractType;

  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  photoUrl?: string;

  @IsOptional()
  @IsString()
  teacherRegistryId?: string;

  @IsOptional()
  @IsString()
  citizenshipNo?: string;

  @IsOptional()
  @IsString()
  panNumber?: string;

  @IsOptional()
  @IsString()
  bankAccount?: string;

  @IsOptional()
  @IsString()
  bankName?: string;

  @IsOptional()
  @IsString()
  qualifications?: string;

  @IsOptional()
  @IsString()
  experience?: string;

  @IsOptional()
  @IsDateString()
  probationEndDate?: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  roleIds!: string[];
}
