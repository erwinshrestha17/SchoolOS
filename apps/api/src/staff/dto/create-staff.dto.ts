import { ContractType, Gender } from '@prisma/client';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  IsDateOfBirth,
  IsNepalPhone,
  IsPersonName,
  IsProfileEmail,
  NormalizeEmailAddress,
  NormalizeNepalPhone,
  NormalizePersonName,
} from '../../common/validation/contact-profile.decorators';
import { AddressInputDto } from '../../addresses/dto/address-input.dto';

export class CreateStaffDto {
  @IsOptional()
  @IsString()
  employeeId?: string;

  @IsString()
  @NormalizePersonName()
  @IsPersonName()
  firstName!: string;

  @IsString()
  @NormalizePersonName()
  @IsPersonName()
  lastName!: string;

  @IsDateOfBirth()
  dateOfBirth!: string;

  @IsEnum(Gender)
  gender!: Gender;

  @IsString()
  address!: string;

  @IsDateString()
  joiningDate!: string;

  @IsEnum(ContractType)
  contractType!: ContractType;

  @NormalizeEmailAddress()
  @IsProfileEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsOptional()
  @IsString()
  @NormalizeNepalPhone()
  @IsNepalPhone()
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

  // Normalized addresses (e.g. one PERMANENT + one CURRENT). Optional --
  // omitting this leaves only the legacy free-text `address` field. The
  // backend re-validates every localLevelId; never trust these ids as-is.
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AddressInputDto)
  addresses?: AddressInputDto[];
}
