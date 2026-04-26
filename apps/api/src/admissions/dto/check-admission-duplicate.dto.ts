import { IsDateString, IsOptional, IsString } from 'class-validator';

export class CheckAdmissionDuplicateDto {
  @IsString()
  firstNameEn!: string;

  @IsString()
  lastNameEn!: string;

  @IsDateString()
  dateOfBirth!: string;

  @IsOptional()
  @IsString()
  excludeStudentId?: string;
}
