import {
  ContractType,
  Gender,
  StaffEmploymentType,
  StaffStatus,
} from '@prisma/client';
import { IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';
import {
  IsDateOfBirth,
  IsNepalPhone,
  IsPersonName,
  IsProfileEmail,
  NormalizeEmailAddress,
  NormalizeNepalPhone,
  NormalizePersonName,
} from '../../common/validation/contact-profile.decorators';

export class UpdateStaffDto {
  @IsOptional()
  @IsString()
  employeeId?: string;

  @IsOptional()
  @IsString()
  staffCode?: string;

  @IsOptional()
  @IsString()
  @NormalizePersonName()
  @IsPersonName()
  firstName?: string;

  @IsOptional()
  @IsString()
  @NormalizePersonName()
  @IsPersonName()
  lastName?: string;

  @IsOptional()
  @IsDateOfBirth()
  dateOfBirth?: string;

  @IsOptional()
  @IsEnum(Gender)
  gender?: Gender;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsDateString()
  joiningDate?: string;

  @IsOptional()
  @IsEnum(ContractType)
  contractType?: ContractType;

  @IsOptional()
  @IsEnum(StaffEmploymentType)
  employmentType?: StaffEmploymentType;

  @IsOptional()
  @IsEnum(StaffStatus)
  status?: StaffStatus;

  @IsOptional()
  @IsString()
  department?: string;

  @IsOptional()
  @IsString()
  designation?: string;

  @IsOptional()
  @IsString()
  contractStatus?: string;

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
  @NormalizePersonName()
  @IsPersonName()
  emergencyContactName?: string;

  @IsOptional()
  @IsString()
  @NormalizeNepalPhone()
  @IsNepalPhone()
  emergencyContactPhone?: string;

  @IsOptional()
  @IsString()
  emergencyContactRelation?: string;

  @IsOptional()
  @IsString()
  qualifications?: string;

  @IsOptional()
  @IsString()
  experience?: string;

  @IsOptional()
  @NormalizeEmailAddress()
  @IsProfileEmail()
  email?: string;
}
