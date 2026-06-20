import { Gender } from '@prisma/client';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { UploadStudentDocumentDto } from '../../student-records/dto/upload-student-document.dto';
import {
  IsDateOfBirth,
  IsNepalPhone,
  IsPersonName,
  IsProfileEmail,
  NormalizeEmailAddress,
  NormalizeNepalPhone,
  NormalizePersonName,
} from '../../common/validation/contact-profile.decorators';

class GuardianInputDto {
  @IsString()
  @IsNotEmpty()
  @NormalizePersonName()
  @IsPersonName()
  fullName!: string;

  @IsString()
  @IsNotEmpty()
  relation!: string;

  @IsString()
  @IsNotEmpty()
  @NormalizeNepalPhone()
  @IsNepalPhone()
  primaryPhone!: string;

  @IsOptional()
  @IsString()
  @NormalizeNepalPhone()
  @IsNepalPhone()
  secondaryPhone?: string;

  @IsOptional()
  @NormalizeEmailAddress()
  @IsProfileEmail()
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
  @NormalizePersonName()
  @IsPersonName()
  emergencyName?: string;

  @IsOptional()
  @IsString()
  @NormalizeNepalPhone()
  @IsNepalPhone()
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
  @NormalizeNepalPhone()
  @IsNepalPhone()
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
  @NormalizeEmailAddress()
  @IsProfileEmail()
  email?: string;

  @ValidateIf((dto: CreateAdmissionDto) => dto.createLogin === true)
  @IsString()
  @MinLength(8)
  password?: string;

  @IsOptional()
  @IsString()
  @NormalizeNepalPhone()
  @IsNepalPhone()
  phone?: string;

  @IsOptional()
  @IsString()
  photo?: string;

  @IsOptional()
  @IsString()
  photoFileName?: string;
}
