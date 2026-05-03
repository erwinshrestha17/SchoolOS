import { Gender } from '@prisma/client';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEmail,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Min,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { UploadStudentDocumentDto } from '../../student-records/dto/upload-student-document.dto';

class GuardianInputDto {
  @IsString()
  @IsNotEmpty()
  fullName!: string;

  @IsString()
  @IsNotEmpty()
  relation!: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^\+?[0-9][0-9\s-]{6,19}$/, {
    message: 'primaryPhone must be a valid phone number',
  })
  primaryPhone!: string;

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

  @IsOptional()
  @IsBoolean()
  receivesAlerts?: boolean;
}

export class CreateAdmissionDto {
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
  academicYearId!: string;

  @IsString()
  classId!: string;

  @IsOptional()
  @IsString()
  sectionId?: string;

  @IsOptional()
  @IsString()
  admissionNumber?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  rollNumber?: number;

  @IsOptional()
  @IsString()
  nationality?: string;

  @IsOptional()
  @IsString()
  bloodGroup?: string;

  @IsOptional()
  @IsString()
  religion?: string;

  @IsOptional()
  @IsString()
  ethnicity?: string;

  @IsOptional()
  @IsString()
  citizenshipNo?: string;

  @IsOptional()
  @IsString()
  siblingStudentSystemId?: string;

  @IsOptional()
  @IsString()
  motherTongue?: string;

  @IsOptional()
  @IsString()
  disabilityFlag?: string;

  @IsOptional()
  @IsBoolean()
  confirmNoDisability?: boolean;

  @IsOptional()
  @IsString()
  mediumOfInstruction?: string;

  @IsOptional()
  @IsString()
  emergencyName?: string;

  @IsOptional()
  @IsString()
  emergencyPhone?: string;

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
  doctorName?: string;

  @IsOptional()
  @IsString()
  doctorPhone?: string;

  @IsOptional()
  @IsBoolean()
  confirmDuplicate?: boolean;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => GuardianInputDto)
  guardians!: GuardianInputDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UploadStudentDocumentDto)
  documents?: UploadStudentDocumentDto[];

  @IsOptional()
  @IsBoolean()
  createLogin?: boolean;

  @ValidateIf((dto: CreateAdmissionDto) => dto.createLogin === true)
  @IsEmail()
  email?: string;

  @ValidateIf((dto: CreateAdmissionDto) => dto.createLogin === true)
  @IsString()
  @MinLength(8)
  password?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  photo?: string;

  @IsOptional()
  @IsString()
  photoFileName?: string;
}
