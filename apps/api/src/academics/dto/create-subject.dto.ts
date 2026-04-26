import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreateSubjectDto {
  @IsString()
  classId!: string;

  @IsString()
  name!: string;

  @IsString()
  code!: string;

  @IsString()
  type!: string;

  @IsOptional()
  @IsBoolean()
  hasPractical?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  theoryMarks?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  practicalMarks?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  passMarks?: number;
}
