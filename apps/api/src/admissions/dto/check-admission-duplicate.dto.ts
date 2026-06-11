import { IsArray, IsDateString, IsOptional, IsString } from 'class-validator';

export class CheckAdmissionDuplicateDto {
  @IsString()
  firstNameEn!: string;

  @IsString()
  lastNameEn!: string;

  @IsDateString()
  dateOfBirth!: string;

  @IsOptional()
  @IsString()
  firstNameNp?: string;

  @IsOptional()
  @IsString()
  lastNameNp?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  guardianPhones?: string[];

  @IsOptional()
  @IsString()
  excludeStudentId?: string;
}
