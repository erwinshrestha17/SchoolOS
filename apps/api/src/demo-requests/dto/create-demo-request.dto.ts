import {
  ArrayMaxSize,
  IsArray,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateDemoRequestDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  schoolName!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  schoolType!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  location!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  studentsCount!: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  branchesCount?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  contactName!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  role!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  phone!: string;

  @IsNotEmpty()
  @IsEmail()
  @MaxLength(160)
  email!: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  preferredContact?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  currentSystem?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  expectedTimeline!: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  interestedModules?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  message?: string;
}
