import { IsArray, IsOptional, IsString } from 'class-validator';
import { IsDateOfBirth } from '../../common/validation/contact-profile.decorators';

export class CheckAdmissionDuplicateDto {
  @IsString()
  firstNameEn!: string;

  @IsString()
  lastNameEn!: string;

  @IsDateOfBirth()
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
